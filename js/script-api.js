// public/js/script-api.js
const API_URL = "/api/funding";
//const API_URL = "http://localhost:4000/api/funding";
let dataStore = [];
let filterFavOnly = false;

async function fetchFundingData() {
  try {
    const { data } = await axios.get(API_URL);
    dataStore = data;
    renderTable();
  } catch (err) {
    console.error("Erreur fetch :", err);
  }
}

function renderTable() {
  const tbody = document.querySelector("#arbitrage-table tbody");
  tbody.innerHTML = "";

  dataStore.forEach(o => {
    if (filterFavOnly && !window.favorites.isFav(o.symbol)) return;

    // --- LOGIQUE MODIFIÉE ---
    // 1. Rassembler tous les taux disponibles (non-null) pour la paire
    const allRates = [
      { dex: "Paradex",     rate: o.paradex1h },
      { dex: "Vest",        rate: o.vest1h    },
      { dex: "Extended",    rate: o.ext1h     },
      { dex: "Hyperliquid", rate: o.hyperliquid1h },
    ];
    const availableRates = allRates.filter(r => r.rate !== null);

    // 2. S'il y a moins de 2 taux, on ne peut pas faire d'arbitrage, donc on ignore la paire.
    if (availableRates.length < 2) {
      return;
    }

    // 3. Calculer la stratégie et l'APR uniquement sur les taux disponibles
    const minE = availableRates.reduce((a, b) => a.rate < b.rate ? a : b);
    const maxE = availableRates.reduce((a, b) => a.rate > b.rate ? a : b);
    const strategy = `Long ${minE.dex}, Short ${maxE.dex}`;
    const spread   = maxE.rate - minE.rate;
    const apr      = spread * 24 * 365 * 100;

    const favClass = window.favorites.isFav(o.symbol) ? "fav active" : "fav";

    const row = document.createElement("tr");
    // 4. Afficher les taux ou '—' s'ils sont manquants (null)
    row.innerHTML = `
      <td><span class="${favClass}" data-symbol="${o.symbol}" title="Favori">★</span></td>
      <td>${o.symbol}</td>
      <td>${o.vest1h !== null ? o.vest1h.toFixed(6) : '—'}</td>
      <td>${o.paradex1h !== null ? o.paradex1h.toFixed(6) : '—'}</td>
      <td>${o.ext1h !== null ? o.ext1h.toFixed(6) : '—'}</td>
      <td>${o.hyperliquid1h !== null ? o.hyperliquid1h.toFixed(6) : '—'}</td>
      <td>${strategy}</td>
      <td>${apr.toFixed(2)}%</td>
    `;
    tbody.appendChild(row);
  });

  // attacher clic sur étoiles
  document.querySelectorAll("span.fav").forEach(el => {
    el.addEventListener("click", () => {
      window.favorites.toggle(el.dataset.symbol);
      renderTable();
    });
  });

  // mettre à jour l’état du bouton filtre
  document.getElementById("filter-fav-btn").textContent = filterFavOnly
    ? "Afficher Tout"
    : "Afficher Favoris";
}

document.getElementById("sort-apr-btn").addEventListener("click", () => {
  dataStore.sort((a, b) => {
    const aprOf = o => {
      const arr = [o.paradex1h, o.vest1h, o.ext1h, o.hyperliquid1h];
      const validRates = arr.filter(rate => rate !== null);
      if (validRates.length < 2) return 0;
      return (Math.max(...validRates) - Math.min(...validRates)) * 24 * 365 * 100;
    };
    return aprOf(b) - aprOf(a);
  });
  renderTable();
});

document.getElementById("filter-fav-btn").addEventListener("click", () => {
  filterFavOnly = !filterFavOnly;
  renderTable();
});

fetchFundingData();