#!/usr/bin/env node

/**
 * HyperliquidFundingHistoryDaily.js
 *
 * Usage:
 *   node HyperliquidFundingHistoryDaily.js <COIN> [days]
 *
 * Exemples:
 *   node HyperliquidFundingHistoryDaily.js ETH 30
 *     -> récupère les 30 derniers jours de fundingHistory pour ETH, écrit hyperliquid.csv
 *
 *   node HyperliquidFundingHistoryDaily.js BTC
 *     -> récupère 1 jour par défaut si [days] non fourni, écrit hyperliquid.csv
 *
 * Remarques :
 * - L’API Hyperliquid attend un POST JSON vers https://api.hyperliquid.xyz/info
 *   avec body { type: "fundingHistory", coin: "<COIN>", startTime: <ms>, endTime: <ms> }.
 * - On découpe la période en tranches de chunkDays (7 jours) pour éviter timeouts/limites.
 * - Le CSV produit est nommé `hyperliquid.csv`, colonnes `date,oneHrFundingRate`.
 */

const axios = require('axios');
const fs = require('fs');
const path = require('path');

/**
 * Envoie un POST pour récupérer le fundingHistory pour coin, entre startTimeMs et endTimeMs.
 * Retourne un tableau d’objets bruts (attendus { coin, fundingRate: string, premium: string, time: number }).
 */
async function fetchFundingHistoryChunk(coin, startTimeMs, endTimeMs) {
  const url = 'https://api.hyperliquid.xyz/info';
  const payload = {
    type: "fundingHistory",
    coin: coin,
    startTime: startTimeMs,
    endTime: endTimeMs
  };
  try {
    const resp = await axios.post(url, payload, {
      headers: { 'Content-Type': 'application/json' },
      timeout: 30000,
    });
    if (!Array.isArray(resp.data)) {
      console.warn(
        `fetchFundingHistoryChunk: réponse inattendue pour ${coin} [${new Date(startTimeMs).toISOString()} - ${new Date(endTimeMs).toISOString()}]:`,
        resp.data
      );
      return [];
    }
    return resp.data;
  } catch (err) {
    console.error(
      `Erreur lors du POST fundingHistory pour ${coin} [${new Date(startTimeMs).toISOString()} - ${new Date(endTimeMs).toISOString()}]:`,
      err.response?.data || err.message
    );
    return [];
  }
}

/**
 * Récupère la funding history complète pour coin sur la période [startTimeMs, endTimeMs],
 * en la découpant par tranches de chunkDays jours.
 * Retourne l’agrégation des tableaux retournés.
 */
async function fetchFundingHistory(coin, startTimeMs, endTimeMs, chunkDays = 7) {
  const results = [];
  const chunkMs = chunkDays * 24 * 60 * 60 * 1000;
  let sliceStart = startTimeMs;
  while (sliceStart < endTimeMs) {
    const sliceEnd = Math.min(sliceStart + chunkMs, endTimeMs);
    console.log(
      `Récupération ${coin} fundingHistory de ${new Date(sliceStart).toISOString()} à ${new Date(sliceEnd).toISOString()}`
    );
    const chunkData = await fetchFundingHistoryChunk(coin, sliceStart, sliceEnd);
    if (chunkData.length > 0) {
      results.push(...chunkData);
    }
    // Pause pour ne pas trop harceler l’API
    await new Promise(res => setTimeout(res, 500));
    sliceStart = sliceEnd + 1;
  }
  return results;
}

/**
 * Calcule la moyenne journalière (UTC) du fundingRate à partir des données brutes renvoyées par l’API.
 * 
 * @param {Array} rawData - tableau d’objets { coin, fundingRate: string, premium: string, time: number }
 * @returns {Array} dailyArray - tableau d’objets { date: Date (UTC minuit), avgFundingRate: number }
 *   Trié par date ascendante.
 */
function computeDailyAverages(rawData) {
  // Map par clé "YYYY-MM-DD" UTC, valeur { sumFR, count }
  const dailyMap = new Map();
  rawData.forEach(item => {
    const tms = Number(item.time);
    const fr = parseFloat(item.fundingRate);
    if (isNaN(tms) || isNaN(fr)) {
      return;
    }
    const dt = new Date(tms);
    // Construire clé UTC "YYYY-MM-DD"
    const year = dt.getUTCFullYear();
    const month = dt.getUTCMonth() + 1; // 1-12
    const day = dt.getUTCDate();
    const key = `${year.toString().padStart(4,'0')}-${month.toString().padStart(2,'0')}-${day.toString().padStart(2,'0')}`;
    if (!dailyMap.has(key)) {
      dailyMap.set(key, { sumFR: fr, count: 1 });
    } else {
      const rec = dailyMap.get(key);
      rec.sumFR += fr;
      rec.count += 1;
    }
  });
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
  console.error('Usage: node HyperliquidFundingHistoryDaily.js <COIN> [days]');
  process.exit(1);
}

async function main() {
  const argv = process.argv.slice(2);
  if (argv.length < 1 || argv.includes('-h') || argv.includes('--help')) {
    console.log('Usage: node HyperliquidFundingHistoryDaily.js <COIN> [days]');
    console.log('Exemple: node HyperliquidFundingHistoryDaily.js ETH 7');
    process.exit(0);
  }
  const coin = argv[0].toUpperCase();
  const days = argv[1] ? Number(argv[1]) : 1;
  if (isNaN(days) || days <= 0) {
    console.error('Le paramètre [days] doit être un nombre positif.');
    process.exit(1);
  }
  const nowMs = Date.now();
  const startTimeMs = nowMs - days * 24 * 60 * 60 * 1000;
  const endTimeMs = nowMs;

  console.log(`--- Hyperliquid fundingHistory pour ${coin}, des ${days} derniers jours ---`);
  const chunkDays = 7;
  const rawData = await fetchFundingHistory(coin, startTimeMs, endTimeMs, chunkDays);

  if (!rawData || rawData.length === 0) {
    console.error('Aucune donnée récupérée pour la période demandée.');
    process.exit(1);
  }

  // Normalisation: on ne garde que time et fundingRate
  // rawData est supposé : { coin, fundingRate: string, premium: string, time: number }
  // On filtre les entrées invalides dans computeDailyAverages.
  const dailyArray = computeDailyAverages(rawData);

  if (dailyArray.length === 0) {
    console.error('Aucun jour avec données valides.');
    process.exit(1);
  }

  // Écriture CSV dans fichier fixe "hyperliquid.csv"
  const outFilename = 'hyperliquid.csv';
  const outPath = path.resolve(process.cwd(), outFilename);
  const header = 'date,oneHrFundingRate';
  const lines = dailyArray.map(item => {
    // ISO UTC début de journée : YYYY-MM-DDT00:00:00.000Z
    const isoDay = item.date.toISOString().split('T')[0] + 'T00:00:00.000Z';
    return `${isoDay},${item.avgFundingRate}`;
  });
  const csvContent = [header, ...lines].join('\n') + '\n';

  try {
    fs.writeFileSync(outPath, csvContent);
    console.log(`CSV quotidien écrit avec succès: ${outFilename} (${dailyArray.length} jours)`);
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

module.exports = { fetchFundingHistory, computeDailyAverages };
