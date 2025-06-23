// js/fundingchart.js

// Liste de tokens (même que d’habitude)
const TOKENS = [
    "AAVE", "ADA", "AI16Z", "AIXBT", "ALCH", "ANIME", "APT", "AR", "ARB", "ATOM", "AVAX", "BCH", "BERA", "BNB", "BRETT", "BTC",
    "CRV", "DOGE", "DOT", "DYDX", "EIGEN", "ENA", "ETC", "ETH", "ETHFI", "EUR", "FARTCOIN", "FET", "FIL", "FTM", "GOAT",
    "GRASS", "GRIFFAIN", "HYPE", "HYPER", "INIT", "INJ", "IO", "IP", "JTO", "JUP", "KAITO", "KBONK", "KFLOKI", "KNEIRO",
    "KPEPE", "KSHIB", "LAUNCHCOIN", "LAYER", "LDO", "LINK", "LTC", "MATIC", "MELANIA", "MEME", "MEW", "MKR", "MNT",
    "MOODENG", "MORPHO", "MOVE", "NEAR", "NIL", "NOT", "NXPC", "OM", "ONDO", "OP", "ORDI", "PAXG", "PENDLE", "PENGU", "PNUT",
    "POPCAT", "PROMPT", "PYTH", "RENDER", "RESOLV", "RUNE", "S", "SCR", "SEI", "SOL", "SOPH", "SPX", "STRK", "SUI", "TAO", "TIA",
    "TON", "TRB", "TRUMP", "TRX", "TST", "TURBO", "UNI", "USUAL", "VINE", "VIRTUAL", "VVV", "W", "WAL", "WCT", "WIF", "WLD",
    "XLM", "XRP", "ZEREBRO", "ZK", "ZRO", "ZORA"
  ];
  
  // Remplissage du sélecteur Token
  const tokenSelect = document.getElementById('token');
  TOKENS.forEach(tk => {
    const opt = document.createElement('option');
    opt.value = tk; opt.text = tk;
    tokenSelect.appendChild(opt);
  });
  tokenSelect.value = "BTC";
  
  let fundingChart, aprChart;
  
  // Moyenne mobile
  function movingAverage(arr, windowSize) {
    if (windowSize < 2) return Array(arr.length).fill(null);
    return arr.map((_, idx) => {
      if (idx < windowSize - 1) return null;
      const window = arr.slice(idx - windowSize + 1, idx + 1);
      return window.reduce((a, b) => a + b, 0) / window.length;
    });
  }
  
  // API funding
  async function fetchFunding(token, source, days=40) {
    const url = `/api/funding-history?symbol=${token}&source=${source}&days=${days}`;
    const res = await fetch(url);
    if (!res.ok) return [];
    return await res.json();
  }
  
  // Affichage principal
  async function drawComparison() {
    const token = document.getElementById('token').value;
    const sourceA = document.getElementById('sourceA').value;
    const sourceB = document.getElementById('sourceB').value;
    const days = 40;
    const maWindow = Number(document.getElementById('ma-window').value);
  
    // Récup data
    const [fundA, fundB] = await Promise.all([
      fetchFunding(token, sourceA, days),
      fetchFunding(token, sourceB, days)
    ]);
    const commonDates = fundA.map(x => x.date).filter(d => fundB.some(y => y.date === d));
    commonDates.sort();
  
    // Funding rates annualisés (direct lisible)
    const ratesA = commonDates.map(d => Number(fundA.find(x => x.date === d)?.funding_rate ?? 0) * 24 * 365 * 100);
    const ratesB = commonDates.map(d => Number(fundB.find(x => x.date === d)?.funding_rate ?? 0) * 24 * 365 * 100);
  
    // MA (si sélectionnée)
    const maA = maWindow ? movingAverage(ratesA, maWindow) : [];
    const maB = maWindow ? movingAverage(ratesB, maWindow) : [];
  
    // APR delta-neutre annualisé
    const aprs = commonDates.map((_, i) => (-ratesA[i] + ratesB[i]));
    const maAPR = maWindow ? movingAverage(aprs, maWindow) : [];
  
    // Funding Chart
    if (fundingChart) fundingChart.destroy();
    fundingChart = new Chart(document.getElementById('fundingChart'), {
      type: 'line',
      data: {
        labels: commonDates.map(d => d.slice(0, 10)),
        datasets: [
          {
            label: `Funding rate ${token} (${sourceA}, long) annualisé (%)`,
            data: ratesA,
            borderColor: 'rgb(255,99,132)', pointRadius: 0, tension: 0.3
          },
          {
            label: `Funding rate ${token} (${sourceB}, short) annualisé (%)`,
            data: ratesB,
            borderColor: 'rgb(54,162,235)', pointRadius: 0, tension: 0.3
          },
          ...(maWindow ? [{
            label: `MA ${maWindow}j (${sourceA})`,
            data: maA,
            borderColor: 'rgba(255,99,132,0.5)',
            borderDash: [6, 5], fill: false, pointRadius: 0
          },{
            label: `MA ${maWindow}j (${sourceB})`,
            data: maB,
            borderColor: 'rgba(54,162,235,0.5)',
            borderDash: [6, 5], fill: false, pointRadius: 0
          }] : [])
        ]
      },
      options: {
        responsive: true,
        plugins: { 
          legend: { position: 'top' },
          tooltip: { enabled: true },
          zoom: {
            zoom: { wheel: { enabled: true }, pinch: { enabled: true }, mode: 'x' }
          }
        },
        scales: {
          y: { title: { display: true, text: 'Funding rate annualisé (%)' } },
          x: { title: { display: true, text: 'Date' } }
        }
      }
    });
  
    // APR Chart
    if (aprChart) aprChart.destroy();
    aprChart = new Chart(document.getElementById('aprChart'), {
      type: 'line',
      data: {
        labels: commonDates.map(d => d.slice(0, 10)),
        datasets: [
          {
            label: `APR delta-neutre (Long ${sourceA}, Short ${sourceB}) annualisé (%)`,
            data: aprs,
            borderColor: 'rgb(34,197,94)', pointRadius: 2, tension: 0.2, fill: true,
          },
          ...(maWindow ? [{
            label: `MA ${maWindow}j APR`,
            data: maAPR,
            borderColor: 'rgba(34,197,94,0.3)',
            borderDash: [6, 5], fill: false, pointRadius: 0
          }] : [])
        ]
      },
      options: {
        responsive: true,
        plugins: { 
          legend: { position: 'top' },
          tooltip: { enabled: true },
          zoom: {
            zoom: { wheel: { enabled: true }, pinch: { enabled: true }, mode: 'x' }
          }
        },
        scales: {
          y: { title: { display: true, text: 'APR delta-neutre annualisé (%)' } },
          x: { title: { display: true, text: 'Date' } }
        }
      }
    });
  }
  
  // Initial draw
  window.onload = drawComparison;
  