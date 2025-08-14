// ===== Config =====
const API_URL = "/api/funding";
const EX = {
  paradex: { name: "Paradex", logo: "images/paradex.png", ref: "https://app.paradex.trade/r/ghzcrypto" },
  vest: { name: "Vest", logo: "images/vest.png", ref: "https://trade.vest.exchange/join/GHZ50" },
  ext: { name: "Extended", logo: "images/extended.png", ref: "https://app.extended.exchange/join/GHZ" },
  hyperliquid: { name: "Hyperliquid", logo: "images/hyperliquid.png", ref: "https://app.hyperliquid.xyz/join/GHZ" },
  backpack: { name: "Backpack", logo: "images/backpack.png", ref: "https://backpack.exchange/join/0xtargeted" },
  orderly: { name: "Orderly", logo: "images/orderly.png", ref: "https://pro.woofi.com/en/trade?ref=GHZ30" },
  hibachi: { name: "Hibachi", logo: "images/hibachi.png", ref: "https://hibachi.xyz/r/ghz" },
};
const TF = { "1h": { mul: 1, annual: 24 * 365 }, "8h": { mul: 8, annual: 3 * 365 }, "1y": { mul: 8760, annual: 1 } };

// ===== State =====
const state = {
  data: [],
  tf: "1h",
  exSel: new Set(["paradex", "vest", "ext", "hyperliquid"]),
  fav: new Set(JSON.parse(localStorage.getItem("favPairs") || "[]")),
  sort: { key: "apr", dir: "desc" }, // 'apr' | 'pair' | 'ex:<dex>'
};

const qs = (s, p = document) => p.querySelector(s);
const qsa = (s, p = document) => [...p.querySelectorAll(s)];

// ===== Helpers =====
const keyFor = (ex) => (ex === "ext" ? "ext1h" : `${ex}1h`);
const conv = (r1h, tf) => (r1h == null ? null : r1h * TF[tf].mul * 100);
const calcAPR = (min, max, tf) => (max - min) * TF[tf].annual;

function compareNum(a, b, dir = "desc") {
  if (a == null && b == null) return 0;
  if (a == null) return 1; // nulls bottom
  if (b == null) return -1;
  return dir === "asc" ? a - b : b - a;
}
function compareStr(a, b, dir = "asc") {
  const r = a.localeCompare(b, "en", { sensitivity: "base" });
  return dir === "asc" ? r : -r;
}
function renderSortCaret(k) {
  if (state.sort.key !== k) return `<span style="opacity:.35;margin-left:4px">↕</span>`;
  return state.sort.dir === "desc"
    ? `<span style="color:#ff9191;margin-left:4px">↓</span>`
    : `<span style="color:#91ffa2;margin-left:4px">↑</span>`;
}

// ===== Sticky header offset (fix first-row hidden) =====
function applyStickyOffsets() {
  // mesure topbar + thead et pousse un spacer pour le tbody
  const topbar = qs(".topbar");
  const theadRow = qs(".table thead");
  const root = document.documentElement;

  const topbarH = topbar ? topbar.getBoundingClientRect().height : 56;
  const theadH = theadRow ? theadRow.getBoundingClientRect().height : 44;

  root.style.setProperty("--topbar-h", `${Math.round(topbarH)}px`);
  root.style.setProperty("--thead-h", `${Math.round(theadH)}px`);
  // valeur combinée utilisée par le 'top' du sticky
  root.style.setProperty("--sticky-top", `${Math.round(topbarH)}px`);
  // spacer avant tbody pour que la première ligne ne passe jamais sous le thead sticky
  root.style.setProperty("--tbody-spacer", `${Math.round(theadH)}px`);
}

// ===== Data =====
async function load() {
  const res = await axios.get(API_URL);
  if (!Array.isArray(res.data)) throw new Error("Invalid API response");
  state.data = res.data;
  renderAll();
  renderCards();
  // recalcul après rendu car thead existe
  requestAnimationFrame(applyStickyOffsets);
  // et re-synchroniser au resize
  window.addEventListener("resize", () => {
    applyStickyOffsets();
  }, { passive: true });
}

// ===== Compute opps (non trié pour laisser le tri colonne) =====
function computeOpps() {
  const selected = [...state.exSel];
  const out = [];
  for (const it of state.data) {
    const rows = selected
      .map((ex) => ({ dex: ex, rate: conv(it[keyFor(ex)], state.tf) }))
      .filter((r) => r.rate != null);
    if (rows.length < 2) continue;
    const min = rows.reduce((a, b) => (a.rate < b.rate ? a : b));
    const max = rows.reduce((a, b) => (a.rate > b.rate ? a : b));
    out.push({ symbol: it.symbol, rates: rows, min, max, apr: calcAPR(min.rate, max.rate, state.tf) });
  }
  return out;
}

// ===== UI: Cards (toujours APR DESC) =====
function renderCards() {
  const cards = qs("#cards");
  const list = computeOpps().sort((a, b) => b.apr - a.apr).slice(0, 4);
  cards.innerHTML = list
    .map(
      (o) => `
    <article class="card">
      <h3>Top opportunity</h3>
      <div class="pair">
        <img src="images/${o.symbol.toLowerCase()}.png" onerror="this.style.display='none'">
        ${o.symbol}
      </div>
      <div class="rates">
        <span>${EX[o.min.dex].name}: <b class="num">${o.min.rate.toFixed(2)}%</b></span>
        <span>${EX[o.max.dex].name}: <b class="num">${o.max.rate.toFixed(2)}%</b></span>
      </div>
      <div class="apr">APR <span class="p num">+${o.apr.toFixed(1)}%</span></div>
    </article>`
    )
    .join("");
}

// ===== UI: Table =====
function renderAll() {
  let opps = computeOpps();

  // TRI selon l'état
  const { key, dir } = state.sort;
  if (key === "apr") {
    opps.sort((a, b) => compareNum(a.apr, b.apr, dir));
  } else if (key === "pair") {
    opps.sort((a, b) => compareStr(a.symbol, b.symbol, dir));
  } else if (key.startsWith("ex:")) {
    const ex = key.split(":")[1];
    opps.sort((a, b) => {
      const ar = a.rates.find((r) => r.dex === ex)?.rate ?? null;
      const br = b.rates.find((r) => r.dex === ex)?.rate ?? null;
      return compareNum(ar, br, dir);
    });
  }

  // Stats
  const maxApr = opps[0]?.apr || 0;
  const stamp = new Date().toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
  qs("#stats-pill").textContent = `${state.data.length} pairs • max APR ${maxApr.toFixed(1)}% • updated ${stamp}`;

  // Head cliquable
  const tr = qs("#thead-row");
  const exCols = [...state.exSel]
    .map(
      (ex) => `<th data-sort="ex:${ex}" style="cursor:pointer">
        <span class="dex"><img src="${EX[ex].logo}">${EX[ex].name}
          <small style="color:var(--muted);margin-left:6px">${state.tf}</small>
        </span>
        ${renderSortCaret(`ex:${ex}`)}
      </th>`
    )
    .join("");

  tr.innerHTML = `
    <th style="width:36px">★</th>
    <th data-sort="pair" style="cursor:pointer">Pair ${renderSortCaret("pair")}</th>
    ${exCols}
    <th>Strategy</th>
    <th data-sort="apr" style="text-align:right;cursor:pointer">APR ${renderSortCaret("apr")}</th>
  `;

  // bind tri
  qsa("th[data-sort]").forEach((th) => {
    th.onclick = () => {
      const k = th.getAttribute("data-sort");
      if (state.sort.key === k) {
        state.sort.dir = state.sort.dir === "desc" ? "asc" : "desc";
      } else {
        state.sort.key = k;
        state.sort.dir = k === "pair" ? "asc" : "desc"; // défaut
      }
      renderAll();
      // recalcul offsets (la hauteur du thead peut changer avec les carets)
      requestAnimationFrame(applyStickyOffsets);
    };
  });

  // Body
  const tb = qs("#tbody");
  if (!opps.length) {
    tb.innerHTML = `<tr><td colspan="99" class="empty">No opportunities</td></tr>`;
    return;
  }
  tb.innerHTML = opps.map(rowHTML).join("");

  // fav
  qsa(".fav").forEach((el) => {
    el.onclick = () => {
      const s = el.dataset.s;
      state.fav.has(s) ? state.fav.delete(s) : state.fav.add(s);
      localStorage.setItem("favPairs", JSON.stringify([...state.fav]));
      el.classList.toggle("active");
    };
  });
}

function rateCell(ex, o) {
  const r = o.rates.find((x) => x.dex === ex);
  if (!r) return `<td style="color:var(--muted)">—</td>`;
  const cls = r.dex === o.min.dex ? "min" : r.dex === o.max.dex ? "max" : "";
  return `<td class="${cls}"><span class="dex"><img src="${EX[ex].logo}">${r.rate.toFixed(2)}%</span></td>`;
}

function rowHTML(o) {
  const exs = [...state.exSel];
  const strategy = `Long <a href="${EX[o.min.dex].ref}" target="_blank">${EX[o.min.dex].name}</a> • Short <a href="${EX[o.max.dex].ref}" target="_blank">${EX[o.max.dex].name}</a>`;
  return `<tr>
    <td><span class="fav ${state.fav.has(o.symbol) ? "active" : ""}" data-s="${o.symbol}">★</span></td>
    <td style="font-weight:700">${o.symbol}</td>
    ${exs.map((ex) => rateCell(ex, o)).join("")}
    <td>${strategy}</td>
    <td class="num" style="text-align:right;color:var(--pos);font-weight:800">${o.apr.toFixed(2)}%</td>
  </tr>`;
}

// ===== Controls =====
qsa(".chip[data-tf]").forEach((c) => (c.onclick = () => {
  qsa(".chip[data-tf]").forEach((x) => x.classList.remove("active"));
  c.classList.add("active");
  state.tf = c.dataset.tf;
  renderAll();
  renderCards();
  requestAnimationFrame(applyStickyOffsets);
}));

qsa(".chip.ex").forEach((c) => (c.onclick = () => {
  c.classList.toggle("active");
  const ex = c.dataset.ex;
  state.exSel.has(ex) ? state.exSel.delete(ex) : state.exSel.add(ex);
  renderAll();
  renderCards();
  requestAnimationFrame(applyStickyOffsets);
}));

qs("#refresh").onclick = () => load();

// Init
load().catch((e) => {
  qs("#tbody").innerHTML = `<tr><td colspan="99" class="empty" style="color:#ff9191">API error: ${e.message}</td></tr>`;
});
