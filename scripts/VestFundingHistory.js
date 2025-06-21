#!/usr/bin/env node

/**
 * Usage:
 *   node vestFundingHistoryDaily.js <COIN> [days]
 *
 * Exemples:
 *   node vestFundingHistoryDaily.js BTC 1
 *     -> récupère les 24 dernières heures pour "BTC-PERP", calcule moyenne journalière,
 *        produit "vest.csv".
 *
 *   node vestFundingHistoryDaily.js ETH 7
 *     -> récupère les 7 derniers jours pour "ETH-PERP", puis calcule moyenne journalière,
 *        produit "vest.csv".
 *
 * Remarque : chaque exécution écrase le fichier `vest.csv` existant dans le dossier de lancement.
 */

const axios = require('axios');
const fs = require('fs');
const path = require('path');

/**
 * Récupère jusqu’à remainingHours points horaires pour le symbole donné, à partir de startTimeMs,
 * en découpant en chunks d’au plus 1000 points pour éviter les limites API Vest.
 * 
 * @param {string} symbol - symbole Vest, ex "BTC-PERP"
 * @param {number} startTimeMs - timestamp ms UTC indiquant le début de récupération
 * @param {number} remainingHours - nombre total d’heures à récupérer
 * @returns {Promise<Array>} - tableau d’objets { time: string ou timestamp, oneHrFundingRate: nombre/string }
 */
async function fetchVestFunding(symbol, startTimeMs, remainingHours) {
  const url = 'https://serverprod.vest.exchange/v2/funding/history';
  const allPoints = [];

  let cursorStart = startTimeMs;
  let hoursLeft = remainingHours;

  while (hoursLeft > 0) {
    const chunkSize = Math.min(hoursLeft, 1000);
    const params = {
      symbol,
      startTime: cursorStart,
      endTime: cursorStart + chunkSize * 3600 * 1000,
      interval: '1h',
      limit: chunkSize
    };

    console.log(`→ Récupération Vest chunk: startTime=${new Date(cursorStart).toISOString()}, limit=${chunkSize}`);
    try {
      const resp = await axios.get(url, { params });
      const data = resp.data;
      if (!Array.isArray(data) || data.length === 0) {
        console.log(`  Pas de donnée retournée (ou tableau vide). Arrêt de la boucle.`);
        break;
      }
      allPoints.push(...data);

      // Avancer le curseur après le dernier point pour éviter doublons
      const lastPt = data[data.length - 1];
      const lastTimeMs = new Date(lastPt.time).getTime();
      cursorStart = lastTimeMs + 1;
      hoursLeft -= data.length;

      if (data.length < chunkSize) {
        console.log(`  Chunk retourné moins d’éléments (${data.length} < ${chunkSize}), fin.`);
        break;
      }
      // Petite pause avant le chunk suivant
      await new Promise(res => setTimeout(res, 200));
    } catch (err) {
      console.error('Erreur lors de la requête Vest funding history:', err.response?.data || err.message);
      break;
    }
  }

  return allPoints;
}

/**
 * À partir d’un tableau de points horaires triés, calcule la moyenne journalière (UTC).
 * 
 * @param {Array} hourlyPoints - tableau d’objets { time: string (ISO) ou timestamp, oneHrFundingRate: nombre/string }
 * @returns {Array} dailyAverages - tableau d’objets { dayStart: number (ms UTC), avgDailyRate: number|null }
 *   Pour chaque jour couvert par les données, avgDailyRate = moyenne des oneHrFundingRate pour les heures valides.
 */
function computeDailyAveragesFromHourlyVest(hourlyPoints) {
  if (hourlyPoints.length === 0) return [];

  // Map pour agréger par jour UTC: clé = timestamp ms du début de jour UTC, valeur = { sum, count }
  const aggDay = new Map();

  // Parcours des points horaires
  for (const pt of hourlyPoints) {
    const tms = new Date(pt.time).getTime();
    if (isNaN(tms)) continue;
    // Floor au début de jour UTC
    const dt = new Date(tms);
    const dayStart = Date.UTC(dt.getUTCFullYear(), dt.getUTCMonth(), dt.getUTCDate());
    // parse rate
    const rate = parseFloat(pt.oneHrFundingRate);
    if (isNaN(rate)) continue;
    if (!aggDay.has(dayStart)) {
      aggDay.set(dayStart, { sum: rate, count: 1 });
    } else {
      const rec = aggDay.get(dayStart);
      rec.sum += rate;
      rec.count += 1;
    }
  }

  // Déterminer la plage de jours à couvrir: du premier jour au dernier jour inclus
  const firstTime = new Date(hourlyPoints[0].time).getTime();
  const lastTime = new Date(hourlyPoints[hourlyPoints.length - 1].time).getTime();
  const firstDay = Date.UTC(new Date(firstTime).getUTCFullYear(),
                            new Date(firstTime).getUTCMonth(),
                            new Date(firstTime).getUTCDate());
  const lastDay = Date.UTC(new Date(lastTime).getUTCFullYear(),
                           new Date(lastTime).getUTCMonth(),
                           new Date(lastTime).getUTCDate());
  const results = [];
  for (let d = firstDay; d <= lastDay; d += 24 * 3600 * 1000) {
    if (aggDay.has(d)) {
      const { sum, count } = aggDay.get(d);
      if (count > 0) {
        results.push({ dayStart: d, avgDailyRate: sum / count });
      } else {
        results.push({ dayStart: d, avgDailyRate: null });
      }
    } else {
      results.push({ dayStart: d, avgDailyRate: null });
    }
  }
  return results;
}

async function main() {
  const argv = process.argv.slice(2);
  if (argv.length < 1 || argv.includes('-h') || argv.includes('--help')) {
    console.log('Usage: node vestFundingHistoryDaily.js <COIN> [days]');
    console.log('Exemple: node vestFundingHistoryDaily.js BTC 7');
    process.exit(0);
  }
  const coin = argv[0].toUpperCase();  // ex "BTC"
  const days = argv[1] ? Number(argv[1]) : 1;
  if (isNaN(days) || days <= 0) {
    console.error('Le nombre de jours doit être un nombre positif');
    process.exit(1);
  }

  // Construire le symbole Vest automatiquement : "<COIN>-PERP"
  const symbol = `${coin}-PERP`;
  const nowMs = Date.now();
  const totalHours = days * 24;
  const startTimeMs = nowMs - totalHours * 3600 * 1000;

  console.log(`Récupération Vest funding pour ${symbol}, derniers ${days} jour(s) (~${totalHours} points horaires)`);

  // 1. Récupération des points horaires
  const hourlyPoints = await fetchVestFunding(symbol, startTimeMs, totalHours);
  if (!hourlyPoints || hourlyPoints.length === 0) {
    console.error('Aucune donnée récupérée.');
    process.exit(1);
  }

  // 2. Tri par time ascendant
  hourlyPoints.sort((a, b) => {
    const ta = new Date(a.time).getTime();
    const tb = new Date(b.time).getTime();
    return ta - tb;
  });
  console.log(`Total points horaires reçus: ${hourlyPoints.length}`);

  // 3. Calcul des moyennes journalières
  const dailyAverages = computeDailyAveragesFromHourlyVest(hourlyPoints);
  console.log(`Jours couverts: ${dailyAverages.length}. Exemples:`);
  dailyAverages.slice(0, 5).forEach(d => {
    console.log(`  ${new Date(d.dayStart).toISOString().slice(0,10)} → ${d.avgDailyRate}`);
  });

  // 4. Écriture CSV quotidien : fichier toujours nommé "vest.csv"
  const outFilename = 'vest.csv';
  const outPath = path.resolve(process.cwd(), outFilename);
  const header = 'date,oneHrFundingRate';
  const lines = dailyAverages.map(d => {
    // date au début du jour UTC, ex "2025-06-20T00:00:00.000Z"
    const isoDay = new Date(d.dayStart).toISOString();
    const rateStr = (d.avgDailyRate != null) ? d.avgDailyRate.toString() : '';
    return `${isoDay},${rateStr}`;
  });
  const csvContent = header + '\n' + lines.join('\n') + '\n';

  try {
    fs.writeFileSync(outPath, csvContent);
    console.log(`→ Fichier CSV journalier écrit : ${outFilename} (${dailyAverages.length} lignes)`);
  } catch (err) {
    console.error('Erreur écriture du fichier CSV:', err);
    process.exit(1);
  }
}

// Exécution si lancé directement
if (require.main === module) {
  main().catch(err => {
    console.error('Erreur inattendue:', err);
    process.exit(1);
  });
}

module.exports = { fetchVestFunding, computeDailyAveragesFromHourlyVest };
