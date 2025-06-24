// Liste des tokens
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

// Sélection du token et initialisation
const tokenSelect = document.getElementById('token');
TOKENS.forEach(tk => {
  const opt = document.createElement('option');
  opt.value = tk;
  opt.text = tk;
  tokenSelect.appendChild(opt);
});
tokenSelect.value = "BTC";

const sourceA = document.getElementById('sourceA');
const sourceB = document.getElementById('sourceB');

// Nettoie, supprime doublons timestamp, aucune value/NaN/null
function cleanData(data) {
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

// Calcul la moving average
function calculateMovingAverageSeriesData(data, maLength) {
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

// Fetch, formate (timestamp seconds, value)
async function fetchFunding(token, source, days = 50) {
  const url = `/api/funding-history?symbol=${token}&source=${source}&days=${days}`;
  const res = await fetch(url);
  if (!res.ok) return [];
  const data = await res.json();
  return cleanData(data.map(d => ({
    time: Math.floor(new Date(d.date.slice(0, 10)).getTime() / 1000),
    value: Math.round(Number(d.funding_rate) * 24 * 365 * 100 * 10000) / 10000
  })));
}

// Croise, ne garde que les dates communes et valides
function getCommonCleanPoints(dataA, dataB) {
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

// Crée le graphique (APR, MA si demandé)
function createDeltaNeutralChart(dataA, dataB, labelA, labelB, maWindow = 7) {
  const chartDiv = document.getElementById('fundingChart');
  chartDiv.innerHTML = "";

  const points = getCommonCleanPoints(dataA, dataB);
  const cleanA = points.map(pt => ({ time: pt.time, value: pt.valueA }));
  const cleanB = points.map(pt => ({ time: pt.time, value: pt.valueB }));
  const deltaApr = points.map(pt => ({
    time: pt.time,
    value: Math.round((pt.valueB - pt.valueA) * 10000) / 10000
  }));

  // Calcul MA sur deltaApr
  const maApr = calculateMovingAverageSeriesData(deltaApr, maWindow);

  const chart = window.LightweightCharts.createChart(chartDiv, {
    width: 950,
    height: 430,
    layout: { background: { color: '#181818' }, textColor: '#ededed' },
    grid: { vertLines: { color: '#262626' }, horzLines: { color: '#262626' } },
    timeScale: { timeVisible: true, secondsVisible: false },
    rightPriceScale: { borderColor: '#71649C' },
    crosshair: { mode: 0 }
  });

  if (cleanA.length)
    chart.addSeries(window.LightweightCharts.LineSeries, {
      color: '#ff6384',
      lineWidth: 2,
      title: labelA,
      priceLineVisible: false
    }).setData(cleanA);

  if (cleanB.length)
    chart.addSeries(window.LightweightCharts.LineSeries, {
      color: '#36a2eb',
      lineWidth: 2,
      title: labelB,
      priceLineVisible: false
    }).setData(cleanB);

  if (deltaApr.length)
    chart.addSeries(window.LightweightCharts.LineSeries, {
      color: '#22c55e',
      lineWidth: 2,
      title: 'Delta-Neutral APR',
      priceLineVisible: true
    }).setData(deltaApr);

  if (maApr.length)
    chart.addSeries(window.LightweightCharts.LineSeries, {
      color: '#ffaa00',
      lineWidth: 2,
      title: `MA ${maWindow}j (APR)`,
      priceLineVisible: false
    }).setData(maApr);

  chart.timeScale().fitContent();
  return chart;
}

// Gère le bouton show et la MA window
async function showChartWithMA() {
  const token = tokenSelect.value;
  const srcA = sourceA.value;
  const srcB = sourceB.value;
  const maWindow = parseInt(document.getElementById('ma-window').value) || 7;
  const [dataA, dataB] = await Promise.all([
    fetchFunding(token, srcA),
    fetchFunding(token, srcB)
  ]);
  createDeltaNeutralChart(
    dataA, dataB,
    `Funding Rate ${token} (${srcA})`,
    `Funding Rate ${token} (${srcB})`,
    maWindow
  );
}

document.getElementById('showChart').onclick = showChartWithMA;
document.getElementById('ma-window').onchange = showChartWithMA;

// Affichage initial
window.onload = showChartWithMA;
