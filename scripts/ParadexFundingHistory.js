#!/usr/bin/env node
/**
 * ParadexFundingStandard.js
 * Usage:
 *   node ParadexFundingStandard.js <COIN> [days]
 * Produit "paradex.csv" : date,oneHrFundingRate (format HL/Binance)
 */

const axios = require('axios');
const fs = require('fs');
const path = require('path');
const { createObjectCsvWriter } = require('csv-writer');

const BASE_URL = 'https://api.prod.paradex.trade/v1';

// 1. Récupère le funding_index à un timestamp précis
async function fetchFundingIndexAt(market, timestampMs) {
  try {
    const resp = await axios.get(`${BASE_URL}/funding/data`, {
      params: { market, end_at: timestampMs, page_size: 1 },
      headers: { Accept: 'application/json' },
      timeout: 20000,
    });
    const data = resp.data;
    if (data.results && data.results.length > 0) {
      const idxStr = data.results[0].funding_index;
      const idx = idxStr ? parseFloat(idxStr) : null;
      return isNaN(idx) ? null : idx;
    }
    return null;
  } catch (err) {
    console.error(`Funding API fail: ${err.message || err}`);
    return null;
  }
}

// 2. Récupère le prix moyen du mark sur 24h (pour convertir en ratio)
async function fetchDailyMarkPrice(symbol, dateMs) {
  const start = dateMs;
  const end = dateMs + 24 * 3600 * 1000;
  try {
    const url = `${BASE_URL}/markets/klines`;
    const params = {
      symbol,
      start_at: start,
      end_at: end,
      resolution: 60,   // 1 heure
      price_kind: 'mark'
    };
    const resp = await axios.get(url, {
      params,
      headers: { Accept: 'application/json' },
      timeout: 20000,
    });
    const results = resp.data.results;
    if (results && results.length > 0) {
      // Moyenne des (open+close)/2 horaires
      const prices = results.map(ohlc => (ohlc[1] + ohlc[4]) / 2);
      const avg = prices.reduce((a, b) => a + b, 0) / prices.length;
      return avg;
    }
    return null;
  } catch (err) {
    console.error(`MarkPrice API fail: ${err.message || err}`);
    return null;
  }
}

// 3. Array de minuit UTC (jours)
function computeDailyMidnights(days) {
  const res = [];
  const now = new Date();
  const today = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  for (let i = days; i >= 1; i--) {
    res.push(today - i * 24 * 3600 * 1000);
  }
  res.push(today); // dernier jour = aujourd'hui 00:00
  return res;
}

async function main() {
  const argv = process.argv.slice(2);
  if (argv.length < 1) {
    console.error('Usage: node ParadexFundingStandard.js <COIN> [days]');
    process.exit(1);
  }
  const coin = argv[0].toUpperCase();
  const days = argv[1] ? Number(argv[1]) : 30;
  if (isNaN(days) || days <= 0) {
    console.error('Le paramètre [days] doit être un nombre de jours positif.');
    process.exit(1);
  }
  const market = `${coin}-USD-PERP`;
  const symbol = market;
  const dayStamps = computeDailyMidnights(days);

  // Funding Index points à minuit UTC chaque jour
  let fundingIndexes = [];
  for (let i = 0; i < dayStamps.length; i++) {
    const idx = await fetchFundingIndexAt(market, dayStamps[i]);
    fundingIndexes.push({ ts: dayStamps[i], idx });
    await new Promise(r => setTimeout(r, 220));
  }

  // Résultat pour chaque jour
  const results = [];
  for (let i = 1; i < fundingIndexes.length; i++) {
    const d0 = fundingIndexes[i-1], d1 = fundingIndexes[i];
    if (d0.idx == null || d1.idx == null) continue;
    const deltaFunding = d1.idx - d0.idx; // funding payé (USDC par contrat) sur 24h

    // On récupère le prix moyen de la journée pour avoir le ratio (funding rate horaire)
    const price = await fetchDailyMarkPrice(symbol, d0.ts);
    if (!price) continue;
    // Funding rate ratio = delta / (price * 24)
    const oneHrFundingRate = deltaFunding / (price * 24);

    // Formatage date ISO (minuit)
    const dateIso = new Date(d0.ts).toISOString().slice(0, 10) + "T00:00:00.000Z";
    results.push({
      date: dateIso,
      oneHrFundingRate: oneHrFundingRate.toPrecision(17) // max précision "Binance"
    });
  }

  // Write CSV
  const outFile = path.resolve(process.cwd(), 'paradex.csv');
  const writer = createObjectCsvWriter({
    path: outFile,
    header: [
      { id: 'date', title: 'date' },
      { id: 'oneHrFundingRate', title: 'oneHrFundingRate' }
    ],
  });
  await writer.writeRecords(results);
  console.log(`CSV écrit: ${outFile}`);
}

main().catch(err => {
  console.error('Erreur inattendue:', err);
  process.exit(1);
});
