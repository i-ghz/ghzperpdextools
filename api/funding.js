// api/funding.js - VERSION OPTIMISÉE
const axios = require('axios');

module.exports = async (req, res) => {
  const start = Date.now();
  
  try {
    console.log('⏱️ Starting parallel API calls...');
    
    // 🚀 PARALLÉLISATION des appels principaux
    const [vestRes, markets, extRes, hyperliquidRes, backpackMarketsRes] = await Promise.all([
      axios.get('https://serverprod.vest.exchange/v2/ticker/latest', { timeout: 5000 }),
      axios.get('https://api.prod.paradex.trade/v1/markets', { timeout: 5000 }),
      axios.get('https://api.extended.exchange/api/v1/info/markets', { timeout: 5000 }),
      axios.post('https://api.hyperliquid.xyz/info', { type: 'metaAndAssetCtxs' }, { timeout: 5000 }),
      axios.get('https://api.backpack.exchange/api/v1/markets', { timeout: 5000 })
    ]);
    
    console.log(`✅ Main APIs fetched in ${Date.now() - start}ms`);
    
    // Vest - Simple processing
    const vest = vestRes.data.tickers.map(t => ({
      symbol: t.symbol.replace(/-PERP|-USD/g, '').toUpperCase(),
      vest1h: Number(t.oneHrFundingRate),
    }));

    // Paradex - Paralléliser les funding calls
    const perp = markets.data.results.filter(m => m.asset_kind === 'PERP');
    const paradexRaw = await Promise.all(perp.map(async m => {
      const r = await axios.get(
        `https://api.prod.paradex.trade/v1/funding/data?market=${m.symbol}&page_size=1`,
        { timeout: 3000 }
      ).catch(() => ({ data: { results: [{ funding_rate: 0 }] } }));
      return {
        symbol: m.symbol.replace(/-PERP|-USD/g, '').toUpperCase(),
        paradex1h: parseFloat(r.data.results[0].funding_rate || 0) / 8,
      };
    }));
    
    console.log(`✅ Paradex funding rates fetched in ${Date.now() - start}ms`);
    
    // Extended - Simple processing
    const extended = extRes.data.data
      .filter(m => m.status === 'ACTIVE')
      .map(m => ({
        symbol: m.name.replace(/-PERP|-USD/g, '').toUpperCase(),
        ext1h: Number(m.marketStats.fundingRate),
      }));

    // Hyperliquid - Simple processing
    const [meta, assetCtxs] = hyperliquidRes.data;
    const hyperliquid = meta.universe.map((u, i) => ({
      symbol: u.name.toUpperCase(),
      hyperliquid1h: Number(assetCtxs[i].funding),
    }));

    // 🚀 Backpack - PARALLÉLISATION + TIMEOUT + ERROR HANDLING
    const backpackPerps = backpackMarketsRes.data.filter(m => m.marketType === 'PERP');
    console.log(`⏱️ Fetching ${backpackPerps.length} Backpack funding rates in parallel...`);
    
    const backpack = await Promise.all(backpackPerps.map(async market => {
      try {
        const fundingRes = await axios.get(
          `https://api.backpack.exchange/api/v1/fundingRates?symbol=${market.symbol}&limit=1`,
          { timeout: 3000 } // 3s timeout per call
        );
        const fundingData = fundingRes.data;
        
        return {
          symbol: market.baseSymbol.toUpperCase(),
          backpack1h: fundingData.length > 0 ? Number(fundingData[0].fundingRate) / 8 : null,
        };
      } catch (error) {
        // Silent fail - continue with null data
        console.warn(`⚠️ Backpack timeout/error for ${market.symbol}: ${error.message}`);
        return {
          symbol: market.baseSymbol.toUpperCase(),
          backpack1h: null,
        };
      }
    }));
    
    console.log(`✅ Backpack funding rates completed in ${Date.now() - start}ms`);

    // Merge all symbols
    const symbols = Array.from(new Set([
      ...vest.map(x => x.symbol),
      ...paradexRaw.map(x => x.symbol),
      ...extended.map(x => x.symbol),
      ...hyperliquid.map(x => x.symbol),
      ...backpack.map(x => x.symbol)
    ]));

    const result = symbols.map(sym => ({
      symbol: sym,
      vest1h: vest.find(x => x.symbol === sym)?.vest1h ?? null,
      paradex1h: paradexRaw.find(x => x.symbol === sym)?.paradex1h ?? null,
      ext1h: extended.find(x => x.symbol === sym)?.ext1h ?? null,
      hyperliquid1h: hyperliquid.find(x => x.symbol === sym)?.hyperliquid1h ?? null,
      backpack1h: backpack.find(x => x.symbol === sym)?.backpack1h ?? null,
    }));

    const totalTime = Date.now() - start;
    console.log(`🎉 API completed successfully in ${totalTime}ms with ${result.length} pairs`);
    
    res.status(200).json(result);

  } catch (err) {
    const totalTime = Date.now() - start;
    console.error(`❌ API failed after ${totalTime}ms:`, err.message);
    res.status(500).json({ error: err.toString() });
  }
};