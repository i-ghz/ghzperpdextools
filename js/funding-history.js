// funding-history-auto.js

// Liste des tokens à proposer dans le dropdown
const TOKENS = [
    "WLD","TON","TRX","BTC","AAVE","SOL","ADA","INIT","AVAX","RESOLV",
    "MELANIA","VIRTUAL","LTC","GRASS","WIF","MKR","JUP","PENDLE","TRUMP",
    "XRP","TIA","PENGU","KAITO","S","ETH","DOT","HYPE","FARTCOIN","ONDO",
    "BNB","BERA","POPCAT","SEI","DOGE","ENA","NEAR","SUI","TAO"
  ];
  
  /**
   * Construit le nom de fichier CSV à partir du token et de la source.
   * Ex: token="WLD", source="paradex" -> "wld-paradex.csv"
   * Vous pouvez adapter le chemin (ex: préfixer un dossier) ici si besoin.
   */
  function buildCsvFilename(token, source) {
    const t = token.trim().toLowerCase();
    const s = source.trim().toLowerCase();
    // On ajoute le préfixe output/csv/
    return `output/csv/${t}-${s}.csv`;
  }  
  
  /**
   * Récupère l’élément select de token et le remplit.
   */
  function populateTokenSelect() {
    const sel = document.getElementById('tokenSelect');
    if (!sel) {
      console.warn('populateTokenSelect: pas de <select id="tokenSelect"> trouvé.');
      return;
    }
    // Vider
    sel.innerHTML = '';
    // Option par défaut vide ou première?
    const opt0 = document.createElement('option');
    opt0.value = '';
    opt0.textContent = '-- Choisir un token --';
    sel.appendChild(opt0);
    for (const token of TOKENS) {
      const opt = document.createElement('option');
      opt.value = token;
      opt.textContent = token;
      sel.appendChild(opt);
    }
  }
  
  /**
   * Récupère la valeur sélectionnée pour la source (string)
   */
  function getSelectedSource(idSelect) {
    const sel = document.getElementById(idSelect);
    if (!sel) return '';
    return sel.value;
  }
  
  /**
   * Met à jour dynamiquement les champs URL (urlA, urlB) selon le token et la source choisie.
   * Si token non choisi (vide), on peut vider ou laisser en placeholder.
   */
  function updateUrlFields() {
    const token = document.getElementById('tokenSelect')?.value;
    const srcA = getSelectedSource('sourceA');
    const srcB = getSelectedSource('sourceB');
    const urlAInput = document.getElementById('urlA');
    const urlBInput = document.getElementById('urlB');
    if (!urlAInput || !urlBInput) {
      console.warn('updateUrlFields: inputs urlA/urlB introuvables');
      return;
    }
  
    if (token) {
      if (srcA) {
        urlAInput.value = buildCsvFilename(token, srcA);
      } else {
        urlAInput.value = '';
      }
      if (srcB) {
        urlBInput.value = buildCsvFilename(token, srcB);
      } else {
        urlBInput.value = '';
      }
    } else {
      // pas de token choisi
      urlAInput.value = '';
      urlBInput.value = '';
    }
  }
  
  /**
   * Parse un CSV donnant deux colonnes 'date' (ou 'time') et 'oneHrFundingRate' (ou 'funding_rate').
   * Retourne un tableau d’objets { time: Date (arrondi à l'heure pleine locale), rate: Number } trié par time asc.
   */
  function parseCsvTimeRate(text) {
      const lines = text.trim().split(/\r?\n/);
      if (lines.length === 0) return [];
  
      // En-tête
      let headerLine = lines[0].trim();
      if (headerLine.charCodeAt(0) === 0xFEFF) {
        headerLine = headerLine.slice(1);
      }
      // Détecter séparateur
      const sep = headerLine.includes(',') ? ',' : (headerLine.includes(';') ? ';' : ',');
      const headerCols = headerLine.split(sep).map(h => h.trim().toLowerCase());
      console.log("parseCsvTimeRate: headerCols =", headerCols);
  
      // Index colonnes temps
      let timeIdx = headerCols.indexOf('time');
      if (timeIdx < 0) timeIdx = headerCols.indexOf('date');
      if (timeIdx < 0) timeIdx = headerCols.indexOf('timestamp');
      // Index colonnes taux
      let rateIdx = headerCols.indexOf('funding_rate');
      if (rateIdx < 0) rateIdx = headerCols.indexOf('onehrfundingrate');
      if (timeIdx < 0 || rateIdx < 0) {
        console.error(
          'CSV header invalide : attendu colonne "date"/"time" et "oneHrFundingRate" ou "funding_rate". ' +
          'Trouvé : [' + headerCols.join(',') + ']'
        );
        return [];
      }
  
      const data = [];
      for (let i = 1; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;
        const cols = line.split(sep);
        if (cols.length <= Math.max(timeIdx, rateIdx)) {
          console.warn(`parseCsvTimeRate: ligne ${i+1} ignorée (pas assez de colonnes): ${line}`);
          continue;
        }
        const dateRaw = cols[timeIdx].trim();
        const date0 = new Date(dateRaw);
        if (isNaN(date0.getTime())) {
          console.warn(`parseCsvTimeRate: ligne ${i+1} date invalide "${dateRaw}"`);
          continue;
        }
        // Arrondir à l’heure pleine locale
        const date = new Date(date0.getFullYear(), date0.getMonth(), date0.getDate(), date0.getHours());
        const rateRaw = cols[rateIdx].trim();
        const rate = parseFloat(rateRaw);
        if (isNaN(rate)) {
          console.warn(`parseCsvTimeRate: ligne ${i+1} rate invalide "${rateRaw}"`);
          continue;
        }
        data.push({ time: date, rate });
      }
      data.sort((a, b) => a.time - b.time);
      console.log(`parseCsvTimeRate: ${data.length} points valides extraits`);
      return data;
  }
  
  /**
   * Récupère la stratégie choisie dans le DOM (radio name="strategy").
   * Retourne 'longAshortB' ou 'longBshortA'.
   */
  function getSelectedStrategy() {
    const radios = document.getElementsByName('strategy');
    for (const r of radios) {
      if (r.checked) {
        return r.value;
      }
    }
    return 'longAshortB';
  }
  
  /**
   * Calcule netRate selon la stratégie :
   * - longAshortB: net = rateB - rateA  (on long A, on reçoit fundingA; short B on paie fundingB; net = fundingA - fundingB = -(rateA)???)
   *   en fait, si on définit rate = funding rate horaire (positive signifie long paie short? selon convention),
   *   assurez-vous de la convention : ici on conserve la même formule que précédemment :
   *   computeNetRate(rateA, rateB, strategy) = (long reçoit - short paie) ou l’inverse.
   *   Ajustez selon signe de rate dans vos CSV.
   * - longBshortA: net = rateA - rateB
   */
  function computeNetRate(rateA, rateB, strategy) {
    if (strategy === 'longAshortB') {
      // net funding hourly pour la position delta neutre
      return rateA - rateB;
    } else if (strategy === 'longBshortA') {
      return rateB - rateA;
    }
    // fallback
    return rateA - rateB;
  }
  
  /**
   * loadAndPlot : fetch les deux CSV, parse, aligne, calcule APR cumulée selon la stratégie,
   * et trace la courbe APR (%) vs temps.
   */
  async function loadAndPlot() {
    // Réinitialiser messages
    document.getElementById('messageZero').textContent = '';
    document.getElementById('aprResult').textContent = '';
  
    // Récupérer token, labels et URLs
    const token = document.getElementById('tokenSelect')?.value;
    const srcA = getSelectedSource('sourceA');
    const srcB = getSelectedSource('sourceB');
    const urlA = document.getElementById('urlA').value.trim();
    const urlB = document.getElementById('urlB').value.trim();
    const strategy = getSelectedStrategy();
  
    if (!token) {
      alert('Veuillez choisir un token.');
      return;
    }
    if (!srcA || !srcB) {
      alert('Veuillez choisir deux sources différentes.');
      return;
    }
    if (srcA === srcB) {
      alert('Veuillez choisir deux sources différentes.');
      return;
    }
    console.log('Token:', token, 'Source A:', srcA, 'URL A:', urlA, 'Source B:', srcB, 'URL B:', urlB, 'Stratégie:', strategy);
  
    // Fetch CSV A
    let dataA = [];
    try {
      const respA = await fetch(urlA);
      if (!respA.ok) throw new Error(`HTTP ${respA.status}`);
      const textA = await respA.text();
      dataA = parseCsvTimeRate(textA);
      if (dataA.length === 0) {
        alert(`Le CSV de la source A (${srcA}) ne contient pas de données valides.`);
        return;
      }
      console.log(`Source A (${srcA}) parsed:`, dataA.length, 'points, du', dataA[0].time, 'au', dataA[dataA.length-1].time);
    } catch (err) {
      console.error('Erreur fetch/parsing CSV A:', err);
      alert(`Erreur lors du chargement du CSV de la source A (${srcA}). Voir console.`);
      return;
    }
  
    // Fetch CSV B
    let dataB = [];
    try {
      const respB = await fetch(urlB);
      if (!respB.ok) throw new Error(`HTTP ${respB.status}`);
      const textB = await respB.text();
      dataB = parseCsvTimeRate(textB);
      if (dataB.length === 0) {
        console.warn(`Source B (${srcB}) parsed: 0 points. On considérera funding B = 0 partout.`);
      } else {
        console.log(`Source B (${srcB}) parsed:`, dataB.length, 'points, du', dataB[0].time, 'au', dataB[dataB.length-1].time);
      }
    } catch (err) {
      console.error('Erreur fetch/parsing CSV B:', err);
      alert(`Erreur lors du chargement du CSV de la source B (${srcB}). Voir console.`);
      return;
    }
  
    // Avertissement si B constant ou absent
    const isBAllZero = dataB.length > 0 && dataB.every(pt => pt.rate === 0);
    if (dataB.length === 0) {
      document.getElementById('messageZero').textContent =
        `Attention : pas de données pour la source B (${srcB}), on part du principe funding B = 0.`;
    } else if (isBAllZero) {
      document.getElementById('messageZero').textContent =
        `Attention : la série B (${srcB}) est constante à 0 pour la période sélectionnée. (Si c'est Vest c'est normal😉)`;
    }
  
    // Aligner points par timestamp (heure pleine)
    const mapB = new Map();
    dataB.forEach(pt => mapB.set(pt.time.getTime(), pt.rate));
    const netEntries = [];
    dataA.forEach(ptA => {
      const tms = ptA.time.getTime();
      const rateA = ptA.rate;
      const rateB = mapB.has(tms) ? mapB.get(tms) : 0;
      const net = computeNetRate(rateA, rateB, strategy);
      netEntries.push({ time: ptA.time, netRate: net });
    });
    if (netEntries.length === 0) {
      document.getElementById('aprResult').textContent =
        'Impossible de calculer APR : pas de points synchronisés.';
      return;
    }
  
    // Calcul APR cumulée (simple) au fil du temps
    const aprSeries = [];
    let sumNet = 0;
    for (let i = 0; i < netEntries.length; i++) {
      sumNet += netEntries[i].netRate;
      const avgHourly = sumNet / (i + 1);
      const aprSimple = avgHourly * 24 * 365 * 100;
      aprSeries.push({ time: netEntries[i].time, apr: aprSimple });
    }
    const chartDataAPR = aprSeries.map(pt => ({ x: pt.time, y: pt.apr }));
  
    // Bornes X/Y
    const allTimes = chartDataAPR.map(d => d.x.getTime());
    let minX = Math.min(...allTimes);
    let maxX = Math.max(...allTimes);
    let allApr = chartDataAPR.map(d => d.y);
    let minY = Math.min(...allApr);
    let maxY = Math.max(...allApr);
    if (minY === maxY) {
      const pad = Math.abs(minY) * 0.1 || 1;
      minY -= pad; maxY += pad;
    } else {
      const range = maxY - minY;
      minY -= range * 0.1; maxY += range * 0.1;
    }
  
    // Choix unité temps
    const durationMs = maxX - minX;
    let timeUnit = 'hour';
    if (durationMs > 7 * 24 * 60 * 60 * 1000) {
      timeUnit = 'day';
    } else if (durationMs > 2 * 24 * 60 * 60 * 1000) {
      timeUnit = 'day';
    } else {
      timeUnit = 'hour';
    }
  
    // Tracé Chart.js
    if (window.myChart) window.myChart.destroy();
    const ctx = document.getElementById('chartCanvas').getContext('2d');
    window.myChart = new Chart(ctx, {
      type: 'line',
      data: {
        datasets: [
          {
            label: 'APR simple (%)',
            data: chartDataAPR,
            borderColor: 'green',
            borderWidth: 2,
            fill: false,
            parsing: false,
            spanGaps: true,
            pointRadius: 2,
            tension: 0.2,
          },
        ]
      },
      options: {
        scales: {
          x: {
            type: 'time',
            time: {
              unit: timeUnit,
              displayFormats: {
                hour: 'HH:mm',
                day: 'dd LLL',
                month: 'MMM yyyy'
              }
            },
            min: minX,
            max: maxX,
            title: { display: true, text: 'Temps' },
            ticks: {
              maxTicksLimit: timeUnit === 'day' ? 15 : undefined
            }
          },
          y: {
            title: { display: true, text: 'APR (%)' },
            min: minY,
            max: maxY
          }
        },
        plugins: {
          tooltip: {
            callbacks: {
              label: ctx => {
                const v = ctx.parsed.y;
                return `${ctx.dataset.label}: ${v.toFixed(2)}%`;
              }
            }
          }
        },
        animation: { duration: 0 },
        elements: { point: { hoverRadius: 4 } }
      }
    });
  
    // Affichage APR global
    const avgHourlyNetTotal = sumNet / netEntries.length;
    const aprGlobalSimple = avgHourlyNetTotal * 24 * 365 * 100;
    let aprCompText = '';
    let cumulTotal = 1;
    netEntries.forEach(pt => { cumulTotal *= (1 + pt.netRate); });
    const totalHours = netEntries.length;
    if (totalHours > 0) {
      const avgHourlyComp = Math.pow(cumulTotal, 1 / totalHours) - 1;
      const aprComp = Math.pow(1 + avgHourlyComp, 24 * 365) - 1;
      aprCompText = ` (APR composé ~ ${(aprComp*100).toFixed(2)}%)`;
    }
    // Adapter le libellé selon stratégie et plateformes
    const stratLabel = strategy === 'longAshortB'
      ? `long ${srcA} / short ${srcB}`
      : `long ${srcB} / short ${srcA}`;
    document.getElementById('aprResult').textContent =
      `APR approximatif global (${token}, ${stratLabel}) : ${aprGlobalSimple.toFixed(2)}%${aprCompText}`;
  }
  
  // Au chargement DOM, on remplit le select token et on lie les événements
  document.addEventListener('DOMContentLoaded', () => {
    populateTokenSelect();
    // Mettre à jour URL au changement de token ou de source
    const tokenSel = document.getElementById('tokenSelect');
    const srcA_sel = document.getElementById('sourceA');
    const srcB_sel = document.getElementById('sourceB');
    if (tokenSel) tokenSel.addEventListener('change', updateUrlFields);
    if (srcA_sel) srcA_sel.addEventListener('change', updateUrlFields);
    if (srcB_sel) srcB_sel.addEventListener('change', updateUrlFields);
  
    // Vous pouvez rendre les inputs URL en lecture seule :
    const urlAInput = document.getElementById('urlA');
    const urlBInput = document.getElementById('urlB');
    if (urlAInput) urlAInput.readOnly = true;
    if (urlBInput) urlBInput.readOnly = true;
  
    // Initial update si des valeurs par défaut étaient définies
    updateUrlFields();
  
    // Attacher le bouton
    const btn = document.getElementById('loadPlot');
    if (btn) btn.addEventListener('click', loadAndPlot);
  });
  