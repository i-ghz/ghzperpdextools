// js/script-airdrop.js

// UTILS ===========================
function formatUsd(x) {
    return '$' + x.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 4 });
  }
  
  // calc airdrop: (yourPoints / totalSupply) * (FDV * airdropPct)
  function computeAirdrop({ yourPts, totalSupply, fdv, pct }) {
    const yourShare = yourPts / totalSupply;
    return yourShare * fdv * (pct / 100);
  }
  
  // FORM HANDLING ===================
  
  document.addEventListener('DOMContentLoaded', () => {
    // VEST elements
    const vForm      = document.getElementById('vest-form');
    const vSupply    = document.getElementById('vest-supply');
    const vFdv       = document.getElementById('vest-fdv');
    const vUnit      = document.getElementById('vest-fdv-unit');
    const vPoints    = document.getElementById('vest-points');
    const vSlider    = document.getElementById('vest-airdrop');
    const vPctDisp   = document.getElementById('vest-airdrop-val');
    const vUsdPt     = document.getElementById('vest-usd-per-point');
    const vEstimate  = document.getElementById('vest-estimate');
  
    // EXTENDED elements
    const eForm      = document.getElementById('extended-form');
    const eSupply    = 50e6;           // fixed
    const eFdv       = document.getElementById('ext-fdv');
    const eUnit      = document.getElementById('ext-fdv-unit');
    const ePoints    = document.getElementById('ext-points');
    const eSlider    = document.getElementById('ext-airdrop');
    const ePctDisp   = document.getElementById('ext-airdrop-val');
    const eUsdPt     = document.getElementById('ext-usd-per-point');
    const eEstimate  = document.getElementById('ext-estimate');
  
    // COMMON UPDATE fn
    function bindRange(slider, display) {
      slider.addEventListener('input', () => {
        display.textContent = slider.value;
      });
    }
    bindRange(vSlider, vPctDisp);
    bindRange(eSlider, ePctDisp);
  
    // VEST Calculation
    vForm.addEventListener('submit', ev => {
      ev.preventDefault();
      const totalSupply = Number(vSupply.value) * 1e6;
      const fdv = Number(vFdv.value) * Number(vUnit.value);
      const yourPts = Number(vPoints.value);
      const pct = Number(vSlider.value);
  
      // USD/Point = (fdv * pct%) / totalSupply
      const usdPerPoint = (fdv * (pct/100)) / totalSupply;
      const drop = computeAirdrop({ yourPts, totalSupply, fdv, pct });
  
      vUsdPt.textContent    = formatUsd(usdPerPoint);
      vEstimate.textContent = formatUsd(drop);
    });
  
    // EXTENDED Calculation
    eForm.addEventListener('submit', ev => {
      ev.preventDefault();
      const totalSupply = eSupply;
      const fdv = Number(eFdv.value) * Number(eUnit.value);
      const yourPts = Number(ePoints.value);
      const pct = Number(eSlider.value);
  
      const usdPerPoint = (fdv * (pct/100)) / totalSupply;
      const drop = computeAirdrop({ yourPts, totalSupply, fdv, pct });
  
      eUsdPt.textContent    = formatUsd(usdPerPoint);
      eEstimate.textContent = formatUsd(drop);
    });
  });
  