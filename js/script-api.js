// js/script-api.js

const API_URL = "/api/funding";
let dataStore = [];
let filterFavOnly = false;

const EX_LOGOS = {
  paradex:     'images/paradex.png',
  vest:        'images/vest.png',
  ext:         'images/extended.png',
  hyperliquid: 'images/hyperliquid.png'
};
const EX_REFLINKS = {
  paradex:     'https://app.paradex.trade/r/ghzcrypto',
  vest:        'https://trade.vest.exchange/join/GHZ50',
  ext:         'https://app.extended.exchange/join/GHZ',
  hyperliquid: 'https://app.hyperliquid.xyz/join/GHZ'
};

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

function renderTable() {
  const tbody = document.querySelector("#arbitrage-table tbody");
  tbody.innerHTML = "";

  const selectedExchanges = getSelectedExchanges();

  // Header dynamique
  const thead = document.querySelector("#arbitrage-table thead tr");
  thead.innerHTML = `
    <th>★</th>
    <th>Pair</th>
    ${selectedExchanges.map(dex => {
      const label = {
        paradex: "Paradex", vest: "Vest", ext: "Extended", hyperliquid: "Hyperliquid"
      }[dex];
      return `<th><img src="${EX_LOGOS[dex]}" alt="${label}" class="ex-logo-td"> ${label} 1h</th>`;
    }).join('')}
    <th>Strategy</th>
    <th>APR</th>
    <th></th>
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
    if (availableRates.length < 2) return;

    const minE = availableRates.reduce((a, b) => a.rate < b.rate ? a : b);
    const maxE = availableRates.reduce((a, b) => a.rate > b.rate ? a : b);
    const strategy = `
      Long <a href="${EX_REFLINKS[minE.dex]}" target="_blank">${minE.label}</a>,
      Short <a href="${EX_REFLINKS[maxE.dex]}" target="_blank">${maxE.label}</a>
    `;
    const spread = maxE.rate - minE.rate;
    const apr = spread * 24 * 365 * 100;
    const favClass = window.favorites.isFav(o.symbol) ? "fav active" : "fav";

    // Génère la ligne
    const row = document.createElement("tr");
    row.innerHTML = `
      <td><span class="${favClass}" data-symbol="${o.symbol}" title="Favori">★</span></td>
      <td>${o.symbol}</td>
      ${allRates.map(r =>
        `<td>${r.rate !== null
          ? `<img src="${EX_LOGOS[r.dex]}" alt="${r.label}" class="ex-logo-td"> ${r.rate.toFixed(6)}`
          : '—'
        }</td>`
      ).join('')}
      <td>${strategy}</td>
      <td>${apr.toFixed(2)}%</td>
      <td>
        <button class="share-btn"
          data-pair="${o.symbol}"
          data-long="${minE.label}"
          data-long-dex="${minE.dex}"
          data-long-rate="${minE.rate}"
          data-short="${maxE.label}"
          data-short-dex="${maxE.dex}"
          data-short-rate="${maxE.rate}"
          data-apr="${apr.toFixed(2)}"
          title="Share"
          style="background:none;border:none;cursor:pointer;padding:4px;"
        >
          <img src="images/shares.svg" alt="Share" class="share-icon-btn" style="width:24px;height:24px;" />
        </button>
      </td>
      
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

document.getElementById("filter-fav-btn").addEventListener("click", () => {
  filterFavOnly = !filterFavOnly;
  renderTable();
});
document.querySelectorAll('.exchange-filter').forEach(cb =>
  cb.addEventListener('change', renderTable)
);
fetchFundingData();


// ==== POP-IN CARD SHARE ====
// Ajoute la lib html2canvas dans le HTML avant ce script !

document.addEventListener('click', function(e) {
  if (e.target.closest('.share-btn')) {
    const btn = e.target.closest('.share-btn');
    const pair   = btn.dataset.pair;
    const long   = btn.dataset.long;
    const longDex = btn.dataset.longDex;
    const longRate = btn.dataset.longRate;
    const short  = btn.dataset.short;
    const shortDex = btn.dataset.shortDex;
    const shortRate = btn.dataset.shortRate;
    const apr    = btn.dataset.apr;

    const tok = pair.split(/[\/\-]/)[0].toLowerCase();
    const tokenIcon = `/images/${tok}.png`;

    const dateStr = new Date().toLocaleString('fr-FR', {
      day: "2-digit", month: "2-digit", year: "numeric",
      hour: "2-digit", minute: "2-digit"
    });

    document.getElementById('card-modal').innerHTML = `
      <div class="arb-card-ghz">
        <div class="arb-card-header">
          <img src="${tokenIcon}" class="arb-token" onerror="this.style.display='none'">
          <span class="arb-card-pair">${pair}</span>
          <span class="arb-card-date">${dateStr}</span>
        </div>
        <div class="arb-card-positions">
          <span class="arb-long">
            <img src="${EX_LOGOS[longDex]}" class="ex-logo-td">
            <a href="${EX_REFLINKS[longDex]}" target="_blank">Long ${long}</a>
          </span>
          <span class="arb-short">
            <img src="${EX_LOGOS[shortDex]}" class="ex-logo-td">
            <a href="${EX_REFLINKS[shortDex]}" target="_blank">Short ${short}</a>
          </span>
        </div>
        <div class="arb-card-apr"><span>APR :</span> <span class="arb-apr">+${apr}%</span></div>
        <div class="arb-card-rates">
          <span>${long}: <b>${Number(longRate).toFixed(6)}</b></span>
          <span>${short}: <b>${Number(shortRate).toFixed(6)}</b></span>
        </div>
        <div class="arb-card-footer">
          by <a href="https://twitter.com/ilyessghz2" target="_blank">@ilyessghz2</a>
          | <a href="https://ghzperpdextools.vercel.app" target="_blank">ghzperpdextools.vercel.app</a>
        </div>
        <button class="arb-card-share" title="Share">
          <img src="images/shares.svg" alt="Share" style="height:26px;width:26px;vertical-align:middle;" />
        </button>
        <button class="arb-card-close">&times;</button>
      </div>
      <div class="arb-card-bg"></div>
    `;
    document.getElementById('card-modal').style.display = "block";
  }

  // Ferme la card si clique sur X ou le fond
  if (e.target.classList.contains('arb-card-close') || e.target.classList.contains('arb-card-bg')) {
    document.getElementById('card-modal').style.display = "none";
  }

  // PARTAGE : copie l’image de la card via html2canvas
  if (e.target.closest('.arb-card-share')) {
    const card = document.querySelector('.arb-card-ghz');
    if (!card) return;
    html2canvas(card, {backgroundColor: null}).then(canvas => {
      canvas.toBlob(blob => {
        if (navigator.clipboard && window.ClipboardItem) {
          navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
          alert("Card copied to clipboard 😁!");
        } else {
          // Fallback : download
          const a = document.createElement('a');
          a.href = canvas.toDataURL();
          a.download = 'arbitrage_card.png';
          a.click();
        }
      });
    });
  }
});
