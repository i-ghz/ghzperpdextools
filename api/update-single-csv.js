// Fichier : api/update-single-csv.js

import { put, head } from '@vercel/blob';
import axios from 'axios';

/**
 * Cette fonction combine la logique de vos 4 scripts pour récupérer les données
 * de chaque source et les formater en CSV.
 */
async function fetchLatestData(source, token, days) {
  const nowMs = Date.now();
  const startTimeMs = nowMs - days * 24 * 60 * 60 * 1000;
  const endTimeMs = nowMs;
  let csv = 'date,funding_rate\n'; // En-tête du CSV

  console.log(`[Fetcher] Demande pour source=${source}, token=${token}, jours=${days}`);

  switch (source) {
    // --- Logique pour HYPERLIQUID ---
    case 'hyperliquid': {
      const market = token;
      const payload = { type: "fundingHistory", coin: market, startTime: startTimeMs, endTime: endTimeMs };
      try {
        const resp = await axios.post('https://api.hyperliquid.xyz/info', payload, { headers: { 'Content-Type': 'application/json' } });
        if (Array.isArray(resp.data)) {
          resp.data.forEach(r => {
            const date = new Date(Number(r.time)).toISOString();
            csv += `${date},${r.fundingRate}\n`;
          });
        }
      } catch (err) {
        console.error(`[Fetcher] Erreur Hyperliquid pour ${token}:`, err.message);
      }
      return csv;
    }

    // --- Logique pour VEST ---
    case 'vest': {
      const market = `${token}-PERP`;
      const url = `https://serverprod.vest.exchange/v2/funding/history`;
      const totalHours = days * 24;
      try {
        const resp = await axios.get(url, { params: { symbol: market, startTime: startTimeMs, endTime: endTimeMs, interval: '1h', limit: totalHours } });
        if (Array.isArray(resp.data)) {
          resp.data.forEach(r => {
            csv += `${r.time},${r.oneHrFundingRate}\n`;
          });
        }
      } catch (err) {
        console.error(`[Fetcher] Erreur Vest pour ${token}:`, err.message);
      }
      return csv;
    }

    // --- Logique pour EXTENDED ---
    case 'extended': {
        const market = `${token}-USD`; // Le nom de marché pour Extended
        let allEntries = [];
        let cursor = null;
        try {
            while (true) {
                const url = `https://api.extended.exchange/api/v1/info/${encodeURIComponent(market)}/funding`;
                const params = { startTime: startTimeMs, endTime: endTimeMs, limit: 10000 };
                if (cursor) params.cursor = cursor;

                const resp = await axios.get(url, { params });
                const body = resp.data;
                
                if (body && body.status === 'OK' && Array.isArray(body.data) && body.data.length > 0) {
                    allEntries.push(...body.data);
                    cursor = body.pagination?.cursor;
                    if (!cursor || body.data.length < 10000) break;
                } else {
                    break;
                }
            }
            allEntries.forEach(r => {
                const date = new Date(Number(r.T)).toISOString();
                csv += `${date},${r.f}\n`;
            });
        } catch (err) {
            console.error(`[Fetcher] Erreur Extended pour ${token}:`, err.message);
        }
        return csv;
    }

    // --- Logique pour PARADEX ---
    case 'paradex': {
      const market = `${token}-USD-PERP`;
      try {
          // La logique Paradex est complexe et calcule une moyenne journalière
          const dayStamps = [];
          for (let i = days; i >= 0; i--) {
            const d = new Date(nowMs - i * 24 * 3600 * 1000);
            dayStamps.push(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
          }
          
          let fundingIndexes = [];
          for (const ts of dayStamps) {
              const resp = await axios.get(`https://api.prod.paradex.trade/v1/funding/data`, { params: { market, end_at: ts, page_size: 1 } });
              fundingIndexes.push({ ts, idx: (resp.data.results && resp.data.results.length > 0) ? parseFloat(resp.data.results[0].funding_index) : null });
          }

          for (let i = 1; i < fundingIndexes.length; i++) {
              const d0 = fundingIndexes[i - 1], d1 = fundingIndexes[i];
              if (d0.idx == null || d1.idx == null) continue;
              
              const deltaFunding = d1.idx - d0.idx;
              
              const priceResp = await axios.get(`https://api.prod.paradex.trade/v1/markets/summary`);
              const marketSummary = priceResp.data.results.find(m => m.symbol === market);
              const price = marketSummary ? parseFloat(marketSummary.mark_price) : 1;

              if (price > 0) {
                  const oneHrFundingRate = deltaFunding / (price * 24);
                  const date = new Date(d0.ts).toISOString();
                  csv += `${date},${oneHrFundingRate}\n`;
              }
          }
      } catch (err) {
          console.error(`[Fetcher] Erreur Paradex pour ${token}:`, err.message);
      }
      return csv;
    }

    default:
      console.warn(`[Fetcher] Source non reconnue: ${source}`);
      return csv;
  }
}


/**
 * Handler principal de la fonction Serverless Vercel
 * Il ne devrait pas y avoir besoin de modifier ce qui suit.
 */
export default async function handler(request, response) {
  if (request.headers.authorization !== `Bearer ${process.env.CRON_SECRET}`) {
    return response.status(401).json({ error: 'Unauthorized' });
  }

  const { token, source } = request.query;
  if (!token || !source) {
    return response.status(400).json({ error: 'Les paramètres "token" et "source" sont requis' });
  }

  const pathname = `csv/${token.toLowerCase()}-${source.toLowerCase()}.csv`;
  console.log(`[WORKER] Démarrage pour : ${pathname}`);

  try {
    let existingCsv = '';
    let lastTimestamp = null;

    try {
      const blobInfo = await head(pathname);
      if (blobInfo.url) {
        const fileResponse = await fetch(blobInfo.url);
        existingCsv = await fileResponse.text();
        const lines = existingCsv.trim().split('\n');
        if (lines.length > 1) {
          lastTimestamp = lines[lines.length - 1].split(',')[0];
        }
        console.log(`[WORKER] Fichier existant trouvé. Dernier timestamp : ${lastTimestamp}`);
      }
    } catch (error) {
      if (error.response?.status !== 404) throw error; // Ignorer l'erreur 404 (fichier non trouvé)
      console.log(`[WORKER] Fichier non trouvé pour ${pathname}. Il sera créé.`);
    }

    let daysToFetch = 30;
    if (lastTimestamp) {
      const diffTime = new Date() - new Date(lastTimestamp);
      daysToFetch = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 2;
    }
    console.log(`[WORKER] Récupération des ${daysToFetch} derniers jours de données.`);

    const newCsvData = await fetchLatestData(source, token, daysToFetch);
    const newLines = newCsvData.trim().split('\n');
    
    if (newLines.length <= 1) {
        console.log(`[WORKER] Pas de nouvelles données à ajouter pour ${pathname}.`);
        return response.status(200).json({ message: 'No new data to add.' });
    }

    const existingLines = existingCsv ? existingCsv.trim().split('\n') : [newLines[0]];
    const existingTimestamps = new Set(existingLines.slice(1).map(line => line.split(',')[0]));
    
    const linesToAppend = newLines.slice(1).filter(line => {
      const timestamp = line.split(',')[0];
      return timestamp && !existingTimestamps.has(timestamp);
    });

    if (linesToAppend.length === 0) {
      console.log(`[WORKER] Pas de nouvelles données uniques à ajouter pour ${pathname}.`);
      return response.status(200).json({ message: 'No new unique data to add.' });
    }

    const finalCsvContent = (existingCsv.trim() || newLines[0]) + '\n' + linesToAppend.join('\n');
    
    await put(pathname, finalCsvContent.trim() + '\n', {
      access: 'public',
      addRandomSuffix: false,
    });
    
    console.log(`[WORKER] Succès : ${linesToAppend.length} ligne(s) ajoutée(s) à ${pathname}.`);
    return response.status(200).json({ success: true, message: `${linesToAppend.length} line(s) added.` });

  } catch (error) {
    console.error(`[WORKER] Erreur critique pour ${pathname}:`, error);
    return response.status(500).json({ error: error.message || "Erreur inconnue" });
  }
}