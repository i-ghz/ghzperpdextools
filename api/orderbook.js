// pages/api/orderbook.js - Version corrigée avec formats de tokens appropriés
const axios = require('axios');
const crypto = require('crypto');

module.exports = async (req, res) => {
  const { exchange, token } = req.query;
  if (!exchange || !token) {
    return res.status(400).json({ error: 'exchange and token are required' });
  }

  let url, parseFn, headers = {}, requestMethod = 'GET', requestData = null;

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
      url = `https://api.extended.exchange/api/v1/info/markets/${pair}/orderbook`;
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

    case 'hyperliquid': {
      const pair = `${token}`;
      url = `https://api.hyperliquid.xyz/info`;
      requestMethod = 'POST';
      requestData = {
        type: "l2Book",
        coin: token
      };
      headers = { 'Content-Type': 'application/json' };
      
      parseFn = data => {
        if (!data.levels || !data.levels.length) throw new Error('empty orderbook');
        
        const bids = data.levels.filter(level => level[1] > 0);
        const asks = data.levels.filter(level => level[1] < 0);
        
        if (!bids.length || !asks.length) throw new Error('empty orderbook');
        
        bids.sort((a, b) => parseFloat(b[0]) - parseFloat(a[0]));
        asks.sort((a, b) => parseFloat(a[0]) - parseFloat(b[0]));
        
        return {
          bidPrice: parseFloat(bids[0][0]),
          bidQty:   Math.abs(parseFloat(bids[0][1])),
          askPrice: parseFloat(asks[0][0]),
          askQty:   Math.abs(parseFloat(asks[0][1]))
        };
      };
      break;
    }

    case 'backpack': {
      // Format Backpack: TOKEN_USDC_PERP (ex: BERA_USDC_PERP)
      const pair = `${token}_USDC_PERP`;
      url = `https://api.backpack.exchange/api/v1/depth?symbol=${pair}`;
      parseFn = data => {
        if (!Array.isArray(data.bids) || !data.bids.length) throw new Error('empty orderbook');
        if (!Array.isArray(data.asks) || !data.asks.length) throw new Error('empty orderbook');
        
        // Format Backpack: ["price", "quantity"] (strings)
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

    case 'orderly': {
      // Orderly nécessite une authentification complète - non disponible pour API publique
      return res.status(503).json({ 
        error: `Data not available for ${exchange}`,
        details: 'Orderly requires authentication and API keys',
        suggestion: 'Use other exchanges like vest, paradex, ext, hyperliquid, backpack, binance, or bybit'
      });
    }

    case 'binance': {
      // Format Binance: TOKENUSDT (ex: BERAUSDT)
      const pair = `${token}USDT`;
      url = `https://api.binance.com/api/v3/depth?symbol=${pair}&limit=1`;
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

    case 'bybit': {
      // Format Bybit: TOKENUSDT (ex: BERAUSDT)
      const pair = `${token}USDT`;
      url = `https://api.bybit.com/v5/market/orderbook?category=spot&symbol=${pair}&limit=1`;
      parseFn = data => {
        if (!data.result || !data.result.b || !data.result.a) throw new Error('empty orderbook');
        
        const bids = data.result.b;
        const asks = data.result.a;
        
        if (!bids.length || !asks.length) throw new Error('empty orderbook');
        
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

    default:
      return res.status(400).json({ 
        error: `Unsupported exchange: ${exchange}`,
        supportedExchanges: ['vest', 'paradex', 'ext', 'hyperliquid', 'backpack', 'binance', 'bybit'],
        unavailableExchanges: ['orderly'],
        pairFormats: {
          vest: 'TOKEN-PERP',
          paradex: 'TOKEN-USD-PERP',
          ext: 'TOKEN-USD',
          hyperliquid: 'TOKEN',
          backpack: 'TOKEN_USDC_PERP',
          binance: 'TOKENUSDT',
          bybit: 'TOKENUSDT'
        }
      });
  }

  try {
    console.log(`Fetching from ${exchange}: ${url}`);
    
    let response;
    if (requestMethod === 'POST') {
      response = await axios.post(url, requestData, { 
        timeout: 15000,
        headers
      });
    } else {
      response = await axios.get(url, { 
        timeout: 15000,
        headers
      });
    }
    
    const { bidPrice, bidQty, askPrice, askQty } = parseFn(response.data);
    
    // Validation des données
    validateOrderbookData({ bidPrice, bidQty, askPrice, askQty });

    const spread = askPrice - bidPrice;
    const spreadPercent = (spread / bidPrice) * 100;
    const liquidity = Math.min(bidPrice * bidQty, askPrice * askQty);

    return res.status(200).json({ 
      bidPrice, 
      bidQty, 
      askPrice, 
      askQty, 
      spread: parseFloat(spreadPercent.toFixed(4)), // Spread en pourcentage
      spreadPercent: parseFloat(spreadPercent.toFixed(4)), // Gardé pour compatibilité
      liquidity: parseFloat(liquidity.toFixed(2)),
      exchange,
      token,
      pairUsed: getPairFormat(exchange, token),
      timestamp: Date.now()
    });
    
  } catch (err) {
    console.error(`${exchange} API error:`, err.response?.data || err.message);
    return handleError(err, res, exchange, token);
  }
};

// Fonction helper pour obtenir le format de pair utilisé
function getPairFormat(exchange, token) {
  const formats = {
    vest: `${token}-PERP`,
    paradex: `${token}-USD-PERP`,
    ext: `${token}-USD`,
    hyperliquid: `${token}`,
    backpack: `${token}_USDC_PERP`,
    binance: `${token}USDT`,
    bybit: `${token}USDT`
  };
  
  return formats[exchange] || `${token}`;
}

// Fonction helper pour gérer les erreurs
function handleError(err, res, exchange, token) {
  if (err.response?.status === 404) {
    return res.status(404).json({ 
      error: `Token ${token} not found on ${exchange}`,
      pairTried: getPairFormat(exchange, token),
      details: err.response?.data 
    });
  }
  
  if (err.message === 'empty orderbook') {
    return res.status(404).json({ 
      error: `Empty orderbook for ${token} on ${exchange}`,
      pairTried: getPairFormat(exchange, token)
    });
  }
  
  if (err.message === 'API response not successful') {
    return res.status(400).json({ 
      error: `Invalid API response from ${exchange}`,
      details: err.response?.data 
    });
  }
  
  if (err.code === 'ECONNABORTED' || err.message.includes('timeout')) {
    return res.status(408).json({ 
      error: `Timeout fetching data from ${exchange}`,
      suggestion: 'Try again in a few seconds'
    });
  }
  
  if (err.response?.status === 429) {
    return res.status(429).json({ 
      error: `Rate limit exceeded for ${exchange}`,
      retryAfter: err.response?.headers['retry-after'] || 60
    });
  }
  
  if (err.response?.status === 401 || err.response?.status === 403) {
    return res.status(401).json({ 
      error: `Authentication required for ${exchange}`,
      details: 'This exchange requires API keys for orderbook access'
    });
  }
  
  if (err.message && err.message.includes('API credentials not configured')) {
    return res.status(500).json({ 
      error: `${exchange} API credentials not configured`,
      details: err.message
    });
  }
  
  if (err.response?.status >= 500) {
    return res.status(503).json({ 
      error: `${exchange} server error`,
      details: 'Exchange API temporarily unavailable'
    });
  }
  
  return res.status(500).json({ 
    error: `Failed to fetch from ${exchange}`,
    details: err.response?.data || err.message
  });
}

// Fonction pour valider les données d'orderbook
function validateOrderbookData(data) {
  const requiredFields = ['bidPrice', 'bidQty', 'askPrice', 'askQty'];
  
  for (const field of requiredFields) {
    if (data[field] === undefined || data[field] === null || isNaN(data[field])) {
      throw new Error(`Invalid ${field} in orderbook data`);
    }
  }
  
  if (data.bidPrice >= data.askPrice) {
    throw new Error('Invalid spread: bid price >= ask price');
  }
  
  if (data.bidQty <= 0 || data.askQty <= 0) {
    throw new Error('Invalid quantities: must be positive');
  }
  
  return true;
}