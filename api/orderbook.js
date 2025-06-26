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
      url = `https://serverprod.vest.exchange/v2/depth?symbol=${pair}&limit=1`;
      parseFn = data => {
        const [bp, bq] = (data.bids && data.bids[0]) || [];
        const [ap, aq] = (data.asks && data.asks[0]) || [];
        return {
          bidPrice: parseFloat(bp),
          bidQty:   parseFloat(bq),
          askPrice: parseFloat(ap),
          askQty:   parseFloat(aq),
        };
      };
      break;

    case 'paradex':
      pair = `${token}-USD-PERP`;
      url = `https://api.prod.paradex.trade/v1/orderbook/${pair}?depth=1`;
      parseFn = data => {
        const [bp, bq] = (data.bids && data.bids[0]) || [];
        const [ap, aq] = (data.asks && data.asks[0]) || [];
        return {
          bidPrice: parseFloat(bp),
          bidQty:   parseFloat(bq),
          askPrice: parseFloat(ap),
          askQty:   parseFloat(aq),
        };
      };
      break;

    case 'ext':
      pair = `${token}-USD`;
      url = `https://api.extended.exchange/api/v1/info/markets/${pair}/orderbook`;
      parseFn = data => {
        const bid = (data.data.bid && data.data.bid[0]) || {};
        const ask = (data.data.ask && data.data.ask[0]) || {};
        return {
          bidPrice: parseFloat(bid.price),
          bidQty:   parseFloat(bid.qty),
          askPrice: parseFloat(ask.price),
          askQty:   parseFloat(ask.qty),
        };
      };
      break;

    default:
      return res.status(400).json({ error: 'unsupported exchange' });
  }

  try {
    console.log(`📡 [orderbook] fetching ${exchange} ${pair} → ${url}`);
    const response = await axios.get(url, { timeout: 10000 });
    console.log('✅ [orderbook] remote data:', response.data);

    const { bidPrice, bidQty, askPrice, askQty } = parseFn(response.data);
    if (![bidPrice, bidQty, askPrice, askQty].every(v => typeof v === 'number' && !isNaN(v))) {
      throw new Error('invalid orderbook payload');
    }

    const spread    = askPrice - bidPrice;
    const liquidity = Math.min(bidPrice * bidQty, askPrice * askQty);
    return res.status(200).json({ bidPrice, bidQty, askPrice, askQty, spread, liquidity });

  } catch (err) {
    // log the upstream error so you can inspect it in Vercel’s logs
    console.error('❌ [orderbook] error:', err.response?.data || err.message);
    const status  = err.response?.status || 500;
    const message = err.response?.data?.error || err.message;
    return res.status(status).json({ error: message });
  }
}
