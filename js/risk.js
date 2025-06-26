// public/js/risk.js

const TOKENS = [
  "AAVE","ADA","AI16Z","AIXBT","ALCH","ANIME","APT","AR","ARB","ATOM",
  "AVAX","BCH","BERA","BNB","BRETT","BTC","CRV","DOGE","DOT","DYDX",
  "EIGEN","ENA","ETC","ETH","ETHFI","EUR","FARTCOIN","FET","FIL","FTM",
  "GOAT","GRASS","GRIFFAIN","HYPE","HYPER","INIT","INJ","IO","IP","JTO",
  "JUP","KAITO","KBONK","KFLOKI","KNEIRO","KPEPE","KSHIB","LAUNCHCOIN",
  "LAYER","LDO","LINK","LTC","MATIC","MELANIA","MEME","MEW","MKR","MNT",
  "MOODENG","MORPHO","MOVE","NEAR","NIL","NOT","NXPC","OM","ONDO","OP",
  "ORDI","PAXG","PENDLE","PENGU","PNUT","POPCAT","PROMPT","PYTH","RENDER",
  "RESOLV","RUNE","S","SCR","SEI","SOL","SOPH","SPX","STRK","SUI","TAO",
  "TIA","TON","TRB","TRUMP","TRX","TST","TURBO","UNI","USUAL","VINE",
  "VIRTUAL","VVV","W","WAL","WCT","WIF","WLD","XLM","XRP","ZEREBRO","ZK",
  "ZRO","ZORA"
];

window.addEventListener('DOMContentLoaded', () => {
  const selectToken    = document.getElementById('token-select');
  const selectExchange = document.getElementById('exchange-select');
  const btn            = document.getElementById('check-btn');
  const resultDiv      = document.getElementById('result');

  // 1) Remplissage du select
  TOKENS.forEach(t => {
    const opt = document.createElement('option');
    opt.value = t;
    opt.textContent = t;
    selectToken.appendChild(opt);
  });

  // 2) Au clic sur Vérifier
  btn.addEventListener('click', async () => {
    const token    = selectToken.value;
    const exchange = selectExchange.value;
    if (!token) {
      resultDiv.innerHTML = `<p class="error">Choose a token.</p>`;
      return;
    }
    resultDiv.textContent = 'Loading...';

    try {
      const { data } = await axios.get(
        `/api/orderbook?exchange=${exchange}&token=${token}`
      );
      const { bidPrice, bidQty, askPrice, askQty, spread, liquidity } = data;

      // Choix de la couleur
      let colorHex = '#22c55e'; // vert
      if      (liquidity < 2_000)  colorHex = '#dc2626'; // rouge
      else if (liquidity < 20_000) colorHex = '#eab308'; // orange

      // 3) Affichage du résultat avec "Risk :" avant la pastille
      resultDiv.innerHTML = `
        <p><strong>Pair</strong>: ${token} / ${exchange}</p>
        <p><strong>Bid</strong>: ${bidPrice} × ${bidQty}</p>
        <p><strong>Ask</strong>: ${askPrice} × ${askQty}</p>
        <p><strong>Spread</strong>: ${spread.toFixed(6)}</p>
        <p><strong>Liquidity (USD)</strong>: ${liquidity.toFixed(2)}</p>

        <div class="risk-line">
          <span class="risk-text"><strong>Risk :</strong></span>
          <span class="risk-dot" style="background:${colorHex};"></span>
          <span class="risk-text">${colorHex === '#dc2626' ? 'RED'
                               : colorHex === '#eab308' ? 'ORANGE'
                               : 'GREEN'}</span>
        </div>
      `;
    } catch (err) {
      resultDiv.innerHTML = `<p class="error">Error : ${
        err.response?.data?.error || err.message
      }</p>`;
    }
  });
});
