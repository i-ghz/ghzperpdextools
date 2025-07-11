// js/script-api-minimal.js - Version optimisée avec Hibachi + navigation vers rapport + effet de survol

// === CONFIGURATION ===
const CONFIG = {
  API_URL: "/api/funding",
  REFRESH_INTERVAL: 120000, // 2 minutes
  MIN_EXCHANGES_FOR_ARBITRAGE: 2,
  MIN_APR_FOR_OPPORTUNITY: 10,
  DEFAULT_TIMEFRAME: '1h'
};

const EXCHANGE_CONFIG = {
  paradex: {
    name: "Paradex",
    logo: 'images/paradex.png',
    refLink: 'https://app.paradex.trade/r/ghzcrypto'
  },
  vest: {
    name: "Vest",
    logo: 'images/vest.png',
    refLink: 'https://trade.vest.exchange/join/GHZ50'
  },
  ext: {
    name: "Extended",
    logo: 'images/extended.png',
    refLink: 'https://app.extended.exchange/join/GHZ'
  },
  hyperliquid: {
    name: "Hyperliquid",
    logo: 'images/hyperliquid.png',
    refLink: 'https://app.hyperliquid.xyz/join/GHZ'
  },
  backpack: {
    name: "Backpack",
    logo: 'images/backpack.png',
    refLink: 'https://backpack.exchange/join/0xtargeted'
  },
  orderly: {
    name: "Orderly",
    logo: 'images/orderly.png',
    refLink: 'https://pro.woofi.com/en/trade?ref=GHZ30'
  },
  hibachi: {
    name: "Hibachi",
    logo: 'images/hibachi.png',
    refLink: 'https://hibachi.xyz/r/ghz'
  }
};

const TIMEFRAME_MULTIPLIERS = {
  '1h': { multiplier: 1, annualize: 24 * 365 },
  '8h': { multiplier: 8, annualize: 3 * 365 },
  '1y': { multiplier: 8760, annualize: 1 }
};

// === STATE MANAGEMENT ===
class AppState {
  constructor() {
    this.dataStore = [];
    this.filterFavOnly = false;
    this.mustIncludeExchange = null;
    this.currentTimeframe = CONFIG.DEFAULT_TIMEFRAME;
    this.lastUpdate = null;
    this.refreshTimer = null;
  }

  setTimeframe(timeframe) {
    if (TIMEFRAME_MULTIPLIERS[timeframe]) {
      this.currentTimeframe = timeframe;
      this.notifyUpdate();
    }
  }

  setMustIncludeExchange(exchange) {
    this.mustIncludeExchange = exchange;
    this.notifyUpdate();
  }

  toggleFavorites() {
    this.filterFavOnly = !this.filterFavOnly;
    this.notifyUpdate();
  }

  updateData(data) {
    this.dataStore = data;
    this.lastUpdate = new Date();
    this.notifyUpdate();
  }

  notifyUpdate() {
    // Observer pattern - notify all listeners
    document.dispatchEvent(new CustomEvent('app-state-changed', { detail: this }));
  }

  getSelectedExchanges() {
    return Array.from(document.querySelectorAll('.exchange-filter:checked')).map(cb => cb.value);
  }
}

// === UTILITIES ===
class RateCalculator {
  static getTimeframeKey(exchange, timeframe) {
    return exchange === 'ext' ? 'ext1h' : `${exchange}1h`;
  }

  static convertRateToTimeframe(rate1h, timeframe) {
    if (rate1h === null || rate1h === undefined) return null;
    
    const config = TIMEFRAME_MULTIPLIERS[timeframe];
    if (!config) return rate1h * 100;
    
    return rate1h * config.multiplier * 100;
  }

  static calculateAPR(minRate, maxRate, timeframe) {
    const rateDiff = maxRate - minRate;
    const config = TIMEFRAME_MULTIPLIERS[timeframe];
    
    return rateDiff * (config?.annualize || TIMEFRAME_MULTIPLIERS['1h'].annualize);
  }

  static processRatesForExchanges(item, exchanges, timeframe) {
    return exchanges
      .map(ex => {
        const key = this.getTimeframeKey(ex, timeframe);
        const rate1h = item[key];
        const convertedRate = this.convertRateToTimeframe(rate1h, timeframe);
        
        return {
          dex: ex,
          label: EXCHANGE_CONFIG[ex]?.name || ex,
          rate: convertedRate
        };
      })
      .filter(r => r.rate !== null && r.rate !== undefined);
  }
}

// === DATA SERVICE ===
class DataService {
  constructor(appState) {
    this.appState = appState;
    this.cache = new Map();
    this.lastFetch = null;
  }

  async fetchFundingData() {
    try {
      console.log('🔄 Fetching data...');
      
      // Simple cache (5 minutes)
      const now = Date.now();
      if (this.lastFetch && (now - this.lastFetch) < 300000) {
        console.log('📦 Using cached data');
        return this.cache.get('funding-data');
      }

      const { data } = await axios.get(CONFIG.API_URL);
      
      // Validate data structure
      if (!Array.isArray(data)) {
        throw new Error('Invalid data format received');
      }

      this.cache.set('funding-data', data);
      this.lastFetch = now;
      this.appState.updateData(data);
      
      console.log(`✅ ${data.length} pairs loaded`);
      return data;
      
    } catch (err) {
      console.error('❌ Fetch error:', err);
      throw err;
    }
  }

  startAutoRefresh() {
    if (this.appState.refreshTimer) {
      clearInterval(this.appState.refreshTimer);
    }

    this.appState.refreshTimer = setInterval(() => {
      console.log('🔄 Auto refresh...');
      this.fetchFundingData().catch(err => {
        console.error('Auto refresh failed:', err);
      });
    }, CONFIG.REFRESH_INTERVAL);
  }

  stopAutoRefresh() {
    if (this.appState.refreshTimer) {
      clearInterval(this.appState.refreshTimer);
      this.appState.refreshTimer = null;
    }
  }
}

// === FILTERS ===
class FilterService {
  constructor(appState) {
    this.appState = appState;
  }

  shouldIncludePair(item) {
    const selectedExchanges = this.appState.getSelectedExchanges();
    
    // Favorites filter
    if (this.appState.filterFavOnly && !window.favorites?.isFav(item.symbol)) {
      return false;
    }

    // Get rates for selected exchanges
    const rates = RateCalculator.processRatesForExchanges(
      item, 
      selectedExchanges, 
      this.appState.currentTimeframe
    );

    // Need at least 2 exchanges with data
    if (rates.length < CONFIG.MIN_EXCHANGES_FOR_ARBITRAGE) {
      return false;
    }

    // Must include exchange verification
    if (this.appState.mustIncludeExchange) {
      return this.validateMustIncludeExchange(item, rates, selectedExchanges);
    }

    return true;
  }

  validateMustIncludeExchange(item, rates, selectedExchanges) {
    const required = this.appState.mustIncludeExchange;
    
    // Check if required exchange is selected
    if (!selectedExchanges.includes(required)) {
      return false;
    }

    // Check if required exchange has data
    const requiredKey = RateCalculator.getTimeframeKey(required, this.appState.currentTimeframe);
    const requiredRate1h = item[requiredKey];
    const requiredRate = RateCalculator.convertRateToTimeframe(requiredRate1h, this.appState.currentTimeframe);
    
    if (requiredRate === null || requiredRate === undefined) {
      return false;
    }

    // Required exchange must be either min or max
    const min = rates.reduce((a, b) => a.rate < b.rate ? a : b);
    const max = rates.reduce((a, b) => a.rate > b.rate ? a : b);
    
    return min.dex === required || max.dex === required;
  }
}

// === OPPORTUNITY PROCESSOR ===
class OpportunityProcessor {
  constructor(appState, filterService) {
    this.appState = appState;
    this.filterService = filterService;
  }

  processOpportunities() {
    const selectedExchanges = this.appState.getSelectedExchanges();
    
    return this.appState.dataStore
      .filter(item => this.filterService.shouldIncludePair(item))
      .map(item => this.createOpportunity(item, selectedExchanges))
      .filter(op => op !== null)
      .sort((a, b) => b.apr - a.apr);
  }

  createOpportunity(item, selectedExchanges) {
    const rates = RateCalculator.processRatesForExchanges(
      item, 
      selectedExchanges, 
      this.appState.currentTimeframe
    );

    if (rates.length < CONFIG.MIN_EXCHANGES_FOR_ARBITRAGE) {
      return null;
    }

    const min = rates.reduce((a, b) => a.rate < b.rate ? a : b);
    const max = rates.reduce((a, b) => a.rate > b.rate ? a : b);
    const apr = RateCalculator.calculateAPR(min.rate, max.rate, this.appState.currentTimeframe);

    return {
      symbol: item.symbol,
      rates,
      min,
      max,
      apr
    };
  }
}

// === STATS CALCULATOR ===
class StatsCalculator {
  constructor(appState, opportunityProcessor) {
    this.appState = appState;
    this.opportunityProcessor = opportunityProcessor;
  }

  calculateStats() {
    const opportunities = this.opportunityProcessor.processOpportunities();
    const maxApr = opportunities.length > 0 ? Math.max(...opportunities.map(op => op.apr)) : 0;
    const goodOpportunities = opportunities.filter(op => op.apr > CONFIG.MIN_APR_FOR_OPPORTUNITY).length;

    return {
      totalPairs: this.appState.dataStore.length,
      maxApr,
      opportunities: goodOpportunities,
      lastUpdate: this.appState.lastUpdate
    };
  }
}

// === UI COMPONENTS ===
class TableRenderer {
  constructor(appState, opportunityProcessor) {
    this.appState = appState;
    this.opportunityProcessor = opportunityProcessor;
  }

  render() {
    const tbody = document.querySelector('#arbitrage-table tbody');
    const selectedExchanges = this.appState.getSelectedExchanges();
    
    this.updateTableHeader(selectedExchanges);
    
    const opportunities = this.opportunityProcessor.processOpportunities();
    
    if (opportunities.length === 0) {
      tbody.innerHTML = this.getEmptyMessage();
      return;
    }
    
    tbody.innerHTML = opportunities.map(op => this.createRow(op, selectedExchanges)).join('');
    this.attachEventListeners(tbody, opportunities);
    this.addHoverStyles();
  }

  updateTableHeader(selectedExchanges) {
    const thead = document.querySelector('#arbitrage-table thead tr');
    
    const exchangeCols = selectedExchanges.map(ex => {
      const config = EXCHANGE_CONFIG[ex];
      if (!config) return '';
      
      return `<th><img src="${config.logo}" class="ex-logo-th" alt="${config.name}"> ${config.name} <span class="timeframe-header">${this.appState.currentTimeframe}</span></th>`;
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

  createRow(opportunity, selectedExchanges) {
    const { symbol, rates, min, max, apr } = opportunity;
    
    const favClass = window.favorites?.isFav(symbol) ? "fav active" : "fav";
    
    const rateCols = selectedExchanges.map(ex => {
      const rate = rates.find(r => r.dex === ex);
      if (!rate) return '<td style="color:#6b7280;">—</td>';
      
      const config = EXCHANGE_CONFIG[ex];
      return this.createRateCell(rate, min, max, config);
    }).join('');
    
    const strategy = this.createStrategyText(min, max);
    
    return `
      <tr>
        <td><span class="${favClass}" data-symbol="${symbol}">★</span></td>
        <td style="font-weight:600;color:#ff5c5c;cursor:pointer;text-decoration:underline;transition: all 0.2s ease;" 
            class="pair-name" 
            data-symbol="${symbol}" 
            title="Click here to see the full report">${symbol}</td>
        ${rateCols}
        <td style="font-size:0.9rem;color:#e5e7eb;">${strategy}</td>
        <td style="font-weight:700;color:#34d399;">${apr.toFixed(2)}%</td>
        <td>
          ${this.createShareButton(symbol, min, max, apr)}
        </td>
      </tr>
    `;
  }

  createRateCell(rate, min, max, config) {
    const isMin = rate.dex === min.dex;
    const isMax = rate.dex === max.dex;
    
    let style = 'color:#f3f4f6;';
    let label = '';
    
    if (isMin) {
      style = 'background:#064e3b;border-left:3px solid #10b981;color:#34d399;';
      label = '<br><small style="color:#34d399;font-weight:600;">LONG</small>';
    }
    
    if (isMax) {
      style = 'background:#7f1d1d;border-left:3px solid #ef4444;color:#fca5a5;';
      label = '<br><small style="color:#fca5a5;font-weight:600;">SHORT</small>';
    }
    
    return `<td style="${style}">
      <img src="${config.logo}" class="ex-logo-td">${rate.rate.toFixed(2)}%
      ${label}
    </td>`;
  }

  createStrategyText(min, max) {
    const minConfig = EXCHANGE_CONFIG[min.dex];
    const maxConfig = EXCHANGE_CONFIG[max.dex];
    
    return `Long <a href="${minConfig.refLink}" target="_blank" style="color:#34d399;text-decoration:none;">${min.label}</a>, Short <a href="${maxConfig.refLink}" target="_blank" style="color:#fca5a5;text-decoration:none;">${max.label}</a>`;
  }

  createShareButton(symbol, min, max, apr) {
    return `
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
    `;
  }

  getEmptyMessage() {
    return `
      <tr><td colspan="12" style="text-align:center;padding:40px;">
        ${this.appState.filterFavOnly ? 'No favorites found' : 'No opportunities found'}
      </td></tr>
    `;
  }

  addHoverStyles() {
    if (document.getElementById('pair-hover-styles')) {
      return;
    }

    const style = document.createElement('style');
    style.id = 'pair-hover-styles';
    style.textContent = `
      .pair-name:hover {
        color: #22d3ee !important;
        text-shadow: 0 0 8px rgba(34, 211, 238, 0.5);
        transform: scale(1.05);
      }
      
      .pair-name:active {
        color: #0891b2 !important;
        transform: scale(0.98);
      }
      
      @keyframes glow-pulse {
        0% { text-shadow: 0 0 8px rgba(34, 211, 238, 0.5); }
        50% { text-shadow: 0 0 12px rgba(34, 211, 238, 0.8); }
        100% { text-shadow: 0 0 8px rgba(34, 211, 238, 0.5); }
      }
      
      .pair-name:hover {
        animation: glow-pulse 1.5s ease-in-out infinite;
      }
    `;
    
    document.head.appendChild(style);
  }

  attachEventListeners(tbody, opportunities) {
    tbody.addEventListener('click', (e) => {
      if (e.target.classList.contains('fav')) {
        window.favorites?.toggle(e.target.dataset.symbol);
        this.render();
      }
      
      if (e.target.classList.contains('pair-name')) {
        const symbol = e.target.dataset.symbol;
        this.navigateToReport(symbol, opportunities);
      }
    });
  }

  navigateToReport(symbol, opportunities) {
    console.log(`🔍 Navigating to report for ${symbol}`);
    
    const opportunity = opportunities.find(op => op.symbol === symbol);
    if (!opportunity) {
      console.error(`❌ No opportunity found for ${symbol}`);
      alert(`Aucune opportunité trouvée pour ${symbol}`);
      return;
    }

    const params = new URLSearchParams({
      symbol: symbol,
      longExchange: opportunity.min.dex,
      shortExchange: opportunity.max.dex,
      longRate: opportunity.min.rate.toFixed(6),
      shortRate: opportunity.max.rate.toFixed(6),
      apr: opportunity.apr.toFixed(2),
      timeframe: this.appState.currentTimeframe
    });

    console.log(`✅ Redirecting to: /report?${params.toString()}`);
    window.location.href = `/report?${params.toString()}`;
  }
}

class StatsRenderer {
  constructor(appState, statsCalculator) {
    this.appState = appState;
    this.statsCalculator = statsCalculator;
  }

  render() {
    const stats = this.statsCalculator.calculateStats();
    
    const elements = {
      pairs: document.getElementById('stats-pairs'),
      maxApr: document.getElementById('stats-max-apr'),
      opportunities: document.getElementById('stats-opportunities'),
      lastUpdate: document.getElementById('stats-last-update')
    };

    if (elements.pairs) elements.pairs.textContent = stats.totalPairs;
    if (elements.maxApr) elements.maxApr.textContent = stats.maxApr.toFixed(1) + '%';
    if (elements.opportunities) elements.opportunities.textContent = stats.opportunities;
    if (elements.lastUpdate && stats.lastUpdate) {
      elements.lastUpdate.textContent = stats.lastUpdate.toLocaleTimeString('en-US', {
        hour: '2-digit', 
        minute: '2-digit',
        hour12: false
      });
    }
  }
}

// === ERROR HANDLING ===
class ErrorHandler {
  static handleFetchError(error, tableElement) {
    console.error('❌ Fetch error:', error);
    
    if (tableElement) {
      const tbody = tableElement.querySelector('tbody');
      if (tbody) {
        tbody.innerHTML = `
          <tr><td colspan="12" style="text-align:center;padding:40px;color:red;">
            Error: ${error.message}
            <br><button onclick="window.app.dataService.fetchFundingData().catch(err => console.error(err))">Retry</button>
          </td></tr>
        `;
      }
    }
  }

  static handleGenericError(error, context = '') {
    console.error(`❌ Error ${context}:`, error);
    
    if (error.message && !error.message.includes('Network')) {
      const errorDiv = document.createElement('div');
      errorDiv.className = 'error-toast';
      errorDiv.textContent = `Error: ${error.message}`;
      errorDiv.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: #dc2626;
        color: white;
        padding: 12px 20px;
        border-radius: 8px;
        z-index: 1000;
        animation: slideIn 0.3s ease;
      `;
      
      document.body.appendChild(errorDiv);
      setTimeout(() => errorDiv.remove(), 5000);
    }
  }
}

// === MAIN APPLICATION ===
class FundingArbitrageApp {
  constructor() {
    this.appState = new AppState();
    this.dataService = new DataService(this.appState);
    this.filterService = new FilterService(this.appState);
    this.opportunityProcessor = new OpportunityProcessor(this.appState, this.filterService);
    this.statsCalculator = new StatsCalculator(this.appState, this.opportunityProcessor);
    this.tableRenderer = new TableRenderer(this.appState, this.opportunityProcessor);
    this.statsRenderer = new StatsRenderer(this.appState, this.statsCalculator);
    
    this.init();
  }

  init() {
    this.setupEventListeners();
    this.loadInitialData();
  }

  setupEventListeners() {
    document.addEventListener('app-state-changed', () => {
      this.render();
    });

    this.setupButtonListeners();
    this.setupExchangeFilters();
    this.setupShareModal();
  }

  setupButtonListeners() {
    const buttons = {
      sort: document.getElementById('sort-apr-btn'),
      favorites: document.getElementById('filter-fav-btn'),
      refresh: document.getElementById('refresh-btn'),
      clearFilters: document.getElementById('filter-must-clear')
    };

    if (buttons.sort) {
      buttons.sort.addEventListener('click', () => this.render());
    }

    if (buttons.favorites) {
      buttons.favorites.addEventListener('click', () => {
        this.appState.toggleFavorites();
        buttons.favorites.textContent = this.appState.filterFavOnly ? 'Show all' : 'Show favorites';
      });
    }

    if (buttons.refresh) {
      buttons.refresh.addEventListener('click', () => {
        this.dataService.fetchFundingData().catch(err => 
          ErrorHandler.handleGenericError(err, 'manual refresh')
        );
      });
    }

    if (buttons.clearFilters) {
      buttons.clearFilters.addEventListener('click', () => {
        this.appState.setMustIncludeExchange(null);
        document.querySelectorAll('.exchange-must-btn').forEach(btn => {
          btn.classList.remove('active');
        });
      });
    }

    // Timeframe buttons
    document.querySelectorAll('.timeframe-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const timeframe = btn.dataset.timeframe;
        this.appState.setTimeframe(timeframe);
        
        document.querySelectorAll('.timeframe-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
      });
    });

    // Must include exchange buttons (including Hibachi)
    document.querySelectorAll('.exchange-must-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const exchange = btn.dataset.exchange;
        
        if (this.appState.mustIncludeExchange === exchange) {
          this.appState.setMustIncludeExchange(null);
          btn.classList.remove('active');
        } else {
          document.querySelectorAll('.exchange-must-btn').forEach(b => b.classList.remove('active'));
          this.appState.setMustIncludeExchange(exchange);
          btn.classList.add('active');
        }
      });
    });
  }

  setupExchangeFilters() {
    document.querySelectorAll('.exchange-filter').forEach(cb => {
      cb.addEventListener('change', () => this.render());
    });
  }

  setupShareModal() {
    document.addEventListener('click', (e) => {
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
        
        this.createShareModal(data);
      }
      
      if (e.target.classList.contains('arb-card-close') || 
          e.target.classList.contains('arb-card-bg')) {
        this.closeShareModal();
      }
      
      if (e.target.closest('.arb-card-share')) {
        this.shareArbitrageCard();
      }
    });
  }

  async loadInitialData() {
    try {
      await this.dataService.fetchFundingData();
      this.dataService.startAutoRefresh();
    } catch (error) {
      ErrorHandler.handleFetchError(error, document.getElementById('arbitrage-table'));
    }
  }

  render() {
    try {
      this.tableRenderer.render();
      this.statsRenderer.render();
    } catch (error) {
      ErrorHandler.handleGenericError(error, 'rendering');
    }
  }

  createShareModal(data) {
    const tokenIcon = `images/${data.pair.toLowerCase()}.png`;
    const dateStr = new Date().toLocaleString('en-US', {
      month: "2-digit", 
      day: "2-digit", 
      year: "numeric",
      hour: "2-digit", 
      minute: "2-digit",
      hour12: false
    });
    
    const longConfig = EXCHANGE_CONFIG[data.longDex];
    const shortConfig = EXCHANGE_CONFIG[data.shortDex];
    
    const modalHTML = `
      <div class="arb-card-ghz" style="position:fixed;left:50%;top:50%;transform:translate(-50%,-50%);background:#191b1f;color:#fff;border-radius:18px;box-shadow:0 2px 32px rgba(179,0,0,0.3);min-width:380px;max-width:94vw;padding:30px 36px 28px 36px;z-index:20;font-family:inherit;">
        <div style="display:flex;align-items:center;justify-content:space-between;width:100%;margin-bottom:22px;">
          <img src="${tokenIcon}" style="width:48px;height:48px;border-radius:50%;margin-right:16px;background:#fff;" onerror="this.style.display='none'">
          <span style="color:#ff5c5c;font-size:1.5em;font-weight:bold;margin-right:auto;">${data.pair}</span>
          <span style="font-size:1.09em;color:#aaa;margin-left:18px;">${dateStr}</span>
        </div>
        <div style="display:flex;gap:24px;margin-bottom:16px;">
          <span style="display:flex;align-items:center;font-size:1.18em;font-weight:bold;padding:6px 20px;border-radius:12px;background:#143f1e;color:#21e686;border:2px solid #2ecc40;">
            <img src="${longConfig.logo}" style="height:18px;width:18px;margin-right:8px;">
            Long ${data.long}
          </span>
          <span style="display:flex;align-items:center;font-size:1.18em;font-weight:bold;padding:6px 20px;border-radius:12px;background:#321112;color:#ff5c5c;border:2px solid #b30000;">
            <img src="${shortConfig.logo}" style="height:18px;width:18px;margin-right:8px;">
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
    if (modal) {
      modal.innerHTML = modalHTML;
      modal.style.display = "block";
      document.body.style.overflow = 'hidden';
    }
  }

  closeShareModal() {
    const modal = document.getElementById('card-modal');
    if (modal) {
      modal.style.display = "none";
      document.body.style.overflow = 'auto';
    }
  }

  shareArbitrageCard() {
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

  destroy() {
    this.dataService.stopAutoRefresh();
    document.removeEventListener('app-state-changed', this.render);
  }
}

// === INITIALIZATION ===
let app;

document.addEventListener('DOMContentLoaded', () => {
  console.log('🚀 Optimized Funding Arbitrage App with Hibachi loading...');
  
  try {
    app = new FundingArbitrageApp();
    window.app = app;
    
    console.log('✅ Application with Hibachi initialized successfully');
    
  } catch (error) {
    ErrorHandler.handleGenericError(error, 'initialization');
  }
});

window.addEventListener('beforeunload', () => {
  if (app) {
    app.destroy();
  }
});

console.log('✅ Optimized script loaded with Hibachi integration, navigation functionality and hover effects');