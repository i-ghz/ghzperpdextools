// api/cron/collect-funding.js
// Endpoint pour le cron job Vercel - Copie exacte de votre logique

const axios = require('axios');
const { createClient } = require('@supabase/supabase-js');

// Configuration Supabase
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
);

// Copier-coller toutes vos fonctions de collecte ici
async function collectVest() {
  try {
    console.log('📊 Collecting Vest...');
    const { data } = await axios.get('https://serverprod.vest.exchange/v2/ticker/latest');
    
    return data.tickers.map(t => ({
      symbol: t.symbol.replace(/-PERP|-USD/g, '').toUpperCase(),
      exchange: 'vest',
      funding_rate_1h: Number(t.oneHrFundingRate)
    }));
  } catch (error) {
    console.error('❌ Vest error:', error.message);
    return [];
  }
}

async function collectExtended() {
  try {
    console.log('📊 Collecting Extended...');
    const { data: marketsData } = await axios.get('https://api.extended.exchange/api/v1/info/markets');
    
    if (marketsData.status !== 'OK' || !marketsData.data) {
      console.error('❌ Extended: Invalid response');
      return [];
    }
    
    const results = marketsData.data
      .filter(m => m.status === 'ACTIVE' && m.name && m.name.endsWith('-USD'))
      .map(m => {
        const fundingRate = m.marketStats?.fundingRate ? parseFloat(m.marketStats.fundingRate) : 0;
        
        return {
          symbol: m.name.replace('-USD', '').toUpperCase(),
          exchange: 'ext',
          funding_rate_1h: fundingRate
        };
      })
      .filter(item => !isNaN(item.funding_rate_1h));
    
    console.log(`✅ Extended: ${results.length} funding rates collected`);
    return results;
    
  } catch (error) {
    console.error('❌ Extended error:', error.message);
    return [];
  }
}

async function collectHyperliquid() {
  try {
    console.log('📊 Collecting Hyperliquid...');
    const { data } = await axios.post('https://api.hyperliquid.xyz/info', {
      type: 'metaAndAssetCtxs'
    });
    
    const [meta, assetCtxs] = data;
    return meta.universe.map((u, i) => ({
      symbol: u.name.toUpperCase(),
      exchange: 'hyperliquid',
      funding_rate_1h: Number(assetCtxs[i].funding)
    }));
  } catch (error) {
    console.error('❌ Hyperliquid error:', error.message);
    return [];
  }
}

async function collectParadex() {
  try {
    console.log('📊 Collecting Paradex (continuous funding)...');
    
    const { data: markets } = await axios.get('https://api.prod.paradex.trade/v1/markets');
    const perps = markets.results.filter(m => m.asset_kind === 'PERP');
    
    const results = [];
    const now = Date.now();
    const oneHourAgo = now - (60 * 60 * 1000);
    
    for (const market of perps) {
      try {
        const { data: currentData } = await axios.get(
          `https://api.prod.paradex.trade/v1/funding/data`,
          {
            params: {
              market: market.symbol,
              end_at: now,
              page_size: 1
            }
          }
        );
        
        const { data: pastData } = await axios.get(
          `https://api.prod.paradex.trade/v1/funding/data`,
          {
            params: {
              market: market.symbol,
              end_at: oneHourAgo,
              page_size: 1
            }
          }
        );
        
        if (currentData.results?.[0] && pastData.results?.[0]) {
          const currentIndex = parseFloat(currentData.results[0].funding_index);
          const pastIndex = parseFloat(pastData.results[0].funding_index);
          
          const { data: priceData } = await axios.get(
            `https://api.prod.paradex.trade/v1/markets/klines`,
            {
              params: {
                symbol: market.symbol,
                start_at: oneHourAgo,
                end_at: now,
                resolution: 60,
                price_kind: 'mark'
              }
            }
          );
          
          if (priceData.results && priceData.results.length > 0) {
            const prices = priceData.results.map(ohlc => (ohlc[1] + ohlc[4]) / 2);
            const avgPrice = prices.reduce((a, b) => a + b, 0) / prices.length;
            
            const deltaFunding = currentIndex - pastIndex;
            const fundingRate1h = deltaFunding / avgPrice;
            
            results.push({
              symbol: market.symbol.replace(/-PERP|-USD/g, '').toUpperCase(),
              exchange: 'paradex',
              funding_rate_1h: fundingRate1h
            });
          }
        }
        
        await new Promise(resolve => setTimeout(resolve, 200));
        
      } catch (err) {
        console.error(`Error fetching Paradex ${market.symbol}:`, err.message);
      }
    }
    
    console.log(`✅ Paradex: ${results.length} pairs with continuous funding calculated`);
    return results;
    
  } catch (error) {
    console.error('❌ Paradex error:', error.message);
    return [];
  }
}

async function collectBackpack() {
  try {
    console.log('📊 Collecting Backpack...');
    
    const { data: markets } = await axios.get('https://api.backpack.exchange/api/v1/markets');
    const perps = markets.filter(m => m.marketType === 'PERP');
    
    const results = [];
    
    for (const market of perps) {
      try {
        const { data } = await axios.get(
          `https://api.backpack.exchange/api/v1/fundingRates?symbol=${market.symbol}&limit=1`
        );
        
        if (data.length > 0) {
          results.push({
            symbol: market.baseSymbol.toUpperCase(),
            exchange: 'backpack',
            funding_rate_1h: Number(data[0].fundingRate) / 8
          });
        }
      } catch (err) {
        console.error(`Error fetching ${market.symbol}:`, err.message);
      }
    }
    
    return results;
  } catch (error) {
    console.error('❌ Backpack error:', error.message);
    return [];
  }
}

async function collectOrderly() {
  try {
    console.log('📊 Collecting Orderly...');
    const { data } = await axios.get('https://api.orderly.org/v1/public/funding_rates');
    
    return data.data.rows
      .filter(row => row.symbol.startsWith('PERP_') && row.symbol.endsWith('_USDC'))
      .map(row => ({
        symbol: row.symbol
          .replace(/^PERP_/, '')
          .replace(/_USDC$/, '')
          .replace(/^1000000/, '')
          .replace(/^1000/, '')
          .toUpperCase(),
        exchange: 'orderly',
        funding_rate_1h: Number(row.est_funding_rate) / 8
      }));
  } catch (error) {
    console.error('❌ Orderly error:', error.message);
    return [];
  }
}

async function collectHibachi() {
  try {
    console.log('📊 Collecting Hibachi...');
    
    const { data } = await axios.get('https://data-api.hibachi.xyz/market/exchange-info');
    const perps = data.futureContracts.filter(c => c.status === 'LIVE');
    
    const results = [];
    
    for (const contract of perps) {
      try {
        const { data: priceData } = await axios.get(
          `https://data-api.hibachi.xyz/market/data/prices?symbol=${contract.symbol}`
        );
        
        if (priceData.fundingRateEstimation) {
          results.push({
            symbol: contract.underlyingSymbol.toUpperCase(),
            exchange: 'hibachi',
            funding_rate_1h: Number(priceData.fundingRateEstimation.estimatedFundingRate) / 8
          });
        }
      } catch (err) {
        console.error(`Error fetching ${contract.symbol}:`, err.message);
      }
    }
    
    return results;
  } catch (error) {
    console.error('❌ Hibachi error:', error.message);
    return [];
  }
}

async function collectAllFundingRates() {
  console.log('🚀 Starting funding rate collection...');
  
  const timestamp = new Date();
  timestamp.setMinutes(0, 0, 0);
  
  const [vest, extended, hyperliquid, orderly] = await Promise.all([
    collectVest(),
    collectExtended(),
    collectHyperliquid(),
    collectOrderly()
  ]);
  
  const paradex = await collectParadex();
  const backpack = await collectBackpack();
  const hibachi = await collectHibachi();
  
  const allRates = [
    ...vest,
    ...extended,
    ...hyperliquid,
    ...paradex,
    ...backpack,
    ...orderly,
    ...hibachi
  ];
  
  console.log(`\n📊 Total collected: ${allRates.length} funding rates`);
  console.log(`Vest: ${vest.length}`);
  console.log(`Extended: ${extended.length}`);
  console.log(`Hyperliquid: ${hyperliquid.length}`);
  console.log(`Paradex: ${paradex.length}`);
  console.log(`Backpack: ${backpack.length}`);
  console.log(`Orderly: ${orderly.length}`);
  console.log(`Hibachi: ${hibachi.length}`);
  
  const dataToInsert = allRates.map(rate => ({
    timestamp: timestamp.toISOString(),
    symbol: rate.symbol,
    exchange: rate.exchange,
    funding_rate_1h: rate.funding_rate_1h
  }));
  
  if (dataToInsert.length > 0) {
    console.log('\n💾 Inserting into database...');
    
    const { error } = await supabase
      .from('funding_snapshots')
      .insert(dataToInsert);
    
    if (error) {
      console.error('❌ Database error:', error);
      throw error;
    } else {
      console.log('✅ Successfully inserted all funding rates!');
    }
  }
  
  return dataToInsert;
}

// Handler principal pour Vercel
module.exports = async (req, res) => {
  try {
    console.log('🕐 Cron job started at:', new Date().toISOString());
    
    const result = await collectAllFundingRates();
    
    res.status(200).json({
      success: true,
      timestamp: new Date().toISOString(),
      recordsInserted: result.length
    });
    
  } catch (error) {
    console.error('❌ Cron job failed:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};