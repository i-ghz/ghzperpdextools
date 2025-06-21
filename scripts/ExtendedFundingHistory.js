#!/usr/bin/env node

/**
 * ExtendedFundingHistoryDaily.js
 *
 * Usage:
 *   node ExtendedFundingHistoryDaily.js <COIN_OR_MARKET> [days]
 *
 * Exemples:
 *   node ExtendedFundingHistoryDaily.js BTC 30
 *     -> récupère les 30 derniers jours pour BTC-USD, écrit extended.csv
 *   node ExtendedFundingHistoryDaily.js ETH-USD 7
 *     -> récupère les 7 derniers jours pour ETH-USD, écrit extended.csv
 *   node ExtendedFundingHistoryDaily.js LTC 1
 *     -> récupère le dernier jour pour LTC-USD
 *
 * Remarque :
 * - L’API Extended est interrogée via GET https://api.extended.exchange/api/v1/info/{market}/funding
 *   avec paramètres startTime, endTime, limit et éventuellement cursor pour paginer.
 * - L’API retourne jusqu’à `limit` enregistrements triés par timestamp descendant.
 * - Les enregistrements ont la forme { m: string, T: number, f: string }.
 *   - `m`: market (ex. "BTC-USD")
 *   - `T`: timestamp en ms UNIX (ici l’exemple retourné l’utilise déjà ms)
 *   - `f`: funding rate appliqué (string convertible en float)
 * - Le script pagine tant qu’il y a un champ `pagination.cursor` non null (et tant que data.length == limit).
 * - On trie ensuite ascendant par timestamp, on agrège par jour UTC (floor à minuit UTC), moyenne de `f`.
 * - On écrit `extended.csv` avec en-tête `date,oneHrFundingRate` et date au format ISO UTC début de jour.
 */

const axios = require('axios');
const fs = require('fs');
const path = require('path');

const BASE_URL = 'https://api.extended.exchange'; // API Extended

/**
 * Récupère une page de funding history pour `market` entre startTime et endTime.
 * @param {string} market         nom du marché (ex. 'BTC-USD')
 * @param {number} startTimeMs    timestamp ms UTC de début (inclus)
 * @param {number} endTimeMs      timestamp ms UTC de fin (inclus)
 * @param {string|number|null} cursor    valeur de cursor pour pagination, ou null pour première page
 * @param {number} limit          nombre max d’enregistrements à demander (<=10000)
 * @returns {Promise<{data: Array, pagination: {cursor: string|null, count: number}}>}
 *   - data: tableau d’enregistrements bruts { m, T, f }
 *   - pagination.cursor: valeur pour la page suivante, ou null si plus de page
 */
async function fetchFundingPage(market, startTimeMs, endTimeMs, cursor = null, limit = 10000) {
  const url = `${BASE_URL}/api/v1/info/${encodeURIComponent(market)}/funding`;
  const params = {
    startTime: startTimeMs,
    endTime: endTimeMs,
    limit
  };
  if (cursor != null) {
    params.cursor = cursor;
  }
  try {
    const resp = await axios.get(url, { params, timeout: 30000 });
    const body = resp.data;
    if (!body || typeof body !== 'object' || body.status !== 'OK' || !Array.isArray(body.data)) {
      console.warn(`fetchFundingPage: réponse inattendue pour ${market}:`, body);
      return { data: [], pagination: { cursor: null, count: 0 } };
    }
    const pagination = body.pagination || {};
    // pagination.cursor peut être number ou string, ou absent/null
    const nextCursor = pagination.cursor != null ? pagination.cursor : null;
    const count = pagination.count != null ? pagination.count : body.data.length;
    return { data: body.data, pagination: { cursor: nextCursor, count } };
  } catch (err) {
    console.error(`Erreur fetchFundingPage pour ${market}:`, err.response?.data || err.message);
    return { data: [], pagination: { cursor: null, count: 0 } };
  }
}

/**
 * Récupère toutes les entrées de funding history pour market entre startTimeMs et endTimeMs.
 * Paginer tant que l’API renvoie un cursor non-null et retourne data.length == limit.
 *
 * @param {string} market
 * @param {number} startTimeMs
 * @param {number} endTimeMs
 * @returns {Promise<Array>} tableau d’objets bruts { m, T, f }
 */
async function fetchAllFundingExtended(market, startTimeMs, endTimeMs) {
  let allEntries = [];
  let cursor = null;
  let page = 0;
  const LIMIT = 10000; // max renvoyé par page
  console.log(`Démarrage fetch Extended funding pour market=${market}`);
  console.log(`  startTime (UTC) = ${new Date(startTimeMs).toISOString()}`);
  console.log(`  endTime   (UTC) = ${new Date(endTimeMs).toISOString()}`);
  do {
    page++;
    console.log(`  Requête page ${page}, cursor=${cursor}`);
    const { data, pagination } = await fetchFundingPage(market, startTimeMs, endTimeMs, cursor, LIMIT);
    if (!data || data.length === 0) {
      console.log(`    Page ${page}: pas de données retournées, arrêt.`);
      break;
    }
    allEntries.push(...data);
    cursor = pagination.cursor;
    // Si pagination.cursor est null ou moins de LIMIT enregistrements retournés, on arrête
    if (cursor == null || data.length < LIMIT) {
      console.log(`    Page ${page}: fin de pagination (cursor null ou data.length < LIMIT).`);
      break;
    }
    // pause courte pour ne pas surcharger l’API
    await new Promise(res => setTimeout(res, 200));
  } while (true);

  console.log(`Total récupéré: ${allEntries.length} enregistrements bruts.`);
  // L’API renvoie en ordre descendant sur T. On trie ascendant pour traitement.
  allEntries.sort((a, b) => {
    // T semble déjà en ms (d’après test curl) ; sinon vérifier longueur et multiplier par 1000 si nécessaire
    let ta = Number(a.T);
    let tb = Number(b.T);
    if (String(a.T).length <= 10) { ta = ta * 1000; }
    if (String(b.T).length <= 10) { tb = tb * 1000; }
    return ta - tb;
  });
  return allEntries;
}

/**
 * Calcule la moyenne journalière (UTC) du fundingRate à partir des enregistrements bruts.
 * @param {Array} entriesBruts - tableau { m, T, f }
 * @returns {Array} dailyArray - tableau { date: Date UTC minuit, avgFundingRate: Number }
 *   Trié par date ascendante.
 */
function computeDailyAveragesExtended(entriesBruts) {
  const dailyMap = new Map();
  for (const item of entriesBruts) {
    let tms = Number(item.T);
    if (isNaN(tms)) continue;
    // Si T en secondes (10-digit), convert to ms
    if (String(item.T).length <= 10) {
      tms = tms * 1000;
    }
    const dt = new Date(tms);
    if (isNaN(dt.getTime())) continue;
    const fr = parseFloat(item.f);
    if (isNaN(fr)) continue;
    // floor UTC jour
    const year = dt.getUTCFullYear();
    const month = dt.getUTCMonth() + 1;
    const day = dt.getUTCDate();
    const key = `${year.toString().padStart(4,'0')}-${month.toString().padStart(2,'0')}-${day.toString().padStart(2,'0')}`;
    if (!dailyMap.has(key)) {
      dailyMap.set(key, { sumFR: fr, count: 1 });
    } else {
      const rec = dailyMap.get(key);
      rec.sumFR += fr;
      rec.count += 1;
    }
  }
  // Transformer en tableau trié
  const dailyArray = Array.from(dailyMap.entries())
    .map(([key, { sumFR, count }]) => {
      const [year, month, day] = key.split('-').map(s => parseInt(s, 10));
      const dateUtc = new Date(Date.UTC(year, month - 1, day, 0, 0, 0));
      const avgFR = sumFR / count;
      return { date: dateUtc, avgFundingRate: avgFR };
    })
    .sort((a, b) => a.date - b.date);
  return dailyArray;
}

function usageAndExit() {
  console.error('Usage: node ExtendedFundingHistoryDaily.js <COIN_OR_MARKET> [days]');
  process.exit(1);
}

async function main() {
  const argv = process.argv.slice(2);
  if (argv.length < 1 || argv.includes('-h') || argv.includes('--help')) {
    console.log('Usage: node ExtendedFundingHistoryDaily.js <COIN_OR_MARKET> [days]');
    console.log('Exemple: node ExtendedFundingHistoryDaily.js BTC 7');
    console.log('         node ExtendedFundingHistoryDaily.js ETH-USD 30');
    process.exit(0);
  }
  let input = argv[0].toUpperCase();
  // Si pas de tiret dans input, on complète en "-USD"
  if (!input.includes('-')) {
    input = input + '-USD';
  }
  const market = input;
  const days = argv[1] ? Number(argv[1]) : 1;
  if (isNaN(days) || days <= 0) {
    console.error('Le paramètre [days] doit être un nombre positif.');
    process.exit(1);
  }
  const nowMs = Date.now();
  const startTimeMs = nowMs - days * 24 * 60 * 60 * 1000;
  const endTimeMs = nowMs;

  // 1. Récupérer toutes les entrées brutes
  const entriesBruts = await fetchAllFundingExtended(market, startTimeMs, endTimeMs);
  if (!entriesBruts || entriesBruts.length === 0) {
    console.error('Aucune donnée récupérée pour la période demandée.');
    process.exit(1);
  }

  // 2. Calcul des moyennes journalières
  const dailyArray = computeDailyAveragesExtended(entriesBruts);
  if (dailyArray.length === 0) {
    console.error('Aucun jour avec données valides.');
    process.exit(1);
  }

  // 3. Écrire CSV fixe "extended.csv"
  const outFilename = 'extended.csv';
  const outPath = path.resolve(process.cwd(), outFilename);
  const header = 'date,oneHrFundingRate';
  const lines = dailyArray.map(item => {
    const isoDay = item.date.toISOString().split('T')[0] + 'T00:00:00.000Z';
    return `${isoDay},${item.avgFundingRate}`;
  });
  const csvContent = [header, ...lines].join('\n') + '\n';
  try {
    fs.writeFileSync(outPath, csvContent);
    console.log(`CSV journalier écrit avec succès: ${outFilename} (${dailyArray.length} jours)`);
  } catch (err) {
    console.error('Erreur écriture CSV:', err);
    process.exit(1);
  }
}

if (require.main === module) {
  main().catch(err => {
    console.error('Erreur inattendue:', err);
    process.exit(1);
  });
}

module.exports = { fetchAllFundingExtended, computeDailyAveragesExtended };
