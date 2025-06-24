const API_URL = "/api/funding";
let dataStore = [];
let filterFavOnly = false;

// Table de correspondance des logos
const EX_LOGOS = {
  paradex:     'images/paradex.png',
  vest:        'images/vest.png',
  ext:         'images/extended.png',
  hyperliquid: 'images/hyperliquid.png'
};

// Retourne la liste des exchanges sélectionnés (cochés)
function getSelectedExchanges() {
  return Array.from(document.querySelectorAll('.exchange-filter:checked')).map(cb => cb.value);
}

// Fetch les données (API)
async function fetchFundingData() {
  try {
    const { data } = await axios.get(API_URL);
    dataStore = data;
    renderTable();
  } catch (err) {
    console.error("Error fetch :", err);
  }
}

// Rend le tableau dynamiquement selon les exchanges cochés
function renderTable() {
  const tbody = document.querySelector("#arbitrage-table tbody");
  tbody.innerHTML = "";

  const selectedExchanges = getSelectedExchanges();

  // Update header dynamiquement selon exchanges cochés
  const thead = document.querySelector("#arbitrage-table thead tr");
  thead.innerHTML = `
    <th>★</th>
    <th>Pair</th>
    ${selectedExchanges.map(dex => {
      // Ajoute le logo dans le header aussi !
      const label = {
        paradex: "Paradex",
        vest: "Vest",
        ext: "Extended",
        hyperliquid: "Hyperliquid"
      }[dex];
      return `<th><img src="${EX_LOGOS[dex]}" alt="${label}" class="ex-logo-td"> ${label} 1h</th>`;
    }).join('')}
    <th>Strategy</th>
    <th>APR</th>
  `;

  dataStore.forEach(o => {
    if (filterFavOnly && !window.favorites.isFav(o.symbol)) return;

    // Liste tous les taux sélectionnés pour la paire
    const allRates = [
      { dex: "paradex", label: "Paradex", rate: o.paradex1h },
      { dex: "vest", label: "Vest", rate: o.vest1h },
      { dex: "ext", label: "Extended", rate: o.ext1h },
      { dex: "hyperliquid", label: "Hyperliquid", rate: o.hyperliquid1h },
    ].filter(r => selectedExchanges.includes(r.dex));

    // On ne garde que les taux non nuls
    const availableRates = allRates.filter(r => r.rate !== null);

    // Arbitrage que si au moins 2 exchanges valides
    if (availableRates.length < 2) return;

    const minE = availableRates.reduce((a, b) => a.rate < b.rate ? a : b);
    const maxE = availableRates.reduce((a, b) => a.rate > b.rate ? a : b);
    const strategy = `Long ${minE.label}, Short ${maxE.label}`;
    const spread   = maxE.rate - minE.rate;
    const apr      = spread * 24 * 365 * 100;
    const favClass = window.favorites.isFav(o.symbol) ? "fav active" : "fav";

    // Génère la ligne avec les bonnes colonnes seulement
    const row = document.createElement("tr");
    row.innerHTML = `
      <td><span class="${favClass}" data-symbol="${o.symbol}" title="Favori">★</span></td>
      <td>${o.symbol}</td>
      ${allRates.map(r =>
        `<td>${
          r.rate !== null
            ? `<img src="${EX_LOGOS[r.dex]}" alt="${r.label}" class="ex-logo-td"> ${r.rate.toFixed(6)}`
            : '—'
        }</td>`
      ).join('')}
      <td>${strategy}</td>
      <td>${apr.toFixed(2)}%</td>
    `;
    tbody.appendChild(row);
  });

  // Gère les favoris
  document.querySelectorAll("span.fav").forEach(el => {
    el.addEventListener("click", () => {
      window.favorites.toggle(el.dataset.symbol);
      renderTable();
    });
  });

  // Met à jour texte bouton fav
  document.getElementById("filter-fav-btn").textContent = filterFavOnly
    ? "Show Everything"
    : "Show Favorites";
}

// Tri APR
document.getElementById("sort-apr-btn").addEventListener("click", () => {
  dataStore.sort((a, b) => {
    const selectedExchanges = getSelectedExchanges();
    function aprOf(o) {
      const arr = [
        selectedExchanges.includes("paradex")     ? o.paradex1h     : null,
        selectedExchanges.includes("vest")        ? o.vest1h        : null,
        selectedExchanges.includes("ext")         ? o.ext1h         : null,
        selectedExchanges.includes("hyperliquid") ? o.hyperliquid1h : null,
      ].filter(rate => rate !== null);
      if (arr.length < 2) return 0;
      return (Math.max(...arr) - Math.min(...arr)) * 24 * 365 * 100;
    }
    return aprOf(b) - aprOf(a);
  });
  renderTable();
});

// Filtre favoris
document.getElementById("filter-fav-btn").addEventListener("click", () => {
  filterFavOnly = !filterFavOnly;
  renderTable();
});

// Met à jour le tableau si l'utilisateur (dé)coche un exchange
document.querySelectorAll('.exchange-filter').forEach(cb =>
  cb.addEventListener('change', renderTable)
);

// Charge initiale
fetchFundingData();
