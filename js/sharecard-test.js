const EX_LOGOS = {
    vest: "images/vest.png",
    paradex: "images/paradex.png",
    ext: "images/extended.png",
    hyperliquid: "images/hyperliquid.png"
  };
  
  document.getElementById("cardForm").onsubmit = function(e) {
    e.preventDefault();
    const pair = document.getElementById('pair').value;
    const longEx = document.getElementById('longEx').value;
    const shortEx = document.getElementById('shortEx').value;
    const longRate = parseFloat(document.getElementById('longRate').value);
    const shortRate = parseFloat(document.getElementById('shortRate').value);
    const apr = parseFloat(document.getElementById('apr').value);
  
    const now = new Date();
    const dateStr = now.toLocaleString('fr-FR', {dateStyle:'short', timeStyle:'short'});
  
    const cardHTML = `
      <div class="strategy-card" id="toDownload">
        <div class="arb-exchanges">
          <img src="${EX_LOGOS[longEx]}" alt="${longEx}"> <span>Long ${capitalize(longEx)}</span>
          <span style="font-size:1.25em;margin:0 7px;">↔</span>
          <img src="${EX_LOGOS[shortEx]}" alt="${shortEx}"> <span>Short ${capitalize(shortEx)}</span>
        </div>
        <div class="arb-pair">${pair}</div>
        <div class="arb-funding">
          <span>${capitalize(longEx)}: <b>${longRate}%</b></span> • <span>${capitalize(shortEx)}: <b>${shortRate}%</b></span>
        </div>
        <div class="arb-apr">APR: <b>${apr}%</b></div>
        <div class="arb-date">${dateStr}</div>
        <div class="arb-brand">via <a href="https://tonsite.com" target="_blank">@ilyessghz2 FundingArb</a></div>
        <button id="dlBtn" style="margin-top:12px;padding:4px 18px;border-radius:8px;background:#22c55e;color:#111;font-weight:bold;border:none;cursor:pointer;">Télécharger l'image</button>
      </div>
    `;
  
    document.getElementById('cardContainer').innerHTML = cardHTML;
  
    // Download as image (html2canvas)
    setTimeout(() => {
      document.getElementById('dlBtn').onclick = () => {
        html2canvas(document.getElementById('toDownload')).then(canvas => {
          const link = document.createElement('a');
          link.download = 'arbitrage_card.png';
          link.href = canvas.toDataURL();
          link.click();
        });
      };
    }, 100);
  };
  
  function capitalize(str) {
    return str.charAt(0).toUpperCase() + str.slice(1);
  }
  function copyCardToClipboard(btn) {
    const card = btn.closest('.arbi-card-ghz');
    // Version texte simple (adapté pour coller dans Telegram, Twitter, Discord, etc)
    let text = "";
    text += card.querySelector('.arbi-pair').innerText + " | ";
    text += card.querySelector('.arbi-time').innerText + "\n";
    text += "Long " + card.querySelector('.arbi-long').innerText.trim() + "\n";
    text += "Short " + card.querySelector('.arbi-short').innerText.trim() + "\n";
    text += "APR: " + card.querySelector('.arbi-apr').innerText + "\n";
    text += "Funding: " + card.querySelector('.arbi-card-funding').innerText.replace(/\s+/g, ' ');
    navigator.clipboard.writeText(text);
    btn.textContent = "Copié !";
    setTimeout(() => btn.innerHTML = `<img src="images/share.svg" alt="Share" /> Partager`, 1500);
  }
  
  
  