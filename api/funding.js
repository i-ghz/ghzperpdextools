// api/funding.js
import axios from 'axios';

export default async function handler(req, res) {
  try {
    // 1) Vest 1h
    const vestResp = await axios.get('https://serverprod.vest.exchange/v2/ticker/latest');
    const vest = vestResp.data.tickers.map(t => ({
      symbol: t.symbol.replace(/-PERP|-USD/g, '').toUpperCase(),
      vest1h: Number(t.oneHrFundingRate)
    }));

    // 2) Paradex 8h → converti en 1h
    const markets = await axios.get('https://api.prod.paradex.trade/v1/markets');
    const perp = markets.data.results.filter(m => m.asset_kind === 'PERP');
    const paradexArr = await Promise.all(perp.map(async p => {
      const sym = p.symbol.replace(/-PERP|-USD/g, '').toUpperCase();
      try {
        const r = await axios.get(
          `https://api.prod.paradex.trade/v1/funding/data?market=${p.symbol}&page_size=1`
        );
        return { symbol: sym, paradex1h: parseFloat(r.data.results?.[0]?.funding_rate || '0') / 8 };
      } catch {
        return { symbol: sym, paradex1h: 0 };
      }
    }));

    // 3) Extended 1h
    const extResp = await axios.get('https://api.extended.exchange/api/v1/info/markets');
    const ext = extResp.data.data.map(m => ({
      symbol: m.name.replace(/-PERP|-USD/g, '').toUpperCase(),
      ext1h: Number(m.marketStats.fundingRate)
    }));

    // 4) Agrégation
    const symbols = [...new Set([...vest, ...paradexArr, ...ext].map(x => x.symbol))];
    const result = symbols.map(sym => ({
      symbol: sym,
      vest1h:  vest.find(x => x.symbol === sym)?.vest1h  ?? null,
      paradex1h: paradexArr.find(x => x.symbol === sym)?.paradex1h ?? null,
      ext1h:   ext.find(x => x.symbol === sym)?.ext1h    ?? null
    }));

    res.status(200).json(result);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.toString() });
  }
}
