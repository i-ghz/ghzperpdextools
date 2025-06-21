// public/js/script-api.js
const API_URL = "/api/funding";
// public/js/script-api.js
//const API_URL = "/api/funding";
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
    if (o.vest1h == null || o.paradex1h == null || o.ext1h == null) return;
    if (filterFavOnly && !window.favorites.isFav(o.symbol)) return;

    const rates = [
      { dex: "Paradex",  rate: o.paradex1h },
      { dex: "Vest",     rate: o.vest1h    },
      { dex: "Extended", rate: o.ext1h     },
    ];
    const minE = rates.reduce((a,b)=>a.rate<b.rate?a:b);
    const maxE = rates.reduce((a,b)=>a.rate>b.rate?a:b);
    const strategy = `Long ${minE.dex}, Short ${maxE.dex}`;
    const spread   = maxE.rate - minE.rate;
    const apr      = spread * 24 * 365 * 100;

    const favClass = window.favorites.isFav(o.symbol) ? "fav active" : "fav";

    const row = document.createElement("tr");
    row.innerHTML = `
      <td><span class="${favClass}" data-symbol="${o.symbol}" title="Favori">★</span></td>
      <td>${o.symbol}</td>
      <td>${o.vest1h.toFixed(6)}</td>
      <td>${o.paradex1h.toFixed(6)}</td>
      <td>${o.ext1h.toFixed(6)}</td>
      <td>${strategy}</td>
      <td>${apr.toFixed(2)}%</td>
    `;
    tbody.appendChild(row);
  });

  // attacher clic sur étoiles
  document.querySelectorAll("span.fav").forEach(el=>{
    el.addEventListener("click", ()=>{
      window.favorites.toggle(el.dataset.symbol);
      renderTable();
    });
  });

  // mettre à jour l’état du bouton filtre
  document.getElementById("filter-fav-btn").textContent = filterFavOnly
    ? "Afficher Tout"
    : "Afficher Favoris";
}

document.getElementById("sort-apr-btn").addEventListener("click", ()=>{
  dataStore.sort((a,b)=>{
    const aprOf=o=>{
      const arr=[o.paradex1h,o.vest1h,o.ext1h];
      return (Math.max(...arr)-Math.min(...arr))*24*365*100;
    };
    return aprOf(b)-aprOf(a);
  });
  renderTable();
});

document.getElementById("filter-fav-btn").addEventListener("click", ()=>{
  filterFavOnly = !filterFavOnly;
  renderTable();
});

fetchFundingData();
