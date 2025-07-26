// collect-funding-rates.js
// Script pour collecter les funding rates de tous les exchanges 

const axios = require('axios');
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

// Configuration Supabase
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
);

// Fonction pour collecter Vest (déjà en 1H)
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

// Fonction pour collecter Extended (déjà en 1H)
async function collectExtended() {
    try {
      console.log('📊 Collecting Extended...');
      const { data: marketsData } = await axios.get('https://api.extended.exchange/api/v1/info/markets');
      
      if (marketsData.status !== 'OK' || !marketsData.data) {
        console.error('❌ Extended: Invalid response');
        return [];
      }
      
      // Filtrer les marchés actifs avec -USD (ce sont les perpétuels)
      const results = marketsData.data
        .filter(m => m.status === 'ACTIVE' && m.name && m.name.endsWith('-USD'))
        .map(m => {
          // Le funding rate est directement dans marketStats
          const fundingRate = m.marketStats?.fundingRate ? parseFloat(m.marketStats.fundingRate) : 0;
          
          return {
            symbol: m.name.replace('-USD', '').toUpperCase(),
            exchange: 'ext',
            funding_rate_1h: fundingRate // Extended retourne déjà en taux horaire
          };
        })
        .filter(item => !isNaN(item.funding_rate_1h)); // Filtrer les valeurs invalides
      
      console.log(`✅ Extended: ${results.length} funding rates collected`);
      return results;
      
    } catch (error) {
      console.error('❌ Extended error:', error.message);
      return [];
    }
  }

// Fonction pour collecter Hyperliquid (déjà en 1H)
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

// Fonction pour collecter Paradex (funding index continu)
async function collectParadex() {
  try {
    console.log('📊 Collecting Paradex (continuous funding)...');
    
    // D'abord récupérer la liste des marchés
    const { data: markets } = await axios.get('https://api.prod.paradex.trade/v1/markets');
    const perps = markets.results.filter(m => m.asset_kind === 'PERP');
    
    const results = [];
    
    // Timestamps pour calculer le funding sur la dernière heure
    const now = Date.now();
    const oneHourAgo = now - (60 * 60 * 1000);
    
    // Pour chaque marché
    for (const market of perps) {
      try {
        // 1. Récupérer l'index de funding actuel
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
        
        // 2. Récupérer l'index de funding d'il y a 1 heure
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
          
          // 3. Récupérer le mark price moyen sur la dernière heure
          const { data: priceData } = await axios.get(
            `https://api.prod.paradex.trade/v1/markets/klines`,
            {
              params: {
                symbol: market.symbol,
                start_at: oneHourAgo,
                end_at: now,
                resolution: 60, // 1 minute
                price_kind: 'mark'
              }
            }
          );
          
          if (priceData.results && priceData.results.length > 0) {
            // Calculer le prix moyen
            const prices = priceData.results.map(ohlc => (ohlc[1] + ohlc[4]) / 2);
            const avgPrice = prices.reduce((a, b) => a + b, 0) / prices.length;
            
            // 4. Calculer le funding rate sur 1h
            const deltaFunding = currentIndex - pastIndex;
            const fundingRate1h = deltaFunding / avgPrice; // Déjà en 1h car on prend 1h de données
            
            results.push({
              symbol: market.symbol.replace(/-PERP|-USD/g, '').toUpperCase(),
              exchange: 'paradex',
              funding_rate_1h: fundingRate1h
            });
          }
        }
        
        // Petit délai pour éviter de surcharger l'API
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

// Fonction pour collecter Backpack (8H → diviser par 8)
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
            funding_rate_1h: Number(data[0].fundingRate) / 8 // Conversion 8H → 1H
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

// Fonction pour collecter Orderly (8H → diviser par 8)
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
        funding_rate_1h: Number(row.est_funding_rate) / 8 // Conversion 8H → 1H
      }));
  } catch (error) {
    console.error('❌ Orderly error:', error.message);
    return [];
  }
}

// Fonction pour collecter Hibachi (8H → diviser par 8)
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
            funding_rate_1h: Number(priceData.fundingRateEstimation.estimatedFundingRate) / 8 // Conversion 8H → 1H
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

// Fonction principale pour collecter tout
async function collectAllFundingRates() {
  console.log('🚀 Starting funding rate collection...');
  
  // Timestamp arrondi à l'heure
  const timestamp = new Date();
  timestamp.setMinutes(0, 0, 0);
  
  // Collecter en parallèle les exchanges rapides
  const [vest, extended, hyperliquid, orderly] = await Promise.all([
    collectVest(),
    collectExtended(),
    collectHyperliquid(),
    collectOrderly()
  ]);
  
  // Collecter séquentiellement ceux qui nécessitent plusieurs appels
  const paradex = await collectParadex();
  const backpack = await collectBackpack();
  const hibachi = await collectHibachi();
  
  // Combiner tous les résultats
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
  
  // Préparer pour l'insertion
  const dataToInsert = allRates.map(rate => ({
    timestamp: timestamp.toISOString(),
    symbol: rate.symbol,
    exchange: rate.exchange,
    funding_rate_1h: rate.funding_rate_1h
  }));
  
  // Insérer dans Supabase
  if (dataToInsert.length > 0) {
    console.log('\n💾 Inserting into database...');
    
    const { error } = await supabase
      .from('funding_snapshots')
      .insert(dataToInsert);
    
    if (error) {
      console.error('❌ Database error:', error);
    } else {
      console.log('✅ Successfully inserted all funding rates!');
    }
  }
  
  return dataToInsert;
}

// Pour tester localement
if (require.main === module) {
  collectAllFundingRates()
    .then(data => {
      console.log('\n✅ Collection completed!');
      process.exit(0);
    })
    .catch(error => {
      console.error('❌ Fatal error:', error);
      process.exit(1);
    });
}

module.exports = { collectAllFundingRates };