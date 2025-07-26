// test-extended-simple.js
const axios = require('axios');

async function testExtended() {
  try {
    const { data: marketsData } = await axios.get('https://api.extended.exchange/api/v1/info/markets');
    
    const results = marketsData.data
      .filter(m => m.status === 'ACTIVE' && m.name && m.name.endsWith('-USD'))
      .slice(0, 5) // Juste les 5 premiers pour le test
      .map(m => ({
        symbol: m.name.replace('-USD', '').toUpperCase(),
        fundingRate: parseFloat(m.marketStats?.fundingRate || 0),
        nextFundingTime: new Date(m.marketStats?.nextFundingRate)
      }));
    
    console.log('Extended funding rates:');
    console.table(results);
    
  } catch (error) {
    console.error('Error:', error.message);
  }
}

testExtended();