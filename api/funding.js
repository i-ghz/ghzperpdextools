// api/funding.js
const axios = require("axios");

module.exports = async (req, res) => {
  const start = Date.now();
  try {
    // Main endpoints parallel
    const [
      vestRes,
      paradexMarketsRes,
      extRes,
      hyperliquidRes,
      backpackMarketsRes,
      orderlyRes,
      hibachiMarketsRes,
    ] = await Promise.all([
      axios.get("https://serverprod.vest.exchange/v2/ticker/latest"),
      axios.get("https://api.prod.paradex.trade/v1/markets"),
      axios.get("https://api.starknet.extended.exchange/api/v1/info/markets"),
      axios.post("https://api.hyperliquid.xyz/info", { type: "metaAndAssetCtxs" }),
      axios.get("https://api.backpack.exchange/api/v1/markets"),
      axios.get("https://api.orderly.org/v1/public/funding_rates"),
      axios.get("https://data-api.hibachi.xyz/market/exchange-info"),
    ]);

    // Vest
    const vest = vestRes.data.tickers.map((t) => ({
      symbol: t.symbol.replace(/-PERP|-USD/g, "").toUpperCase(),
      vest1h: Number(t.oneHrFundingRate),
    }));

    // Extended
    const extended = extRes.data.data
      .filter((m) => m.status === "ACTIVE")
      .map((m) => ({
        symbol: m.name.replace(/-PERP|-USD/g, "").toUpperCase(),
        ext1h: Number(m.marketStats.fundingRate),
      }));

    // Hyperliquid
    const [meta, assetCtxs] = hyperliquidRes.data;
    const hyperliquid = meta.universe.map((u, i) => ({
      symbol: u.name.toUpperCase(),
      hyperliquid1h: Number(assetCtxs[i].funding),
    }));

    // Orderly (8h -> 1h)
    const orderly = orderlyRes.data.data.rows
      .filter((r) => r.symbol.startsWith("PERP_") && r.symbol.endsWith("_USDC"))
      .map((r) => ({
        symbol: r.symbol.replace(/^PERP_/, "").replace(/_USDC$/, "").replace(/^1000000/, "").replace(/^1000/, "").toUpperCase(),
        orderly1h: Number(r.est_funding_rate) / 8,
      }));

    // Perps lists
    const paradexPerps = paradexMarketsRes.data.results.filter((m) => m.asset_kind === "PERP");
    const backpackPerps = backpackMarketsRes.data.filter((m) => m.marketType === "PERP");
    const hibachiPerps = hibachiMarketsRes.data.futureContracts.filter((c) => c.status === "LIVE");

    // Secondary parallel: Paradex/Backpack/Hibachi item data
    const [paradexRaw, backpack, hibachi] = await Promise.all([
      Promise.all(
        paradexPerps.map(async (m) => {
          try {
            const r = await axios.get(`https://api.prod.paradex.trade/v1/funding/data?market=${m.symbol}&page_size=1`);
            return {
              symbol: m.symbol.replace(/-PERP|-USD/g, "").toUpperCase(),
              paradex1h: parseFloat(r.data?.results?.[0]?.funding_rate || 0) / 8, // 8h->1h
            };
          } catch {
            return { symbol: m.symbol.replace(/-PERP|-USD/g, "").toUpperCase(), paradex1h: null };
          }
        })
      ),
      Promise.all(
        backpackPerps.map(async (m) => {
          try {
            const r = await axios.get(`https://api.backpack.exchange/api/v1/fundingRates?symbol=${m.symbol}&limit=1`);
            return { symbol: m.baseSymbol.toUpperCase(), backpack1h: r.data.length ? Number(r.data[0].fundingRate) / 8 : null };
          } catch {
            return { symbol: m.baseSymbol.toUpperCase(), backpack1h: null };
          }
        })
      ),
      Promise.all(
        hibachiPerps.map(async (c) => {
          try {
            const r = await axios.get(`https://data-api.hibachi.xyz/market/data/prices?symbol=${c.symbol}`);
            const est = r.data?.fundingRateEstimation?.estimatedFundingRate;
            return { symbol: c.underlyingSymbol.toUpperCase(), hibachi1h: est ? Number(est) / 8 : null };
          } catch {
            return { symbol: c.underlyingSymbol.toUpperCase(), hibachi1h: null };
          }
        })
      ),
    ]);

    // Merge
    const set = new Set();
    [vest, extended, hyperliquid, orderly, paradexRaw, backpack, hibachi].forEach((arr) => arr.forEach((x) => set.add(x.symbol)));

    const mapOf = (arr, k) => new Map(arr.map((x) => [x.symbol, x[k]]));

    const out = [...set].map((sym) => ({
      symbol: sym,
      vest1h: mapOf(vest, "vest1h").get(sym) ?? null,
      paradex1h: mapOf(paradexRaw, "paradex1h").get(sym) ?? null,
      ext1h: mapOf(extended, "ext1h").get(sym) ?? null,
      hyperliquid1h: mapOf(hyperliquid, "hyperliquid1h").get(sym) ?? null,
      backpack1h: mapOf(backpack, "backpack1h").get(sym) ?? null,
      orderly1h: mapOf(orderly, "orderly1h").get(sym) ?? null,
      hibachi1h: mapOf(hibachi, "hibachi1h").get(sym) ?? null,
    }));

    res.status(200).json(out);
    console.log(`Funding API ok in ${Date.now() - start}ms • ${out.length} pairs`);
  } catch (e) {
    console.error("Funding API error:", e.message);
    res.status(500).json({ error: e.message });
  }
};
