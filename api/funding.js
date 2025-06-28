// api/funding.js
const axios = require('axios');

module.exports = async (req, res) => {
  try {
    // Vest
    const vestRes = await axios.get('https://serverprod.vest.exchange/v2/ticker/latest');
    const vest = vestRes.data.tickers.map(t => ({
      symbol: t.symbol.replace(/-PERP|-USD/g, '').toUpperCase(),
      vest1h: Number(t.oneHrFundingRate),
    }));

    // Paradex
    const markets = await axios.get('https://api.prod.paradex.trade/v1/markets');
    const perp = markets.data.results.filter(m => m.asset_kind === 'PERP');
    const paradexRaw = await Promise.all(perp.map(async m => {
      const r = await axios.get(
        `https://api.prod.paradex.trade/v1/funding/data?market=${m.symbol}&page_size=1`
      ).catch(() => ({ data: { results: [{ funding_rate: 0 }] } }));
      return {
        symbol: m.symbol.replace(/-PERP|-USD/g, '').toUpperCase(),
        // Le taux de Paradex est pour 8h, on le divise par 8 pour avoir le taux horaire
        paradex1h: parseFloat(r.data.results[0].funding_rate || 0) / 8,
      };
    }));
    
    // Extended
    const extRes = await axios.get('https://api.extended.exchange/api/v1/info/markets');
    const extended = extRes.data.data
      .filter(m => m.status === 'ACTIVE')
      .map(m => ({
        symbol: m.name.replace(/-PERP|-USD/g, '').toUpperCase(),
        ext1h: Number(m.marketStats.fundingRate),
      }));

    // Hyperliquid
    const hyperliquidRes = await axios.post('https://api.hyperliquid.xyz/info', { type: 'metaAndAssetCtxs' });
    const [meta, assetCtxs] = hyperliquidRes.data;
    const hyperliquid = meta.universe.map((u, i) => ({
      symbol: u.name.toUpperCase(),
      hyperliquid1h: Number(assetCtxs[i].funding),
    }));

    // --- NOUVEAU : Backpack ---
    const backpackMarketsRes = await axios.get('https://api.backpack.exchange/api/v1/markets');
    const backpackPerps = backpackMarketsRes.data.filter(m => m.marketType === 'PERP');
    
    const backpack = await Promise.all(backpackPerps.map(async market => {
      try {
        const fundingRes = await axios.get(`https://api.backpack.exchange/api/v1/fundingRates?symbol=${market.symbol}&limit=1`);
        const fundingData = fundingRes.data;
        
        return {
          symbol: market.baseSymbol.toUpperCase(), // SOL_USDC_PERP -> SOL
          // Le taux de Backpack est pour 8h, on le divise par 8 pour avoir le taux horaire
          backpack1h: fundingData.length > 0 ? Number(fundingData[0].fundingRate) / 8 : null,
        };
      } catch (error) {
        console.warn(`Backpack funding error for ${market.symbol}:`, error.message);
        return {
          symbol: market.baseSymbol.toUpperCase(),
          backpack1h: null,
        };
      }
    }));

    // Merge all symbols
    const symbols = Array.from(new Set([
      ...vest.map(x => x.symbol),
      ...paradexRaw.map(x => x.symbol),
      ...extended.map(x => x.symbol),
      ...hyperliquid.map(x => x.symbol),
      ...backpack.map(x => x.symbol) // Ajout des symboles de Backpack
    ]));

    const result = symbols.map(sym => ({
      symbol: sym,
      vest1h:        vest.find(x => x.symbol === sym)?.vest1h ?? null,
      paradex1h:     paradexRaw.find(x => x.symbol === sym)?.paradex1h ?? null,
      ext1h:         extended.find(x => x.symbol === sym)?.ext1h ?? null,
      hyperliquid1h: hyperliquid.find(x => x.symbol === sym)?.hyperliquid1h ?? null,
      backpack1h:    backpack.find(x => x.symbol === sym)?.backpack1h ?? null, // Ajout de la donnée Backpack
    }));

    res.status(200).json(result);

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.toString() });
  }
};