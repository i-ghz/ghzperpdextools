// pages/api/orderbook.js
import axios from 'axios';

export default async function handler(req, res) {
  const { exchange, token } = req.query;
  if (!exchange || !token) {
    return res.status(400).json({ error: 'exchange and token are required' });
  }

  let pair, url, parseFn;

  switch (exchange) {
    case 'vest':
      pair = `${token}-PERP`;
      url = `https://serverprod.vest.exchange/v2/depth?symbol=${pair}&limit=2`;
      parseFn = data => {
        // take up to two bids/asks
        const bids = (data.bids || []).slice(0, 2);
        const asks = (data.asks || []).slice(0, 2);
        // sum qty and weighted price if you like, but here we'll just total qty
        const bidQty = bids.reduce((sum, [,q]) => sum + parseFloat(q), 0);
        const askQty = asks.reduce((sum, [,q]) => sum + parseFloat(q), 0);
        // pick best price
        const bidPrice = parseFloat(bids[0]?.[0] || 0);
        const askPrice = parseFloat(asks[0]?.[0] || 0);
        return { bidPrice, bidQty, askPrice, askQty };
      };
      break;

    case 'paradex':
      pair = `${token}-USD-PERP`;
      url = `https://api.prod.paradex.trade/v1/orderbook/${pair}?depth=2`;
      parseFn = data => {
        const bids = (data.bids || []).slice(0, 2);
        const asks = (data.asks || []).slice(0, 2);
        const bidQty = bids.reduce((s, [p,q]) => s + parseFloat(q), 0);
        const askQty = asks.reduce((s, [p,q]) => s + parseFloat(q), 0);
        const bidPrice = parseFloat(bids[0]?.[0] || 0);
        const askPrice = parseFloat(asks[0]?.[0] || 0);
        return { bidPrice, bidQty, askPrice, askQty };
      };
      break;

    case 'ext':
      pair = `${token}-USD`;
      url = `https://api.extended.exchange/api/v1/info/markets/${pair}/orderbook`;
      parseFn = data => {
        const bids = (data.data.bid || []).slice(0, 2);
        const asks = (data.data.ask || []).slice(0, 2);
        const bidQty = bids.reduce((s, lvl) => s + parseFloat(lvl.qty), 0);
        const askQty = asks.reduce((s, lvl) => s + parseFloat(lvl.qty), 0);
        const bidPrice = parseFloat(bids[0]?.price || 0);
        const askPrice = parseFloat(asks[0]?.price || 0);
        return { bidPrice, bidQty, askPrice, askQty };
      };
      break;

    default:
      return res.status(400).json({ error: 'unsupported exchange' });
  }

  try {
    const { data } = await axios.get(url);
    const { bidPrice, bidQty, askPrice, askQty } = parseFn(data);
    const spread    = askPrice - bidPrice;
    const liquidity = Math.min(bidPrice * bidQty, askPrice * askQty);
    if (![bidPrice, bidQty, askPrice, askQty].every(v=>v>0)) {
      throw new Error('invalid orderbook data');
    }
    return res.status(200).json({ bidPrice, bidQty, askPrice, askQty, spread, liquidity });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
