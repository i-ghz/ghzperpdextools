// pages/api/orderbook.js
const axios = require('axios');

export default async function handler(req, res) {
  const { exchange, token } = req.query;
  if (!exchange || !token) {
    return res.status(400).json({ error: 'exchange and token are required' });
  }

  let url;
  let parseFn;

  switch (exchange) {
    case 'vest': {
      const pair = `${token}-PERP`;
      url = `https://serverprod.vest.exchange/v2/depth?symbol=${pair}&limit=1`;
      parseFn = data => {
        const bids = data.bids;
        const asks = data.asks;
        if (!Array.isArray(bids) || bids.length === 0) throw new Error('empty orderbook');
        if (!Array.isArray(asks) || asks.length === 0) throw new Error('empty orderbook');
        const [bp, bq] = bids[0];
        const [ap, aq] = asks[0];
        return {
          bidPrice: parseFloat(bp),
          bidQty:   parseFloat(bq),
          askPrice: parseFloat(ap),
          askQty:   parseFloat(aq)
        };
      };
      break;
    }

    case 'paradex': {
      const pair = `${token}-USD-PERP`;
      url = `https://api.prod.paradex.trade/v1/orderbook/${pair}?depth=1`;
      parseFn = data => {
        const bids = data.bids || [];
        const asks = data.asks || [];
        if (!bids.length || !asks.length) throw new Error('empty orderbook');
        const [[bp, bq]] = bids;
        const [[ap, aq]] = asks;
        return {
          bidPrice: parseFloat(bp),
          bidQty:   parseFloat(bq),
          askPrice: parseFloat(ap),
          askQty:   parseFloat(aq)
        };
      };
      break;
    }

    case 'ext': {
      const pair = `${token}-USD`;
      url = `https://api.extended.exchange/api/v1/info/${pair}/orderbook`;
      parseFn = data => {
        const bids = data.data?.bid;
        const asks = data.data?.ask;
        if (!Array.isArray(bids) || bids.length === 0) throw new Error('empty orderbook');
        if (!Array.isArray(asks) || asks.length === 0) throw new Error('empty orderbook');
        return {
          bidPrice: parseFloat(bids[0].price),
          bidQty:   parseFloat(bids[0].qty),
          askPrice: parseFloat(asks[0].price),
          askQty:   parseFloat(asks[0].qty)
        };
      };
      break;
    }

    default:
      return res.status(400).json({ error: 'unsupported exchange' });
  }

  try {
    const response = await axios.get(url, { timeout: 15000 });
    const { bidPrice, bidQty, askPrice, askQty } = parseFn(response.data);

    // Vérifie qu'on a bien des nombres valides
    if ([bidPrice, bidQty, askPrice, askQty].some(v => typeof v !== 'number' || isNaN(v))) {
      throw new Error('invalid orderbook');
    }

    const spread    = askPrice - bidPrice;
    const liquidity = Math.min(bidPrice * bidQty, askPrice * askQty);

    return res.status(200).json({ bidPrice, bidQty, askPrice, askQty, spread, liquidity });
  } catch (err) {
    console.error(err.response?.data || err.message);
    if (err.message === 'empty orderbook') {
      return res.status(404).json({ error: 'orderbook empty for this token/exchange' });
    }
    return res.status(500).json({ error: err.message || 'internal error' });
  }
}
