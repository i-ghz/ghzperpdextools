const express = require("express");
const axios = require("axios");
const cors = require("cors");

const app = express();
app.use(cors());
const PORT = 4000;

// 1) Récupérer les funding bruts
async function getVestRates() {
  const { data } = await axios.get("https://serverprod.vest.exchange/v2/ticker/latest");
  return data.tickers.map(t => ({
    symbol: t.symbol.replace(/-PERP|-USD/g, "").toUpperCase(),
    vest1h: Number(t.oneHrFundingRate)
  }));
}

async function getParadexRates() {
  const m = await axios.get("https://api.prod.paradex.trade/v1/markets");
  const perp = m.data.results.filter(x => x.asset_kind === "PERP");
  const arr = await Promise.all(perp.map(async p => {
    const sym = p.symbol.replace(/-PERP|-USD/g, "").toUpperCase();
    try {
      const r = await axios.get(`https://api.prod.paradex.trade/v1/funding/data?market=${p.symbol}&page_size=1`);
      return { symbol: sym, paradex8h: parseFloat(r.data.results?.[0]?.funding_rate) || 0 };
    } catch {
      return { symbol: sym, paradex8h: 0 };
    }
  }));
  return arr;
}

async function getExtendedRates() {
  const { data } = await axios.get("https://api.extended.exchange/api/v1/info/markets");
  return data.data.map(m => ({
    symbol: m.name.replace(/-PERP|-USD/g, "").toUpperCase(),
    ext1h: Number(m.marketStats.fundingRate)
  }));
}

// 2) Agréger par symbol et exposer en JSON
app.get("/api/funding", async (req, res) => {
  try {
    const [vest, paradex, ext] = await Promise.all([
      getVestRates(),
      getParadexRates(),
      getExtendedRates(),
    ]);
    const symbols = [...new Set([...vest, ...paradex, ...ext].map(x => x.symbol))];
    const result = symbols.map(sym => ({
      symbol: sym,
      vest1h: vest.find(x => x.symbol === sym)?.vest1h ?? null,
      paradex1h: (paradex.find(x => x.symbol === sym)?.paradex8h ?? 0) / 8, // converti en 1h
      ext1h: ext.find(x => x.symbol === sym)?.ext1h ?? null,
    }));
    res.json(result);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.toString() });
  }
});
// server/server.js (ajoutez après vos routes /api/funding)

app.get('/vest-orderbook', async (req, res) => {
    const { symbol, limit = 20 } = req.query;
    try {
      const resp = await axios.get(
        `https://serverprod.vest.exchange/v2/depth`,
        { params: { symbol, limit } }
      );
      res.json(resp.data);
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: err.toString() });
    }
  });
  
  app.get('/paradex-orderbook', async (req, res) => {
    const { market, depth = 20 } = req.query;
    try {
      const resp = await axios.get(
        `https://api.prod.paradex.trade/v1/orderbook/${market}`,
        { params: { depth } }
      );
      res.json(resp.data);
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: err.toString() });
    }
  });
  

app.listen(PORT, () => console.log(`✅ Backend running on http://localhost:${PORT}`));
