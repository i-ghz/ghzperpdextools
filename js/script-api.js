// public/js/script-api.js
const API_URL = "http://localhost:4000/api/funding";
let dataStore = [];

async function fetchFundingData() {
  try {
    const { data } = await axios.get(API_URL);
    dataStore = data;
    renderTable(dataStore);
  } catch (err) {
    console.error("Erreur fetch :", err);
  }
}

function renderTable(list) {
  const tbody = document.querySelector("#arbitrage-table tbody");
  tbody.innerHTML = "";

  list.forEach(o => {
    // SI l'une des plateformes manque, on saute
    if (o.vest1h   == null ||
        o.paradex1h== null ||
        o.ext1h    == null) {
      return;
    }

    // on a les trois rates => on peut calculer
    const rates = [
      { dex: "Paradex",   rate: o.paradex1h },
      { dex: "Vest",      rate: o.vest1h    },
      { dex: "Extended",  rate: o.ext1h     },
    ];

    const minE = rates.reduce((a,b) => a.rate < b.rate ? a : b);
    const maxE = rates.reduce((a,b) => a.rate > b.rate ? a : b);

    const strategy = `Long ${minE.dex}, Short ${maxE.dex}`;
    const spread   = maxE.rate - minE.rate;
    const apr      = spread * 24 * 365 * 100;

    const row = document.createElement("tr");
    row.innerHTML = `
      <td>${o.symbol}</td>
      <td>${o.vest1h.toFixed(6)}</td>
      <td>${o.paradex1h.toFixed(6)}</td>
      <td>${o.ext1h.toFixed(6)}</td>
      <td>${strategy}</td>
      <td>${apr.toFixed(2)}%</td>
    `;
    tbody.appendChild(row);
  });
}

document.getElementById("sort-apr-btn").addEventListener("click", () => {
  const sorted = [...dataStore]
    // même filtre : il faut les 3 plateformes
    .filter(o => o.vest1h   != null &&
                 o.paradex1h!= null &&
                 o.ext1h    != null)
    .sort((a, b) => {
      const calcApr = o => {
        const list = [o.paradex1h, o.vest1h, o.ext1h];
        const mn   = Math.min(...list);
        const mx   = Math.max(...list);
        return (mx - mn) * 24 * 365 * 100;
      };
      return calcApr(b) - calcApr(a);
    })
  ;
  renderTable(sorted);
});

fetchFundingData();
