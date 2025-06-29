// api/funding.js - VERSION ULTRA-OPTIMISÉE ET STABLE
const axios = require('axios');

// Configuration globale pour éviter les timeouts
const axiosConfig = {
  timeout: 10000, // 10 secondes pour tous
  headers: {
    'User-Agent': 'Mozilla/5.0 (compatible; FundingBot/1.0)',
    'Accept': 'application/json',
  }
};

// Helper pour les appels avec retry automatique
const safeApiCall = async (url, config = {}, retries = 2) => {
  for (let i = 0; i <= retries; i++) {
    try {
      const response = await axios({ url, ...axiosConfig, ...config });
      return response;
    } catch (error) {
      if (i === retries) {
        console.warn(`❌ Final failure for ${url}: ${error.message}`);
        throw error;
      }
      console.warn(`⚠️ Retry ${i + 1} for ${url}: ${error.message}`);
      await new Promise(resolve => setTimeout(resolve, 500 * (i + 1))); // Backoff
    }
  }
};

// Helper pour traiter les données en batch avec limite de concurrence
const processBatch = async (items, processor, batchSize = 10) => {
  const results = [];
  for (let i = 0; i < items.length; i += batchSize) {
    const batch = items.slice(i, i + batchSize);
    const batchResults = await Promise.allSettled(batch.map(processor));
    results.push(...batchResults.map(r => r.status === 'fulfilled' ? r.value : null).filter(Boolean));
  }
  return results;
};

module.exports = async (req, res) => {
  const start = Date.now();
  
  try {
    console.log('🚀 Starting optimized parallel API calls...');
    
    // ÉTAPE 1: Appels API principaux avec gestion d'erreur individuelle
    const apiPromises = [
      safeApiCall('https://serverprod.vest.exchange/v2/ticker/latest')
        .then(r => ({ source: 'vest', data: r.data }))
        .catch(() => ({ source: 'vest', data: null })),
        
      safeApiCall('https://api.prod.paradex.trade/v1/markets')
        .then(r => ({ source: 'paradex', data: r.data }))
        .catch(() => ({ source: 'paradex', data: null })),
        
      safeApiCall('https://api.extended.exchange/api/v1/info/markets')
        .then(r => ({ source: 'extended', data: r.data }))
        .catch(() => ({ source: 'extended', data: null })),
        
      safeApiCall('https://api.hyperliquid.xyz/info', { 
        method: 'POST', 
        data: { type: 'metaAndAssetCtxs' } 
      })
        .then(r => ({ source: 'hyperliquid', data: r.data }))
        .catch(() => ({ source: 'hyperliquid', data: null })),
        
      safeApiCall('https://api.backpack.exchange/api/v1/markets')
        .then(r => ({ source: 'backpack', data: r.data }))
        .catch(() => ({ source: 'backpack', data: null }))
    ];
    
    const apiResults = await Promise.all(apiPromises);
    console.log(`✅ Main APIs completed in ${Date.now() - start}ms`);
    
    // ÉTAPE 2: Traitement des données avec fallback
    let vest = [], paradexRaw = [], extended = [], hyperliquid = [], backpack = [];
    
    // Vest
    const vestData = apiResults.find(r => r.source === 'vest')?.data;
    if (vestData?.tickers) {
      vest = vestData.tickers.map(t => ({
        symbol: t.symbol.replace(/-PERP|-USD/g, '').toUpperCase(),
        vest1h: Number(t.oneHrFundingRate) || 0,
      }));
      console.log(`✅ Vest: ${vest.length} pairs`);
    }

    // Paradex avec traitement en batch pour éviter la surcharge
    const paradexData = apiResults.find(r => r.source === 'paradex')?.data;
    if (paradexData?.results) {
      const perpMarkets = paradexData.results.filter(m => m.asset_kind === 'PERP').slice(0, 50); // Limite à 50
      
      paradexRaw = await processBatch(
        perpMarkets,
        async (market) => {
          try {
            const response = await safeApiCall(
              `https://api.prod.paradex.trade/v1/funding/data?market=${market.symbol}&page_size=1`
            );
            return {
              symbol: market.symbol.replace(/-PERP|-USD/g, '').toUpperCase(),
              paradex1h: parseFloat(response.data.results[0]?.funding_rate || 0) / 8,
            };
          } catch {
            return {
              symbol: market.symbol.replace(/-PERP|-USD/g, '').toUpperCase(),
              paradex1h: 0,
            };
          }
        },
        5 // Batch de 5 pour éviter la surcharge
      );
      console.log(`✅ Paradex: ${paradexRaw.length} pairs`);
    }

    // Extended
    const extendedData = apiResults.find(r => r.source === 'extended')?.data;
    if (extendedData?.data) {
      extended = extendedData.data
        .filter(m => m.status === 'ACTIVE')
        .map(m => ({
          symbol: m.name.replace(/-PERP|-USD/g, '').toUpperCase(),
          ext1h: Number(m.marketStats?.fundingRate) || 0,
        }));
      console.log(`✅ Extended: ${extended.length} pairs`);
    }

    // Hyperliquid
    const hyperliquidData = apiResults.find(r => r.source === 'hyperliquid')?.data;
    if (hyperliquidData && Array.isArray(hyperliquidData) && hyperliquidData.length >= 2) {
      const [meta, assetCtxs] = hyperliquidData;
      if (meta?.universe && assetCtxs) {
        hyperliquid = meta.universe.map((u, i) => ({
          symbol: u.name.toUpperCase(),
          hyperliquid1h: Number(assetCtxs[i]?.funding) || 0,
        }));
        console.log(`✅ Hyperliquid: ${hyperliquid.length} pairs`);
      }
    }

    // Backpack avec gestion ultra-optimisée
    const backpackData = apiResults.find(r => r.source === 'backpack')?.data;
    if (backpackData && Array.isArray(backpackData)) {
      const backpackPerps = backpackData.filter(m => m.marketType === 'PERP').slice(0, 30); // Limite à 30
      
      backpack = await processBatch(
        backpackPerps,
        async (market) => {
          try {
            const response = await safeApiCall(
              `https://api.backpack.exchange/api/v1/fundingRates?symbol=${market.symbol}&limit=1`,
              { timeout: 10000 } // 10 secondes
            );
            return {
              symbol: market.baseSymbol.toUpperCase(),
              backpack1h: response.data.length > 0 ? Number(response.data[0].fundingRate) / 8 : 0,
            };
          } catch {
            return {
              symbol: market.baseSymbol.toUpperCase(),
              backpack1h: null, // null pour distinguer les erreurs des 0
            };
          }
        },
        3 // Batch très petit pour Backpack
      );
      console.log(`✅ Backpack: ${backpack.length} pairs`);
    }

    // ÉTAPE 3: Merge intelligent avec tous les symboles uniques
    const allSymbols = new Set([
      ...vest.map(x => x.symbol),
      ...paradexRaw.map(x => x.symbol),
      ...extended.map(x => x.symbol),
      ...hyperliquid.map(x => x.symbol),
      ...backpack.map(x => x.symbol)
    ]);

    const result = Array.from(allSymbols).map(sym => ({
      symbol: sym,
      vest1h: vest.find(x => x.symbol === sym)?.vest1h ?? null,
      paradex1h: paradexRaw.find(x => x.symbol === sym)?.paradex1h ?? null,
      ext1h: extended.find(x => x.symbol === sym)?.ext1h ?? null,
      hyperliquid1h: hyperliquid.find(x => x.symbol === sym)?.hyperliquid1h ?? null,
      backpack1h: backpack.find(x => x.symbol === sym)?.backpack1h ?? null,
    })).filter(item => {
      // Garde seulement les pairs qui ont au moins 2 exchanges avec des données
      const nonNullCount = [
        item.vest1h, item.paradex1h, item.ext1h, 
        item.hyperliquid1h, item.backpack1h
      ].filter(val => val !== null).length;
      return nonNullCount >= 2;
    });

    const totalTime = Date.now() - start;
    console.log(`🎉 API completed successfully in ${totalTime}ms`);
    console.log(`📊 Results: ${result.length} pairs with sufficient data`);
    console.log(`📈 Sources: V:${vest.length} P:${paradexRaw.length} E:${extended.length} H:${hyperliquid.length} B:${backpack.length}`);
    
    // Headers pour éviter les problèmes de cache
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    
    res.status(200).json({ 
      data: result,
      meta: {
        totalTime,
        sources: {
          vest: vest.length,
          paradex: paradexRaw.length,
          extended: extended.length,
          hyperliquid: hyperliquid.length,
          backpack: backpack.length
        },
        timestamp: new Date().toISOString()
      }
    });

  } catch (err) {
    const totalTime = Date.now() - start;
    console.error(`❌ Critical API failure after ${totalTime}ms:`, err.message);
    console.error('Stack:', err.stack);
    
    // Réponse d'erreur structurée
    res.status(500).json({ 
      error: 'API temporarily unavailable',
      details: err.message,
      timestamp: new Date().toISOString(),
      duration: totalTime
    });
  }
};