// js/report.js - Script complet pour la page de rapport avec gestion Supabase

class FundingReportApp {
  constructor() {
    this.urlParams = new URLSearchParams(window.location.search);
    this.currentChart = null;
    this.refreshInterval = null;
    
    // Exchanges qui ont des données historiques dans Supabase
    this.EXCHANGES_WITH_HISTORY = [
      'vest', 
      'paradex', 
      'ext', 
      'hyperliquid',
      'orderly'
      // 'backpack' - PAS de données historiques (orderbook seulement)
    ];
    
    // Mapping entre les codes d'interface et les noms Supabase
    this.SUPABASE_EXCHANGE_MAPPING = {
      'vest': 'vest',
      'paradex': 'paradex', 
      'ext': 'extended',  // ⭐ Mapping important !
      'hyperliquid': 'hyperliquid',
      'backpack': 'backpack',
      'orderly': 'orderly'
    };
    
    this.EXCHANGE_CONFIG = {
      paradex: { name: "Paradex", logo: 'images/paradex.png' },
      vest: { name: "Vest", logo: 'images/vest.png' },
      ext: { name: "Extended", logo: 'images/extended.png' },
      hyperliquid: { name: "Hyperliquid", logo: 'images/hyperliquid.png' },
      backpack: { name: "Backpack", logo: 'images/backpack.png' },
      orderly: { name: "Orderly", logo: 'images/orderly.png' }
    };
    
    this.init();
  }

  init() {
    this.setupTokenSelect();
    this.loadUrlParameters();
    this.setupEventListeners();
    this.loadInitialData();
    this.startOrderbookRefresh();
  }

  setupTokenSelect() {
    const TOKENS = [
      "AAVE", "ADA", "AI16Z", "AIXBT", "ALCH", "ANIME", "APT", "AR", "ARB", "ATOM", "AVAX", "BCH", 
      "BERA", "BNB", "BRETT", "BTC", "CRV", "DOGE", "DOT", "DYDX", "EIGEN", "ENA", "ETC", "ETH", 
      "ETHFI", "EUR", "FARTCOIN", "FET", "FIL", "FTM", "GOAT", "GRASS", "GRIFFAIN", "HYPE", "HYPER", 
      "INIT", "INJ", "IO", "IP", "JTO", "JUP", "KAITO", "KBONK", "KFLOKI", "KNEIRO", "KPEPE", "KSHIB", 
      "LAUNCHCOIN", "LAYER", "LDO", "LINK", "LTC", "MATIC", "MELANIA", "MEME", "MEW", "MKR", "MNT", 
      "MOODENG", "MORPHO", "MOVE", "NEAR", "NIL", "NOT", "NXPC", "OM", "ONDO", "OP", "ORDI", "PAXG", 
      "PENDLE", "PENGU", "PNUT", "POPCAT", "PROMPT", "PYTH", "RENDER", "RESOLV", "RUNE", "S", "SCR", 
      "SEI", "SOL", "SOPH", "SPX", "STRK", "SUI", "TAO", "TIA", "TON", "TRB", "TRUMP", "TRX", "TST", 
      "TURBO", "UNI", "USUAL", "VINE", "VIRTUAL", "VVV", "W", "WAL", "WCT", "WIF", "WLD", "XLM", 
      "XRP", "ZEREBRO", "ZK", "ZRO", "ZORA"
    ];

    const tokenSelect = document.getElementById('token');
    TOKENS.forEach(token => {
      const option = document.createElement('option');
      option.value = token;
      option.textContent = token;
      tokenSelect.appendChild(option);
    });
  }

  loadUrlParameters() {
    const symbol = this.urlParams.get('symbol') || 'BTC';
    const longExchange = this.urlParams.get('longExchange') || 'vest';
    const shortExchange = this.urlParams.get('shortExchange') || 'paradex';
    const longRate = this.urlParams.get('longRate') || '0';
    const shortRate = this.urlParams.get('shortRate') || '0';
    const apr = this.urlParams.get('apr') || '0';

    // Mettre à jour le titre
    document.getElementById('report-title').textContent = `Funding Report - ${symbol}`;
    document.title = `Funding Report - ${symbol}`;

    // Remplir les sélecteurs avec les valeurs de l'URL
    document.getElementById('token').value = symbol;
    document.getElementById('sourceA').value = longExchange;
    document.getElementById('sourceB').value = shortExchange;

    // Si on a des paramètres d'URL (venant du tableau), les afficher
    if (this.urlParams.get('apr')) {
      this.displayCurrentStrategy(symbol, longExchange, shortExchange, longRate, shortRate, apr);
    } else {
      // 🆕 Si accès direct, calculer la stratégie en temps réel
      this.updateStrategy();
    }

    console.log(`📊 Loaded report for ${symbol}: ${longExchange} vs ${shortExchange}${this.urlParams.get('apr') ? `, APR: ${apr}%` : ' (calculating...)'}`);
  }

  displayCurrentStrategy(symbol, longExchange, shortExchange, longRate, shortRate, apr) {
    const strategyHtml = `
      <div class="strategy-card">
        <div class="strategy-header">
          <h3>${symbol} Delta-Neutral Strategy</h3>
          <div class="apr-badge">APR: +${apr}%</div>
        </div>
        <div class="strategy-positions">
          <div class="position long-position">
            <div class="position-type">LONG</div>
            <div class="exchange-name">${this.EXCHANGE_CONFIG[longExchange]?.name || longExchange}</div>
            <div class="rate">${parseFloat(longRate).toFixed(4)}%</div>
          </div>
          <div class="vs-separator">VS</div>
          <div class="position short-position">
            <div class="position-type">SHORT</div>
            <div class="exchange-name">${this.EXCHANGE_CONFIG[shortExchange]?.name || shortExchange}</div>
            <div class="rate">${parseFloat(shortRate).toFixed(4)}%</div>
          </div>
        </div>
      </div>
    `;

    document.getElementById('strategy-display').innerHTML = strategyHtml;
  }

  setupEventListeners() {
    document.getElementById('showChart').addEventListener('click', () => {
      this.updateChart();
    });

    document.getElementById('ma-window').addEventListener('change', () => {
      this.updateChart();
    });

    // Auto-update when selects change
    ['token', 'sourceA', 'sourceB'].forEach(id => {
      document.getElementById(id).addEventListener('change', () => {
        this.updateChart();
        this.updateOrderbookTitles();
        this.loadOrderbookData();
        this.updateStrategy(); // 🆕 Mettre à jour la stratégie
        this.updateURL(); // 🆕 Mettre à jour l'URL
      });
    });
  }

  // 🆕 NOUVELLE MÉTHODE: Mettre à jour la stratégie dynamiquement
  async updateStrategy() {
    const token = document.getElementById('token').value;
    const sourceA = document.getElementById('sourceA').value;
    const sourceB = document.getElementById('sourceB').value;

    try {
      // Calculer l'APR en temps réel
      const apr = await this.calculateCurrentAPR(token, sourceA, sourceB);
      
      // Déterminer qui est LONG et qui est SHORT
      const { longExchange, shortExchange, longRate, shortRate } = await this.determineLongShort(token, sourceA, sourceB);
      
      // Mettre à jour l'affichage de la stratégie
      this.displayCurrentStrategy(token, longExchange, shortExchange, longRate, shortRate, apr);
      
      // Mettre à jour le titre de la page
      document.getElementById('report-title').textContent = `Funding Report - ${token}`;
      document.title = `Funding Report - ${token}`;
      
    } catch (error) {
      console.error('❌ Error updating strategy:', error);
      // En cas d'erreur, afficher une stratégie basique
      this.displayCurrentStrategy(token, sourceA, sourceB, 0, 0, 0);
    }
  }

  // 🆕 NOUVELLE MÉTHODE: Calculer l'APR actuel
  async calculateCurrentAPR(token, sourceA, sourceB) {
    try {
      // Récupérer les taux actuels de votre API funding
      const response = await fetch('/api/funding');
      const data = await response.json();
      
      // Trouver la paire correspondante
      const pair = data.find(item => item.symbol === token);
      if (!pair) return 0;

      // Obtenir les taux pour les deux exchanges
      const rateA = this.getRateForExchange(pair, sourceA);
      const rateB = this.getRateForExchange(pair, sourceB);
      
      if (rateA === null || rateB === null) return 0;

      // Calculer l'APR (différence annualisée)
      const rateDiff = Math.abs(rateB - rateA);
      const apr = rateDiff * 24 * 365; // Annualiser
      
      return Math.round(apr * 100) / 100; // Arrondir à 2 décimales
      
    } catch (error) {
      console.error('Error calculating APR:', error);
      return 0;
    }
  }

  // 🆕 NOUVELLE MÉTHODE: Déterminer qui est LONG et qui est SHORT
  async determineLongShort(token, sourceA, sourceB) {
    try {
      const response = await fetch('/api/funding');
      const data = await response.json();
      
      const pair = data.find(item => item.symbol === token);
      if (!pair) {
        return {
          longExchange: sourceA,
          shortExchange: sourceB,
          longRate: 0,
          shortRate: 0
        };
      }

      const rateA = this.getRateForExchange(pair, sourceA);
      const rateB = this.getRateForExchange(pair, sourceB);
      
      if (rateA === null || rateB === null) {
        return {
          longExchange: sourceA,
          shortExchange: sourceB,
          longRate: 0,
          shortRate: 0
        };
      }

      // Convertir en pourcentage annualisé
      const annualizedA = rateA * 24 * 365 * 100;
      const annualizedB = rateB * 24 * 365 * 100;

      // Le plus bas taux = LONG, le plus haut = SHORT
      if (annualizedA <= annualizedB) {
        return {
          longExchange: sourceA,
          shortExchange: sourceB,
          longRate: annualizedA.toFixed(6),
          shortRate: annualizedB.toFixed(6)
        };
      } else {
        return {
          longExchange: sourceB,
          shortExchange: sourceA,
          longRate: annualizedB.toFixed(6),
          shortRate: annualizedA.toFixed(6)
        };
      }
      
    } catch (error) {
      console.error('Error determining long/short:', error);
      return {
        longExchange: sourceA,
        shortExchange: sourceB,
        longRate: 0,
        shortRate: 0
      };
    }
  }

  // 🆕 HELPER: Obtenir le taux pour un exchange
  getRateForExchange(pair, exchange) {
    // Mapper le nom d'exchange pour correspondre aux clés de l'API
    const exchangeKey = exchange === 'ext' ? 'ext1h' : `${exchange}1h`;
    
    const rate = pair[exchangeKey];
    return (rate !== null && rate !== undefined && !isNaN(rate)) ? rate : null;
  }

  // 🆕 NOUVELLE MÉTHODE: Mettre à jour l'URL sans recharger
  updateURL() {
    const token = document.getElementById('token').value;
    const sourceA = document.getElementById('sourceA').value;
    const sourceB = document.getElementById('sourceB').value;

    const params = new URLSearchParams();
    params.set('symbol', token);
    params.set('longExchange', sourceA);
    params.set('shortExchange', sourceB);
    params.set('timeframe', '1h');

    // Mettre à jour l'URL sans recharger la page
    const newURL = `/report?${params.toString()}`;
    window.history.replaceState(null, '', newURL);
    
    console.log(`🔗 URL updated: ${newURL}`);
  }

  async loadInitialData() {
    try {
      // 🆕 Si pas de paramètres APR dans l'URL, c'est un accès direct
      if (!this.urlParams.get('apr')) {
        await this.updateStrategy();
      }
      
      await this.updateChart();
      this.updateOrderbookTitles();
      await this.loadOrderbookData();
    } catch (error) {
      console.error('❌ Error loading initial data:', error);
    }
  }

  async updateChart() {
    const token = document.getElementById('token').value;
    const sourceA = document.getElementById('sourceA').value;
    const sourceB = document.getElementById('sourceB').value;
    const maWindow = parseInt(document.getElementById('ma-window').value) || 7;

    console.log(`📈 Updating chart: ${token} - ${sourceA} vs ${sourceB}`);

    // Vérifier si les exchanges ont des données historiques
    const sourceAHasHistory = this.EXCHANGES_WITH_HISTORY.includes(sourceA);
    const sourceBHasHistory = this.EXCHANGES_WITH_HISTORY.includes(sourceB);

    if (!sourceAHasHistory && !sourceBHasHistory) {
      this.showNoHistoryMessage(sourceA, sourceB);
      return;
    }

    try {
      const chartDiv = document.getElementById('fundingChart');
      chartDiv.innerHTML = '<div class="loading">Loading chart data...</div>';

      let dataA = [];
      let dataB = [];

      // Charger les données seulement pour les exchanges qui ont l'historique
      const promises = [];
      
      if (sourceAHasHistory) {
        promises.push(this.fetchFunding(token, sourceA).then(data => ({ source: 'A', data })));
      }
      
      if (sourceBHasHistory) {
        promises.push(this.fetchFunding(token, sourceB).then(data => ({ source: 'B', data })));
      }

      const results = await Promise.all(promises);
      
      results.forEach(result => {
        if (result.source === 'A') dataA = result.data;
        if (result.source === 'B') dataB = result.data;
      });

      this.createDeltaNeutralChart(dataA, dataB, sourceA, sourceB, maWindow, sourceAHasHistory, sourceBHasHistory);
      
    } catch (error) {
      console.error('❌ Error updating chart:', error);
      this.showChartError(error.message);
    }
  }

  showNoHistoryMessage(sourceA, sourceB) {
    const chartDiv = document.getElementById('fundingChart');
    chartDiv.innerHTML = `
      <div class="no-history-message">
        <div class="icon">📊</div>
        <h3>Données historiques non disponibles</h3>
        <p>
          Les exchanges <strong>${this.EXCHANGE_CONFIG[sourceA]?.name || sourceA}</strong> et 
          <strong>${this.EXCHANGE_CONFIG[sourceB]?.name || sourceB}</strong> 
          n'ont pas de données historiques disponibles dans notre base de données.
        </p>
        <p class="sub-text">
          Vous pouvez analyser les orderbooks en temps réel ci-dessous.
        </p>
      </div>
    `;
  }

  showChartError(errorMessage) {
    const chartDiv = document.getElementById('fundingChart');
    chartDiv.innerHTML = `
      <div class="chart-error">
        <div class="icon">❌</div>
        <h3>Erreur lors du chargement</h3>
        <p>${errorMessage}</p>
        <button onclick="window.reportApp.updateChart()" class="retry-btn">
          🔄 Réessayer
        </button>
      </div>
    `;
  }

  async fetchFunding(token, source, days = 50) {
    // Vérifier si l'exchange a des données historiques
    if (!this.EXCHANGES_WITH_HISTORY.includes(source)) {
      console.warn(`⚠️ ${source} does not have historical data available`);
      return [];
    }

    try {
      // 🔄 Mapper le nom d'exchange pour Supabase
      const supabaseSource = this.SUPABASE_EXCHANGE_MAPPING[source] || source;
      
      const url = `/api/funding-history?symbol=${token}&source=${supabaseSource}&days=${days}`;
      console.log(`📡 Fetching funding data: ${url} (mapped ${source} -> ${supabaseSource})`);
      
      const res = await fetch(url);
      if (!res.ok) {
        const errorText = await res.text();
        throw new Error(`HTTP ${res.status}: ${errorText}`);
      }
      
      const data = await res.json();
      
      if (!Array.isArray(data)) {
        throw new Error('Invalid data format received from API');
      }

      const formattedData = this.cleanData(data.map(d => ({
        time: Math.floor(new Date(d.date.slice(0, 10)).getTime() / 1000),
        value: Math.round(Number(d.funding_rate) * 24 * 365 * 100 * 10000) / 10000
      })));

      console.log(`✅ Loaded ${formattedData.length} data points for ${token}/${supabaseSource}`);
      return formattedData;
      
    } catch (error) {
      console.error(`❌ Error fetching funding data for ${token}/${source}:`, error);
      throw error;
    }
  }

  cleanData(data) {
    const seen = {};
    return (data || []).filter(d =>
      d &&
      typeof d.value === 'number' &&
      !isNaN(d.value) &&
      d.value !== null &&
      typeof d.time === 'number' &&
      Number.isFinite(d.time) &&
      !seen[d.time] && (seen[d.time] = true)
    );
  }

  createDeltaNeutralChart(dataA, dataB, labelA, labelB, maWindow = 7, sourceAHasHistory = true, sourceBHasHistory = true) {
    const chartDiv = document.getElementById('fundingChart');
    chartDiv.innerHTML = "";

    if (this.currentChart) {
      this.currentChart.remove();
    }

    // Si aucune donnée disponible
    if (dataA.length === 0 && dataB.length === 0) {
      this.showNoHistoryMessage(labelA, labelB);
      return;
    }

    const points = this.getCommonCleanPoints(dataA, dataB);
    const cleanA = points.map(pt => ({ time: pt.time, value: pt.valueA }));
    const cleanB = points.map(pt => ({ time: pt.time, value: pt.valueB }));
    
    let deltaApr = [];
    if (cleanA.length > 0 && cleanB.length > 0) {
      deltaApr = points.map(pt => ({
        time: pt.time,
        value: Math.round((pt.valueB - pt.valueA) * 10000) / 10000
      }));
    }

    const maApr = deltaApr.length > 0 ? this.calculateMovingAverageSeriesData(deltaApr, maWindow) : [];

    this.currentChart = window.LightweightCharts.createChart(chartDiv, {
      width: Math.min(950, chartDiv.clientWidth),
      height: 430,
      layout: { background: { color: '#181818' }, textColor: '#ededed' },
      grid: { vertLines: { color: '#262626' }, horzLines: { color: '#262626' } },
      timeScale: { timeVisible: true, secondsVisible: false },
      rightPriceScale: { borderColor: '#71649C' },
      crosshair: { mode: 0 }
    });

    // Ajouter les séries seulement si on a des données
    if (cleanA.length > 0 && sourceAHasHistory) {
      this.currentChart.addSeries(window.LightweightCharts.LineSeries, {
        color: '#ff6384',
        lineWidth: 2,
        title: `${this.EXCHANGE_CONFIG[labelA]?.name || labelA} APR`,
        priceLineVisible: false
      }).setData(cleanA);
    }

    if (cleanB.length > 0 && sourceBHasHistory) {
      this.currentChart.addSeries(window.LightweightCharts.LineSeries, {
        color: '#36a2eb',
        lineWidth: 2,
        title: `${this.EXCHANGE_CONFIG[labelB]?.name || labelB} APR`,
        priceLineVisible: false
      }).setData(cleanB);
    }

    if (deltaApr.length > 0) {
      this.currentChart.addSeries(window.LightweightCharts.LineSeries, {
        color: '#22c55e',
        lineWidth: 3,
        title: 'Delta-Neutral APR',
        priceLineVisible: true
      }).setData(deltaApr);
    }

    if (maApr.length > 0) {
      this.currentChart.addSeries(window.LightweightCharts.LineSeries, {
        color: '#ffaa00',
        lineWidth: 2,
        title: `MA ${maWindow}d`,
        priceLineVisible: false
      }).setData(maApr);
    }

    // Ajouter une note si certains exchanges n'ont pas de données
    if (!sourceAHasHistory || !sourceBHasHistory) {
      const warningNote = document.createElement('div');
      warningNote.className = 'chart-warning';
      warningNote.innerHTML = `
        ⚠️ ${!sourceAHasHistory ? this.EXCHANGE_CONFIG[labelA]?.name || labelA : this.EXCHANGE_CONFIG[labelB]?.name || labelB} : 
        Pas de données historiques
      `;
      chartDiv.style.position = 'relative';
      chartDiv.appendChild(warningNote);
    }

    this.currentChart.timeScale().fitContent();
    console.log('✅ Chart created successfully');
  }

  getCommonCleanPoints(dataA, dataB) {
    if (dataA.length === 0 || dataB.length === 0) {
      return [];
    }

    const bMap = Object.fromEntries(dataB.map(d => [d.time, d.value]));
    return dataA
      .filter(d =>
        typeof d.value === 'number' && !isNaN(d.value) &&
        d.time in bMap &&
        typeof bMap[d.time] === 'number' &&
        !isNaN(bMap[d.time])
      )
      .map(d => ({
        time: d.time,
        valueA: d.value,
        valueB: bMap[d.time]
      }));
  }

  calculateMovingAverageSeriesData(data, maLength) {
    const maData = [];
    for (let i = 0; i < data.length; i++) {
      if (i < maLength - 1) continue;
      let sum = 0;
      for (let j = 0; j < maLength; j++) {
        sum += data[i - j].value;
      }
      maData.push({
        time: data[i].time,
        value: Math.round((sum / maLength) * 10000) / 10000
      });
    }
    return maData;
  }

  updateOrderbookTitles() {
    const sourceA = document.getElementById('sourceA').value;
    const sourceB = document.getElementById('sourceB').value;

    document.getElementById('long-exchange-title').textContent = 
      `${this.EXCHANGE_CONFIG[sourceA]?.name || sourceA} (LONG)`;
    document.getElementById('short-exchange-title').textContent = 
      `${this.EXCHANGE_CONFIG[sourceB]?.name || sourceB} (SHORT)`;
  }

  async loadOrderbookData() {
    const token = document.getElementById('token').value;
    const sourceA = document.getElementById('sourceA').value;
    const sourceB = document.getElementById('sourceB').value;

    console.log(`📊 Loading orderbook data for ${token}: ${sourceA} vs ${sourceB}`);

    // Afficher loading
    document.getElementById('long-orderbook-data').innerHTML = '<p class="loading">Loading...</p>';
    document.getElementById('short-orderbook-data').innerHTML = '<p class="loading">Loading...</p>';

    // Load both orderbooks in parallel
    const [orderbookA, orderbookB] = await Promise.all([
      this.fetchOrderbook(token, sourceA),
      this.fetchOrderbook(token, sourceB)
    ]);

    this.displayOrderbook(orderbookA, 'long-orderbook-data', 'LONG');
    this.displayOrderbook(orderbookB, 'short-orderbook-data', 'SHORT');
    this.displaySpreadAnalysis(orderbookA, orderbookB);
  }

  async fetchOrderbook(token, exchange) {
    try {
      console.log(`📡 Fetching orderbook: ${exchange}/${token}`);
      const response = await axios.get(`/api/orderbook?exchange=${exchange}&token=${token}`);
      return { ...response.data, exchange, token, success: true };
    } catch (error) {
      console.error(`❌ Error fetching ${exchange} orderbook:`, error);
      return { 
        success: false, 
        error: error.response?.data?.error || error.message,
        exchange,
        token
      };
    }
  }

  displayOrderbook(orderbook, elementId, position) {
    const element = document.getElementById(elementId);
    
    if (!orderbook.success) {
      element.innerHTML = `
        <div class="orderbook-error">
          <p>❌ Erreur de chargement</p>
          <small>${orderbook.error}</small>
          <button onclick="window.reportApp.loadOrderbookData()" class="retry-btn-small">
            🔄 Réessayer
          </button>
        </div>
      `;
      return;
    }

    const riskColor = this.getRiskColor(orderbook.liquidity);
    const riskLevel = this.getRiskLevel(orderbook.liquidity);

    element.innerHTML = `
      <div class="orderbook-data">
        <div class="price-row">
          <span class="label">Best Bid:</span>
          <span class="value">$${orderbook.bidPrice?.toFixed(4) || 'N/A'}</span>
          <span class="qty">${orderbook.bidQty?.toFixed(2) || 'N/A'}</span>
        </div>
        <div class="price-row">
          <span class="label">Best Ask:</span>
          <span class="value">$${orderbook.askPrice?.toFixed(4) || 'N/A'}</span>
          <span class="qty">${orderbook.askQty?.toFixed(2) || 'N/A'}</span>
        </div>
        <div class="metric-row">
          <span class="label">Spread:</span>
          <span class="value">${orderbook.spread?.toFixed(6) || 'N/A'}</span>
        </div>
        <div class="metric-row">
          <span class="label">Liquidity:</span>
          <span class="value">$${orderbook.liquidity?.toFixed(0) || 'N/A'}</span>
        </div>
        <div class="risk-row">
          <span class="label">Risk:</span>
          <span class="risk-indicator" style="background: ${riskColor}"></span>
          <span class="risk-text">${riskLevel}</span>
        </div>
      </div>
    `;
  }

  displaySpreadAnalysis(orderbookA, orderbookB) {
    const spreadElement = document.getElementById('spread-analysis');
    const liquidityElement = document.getElementById('liquidity-analysis');

    if (!orderbookA.success || !orderbookB.success) {
      spreadElement.innerHTML = `
        <div class="analysis-card">
          <h4>Spread Analysis</h4>
          <p class="error-message">Unable to calculate - orderbook data unavailable</p>
        </div>
      `;
      liquidityElement.innerHTML = `
        <div class="analysis-card">
          <h4>Liquidity Analysis</h4>
          <p class="error-message">Unable to calculate - orderbook data unavailable</p>
        </div>
      `;
      return;
    }

    // Spread analysis
    const spreadDiff = Math.abs(orderbookA.spread - orderbookB.spread);
    const avgSpread = (orderbookA.spread + orderbookB.spread) / 2;
    const spreadRatio = avgSpread > 0 ? (spreadDiff / avgSpread * 100) : 0;

    spreadElement.innerHTML = `
      <div class="analysis-card">
        <h4>Spread Analysis</h4>
        <div class="metric">
          <span class="metric-label">Average Spread:</span>
          <span class="metric-value">${avgSpread.toFixed(6)}</span>
        </div>
        <div class="metric">
          <span class="metric-label">Spread Difference:</span>
          <span class="metric-value">${spreadDiff.toFixed(6)}</span>
        </div>
        <div class="metric">
          <span class="metric-label">Spread Ratio:</span>
          <span class="metric-value">${spreadRatio.toFixed(2)}%</span>
        </div>
        <div class="recommendation ${this.getSpreadRecommendationClass(spreadRatio)}">
          ${this.getSpreadRecommendation(spreadRatio)}
        </div>
      </div>
    `;

    // Liquidity analysis
    const minLiquidity = Math.min(orderbookA.liquidity, orderbookB.liquidity);
    const maxLiquidity = Math.max(orderbookA.liquidity, orderbookB.liquidity);
    const liquidityRatio = maxLiquidity > 0 ? (minLiquidity / maxLiquidity) : 0;

    liquidityElement.innerHTML = `
      <div class="analysis-card">
        <h4>Liquidity Analysis</h4>
        <div class="metric">
          <span class="metric-label">${this.EXCHANGE_CONFIG[orderbookA.exchange]?.name || orderbookA.exchange}:</span>
          <span class="metric-value">$${orderbookA.liquidity.toFixed(0)}</span>
        </div>
        <div class="metric">
          <span class="metric-label">${this.EXCHANGE_CONFIG[orderbookB.exchange]?.name || orderbookB.exchange}:</span>
          <span class="metric-value">$${orderbookB.liquidity.toFixed(0)}</span>
        </div>
        <div class="metric">
          <span class="metric-label">Min Liquidity:</span>
          <span class="metric-value">$${minLiquidity.toFixed(0)}</span>
        </div>
        <div class="metric">
          <span class="metric-label">Balance Ratio:</span>
          <span class="metric-value">${(liquidityRatio * 100).toFixed(1)}%</span>
        </div>
        <div class="recommendation ${this.getLiquidityRecommendationClass(minLiquidity)}">
          ${this.getLiquidityRecommendation(minLiquidity)}
        </div>
      </div>
    `;
  }

  getSpreadRecommendation(spreadRatio) {
    if (spreadRatio < 5) return '✅ Good spread alignment';
    if (spreadRatio < 15) return '⚠️ Moderate spread difference';
    return '❌ High spread variance - risk of slippage';
  }

  getSpreadRecommendationClass(spreadRatio) {
    if (spreadRatio < 5) return 'recommendation-good';
    if (spreadRatio < 15) return 'recommendation-warning';
    return 'recommendation-danger';
  }

  getLiquidityRecommendation(minLiquidity) {
    if (minLiquidity > 20000) return '✅ High liquidity';
    if (minLiquidity > 2000) return '⚠️ Moderate liquidity';
    return '❌ Low liquidity - high risk';
  }

  getLiquidityRecommendationClass(minLiquidity) {
    if (minLiquidity > 20000) return 'recommendation-good';
    if (minLiquidity > 2000) return 'recommendation-warning';
    return 'recommendation-danger';
  }

  getRiskColor(liquidity) {
    if (liquidity < 2000) return '#dc2626';
    if (liquidity < 20000) return '#eab308';
    return '#22c55e';
  }

  getRiskLevel(liquidity) {
    if (liquidity < 2000) return 'HIGH';
    if (liquidity < 20000) return 'MEDIUM';
    return 'LOW';
  }

  startOrderbookRefresh() {
    // Refresh orderbook data every 30 seconds
    this.refreshInterval = setInterval(() => {
      console.log('🔄 Auto-refreshing orderbook data...');
      this.loadOrderbookData();
    }, 30000);
  }

  destroy() {
    if (this.refreshInterval) {
      clearInterval(this.refreshInterval);
    }
    if (this.currentChart) {
      this.currentChart.remove();
    }
  }
}

// Initialize the app
let reportApp;

document.addEventListener('DOMContentLoaded', () => {
  console.log('🚀 Funding Report App loading...');
  try {
    reportApp = new FundingReportApp();
    window.reportApp = reportApp; // For debugging and error recovery
    console.log('✅ Report App initialized successfully');
  } catch (error) {
    console.error('❌ Error initializing report app:', error);
    
    // Show user-friendly error
    const container = document.querySelector('.container');
    if (container) {
      container.innerHTML = `
        <div class="init-error">
          <h2>❌ Erreur d'initialisation</h2>
          <p>Une erreur s'est produite lors du chargement de l'application.</p>
          <button onclick="window.location.reload()" class="retry-btn">
            🔄 Recharger la page
          </button>
        </div>
      `;
    }
  }
});

window.addEventListener('beforeunload', () => {
  if (reportApp) {
    reportApp.destroy();
  }
});

console.log('✅ Report script loaded with Supabase integration');