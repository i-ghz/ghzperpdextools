// pages/api/orderbook.js
const axios = require('axios');

module.exports = async (req, res) => {
  const { exchange, token } = req.query;
  if (!exchange || !token) {
    return res.status(400).json({ error: 'exchange and token are required' });
  }

  let url, parseFn;

  switch (exchange) {
    case 'vest': {
      const pair = `${token}-PERP`;
      url = `https://serverprod.vest.exchange/v2/depth?symbol=${pair}&limit=1`;
      parseFn = data => {
        if (!Array.isArray(data.bids) || !data.bids.length) throw new Error('empty orderbook');
        if (!Array.isArray(data.asks) || !data.asks.length) throw new Error('empty orderbook');
        const [bp, bq] = data.bids[0];
        const [ap, aq] = data.asks[0];
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
        const [[bp, bq] = []] = data.bids || [];
        const [[ap, aq] = []] = data.asks || [];
        if (bp == null || ap == null) throw new Error('empty orderbook');
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
        if (!Array.isArray(bids) || !bids.length) throw new Error('empty orderbook');
        if (!Array.isArray(asks) || !asks.length) throw new Error('empty orderbook');
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
    const { data } = await axios.get(url, { timeout: 15000 });
    const { bidPrice, bidQty, askPrice, askQty } = parseFn(data);

    const spread    = askPrice - bidPrice;
    const liquidity = Math.min(bidPrice * bidQty, askPrice * askQty);

    return res.status(200).json({ bidPrice, bidQty, askPrice, askQty, spread, liquidity });
  } catch (err) {
    console.error(err.response?.data || err.message);
    // Si ordre vide, on renvoie 404 pour que le front puisse l'afficher proprement
    if (err.message === 'empty orderbook') {
      return res.status(404).json({ error: 'orderbook empty for this token/exchange' });
    }
    return res.status(500).json({ error: err.message });
  }
};