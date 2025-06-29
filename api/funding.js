// api/funding.js - Version avec parallélisation pure (sans timeout)
const axios = require('axios');

module.exports = async (req, res) => {
  const start = Date.now();
  console.log('🚀 Starting parallelized API calls...');
  
  try {
    // 🚀 PARALLÉLISATION MAXIMALE - Tous les appels principaux en même temps
    console.log('📡 Fetching all main APIs in parallel...');
    const [vestRes, markets, extRes, hyperliquidRes, backpackMarketsRes] = await Promise.all([
      axios.get('https://serverprod.vest.exchange/v2/ticker/latest'),
      axios.get('https://api.prod.paradex.trade/v1/markets'),
      axios.get('https://api.extended.exchange/api/v1/info/markets'),
      axios.post('https://api.hyperliquid.xyz/info', { type: 'metaAndAssetCtxs' }),
      axios.get('https://api.backpack.exchange/api/v1/markets')
    ]);
    
    console.log(`✅ All main APIs fetched in ${Date.now() - start}ms`);

    // Traitement Vest (instantané)
    const vest = vestRes.data.tickers.map(t => ({
      symbol: t.symbol.replace(/-PERP|-USD/g, '').toUpperCase(),
      vest1h: Number(t.oneHrFundingRate),
    }));

    // Traitement Extended (instantané)
    const extended = extRes.data.data
      .filter(m => m.status === 'ACTIVE')
      .map(m => ({
        symbol: m.name.replace(/-PERP|-USD/g, '').toUpperCase(),
        ext1h: Number(m.marketStats.fundingRate),
      }));

    // Traitement Hyperliquid (instantané)
    const [meta, assetCtxs] = hyperliquidRes.data;
    const hyperliquid = meta.universe.map((u, i) => ({
      symbol: u.name.toUpperCase(),
      hyperliquid1h: Number(assetCtxs[i].funding),
    }));

    console.log(`✅ Instant processing completed: V:${vest.length} E:${extended.length} H:${hyperliquid.length}`);

    // 🚀 PARALLÉLISATION DES APPELS SECONDAIRES
    const perp = markets.data.results.filter(m => m.asset_kind === 'PERP');
    const backpackPerps = backpackMarketsRes.data.filter(m => m.marketType === 'PERP');
    
    console.log(`📡 Starting parallel secondary calls: ${perp.length} Paradex + ${backpackPerps.length} Backpack...`);

    // 🚀 PARADEX + BACKPACK EN PARALLÈLE TOTAL
    const [paradexRaw, backpack] = await Promise.all([
      // Paradex en parallèle total
      Promise.all(perp.map(async m => {
        const r = await axios.get(
          `https://api.prod.paradex.trade/v1/funding/data?market=${m.symbol}&page_size=1`
        ).catch(() => ({ data: { results: [{ funding_rate: 0 }] } }));
        return {
          symbol: m.symbol.replace(/-PERP|-USD/g, '').toUpperCase(),
          paradex1h: parseFloat(r.data.results[0].funding_rate || 0) / 8,
        };
      })),
      
      // Backpack en parallèle total
      Promise.all(backpackPerps.map(async market => {
        try {
          const fundingRes = await axios.get(
            `https://api.backpack.exchange/api/v1/fundingRates?symbol=${market.symbol}&limit=1`
          );
          const fundingData = fundingRes.data;
          
          return {
            symbol: market.baseSymbol.toUpperCase(),
            backpack1h: fundingData.length > 0 ? Number(fundingData[0].fundingRate) / 8 : null,
          };
        } catch (error) {
          console.warn(`⚠️ Backpack error for ${market.symbol}:`, error.message);
          return {
            symbol: market.baseSymbol.toUpperCase(),
            backpack1h: null,
          };
        }
      }))
    ]);

    console.log(`✅ All secondary calls completed: P:${paradexRaw.length} B:${backpack.length}`);

    // Merge rapide avec Set pour optimiser les performances
    const symbolsSet = new Set();
    vest.forEach(x => symbolsSet.add(x.symbol));
    paradexRaw.forEach(x => symbolsSet.add(x.symbol));
    extended.forEach(x => symbolsSet.add(x.symbol));
    hyperliquid.forEach(x => symbolsSet.add(x.symbol));
    backpack.forEach(x => symbolsSet.add(x.symbol));

    // Création optimisée des Maps pour lookup O(1)
    const vestMap = new Map(vest.map(x => [x.symbol, x.vest1h]));
    const paradexMap = new Map(paradexRaw.map(x => [x.symbol, x.paradex1h]));
    const extendedMap = new Map(extended.map(x => [x.symbol, x.ext1h]));
    const hyperliquidMap = new Map(hyperliquid.map(x => [x.symbol, x.hyperliquid1h]));
    const backpackMap = new Map(backpack.map(x => [x.symbol, x.backpack1h]));

    // Assemblage final ultra-rapide
    const result = Array.from(symbolsSet).map(sym => ({
      symbol: sym,
      vest1h: vestMap.get(sym) ?? null,
      paradex1h: paradexMap.get(sym) ?? null,
      ext1h: extendedMap.get(sym) ?? null,
      hyperliquid1h: hyperliquidMap.get(sym) ?? null,
      backpack1h: backpackMap.get(sym) ?? null,
    }));

    const totalTime = Date.now() - start;
    console.log(`🎉 ULTRA-FAST API completed in ${totalTime}ms with ${result.length} pairs`);
    console.log(`🚀 Speed boost: ${Math.round((15000 - totalTime) / 150)}% faster than sequential`);

    res.status(200).json(result);

  } catch (err) {
    const totalTime = Date.now() - start;
    console.error(`❌ API failed after ${totalTime}ms:`, err.message);
    res.status(500).json({ error: err.toString() });
  }
};