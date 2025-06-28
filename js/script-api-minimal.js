// js/script-api-minimal.js - English version with Backpack (frontend only)

const API_URL = "/api/funding";
let dataStore = [];
let filterFavOnly = false;
let mustIncludeExchange = null; // Required exchange

const EX_LOGOS = {
  paradex: 'images/paradex.png',
  vest: 'images/vest.png',
  ext: 'images/extended.png',
  hyperliquid: 'images/hyperliquid.png',
  backpack: 'images/backpack.png'
};

const EX_REFLINKS = {
  paradex: 'https://app.paradex.trade/r/ghzcrypto',
  vest: 'https://trade.vest.exchange/join/GHZ50',
  ext: 'https://app.extended.exchange/join/GHZ',
  hyperliquid: 'https://app.hyperliquid.xyz/join/GHZ',
  backpack: 'https://backpack.exchange/join/0xtargeted'
};

const EX_LABELS = {
  paradex: "Paradex", 
  vest: "Vest", 
  ext: "Extended", 
  hyperliquid: "Hyperliquid",
  backpack: "Backpack"
};

// === UTILITIES ===
function getSelectedExchanges() {
  return Array.from(document.querySelectorAll('.exchange-filter:checked')).map(cb => cb.value);
}

// === FETCH DATA ===
async function fetchFundingData() {
  try {
    console.log('🔄 Fetching data...');
    const { data } = await axios.get(API_URL);
    dataStore = data;
    console.log(`✅ ${data.length} pairs loaded with Backpack data`);
    
    updateStats();
    renderTable();
    
  } catch (err) {
    console.error('❌ Fetch error:', err);
    document.querySelector('#arbitrage-table tbody').innerHTML = `
      <tr><td colspan="10" style="text-align:center;padding:40px;color:red;">
        Error: ${err.message}
        <br><button onclick="fetchFundingData()">Retry</button>
      </td></tr>
    `;
  }
}

// === UPDATE STATS ===
function updateStats() {
  if (!dataStore.length) return;
  
  const selectedExchanges = getSelectedExchanges();
  let maxApr = 0;
  let opportunities = 0;
  
  dataStore.forEach(item => {
    const rates = selectedExchanges.map(ex => {
      const key = ex === 'ext' ? 'ext1h' : `${ex}1h`;
      return item[key];
    }).filter(r => r !== null);
    
    if (rates.length >= 2) {
      const apr = (Math.max(...rates) - Math.min(...rates)) * 24 * 365 * 100;
      maxApr = Math.max(maxApr, apr);
      if (apr > 10) opportunities++;
    }
  });
  
  document.getElementById('stats-pairs').textContent = dataStore.length;
  document.getElementById('stats-max-apr').textContent = maxApr.toFixed(1) + '%';
  document.getElementById('stats-opportunities').textContent = opportunities;
  document.getElementById('stats-last-update').textContent = new Date().toLocaleTimeString('en-US', {
    hour: '2-digit', 
    minute: '2-digit',
    hour12: false
  });
}

// === RENDER TABLE ===
function renderTable() {
  const tbody = document.querySelector('#arbitrage-table tbody');
  const selectedExchanges = getSelectedExchanges();
  
  // Update header
  updateTableHeader(selectedExchanges);
  
  // Filter and process
  const opportunities = processData(selectedExchanges);
  
  if (opportunities.length === 0) {
    tbody.innerHTML = `
      <tr><td colspan="10" style="text-align:center;padding:40px;">
        ${filterFavOnly ? 'No favorites found' : 'No opportunities found'}
      </td></tr>
    `;
    return;
  }
  
  // Generate rows
  tbody.innerHTML = opportunities.map(op => createRow(op, selectedExchanges)).join('');
  
  // Favorites events
  tbody.addEventListener('click', (e) => {
    if (e.target.classList.contains('fav')) {
      window.favorites.toggle(e.target.dataset.symbol);
      renderTable();
    }
  });
}

// === UPDATE HEADER ===
function updateTableHeader(selectedExchanges) {
  const thead = document.querySelector('#arbitrage-table thead tr');
  
  const exchangeCols = selectedExchanges.map(ex => {
    const label = EX_LABELS[ex];
    return `<th><img src="${EX_LOGOS[ex]}" class="ex-logo-th" alt="${label}"> ${label} 1h</th>`;
  }).join('');
  
  thead.innerHTML = `
    <th>★</th>
    <th>Pair</th>
    ${exchangeCols}
    <th>Strategy</th>
    <th>APR</th>
    <th>Actions</th>
  `;
}

// === DATA PROCESSING ===
function processData(selectedExchanges) {
  return dataStore
    .filter(item => {
      // Favorites filter
      if (filterFavOnly && !window.favorites.isFav(item.symbol)) return false;
      
      // Check we have at least 2 exchanges with data
      const rates = selectedExchanges.map(ex => {
        const key = ex === 'ext' ? 'ext1h' : `${ex}1h`;
        return { dex: ex, rate: item[key] };
      }).filter(r => r.rate !== null && r.rate !== undefined);
      
      if (rates.length < 2) return false;
      
      // Must include exchange verification
      if (mustIncludeExchange) {
        const mustIncludeKey = mustIncludeExchange === 'ext' ? 'ext1h' : `${mustIncludeExchange}1h`;
        const mustIncludeRate = item[mustIncludeKey];
        
        // If required exchange has no data, exclude this pair
        if (mustIncludeRate === null || mustIncludeRate === undefined) {
          return false;
        }
        
        // Check that required exchange is also selected in filters
        if (!selectedExchanges.includes(mustIncludeExchange)) {
          return false;
        }
        
        // NEW CHECK: Required exchange must be either min or max
        const min = rates.reduce((a, b) => a.rate < b.rate ? a : b);
        const max = rates.reduce((a, b) => a.rate > b.rate ? a : b);
        
        // If required exchange is neither min nor max, exclude this pair
        if (min.dex !== mustIncludeExchange && max.dex !== mustIncludeExchange) {
          return false;
        }
      }
      
      return true;
    })
    .map(item => {
      const rates = selectedExchanges.map(ex => {
        const key = ex === 'ext' ? 'ext1h' : `${ex}1h`;
        const label = EX_LABELS[ex];
        return { dex: ex, label, rate: item[key] };
      }).filter(r => r.rate !== null && r.rate !== undefined);
      
      const min = rates.reduce((a, b) => a.rate < b.rate ? a : b);
      const max = rates.reduce((a, b) => a.rate > b.rate ? a : b);
      const apr = (max.rate - min.rate) * 24 * 365 * 100;
      
      return { symbol: item.symbol, rates, min, max, apr };
    })
    .sort((a, b) => b.apr - a.apr);
}

// === CREATE ROW ===
function createRow(op, selectedExchanges) {
  const { symbol, rates, min, max, apr } = op;
  
  const favClass = window.favorites?.isFav(symbol) ? "fav active" : "fav";
  
  const rateCols = selectedExchanges.map(ex => {
    const rate = rates.find(r => r.dex === ex);
    if (!rate) return '<td style="color:#6b7280;">—</td>';
    
    const isMin = rate.dex === min.dex;
    const isMax = rate.dex === max.dex;
    
    let style = 'color:#f3f4f6;';
    
    if (isMin) {
      // LONG styling
      style = 'background:#064e3b;border-left:3px solid #10b981;color:#34d399;';
    }
    
    if (isMax) {
      // SHORT styling
      style = 'background:#7f1d1d;border-left:3px solid #ef4444;color:#fca5a5;';
    }
    
    return `<td style="${style}">
      <img src="${EX_LOGOS[rate.dex]}" class="ex-logo-td">${rate.rate.toFixed(6)}
      ${isMin ? '<br><small style="color:#34d399;font-weight:600;">LONG</small>' : ''}
      ${isMax ? '<br><small style="color:#fca5a5;font-weight:600;">SHORT</small>' : ''}
    </td>`;
  }).join('');
  
  const strategy = `Long <a href="${EX_REFLINKS[min.dex]}" target="_blank" style="color:#34d399;text-decoration:none;">${min.label}</a>, Short <a href="${EX_REFLINKS[max.dex]}" target="_blank" style="color:#fca5a5;text-decoration:none;">${max.label}</a>`;
  
  return `
    <tr>
      <td><span class="${favClass}" data-symbol="${symbol}">★</span></td>
      <td style="font-weight:600;color:#ff5c5c;">${symbol}</td>
      ${rateCols}
      <td style="font-size:0.9rem;color:#e5e7eb;">${strategy}</td>
      <td style="font-weight:700;color:#34d399;">${apr.toFixed(2)}%</td>
      <td>
        <button class="share-btn"
          data-pair="${symbol}"
          data-long="${min.label}"
          data-long-dex="${min.dex}"
          data-long-rate="${min.rate}"
          data-short="${max.label}"
          data-short-dex="${max.dex}"
          data-short-rate="${max.rate}"
          data-apr="${apr.toFixed(2)}"
          style="background:none;border:1px solid #374151;padding:4px;border-radius:4px;cursor:pointer;">
          <img src="images/shares.svg" alt="Share" style="width:16px;height:16px;filter:invert(1);" />
        </button>
      </td>
    </tr>
  `;
}

// === SORTING ===
function sortData() {
  dataStore.sort((a, b) => {
    const selectedExchanges = getSelectedExchanges();
    
    function getApr(item) {
      const rates = selectedExchanges.map(ex => {
        const key = ex === 'ext' ? 'ext1h' : `${ex}1h`;
        return item[key];
      }).filter(r => r !== null);
      
      if (rates.length < 2) return 0;
      return (Math.max(...rates) - Math.min(...rates)) * 24 * 365 * 100;
    }
    
    return getApr(b) - getApr(a);
  });
  
  renderTable();
}

// === FAVORITES ===
function toggleFavorites() {
  filterFavOnly = !filterFavOnly;
  const btn = document.getElementById('filter-fav-btn');
  btn.textContent = filterFavOnly ? 'Show all' : 'Show favorites';
  renderTable();
}

// === EVENTS ===
document.addEventListener('DOMContentLoaded', () => {
  console.log('🚀 English script with Backpack loaded');
  
  // Buttons with checks
  const sortBtn = document.getElementById('sort-apr-btn');
  const favBtn = document.getElementById('filter-fav-btn');
  const refreshBtn = document.getElementById('refresh-btn');
  
  if (sortBtn) sortBtn.addEventListener('click', sortData);
  if (favBtn) favBtn.addEventListener('click', toggleFavorites);
  if (refreshBtn) refreshBtn.addEventListener('click', () => {
    console.log('🔄 Manual refresh...');
    fetchFundingData();
  });
  
  // Must Include buttons
  document.querySelectorAll('.exchange-must-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const exchange = btn.dataset.exchange;
      
      // Toggle required exchange
      if (mustIncludeExchange === exchange) {
        mustIncludeExchange = null;
        btn.classList.remove('active');
        console.log('🔓 Cleared required exchange');
      } else {
        // Disable other buttons
        document.querySelectorAll('.exchange-must-btn').forEach(b => {
          b.classList.remove('active');
        });
        
        // Activate this button
        mustIncludeExchange = exchange;
        btn.classList.add('active');
        console.log(`🔒 Required exchange: ${exchange}`);
      }
      
      renderTable();
    });
  });
  
  // Clear button
  const clearBtn = document.getElementById('filter-must-clear');
  if (clearBtn) {
    clearBtn.addEventListener('click', () => {
      mustIncludeExchange = null;
      document.querySelectorAll('.exchange-must-btn').forEach(btn => {
        btn.classList.remove('active');
      });
      console.log('🗑️ Cleared all filters');
      renderTable();
    });
  }
  
  // Exchanges
  document.querySelectorAll('.exchange-filter').forEach(cb => {
    cb.addEventListener('change', renderTable);
  });
  
  // Initial load
  fetchFundingData();
  
  // Auto-refresh every 2 minutes
  setInterval(() => {
    console.log('🔄 Auto refresh...');
    fetchFundingData();
  }, 120000);
});

// === COMPLETE SHARE MODAL ===
document.addEventListener('click', function(e) {
  if (e.target.closest('.share-btn')) {
    const btn = e.target.closest('.share-btn');
    const data = {
      pair: btn.dataset.pair,
      long: btn.dataset.long,
      longDex: btn.dataset.longDex,
      longRate: btn.dataset.longRate,
      short: btn.dataset.short,
      shortDex: btn.dataset.shortDex,
      shortRate: btn.dataset.shortRate,
      apr: btn.dataset.apr
    };
    
    createShareModal(data);
  }
  
  // Close modal
  if (e.target.classList.contains('arb-card-close') || 
      e.target.classList.contains('arb-card-bg')) {
    closeShareModal();
  }
  
  // Share image
  if (e.target.closest('.arb-card-share')) {
    shareArbitrageCard();
  }
});

function createShareModal(data) {
  const tokenIcon = `images/${data.pair.toLowerCase()}.png`;
  const dateStr = new Date().toLocaleString('en-US', {
    month: "2-digit", 
    day: "2-digit", 
    year: "numeric",
    hour: "2-digit", 
    minute: "2-digit",
    hour12: false
  });
  
  const modalHTML = `
    <div class="arb-card-ghz" style="position:fixed;left:50%;top:50%;transform:translate(-50%,-50%);background:#191b1f;color:#fff;border-radius:18px;box-shadow:0 2px 32px rgba(179,0,0,0.3);min-width:380px;max-width:94vw;padding:30px 36px 28px 36px;z-index:20;font-family:inherit;">
      <div style="display:flex;align-items:center;justify-content:space-between;width:100%;margin-bottom:22px;">
        <img src="${tokenIcon}" style="width:48px;height:48px;border-radius:50%;margin-right:16px;background:#fff;" onerror="this.style.display='none'">
        <span style="color:#ff5c5c;font-size:1.5em;font-weight:bold;margin-right:auto;">${data.pair}</span>
        <span style="font-size:1.09em;color:#aaa;margin-left:18px;">${dateStr}</span>
      </div>
      <div style="display:flex;gap:24px;margin-bottom:16px;">
        <span style="display:flex;align-items:center;font-size:1.18em;font-weight:bold;padding:6px 20px;border-radius:12px;background:#143f1e;color:#21e686;border:2px solid #2ecc40;">
          <img src="${EX_LOGOS[data.longDex]}" style="height:18px;width:18px;margin-right:8px;">
          Long ${data.long}
        </span>
        <span style="display:flex;align-items:center;font-size:1.18em;font-weight:bold;padding:6px 20px;border-radius:12px;background:#321112;color:#ff5c5c;border:2px solid #b30000;">
          <img src="${EX_LOGOS[data.shortDex]}" style="height:18px;width:18px;margin-right:8px;">
          Short ${data.short}
        </span>
      </div>
      <div style="margin-bottom:10px;font-size:1.25em;">
        <span style="color:#aaa;margin-right:6px;">APR:</span>
        <span style="color:#21e686;font-weight:bold;font-size:1.22em;">+${data.apr}%</span>
      </div>
      <div style="font-size:1.08em;color:#eee;margin-bottom:28px;">
        <span style="margin-right:20px;">${data.long}: <b>${Number(data.longRate).toFixed(6)}</b></span>
        <span>${data.short}: <b>${Number(data.shortRate).toFixed(6)}</b></span>
      </div>
      <div style="margin-bottom:8px;">
        by <a href="https://twitter.com/ilyessghz2" target="_blank" style="color:#ff5c5c;text-decoration:none;font-weight:600;">@ilyessghz2</a>
        | <a href="https://ghzperpdextools.vercel.app" target="_blank" style="color:#ff5c5c;text-decoration:none;font-weight:600;">ghzperpdextools.vercel.app</a>
      </div>
      <button class="arb-card-share" style="margin-top:6px;padding:12px 38px;background:none;border:2px solid #ff5c5c;color:#ff5c5c;font-weight:bold;border-radius:10px;font-size:1.1em;cursor:pointer;transition:all 0.14s;">
        📤 Share
      </button>
      <button class="arb-card-close" style="position:absolute;top:17px;right:19px;background:none;border:none;color:#ff5c5c;font-size:2.2em;font-weight:bold;cursor:pointer;">&times;</button>
    </div>
    <div class="arb-card-bg" style="position:fixed;left:0;top:0;width:100vw;height:100vh;background:rgba(0,0,0,0.7);z-index:10;"></div>
  `;
  
  const modal = document.getElementById('card-modal');
  modal.innerHTML = modalHTML;
  modal.style.display = "block";
  document.body.style.overflow = 'hidden';
}

function closeShareModal() {
  const modal = document.getElementById('card-modal');
  modal.style.display = "none";
  document.body.style.overflow = 'auto';
}

function shareArbitrageCard() {
  const card = document.querySelector('.arb-card-ghz');
  if (!card) return;
  
  if (window.html2canvas) {
    window.html2canvas(card, { backgroundColor: null, scale: 2 }).then(canvas => {
      canvas.toBlob(blob => {
        if (navigator.clipboard && window.ClipboardItem) {
          navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
          alert('📋 Image copied to clipboard!');
        } else {
          const link = document.createElement('a');
          link.download = `arbitrage-${Date.now()}.png`;
          link.href = canvas.toDataURL();
          link.click();
          alert('📥 Image downloaded!');
        }
      });
    });
  } else {
    alert('Share function not available');
  }
}

console.log('✅ English script with Backpack loaded');

// === UPDATE STATS ===
function updateStats() {
  if (!dataStore.length) return;
  
  const selectedExchanges = getSelectedExchanges();
  let maxApr = 0;
  let opportunities = 0;
  
  dataStore.forEach(item => {
    const rates = selectedExchanges.map(ex => {
      const key = ex === 'ext' ? 'ext1h' : `${ex}1h`;
      return item[key];
    }).filter(r => r !== null);
    
    if (rates.length >= 2) {
      const apr = (Math.max(...rates) - Math.min(...rates)) * 24 * 365 * 100;
      maxApr = Math.max(maxApr, apr);
      if (apr > 10) opportunities++;
    }
  });
  
  document.getElementById('stats-pairs').textContent = dataStore.length;
  document.getElementById('stats-max-apr').textContent = maxApr.toFixed(1) + '%';
  document.getElementById('stats-opportunities').textContent = opportunities;
  document.getElementById('stats-last-update').textContent = new Date().toLocaleTimeString('en-US', {
    hour: '2-digit', 
    minute: '2-digit',
    hour12: false
  });
}

// === RENDER TABLE ===
function renderTable() {
  const tbody = document.querySelector('#arbitrage-table tbody');
  const selectedExchanges = getSelectedExchanges();
  
  // Update header
  updateTableHeader(selectedExchanges);
  
  // Filter and process
  const opportunities = processData(selectedExchanges);
  
  if (opportunities.length === 0) {
    tbody.innerHTML = `
      <tr><td colspan="10" style="text-align:center;padding:40px;">
        ${filterFavOnly ? 'No favorites found' : 'No opportunities found'}
      </td></tr>
    `;
    return;
  }
  
  // Generate rows
  tbody.innerHTML = opportunities.map(op => createRow(op, selectedExchanges)).join('');
  
  // Favorites events
  tbody.addEventListener('click', (e) => {
    if (e.target.classList.contains('fav')) {
      window.favorites.toggle(e.target.dataset.symbol);
      renderTable();
    }
  });
}

// === UPDATE HEADER ===
function updateTableHeader(selectedExchanges) {
  const thead = document.querySelector('#arbitrage-table thead tr');
  
  const exchangeCols = selectedExchanges.map(ex => {
    const label = EX_LABELS[ex];
    return `<th><img src="${EX_LOGOS[ex]}" class="ex-logo-th" alt="${label}"> ${label} 1h</th>`;
  }).join('');
  
  thead.innerHTML = `
    <th>★</th>
    <th>Pair</th>
    ${exchangeCols}
    <th>Strategy</th>
    <th>APR</th>
    <th>Actions</th>
  `;
}

// === DATA PROCESSING ===
function processData(selectedExchanges) {
  return dataStore
    .filter(item => {
      // Favorites filter
      if (filterFavOnly && !window.favorites.isFav(item.symbol)) return false;
      
      // Check we have at least 2 exchanges with data
      const rates = selectedExchanges.map(ex => {
        const key = ex === 'ext' ? 'ext1h' : `${ex}1h`;
        return { dex: ex, rate: item[key] };
      }).filter(r => r.rate !== null && r.rate !== undefined);
      
      if (rates.length < 2) return false;
      
      // Must include exchange verification
      if (mustIncludeExchange) {
        const mustIncludeKey = mustIncludeExchange === 'ext' ? 'ext1h' : `${mustIncludeExchange}1h`;
        const mustIncludeRate = item[mustIncludeKey];
        
        // If required exchange has no data, exclude this pair
        if (mustIncludeRate === null || mustIncludeRate === undefined) {
          return false;
        }
        
        // Check that required exchange is also selected in filters
        if (!selectedExchanges.includes(mustIncludeExchange)) {
          return false;
        }
        
        // NEW CHECK: Required exchange must be either min or max
        const min = rates.reduce((a, b) => a.rate < b.rate ? a : b);
        const max = rates.reduce((a, b) => a.rate > b.rate ? a : b);
        
        // If required exchange is neither min nor max, exclude this pair
        if (min.dex !== mustIncludeExchange && max.dex !== mustIncludeExchange) {
          return false;
        }
      }
      
      return true;
    })
    .map(item => {
      const rates = selectedExchanges.map(ex => {
        const key = ex === 'ext' ? 'ext1h' : `${ex}1h`;
        const label = EX_LABELS[ex];
        return { dex: ex, label, rate: item[key] };
      }).filter(r => r.rate !== null && r.rate !== undefined);
      
      const min = rates.reduce((a, b) => a.rate < b.rate ? a : b);
      const max = rates.reduce((a, b) => a.rate > b.rate ? a : b);
      const apr = (max.rate - min.rate) * 24 * 365 * 100;
      
      return { symbol: item.symbol, rates, min, max, apr };
    })
    .sort((a, b) => b.apr - a.apr);
}

// === CREATE ROW ===
function createRow(op, selectedExchanges) {
  const { symbol, rates, min, max, apr } = op;
  
  const favClass = window.favorites?.isFav(symbol) ? "fav active" : "fav";
  
  const rateCols = selectedExchanges.map(ex => {
    const rate = rates.find(r => r.dex === ex);
    if (!rate) return '<td style="color:#6b7280;">—</td>';
    
    const isMin = rate.dex === min.dex;
    const isMax = rate.dex === max.dex;
    
    let style = 'color:#f3f4f6;';
    
    if (isMin) {
      // LONG styling
      style = 'background:#064e3b;border-left:3px solid #10b981;color:#34d399;';
    }
    
    if (isMax) {
      // SHORT styling
      style = 'background:#7f1d1d;border-left:3px solid #ef4444;color:#fca5a5;';
    }
    
    return `<td style="${style}">
      <img src="${EX_LOGOS[rate.dex]}" class="ex-logo-td">${rate.rate.toFixed(6)}
      ${isMin ? '<br><small style="color:#34d399;font-weight:600;">LONG</small>' : ''}
      ${isMax ? '<br><small style="color:#fca5a5;font-weight:600;">SHORT</small>' : ''}
    </td>`;
  }).join('');
  
  const strategy = `Long <a href="${EX_REFLINKS[min.dex]}" target="_blank" style="color:#34d399;text-decoration:none;">${min.label}</a>, Short <a href="${EX_REFLINKS[max.dex]}" target="_blank" style="color:#fca5a5;text-decoration:none;">${max.label}</a>`;
  
  return `
    <tr>
      <td><span class="${favClass}" data-symbol="${symbol}">★</span></td>
      <td style="font-weight:600;color:#ff5c5c;">${symbol}</td>
      ${rateCols}
      <td style="font-size:0.9rem;color:#e5e7eb;">${strategy}</td>
      <td style="font-weight:700;color:#34d399;">${apr.toFixed(2)}%</td>
      <td>
        <button class="share-btn"
          data-pair="${symbol}"
          data-long="${min.label}"
          data-long-dex="${min.dex}"
          data-long-rate="${min.rate}"
          data-short="${max.label}"
          data-short-dex="${max.dex}"
          data-short-rate="${max.rate}"
          data-apr="${apr.toFixed(2)}"
          style="background:none;border:1px solid #374151;padding:4px;border-radius:4px;cursor:pointer;">
          <img src="images/shares.svg" alt="Share" style="width:16px;height:16px;filter:invert(1);" />
        </button>
      </td>
    </tr>
  `;
}

// === SORTING ===
function sortData() {
  dataStore.sort((a, b) => {
    const selectedExchanges = getSelectedExchanges();
    
    function getApr(item) {
      const rates = selectedExchanges.map(ex => {
        const key = ex === 'ext' ? 'ext1h' : `${ex}1h`;
        return item[key];
      }).filter(r => r !== null);
      
      if (rates.length < 2) return 0;
      return (Math.max(...rates) - Math.min(...rates)) * 24 * 365 * 100;
    }
    
    return getApr(b) - getApr(a);
  });
  
  renderTable();
}

// === FAVORITES ===
function toggleFavorites() {
  filterFavOnly = !filterFavOnly;
  const btn = document.getElementById('filter-fav-btn');
  btn.textContent = filterFavOnly ? 'Show all' : 'Show favorites';
  renderTable();
}

// === EVENTS ===
document.addEventListener('DOMContentLoaded', () => {
  console.log('🚀 English script with Backpack loaded');
  
  // Buttons with checks
  const sortBtn = document.getElementById('sort-apr-btn');
  const favBtn = document.getElementById('filter-fav-btn');
  const refreshBtn = document.getElementById('refresh-btn');
  
  if (sortBtn) sortBtn.addEventListener('click', sortData);
  if (favBtn) favBtn.addEventListener('click', toggleFavorites);
  if (refreshBtn) refreshBtn.addEventListener('click', () => {
    console.log('🔄 Manual refresh...');
    fetchFundingData();
  });
  
  // Must Include buttons
  document.querySelectorAll('.exchange-must-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const exchange = btn.dataset.exchange;
      
      // Toggle required exchange
      if (mustIncludeExchange === exchange) {
        mustIncludeExchange = null;
        btn.classList.remove('active');
        console.log('🔓 Cleared required exchange');
      } else {
        // Disable other buttons
        document.querySelectorAll('.exchange-must-btn').forEach(b => {
          b.classList.remove('active');
        });
        
        // Activate this button
        mustIncludeExchange = exchange;
        btn.classList.add('active');
        console.log(`🔒 Required exchange: ${exchange}`);
      }
      
      renderTable();
    });
  });
  
  // Clear button
  const clearBtn = document.getElementById('filter-must-clear');
  if (clearBtn) {
    clearBtn.addEventListener('click', () => {
      mustIncludeExchange = null;
      document.querySelectorAll('.exchange-must-btn').forEach(btn => {
        btn.classList.remove('active');
      });
      console.log('🗑️ Cleared all filters');
      renderTable();
    });
  }
  
  // Exchanges
  document.querySelectorAll('.exchange-filter').forEach(cb => {
    cb.addEventListener('change', renderTable);
  });
  
  // Initial load
  fetchFundingData();
  
  // Auto-refresh every 2 minutes
  setInterval(() => {
    console.log('🔄 Auto refresh...');
    fetchFundingData();
  }, 120000);
});

// === COMPLETE SHARE MODAL ===
document.addEventListener('click', function(e) {
  if (e.target.closest('.share-btn')) {
    const btn = e.target.closest('.share-btn');
    const data = {
      pair: btn.dataset.pair,
      long: btn.dataset.long,
      longDex: btn.dataset.longDex,
      longRate: btn.dataset.longRate,
      short: btn.dataset.short,
      shortDex: btn.dataset.shortDex,
      shortRate: btn.dataset.shortRate,
      apr: btn.dataset.apr
    };
    
    createShareModal(data);
  }
  
  // Close modal
  if (e.target.classList.contains('arb-card-close') || 
      e.target.classList.contains('arb-card-bg')) {
    closeShareModal();
  }
  
  // Share image
  if (e.target.closest('.arb-card-share')) {
    shareArbitrageCard();
  }
});

function createShareModal(data) {
  const tokenIcon = `images/${data.pair.toLowerCase()}.png`;
  const dateStr = new Date().toLocaleString('en-US', {
    month: "2-digit", 
    day: "2-digit", 
    year: "numeric",
    hour: "2-digit", 
    minute: "2-digit",
    hour12: false
  });
  
  const modalHTML = `
    <div class="arb-card-ghz" style="position:fixed;left:50%;top:50%;transform:translate(-50%,-50%);background:#191b1f;color:#fff;border-radius:18px;box-shadow:0 2px 32px rgba(179,0,0,0.3);min-width:380px;max-width:94vw;padding:30px 36px 28px 36px;z-index:20;font-family:inherit;">
      <div style="display:flex;align-items:center;justify-content:space-between;width:100%;margin-bottom:22px;">
        <img src="${tokenIcon}" style="width:48px;height:48px;border-radius:50%;margin-right:16px;background:#fff;" onerror="this.style.display='none'">
        <span style="color:#ff5c5c;font-size:1.5em;font-weight:bold;margin-right:auto;">${data.pair}</span>
        <span style="font-size:1.09em;color:#aaa;margin-left:18px;">${dateStr}</span>
      </div>
      <div style="display:flex;gap:24px;margin-bottom:16px;">
        <span style="display:flex;align-items:center;font-size:1.18em;font-weight:bold;padding:6px 20px;border-radius:12px;background:#143f1e;color:#21e686;border:2px solid #2ecc40;">
          <img src="${EX_LOGOS[data.longDex]}" style="height:18px;width:18px;margin-right:8px;">
          Long ${data.long}
        </span>
        <span style="display:flex;align-items:center;font-size:1.18em;font-weight:bold;padding:6px 20px;border-radius:12px;background:#321112;color:#ff5c5c;border:2px solid #b30000;">
          <img src="${EX_LOGOS[data.shortDex]}" style="height:18px;width:18px;margin-right:8px;">
          Short ${data.short}
        </span>
      </div>
      <div style="margin-bottom:10px;font-size:1.25em;">
        <span style="color:#aaa;margin-right:6px;">APR:</span>
        <span style="color:#21e686;font-weight:bold;font-size:1.22em;">+${data.apr}%</span>
      </div>
      <div style="font-size:1.08em;color:#eee;margin-bottom:28px;">
        <span style="margin-right:20px;">${data.long}: <b>${Number(data.longRate).toFixed(6)}</b></span>
        <span>${data.short}: <b>${Number(data.shortRate).toFixed(6)}</b></span>
      </div>
      <div style="margin-bottom:8px;">
        by <a href="https://twitter.com/ilyessghz2" target="_blank" style="color:#ff5c5c;text-decoration:none;font-weight:600;">@ilyessghz2</a>
        | <a href="https://ghzperpdextools.vercel.app/" target="_blank" style="color:#ff5c5c;text-decoration:none;font-weight:600;">ghzperpdextools.vercel.app</a>
      </div>
      <button class="arb-card-share" style="margin-top:6px;padding:12px 38px;background:none;border:2px solid #ff5c5c;color:#ff5c5c;font-weight:bold;border-radius:10px;font-size:1.1em;cursor:pointer;transition:all 0.14s;">
        📤 Share
      </button>
      <button class="arb-card-close" style="position:absolute;top:17px;right:19px;background:none;border:none;color:#ff5c5c;font-size:2.2em;font-weight:bold;cursor:pointer;">&times;</button>
    </div>
    <div class="arb-card-bg" style="position:fixed;left:0;top:0;width:100vw;height:100vh;background:rgba(0,0,0,0.7);z-index:10;"></div>
  `;
  
  const modal = document.getElementById('card-modal');
  modal.innerHTML = modalHTML;
  modal.style.display = "block";
  document.body.style.overflow = 'hidden';
}

function closeShareModal() {
  const modal = document.getElementById('card-modal');
  modal.style.display = "none";
  document.body.style.overflow = 'auto';
}

function shareArbitrageCard() {
  const card = document.querySelector('.arb-card-ghz');
  if (!card) return;
  
  if (window.html2canvas) {
    window.html2canvas(card, { backgroundColor: null, scale: 2 }).then(canvas => {
      canvas.toBlob(blob => {
        if (navigator.clipboard && window.ClipboardItem) {
          navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
          alert('📋 Image copied to clipboard!');
        } else {
          const link = document.createElement('a');
          link.download = `arbitrage-${Date.now()}.png`;
          link.href = canvas.toDataURL();
          link.click();
          alert('📥 Image downloaded!');
        }
      });
    });
  } else {
    alert('Share function not available');
  }
}

console.log('✅ English script with Backpack loaded');

// === UTILITIES ===
function getSelectedExchanges() {
  return Array.from(document.querySelectorAll('.exchange-filter:checked')).map(cb => cb.value);
}

// === FETCH DATA ===
async function fetchFundingData() {
  try {
    console.log('🔄 Fetching data...');
    const { data } = await axios.get(API_URL);
    dataStore = data;
    console.log(`✅ ${data.length} pairs loaded`);
    
    updateStats();
    renderTable();
    
  } catch (err) {
    console.error('❌ Fetch error:', err);
    document.querySelector('#arbitrage-table tbody').innerHTML = `
      <tr><td colspan="9" style="text-align:center;padding:40px;color:red;">
        Error: ${err.message}
        <br><button onclick="fetchFundingData()">Retry</button>
      </td></tr>
    `;
  }
}

// === UPDATE STATS ===
function updateStats() {
  if (!dataStore.length) return;
  
  const selectedExchanges = getSelectedExchanges();
  let maxApr = 0;
  let opportunities = 0;
  
  dataStore.forEach(item => {
    const rates = selectedExchanges.map(ex => {
      const key = ex === 'ext' ? 'ext1h' : `${ex}1h`;
      return item[key];
    }).filter(r => r !== null);
    
    if (rates.length >= 2) {
      const apr = (Math.max(...rates) - Math.min(...rates)) * 24 * 365 * 100;
      maxApr = Math.max(maxApr, apr);
      if (apr > 10) opportunities++;
    }
  });
  
  document.getElementById('stats-pairs').textContent = dataStore.length;
  document.getElementById('stats-max-apr').textContent = maxApr.toFixed(1) + '%';
  document.getElementById('stats-opportunities').textContent = opportunities;
  document.getElementById('stats-last-update').textContent = new Date().toLocaleTimeString('en-US', {
    hour: '2-digit', 
    minute: '2-digit',
    hour12: false
  });
}

// === RENDER TABLE ===
function renderTable() {
  const tbody = document.querySelector('#arbitrage-table tbody');
  const selectedExchanges = getSelectedExchanges();
  
  // Update header
  updateTableHeader(selectedExchanges);
  
  // Filter and process
  const opportunities = processData(selectedExchanges);
  
  if (opportunities.length === 0) {
    tbody.innerHTML = `
      <tr><td colspan="9" style="text-align:center;padding:40px;">
        ${filterFavOnly ? 'No favorites found' : 'No opportunities found'}
      </td></tr>
    `;
    return;
  }
  
  // Generate rows
  tbody.innerHTML = opportunities.map(op => createRow(op, selectedExchanges)).join('');
  
  // Favorites events
  tbody.addEventListener('click', (e) => {
    if (e.target.classList.contains('fav')) {
      window.favorites.toggle(e.target.dataset.symbol);
      renderTable();
    }
  });
}

// === UPDATE HEADER ===
function updateTableHeader(selectedExchanges) {
  const thead = document.querySelector('#arbitrage-table thead tr');
  
  const exchangeCols = selectedExchanges.map(ex => {
    const label = EX_LABELS[ex];
    return `<th><img src="${EX_LOGOS[ex]}" class="ex-logo-th" alt="${label}"> ${label} 1h</th>`;
  }).join('');
  
  thead.innerHTML = `
    <th>★</th>
    <th>Pair</th>
    ${exchangeCols}
    <th>Strategy</th>
    <th>APR</th>
    <th>Actions</th>
  `;
}

// === DATA PROCESSING ===
function processData(selectedExchanges) {
  return dataStore
    .filter(item => {
      // Favorites filter
      if (filterFavOnly && !window.favorites.isFav(item.symbol)) return false;
      
      // Check we have at least 2 exchanges with data
      const rates = selectedExchanges.map(ex => {
        const key = ex === 'ext' ? 'ext1h' : `${ex}1h`;
        return { dex: ex, rate: item[key] };
      }).filter(r => r.rate !== null && r.rate !== undefined);
      
      if (rates.length < 2) return false;
      
      // Must include exchange verification
      if (mustIncludeExchange) {
        const mustIncludeKey = mustIncludeExchange === 'ext' ? 'ext1h' : `${mustIncludeExchange}1h`;
        const mustIncludeRate = item[mustIncludeKey];
        
        // If required exchange has no data, exclude this pair
        if (mustIncludeRate === null || mustIncludeRate === undefined) {
          return false;
        }
        
        // Check that required exchange is also selected in filters
        if (!selectedExchanges.includes(mustIncludeExchange)) {
          return false;
        }
        
        // NEW CHECK: Required exchange must be either min or max
        const min = rates.reduce((a, b) => a.rate < b.rate ? a : b);
        const max = rates.reduce((a, b) => a.rate > b.rate ? a : b);
        
        // If required exchange is neither min nor max, exclude this pair
        if (min.dex !== mustIncludeExchange && max.dex !== mustIncludeExchange) {
          return false;
        }
      }
      
      return true;
    })
    .map(item => {
      const rates = selectedExchanges.map(ex => {
        const key = ex === 'ext' ? 'ext1h' : `${ex}1h`;
        const label = EX_LABELS[ex];
        return { dex: ex, label, rate: item[key] };
      }).filter(r => r.rate !== null && r.rate !== undefined);
      
      const min = rates.reduce((a, b) => a.rate < b.rate ? a : b);
      const max = rates.reduce((a, b) => a.rate > b.rate ? a : b);
      const apr = (max.rate - min.rate) * 24 * 365 * 100;
      
      return { symbol: item.symbol, rates, min, max, apr };
    })
    .sort((a, b) => b.apr - a.apr);
}

// === CREATE ROW ===
function createRow(op, selectedExchanges) {
  const { symbol, rates, min, max, apr } = op;
  
  const favClass = window.favorites?.isFav(symbol) ? "fav active" : "fav";
  
  const rateCols = selectedExchanges.map(ex => {
    const rate = rates.find(r => r.dex === ex);
    if (!rate) return '<td style="color:#6b7280;">—</td>';
    
    const isMin = rate.dex === min.dex;
    const isMax = rate.dex === max.dex;
    
    let style = 'color:#f3f4f6;';
    
    if (isMin) {
      // LONG styling
      style = 'background:#064e3b;border-left:3px solid #10b981;color:#34d399;';
    }
    
    if (isMax) {
      // SHORT styling
      style = 'background:#7f1d1d;border-left:3px solid #ef4444;color:#fca5a5;';
    }
    
    return `<td style="${style}">
      <img src="${EX_LOGOS[rate.dex]}" class="ex-logo-td">${rate.rate.toFixed(6)}
      ${isMin ? '<br><small style="color:#34d399;font-weight:600;">LONG</small>' : ''}
      ${isMax ? '<br><small style="color:#fca5a5;font-weight:600;">SHORT</small>' : ''}
    </td>`;
  }).join('');
  
  const strategy = `Long <a href="${EX_REFLINKS[min.dex]}" target="_blank" style="color:#34d399;text-decoration:none;">${min.label}</a>, Short <a href="${EX_REFLINKS[max.dex]}" target="_blank" style="color:#fca5a5;text-decoration:none;">${max.label}</a>`;
  
  return `
    <tr>
      <td><span class="${favClass}" data-symbol="${symbol}">★</span></td>
      <td style="font-weight:600;color:#ff5c5c;">${symbol}</td>
      ${rateCols}
      <td style="font-size:0.9rem;color:#e5e7eb;">${strategy}</td>
      <td style="font-weight:700;color:#34d399;">${apr.toFixed(2)}%</td>
      <td>
        <button class="share-btn"
          data-pair="${symbol}"
          data-long="${min.label}"
          data-long-dex="${min.dex}"
          data-long-rate="${min.rate}"
          data-short="${max.label}"
          data-short-dex="${max.dex}"
          data-short-rate="${max.rate}"
          data-apr="${apr.toFixed(2)}"
          style="background:none;border:1px solid #374151;padding:4px;border-radius:4px;cursor:pointer;">
          <img src="images/shares.svg" alt="Share" style="width:16px;height:16px;filter:invert(1);" />
        </button>
      </td>
    </tr>
  `;
}

// === SORTING ===
function sortData() {
  dataStore.sort((a, b) => {
    const selectedExchanges = getSelectedExchanges();
    
    function getApr(item) {
      const rates = selectedExchanges.map(ex => {
        const key = ex === 'ext' ? 'ext1h' : `${ex}1h`;
        return item[key];
      }).filter(r => r !== null);
      
      if (rates.length < 2) return 0;
      return (Math.max(...rates) - Math.min(...rates)) * 24 * 365 * 100;
    }
    
    return getApr(b) - getApr(a);
  });
  
  renderTable();
}

// === FAVORITES ===
function toggleFavorites() {
  filterFavOnly = !filterFavOnly;
  const btn = document.getElementById('filter-fav-btn');
  btn.textContent = filterFavOnly ? 'Show all' : 'Show favorites';
  renderTable();
}

// === EVENTS ===
document.addEventListener('DOMContentLoaded', () => {
  console.log('🚀 English script loaded');
  
  // Buttons with checks
  const sortBtn = document.getElementById('sort-apr-btn');
  const favBtn = document.getElementById('filter-fav-btn');
  const refreshBtn = document.getElementById('refresh-btn');
  
  if (sortBtn) sortBtn.addEventListener('click', sortData);
  if (favBtn) favBtn.addEventListener('click', toggleFavorites);
  if (refreshBtn) refreshBtn.addEventListener('click', () => {
    console.log('🔄 Manual refresh...');
    fetchFundingData();
  });
  
  // Must Include buttons
  document.querySelectorAll('.exchange-must-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const exchange = btn.dataset.exchange;
      
      // Toggle required exchange
      if (mustIncludeExchange === exchange) {
        mustIncludeExchange = null;
        btn.classList.remove('active');
        console.log('🔓 Cleared required exchange');
      } else {
        // Disable other buttons
        document.querySelectorAll('.exchange-must-btn').forEach(b => {
          b.classList.remove('active');
        });
        
        // Activate this button
        mustIncludeExchange = exchange;
        btn.classList.add('active');
        console.log(`🔒 Required exchange: ${exchange}`);
      }
      
      renderTable();
    });
  });
  
  // Clear button
  const clearBtn = document.getElementById('filter-must-clear');
  if (clearBtn) {
    clearBtn.addEventListener('click', () => {
      mustIncludeExchange = null;
      document.querySelectorAll('.exchange-must-btn').forEach(btn => {
        btn.classList.remove('active');
      });
      console.log('🗑️ Cleared all filters');
      renderTable();
    });
  }
  
  // Exchanges
  document.querySelectorAll('.exchange-filter').forEach(cb => {
    cb.addEventListener('change', renderTable);
  });
  
  // Initial load
  fetchFundingData();
  
  // Auto-refresh every 2 minutes
  setInterval(() => {
    console.log('🔄 Auto refresh...');
    fetchFundingData();
  }, 120000);
});

// === COMPLETE SHARE MODAL ===
document.addEventListener('click', function(e) {
  if (e.target.closest('.share-btn')) {
    const btn = e.target.closest('.share-btn');
    const data = {
      pair: btn.dataset.pair,
      long: btn.dataset.long,
      longDex: btn.dataset.longDex,
      longRate: btn.dataset.longRate,
      short: btn.dataset.short,
      shortDex: btn.dataset.shortDex,
      shortRate: btn.dataset.shortRate,
      apr: btn.dataset.apr
    };
    
    createShareModal(data);
  }
  
  // Close modal
  if (e.target.classList.contains('arb-card-close') || 
      e.target.classList.contains('arb-card-bg')) {
    closeShareModal();
  }
  
  // Share image
  if (e.target.closest('.arb-card-share')) {
    shareArbitrageCard();
  }
});

function createShareModal(data) {
  const tokenIcon = `images/${data.pair.toLowerCase()}.png`;
  const dateStr = new Date().toLocaleString('en-US', {
    month: "2-digit", 
    day: "2-digit", 
    year: "numeric",
    hour: "2-digit", 
    minute: "2-digit",
    hour12: false
  });
  
  const modalHTML = `
    <div class="arb-card-ghz" style="position:fixed;left:50%;top:50%;transform:translate(-50%,-50%);background:#191b1f;color:#fff;border-radius:18px;box-shadow:0 2px 32px rgba(179,0,0,0.3);min-width:380px;max-width:94vw;padding:30px 36px 28px 36px;z-index:20;font-family:inherit;">
      <div style="display:flex;align-items:center;justify-content:space-between;width:100%;margin-bottom:22px;">
        <img src="${tokenIcon}" style="width:48px;height:48px;border-radius:50%;margin-right:16px;background:#fff;" onerror="this.style.display='none'">
        <span style="color:#ff5c5c;font-size:1.5em;font-weight:bold;margin-right:auto;">${data.pair}</span>
        <span style="font-size:1.09em;color:#aaa;margin-left:18px;">${dateStr}</span>
      </div>
      <div style="display:flex;gap:24px;margin-bottom:16px;">
        <span style="display:flex;align-items:center;font-size:1.18em;font-weight:bold;padding:6px 20px;border-radius:12px;background:#143f1e;color:#21e686;border:2px solid #2ecc40;">
          <img src="${EX_LOGOS[data.longDex]}" style="height:18px;width:18px;margin-right:8px;">
          Long ${data.long}
        </span>
        <span style="display:flex;align-items:center;font-size:1.18em;font-weight:bold;padding:6px 20px;border-radius:12px;background:#321112;color:#ff5c5c;border:2px solid #b30000;">
          <img src="${EX_LOGOS[data.shortDex]}" style="height:18px;width:18px;margin-right:8px;">
          Short ${data.short}
        </span>
      </div>
      <div style="margin-bottom:10px;font-size:1.25em;">
        <span style="color:#aaa;margin-right:6px;">APR:</span>
        <span style="color:#21e686;font-weight:bold;font-size:1.22em;">+${data.apr}%</span>
      </div>
      <div style="font-size:1.08em;color:#eee;margin-bottom:28px;">
        <span style="margin-right:20px;">${data.long}: <b>${Number(data.longRate).toFixed(6)}</b></span>
        <span>${data.short}: <b>${Number(data.shortRate).toFixed(6)}</b></span>
      </div>
      <div style="margin-bottom:8px;">
        by <a href="https://twitter.com/ilyessghz2" target="_blank" style="color:#ff5c5c;text-decoration:none;font-weight:600;">@ilyessghz2</a>
        | <a href="https://ghzperpdextools.vercel.app" target="_blank" style="color:#ff5c5c;text-decoration:none;font-weight:600;">ghzperpdextools.vercel.app</a>
      </div>
      <button class="arb-card-share" style="margin-top:6px;padding:12px 38px;background:none;border:2px solid #ff5c5c;color:#ff5c5c;font-weight:bold;border-radius:10px;font-size:1.1em;cursor:pointer;transition:all 0.14s;">
        📤 Share
      </button>
      <button class="arb-card-close" style="position:absolute;top:17px;right:19px;background:none;border:none;color:#ff5c5c;font-size:2.2em;font-weight:bold;cursor:pointer;">&times;</button>
    </div>
    <div class="arb-card-bg" style="position:fixed;left:0;top:0;width:100vw;height:100vh;background:rgba(0,0,0,0.7);z-index:10;"></div>
  `;
  
  const modal = document.getElementById('card-modal');
  modal.innerHTML = modalHTML;
  modal.style.display = "block";
  document.body.style.overflow = 'hidden';
}

function closeShareModal() {
  const modal = document.getElementById('card-modal');
  modal.style.display = "none";
  document.body.style.overflow = 'auto';
}

function shareArbitrageCard() {
  const card = document.querySelector('.arb-card-ghz');
  if (!card) return;
  
  if (window.html2canvas) {
    window.html2canvas(card, { backgroundColor: null, scale: 2 }).then(canvas => {
      canvas.toBlob(blob => {
        if (navigator.clipboard && window.ClipboardItem) {
          navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
          alert('📋 Image copied to clipboard!');
        } else {
          const link = document.createElement('a');
          link.download = `arbitrage-${Date.now()}.png`;
          link.href = canvas.toDataURL();
          link.click();
          alert('📥 Image downloaded!');
        }
      });
    });
  } else {
    alert('Share function not available');
  }
}

console.log('✅ English script loaded');