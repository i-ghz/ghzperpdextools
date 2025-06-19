// js/slippage.js

// 1) CONFIGURATION : l’URL de ton back-end Express
const API_BASE = 'http://localhost:4000';
const DEFAULT_DEPTH = 50;

// 2) PROXY VERS LE BACK-END
async function fetchVestOrderbook(symbol, depth = DEFAULT_DEPTH) {
  const url = `${API_BASE}/vest-orderbook`;
  const resp = await axios.get(url, { params: { symbol, limit: depth } });
  return resp.data;
}

async function fetchParadexOrderbook(market, depth = DEFAULT_DEPTH) {
  const url = `${API_BASE}/paradex-orderbook`;
  const resp = await axios.get(url, { params: { market, depth } });
  return resp.data;
}

// 3) ESTIMATION DU SLIPPAGE
/**
 * Parcourt l’orderbook et calcule le slippage pour un ordre d’achat ou de vente.
 * @param {{ bids: [string,string][], asks: [string,string][] }} book 
 * @param {number} quantity  quantité à exécuter
 * @param {boolean} isBuy   true = on parcourt les asks, false = on parcourt les bids
 * @returns {number} slippage en % (positif)
 */
function estimateSlippageFromBook(book, quantity, isBuy) {
  const levels = isBuy ? book.asks : book.bids;
  if (!levels || levels.length === 0) {
    throw new Error('Orderbook vide');
  }

  let remaining = quantity;
  let costOrProceeds = 0;

  for (const [priceStr, sizeStr] of levels) {
    const price = parseFloat(priceStr);
    const size  = parseFloat(sizeStr);
    const taken = Math.min(size, remaining);
    costOrProceeds += taken * price;
    remaining -= taken;
    if (remaining <= 0) break;
  }

  if (remaining > 0) {
    throw new Error('Profondeur insuffisante pour votre quantité');
  }

  const avgPrice = costOrProceeds / quantity;
  const refPrice = parseFloat((isBuy ? book.asks[0][0] : book.bids[0][0]));

  // achat : (moyenne – meilleur) / meilleur ; vente : (meilleur – moyenne) / meilleur
  const slip = isBuy
    ? (avgPrice - refPrice) / refPrice
    : (refPrice - avgPrice) / refPrice;

  return slip * 100;
}

// 4) GESTION DU FORMULAIRE
async function handleSlippageForm(event) {
  event.preventDefault();

  const dex     = document.getElementById('dex').value;
  const market  = document.getElementById('market').value.trim();
  const qty     = parseFloat(document.getElementById('quantity').value);
  const side    = document.querySelector('input[name="side"]:checked').value;
  const tol     = parseFloat(document.getElementById('tolerance').value);
  const result  = document.getElementById('slippage-result');

  result.innerHTML = '<p>Calcul en cours…</p>';

  try {
    // 4.a) récupérer le book auprès du back-end
    let book;
    if (dex === 'Vest') {
      book = await fetchVestOrderbook(market);
    } else {
      book = await fetchParadexOrderbook(market);
    }

    // 4.b) estimer le slippage
    const isBuy = (side === 'buy');
    const slip  = estimateSlippageFromBook(book, qty, isBuy);
    const ok    = Math.abs(slip) <= tol;

    // 4.c) afficher
    result.innerHTML = `
      <p><strong>Slippage estimé :</strong> ${slip.toFixed(2)}%</p>
      <p>${ok
        ? `<span class="positive">Dans la tolérance (${tol}%) ✅</span>`
        : `<span class="negative">Trop élevé (> ${tol}%) ❌</span>`
      }</p>
    `;
  } catch (err) {
    result.innerHTML = `<p class="error"><strong>Erreur :</strong> ${err.message}</p>`;
  }
}

// 5) INITIALISATION DU SCRIPT
document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('slippage-form')
          .addEventListener('submit', handleSlippageForm);
});
