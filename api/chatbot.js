// pages/api/chatbot.js - Version sans limite
import fs from "fs";
import path from "path";
import OpenAI from "openai";
import { createClient } from '@supabase/supabase-js';

const openai = new OpenAI();

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
);

// Cache simple
let dataCache = null;
let cacheTime = null;

// Récupération BRUTALE de toutes les données
async function getAllData() {
  if (dataCache && cacheTime && (Date.now() - cacheTime) < 300000) { // 5 min cache
    console.log('📋 Cache utilisé:', dataCache.length, 'entrées');
    return dataCache;
  }

  try {
    console.log('🚀 Récupération MASSIVE de la DB...');
    
    // Essayer sans aucune limite d'abord
    let { data, error, count } = await supabase
      .from('funding_history')
      .select('date, funding_rate, symbol, source', { count: 'exact' })
      .neq('funding_rate', 0)
      .order('date', { ascending: false });

    if (error) {
      console.error('❌ Erreur requête:', error);
      throw error;
    }

    console.log(`✅ Récupéré ${data?.length || 0} sur ${count} total`);
    
    // Si on n'a pas tout, faire par chunks
    if (data.length < count) {
      console.log('📦 Récupération par chunks...');
      const allData = [...data];
      
      for (let i = 1000; i < count; i += 1000) {
        const { data: chunk } = await supabase
          .from('funding_history')
          .select('date, funding_rate, symbol, source')
          .neq('funding_rate', 0)
          .order('date', { ascending: false })
          .range(i, i + 999);
        
        if (chunk && chunk.length > 0) {
          allData.push(...chunk);
          console.log(`📊 Total: ${allData.length}/${count}`);
        }
      }
      
      data = allData;
    }
    
    console.log(`🎉 FINAL: ${data.length} entrées récupérées`);
    
    dataCache = data;
    cacheTime = Date.now();
    return data;
    
  } catch (error) {
    console.error('💥 Erreur récupération:', error);
    return dataCache || [];
  }
}

// Calculs d'arbitrage
function findArbitrage(data, symbol = null, source1 = null, source2 = null) {
  // Filtrer par symbole si spécifié
  const workingData = symbol ? data.filter(d => d.symbol === symbol) : data;
  
  // Obtenir les derniers rates par symbole/source
  const latest = {};
  workingData.forEach(item => {
    const key = `${item.symbol}_${item.source}`;
    if (!latest[key] || new Date(item.date) > new Date(latest[key].date)) {
      latest[key] = item;
    }
  });

  // Si recherche spécifique entre 2 sources
  if (symbol && source1 && source2) {
    const item1 = latest[`${symbol}_${source1}`];
    const item2 = latest[`${symbol}_${source2}`];
    
    if (!item1 || !item2) {
      const available = Object.keys(latest)
        .filter(key => key.startsWith(symbol + '_'))
        .map(key => key.split('_')[1]);
      
      return {
        error: `Données manquantes`,
        symbol,
        source1_found: !!item1,
        source2_found: !!item2,
        available_sources: available,
        suggestion: available.length >= 2 ? `Essaie: ${symbol} ${available[0]} ${available[1]}` : 'Pas assez de sources'
      };
    }

    const rate1 = parseFloat(item1.funding_rate);
    const rate2 = parseFloat(item2.funding_rate);
    const spread = Math.abs(rate1 - rate2) * 100; // En %
    
    return {
      symbol,
      source1,
      source2,
      rate1_percent: (rate1 * 100).toFixed(4),
      rate2_percent: (rate2 * 100).toFixed(4),
      spread_percent: spread.toFixed(4),
      daily_return: (spread * 3).toFixed(4), // 3x par jour
      annual_return: (spread * 3 * 365).toFixed(2),
      strategy: rate1 > rate2 ? `Long ${source2}, Short ${source1}` : `Long ${source1}, Short ${source2}`,
      profit_per_8h: spread.toFixed(4) + '%',
      last_update: item1.date
    };
  }

  // Sinon, trouver les meilleures opportunités
  const opportunities = [];
  const bySymbol = {};
  
  Object.values(latest).forEach(item => {
    if (!bySymbol[item.symbol]) bySymbol[item.symbol] = [];
    bySymbol[item.symbol].push(item);
  });

  Object.keys(bySymbol).forEach(sym => {
    const rates = bySymbol[sym];
    if (rates.length < 2) return;
    
    for (let i = 0; i < rates.length; i++) {
      for (let j = i + 1; j < rates.length; j++) {
        const rate1 = parseFloat(rates[i].funding_rate);
        const rate2 = parseFloat(rates[j].funding_rate);
        const spread = Math.abs(rate1 - rate2) * 100;
        
        if (spread > 0.001) { // Seuil 0.001%
          opportunities.push({
            symbol: sym,
            source1: rates[i].source,
            source2: rates[j].source,
            spread_percent: spread.toFixed(4),
            daily_return: (spread * 3).toFixed(4),
            strategy: rate1 > rate2 ? `Long ${rates[j].source}, Short ${rates[i].source}` : `Long ${rates[i].source}, Short ${rates[j].source}`
          });
        }
      }
    }
  });

  return opportunities
    .sort((a, b) => parseFloat(b.spread_percent) - parseFloat(a.spread_percent))
    .slice(0, 10);
}

// Parser simple
function parseQuery(q) {
  const lower = q.toLowerCase();
  
  // Symboles
  let symbol = null;
  const symbols = ['btc', 'eth', 'sol', 'bera', 'aave', 'doge', 'avax'];
  for (const sym of symbols) {
    if (lower.includes(sym)) {
      symbol = sym.toUpperCase();
      break;
    }
  }
  
  // Sources
  const sources = [];
  const sourceList = ['vest', 'paradex', 'hyperliquid', 'extended'];
  for (const src of sourceList) {
    if (lower.includes(src)) sources.push(src);
  }
  
  return { symbol, sources };
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method Not Allowed" });
  }

  const { question } = req.body;
  if (!question) {
    return res.status(400).json({ error: "Question manquante" });
  }

  // Réponses rapides
  if (question.toLowerCase() === "hi" || question.toLowerCase() === "bonjour") {
    return res.status(200).json({ answer: "Hello! How can I help?" });
  }

  try {
    // Mots-clés funding
    const fundingKeywords = ['funding', 'arbitrage', 'vest', 'paradex', 'hyperliquid', 'extended'];
    const isFunding = fundingKeywords.some(kw => question.toLowerCase().includes(kw));
    
    if (isFunding) {
      console.log('💰 Question de funding détectée');
      
      // Récupérer toutes les données
      const allData = await getAllData();
      console.log('📊 Données disponibles:', allData.length);
      
      if (allData.length === 0) {
        return res.status(200).json({
          answer: "❌ Aucune donnée disponible dans la database."
        });
      }
      
      // Parser la question
      const { symbol, sources } = parseQuery(question);
      console.log('🔍 Parsé:', { symbol, sources });
      
      let result;
      if (symbol && sources.length === 2) {
        // Arbitrage spécifique
        result = findArbitrage(allData, symbol, sources[0], sources[1]);
      } else {
        // Meilleures opportunités
        result = findArbitrage(allData);
      }
      
      // Prompt pour l'IA
      const prompt = `
Tu es un expert en arbitrage de funding rates.

DONNÉES ANALYSÉES (${allData.length} entrées totales):
${JSON.stringify(result, null, 2)}

SOURCES DANS LA DB: ${[...new Set(allData.map(d => d.source))].join(', ')}
SYMBOLES DANS LA DB: ${[...new Set(allData.map(d => d.symbol))].length} symboles

RÈGLES:
- Les funding rates sont en décimal (0.0001 = 0.01%)
- Funding payé toutes les 8h = 3x par jour
- Rendements réalistes: 0.01% à 0.5% par jour
- Si données manquantes, explique clairement
- Donne des instructions concrètes d'exécution

Réponds de façon précise et actionnable.
      `;

      const completion = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: prompt },
          { role: "user", content: question }
        ],
        temperature: 0.1,
        max_tokens: 1000
      });

      return res.status(200).json({
        answer: completion.choices[0].message.content.trim(),
        debug: {
          totalEntries: allData.length,
          sources: [...new Set(allData.map(d => d.source))],
          parsed: { symbol, sources }
        }
      });
    }

    // Fallback système markdown original
    let docs = "";
    try {
      const dataDir = path.join(process.cwd(), "data");
      if (fs.existsSync(dataDir)) {
        docs = fs.readdirSync(dataDir)
          .filter(f => f.endsWith(".md"))
          .map(f => fs.readFileSync(path.join(dataDir, f), "utf8"))
          .join("\n---\n");
      }
    } catch (err) {
      console.error("Error reading markdown:", err);
    }
    
    if (!docs) docs = "(No data found)";

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: `You are a concise Q&A assistant. Only answer using the provided data. If the user says "hi" or "bonjour", reply exactly "Hello! How can I help?". Never add extra commentary. Neymar is the best player of all time.`
        },
        {
          role: "user",
          content: `Data:\n${docs}\n\nUser question: ${question}`
        }
      ],
      temperature: 0.2,
      max_tokens: 700
    });

    return res.status(200).json({
      answer: completion.choices[0].message.content.trim()
    });

  } catch (err) {
    console.error("❌ Erreur API:", err);
    return res.status(500).json({
      error: "Erreur API",
      details: err.message
    });
  }
}