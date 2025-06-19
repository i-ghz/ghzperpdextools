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
      ).catch(() => ({ data:{ results:[{ funding_rate:0 }] } }));
      return {
        symbol: m.symbol.replace(/-PERP|-USD/g, '').toUpperCase(),
        paradex1h: parseFloat(r.data.results[0].funding_rate || 0) / 8,
      };
    }));

    // Extended
    const extRes = await axios.get('https://api.extended.exchange/api/v1/info/markets');
    const extended = extRes.data.data.map(m => ({
      symbol: m.name.replace(/-PERP|-USD/g, '').toUpperCase(),
      ext1h: Number(m.marketStats.fundingRate),
    }));

    // Merge
    const symbols = Array.from(new Set([
      ...vest.map(x=>x.symbol),
      ...paradexRaw.map(x=>x.symbol),
      ...extended.map(x=>x.symbol)
    ]));

    const result = symbols.map(sym => ({
      symbol: sym,
      vest1h:  vest.find(x=>x.symbol===sym)?.vest1h  ?? null,
      paradex1h: paradexRaw.find(x=>x.symbol===sym)?.paradex1h ?? null,
      ext1h:   extended.find(x=>x.symbol===sym)?.ext1h ?? null,
    }));

    res.status(200).json(result);

  } catch(err) {
    console.error(err);
    res.status(500).json({ error: err.toString() });
  }
};
