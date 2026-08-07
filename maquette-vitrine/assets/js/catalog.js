/* =========================================================
   HIRI TOURS — Catalogue : rendu de cartes, filtres, tri, recherche
   ========================================================= */

/* Carte circuit réutilisable (accueil + catalogue) */
function circuitCard(c) {
  const wished = getWishlist().includes(c.id);
  const themeTag = THEME_LABELS[c.theme[0]] || c.theme[0];
  return `
  <article class="card">
    <div class="card-media">
      <a href="circuit.html?id=${c.id}"><img src="${c.img}" alt="${c.titre}" loading="lazy"></a>
      <span class="card-tag">${themeTag}</span>
      <button class="card-fav ${wished ? "active" : ""}" data-fav="${c.id}" aria-label="Ajouter aux favoris">${icon("heart")}</button>
    </div>
    <div class="card-body">
      <div class="card-meta">
        <span>${icon("pin")} ${c.destination}</span>
        <span>${icon("clock")} ${c.dureeTxt}</span>
      </div>
      <h3><a href="circuit.html?id=${c.id}">${c.titre}</a></h3>
      <p>${c.resume.length > 96 ? c.resume.slice(0, 96) + "…" : c.resume}</p>
      <div class="rating"><span class="stars">${stars(c.note)}</span> ${c.note} · ${c.avis} avis</div>
      <div class="card-foot">
        <div class="price"><small>à partir de</small><b>${c.prix} <span>DH</span></b></div>
        <a href="circuit.html?id=${c.id}" class="btn btn-ocean">Voir</a>
      </div>
    </div>
  </article>`;
}

function bindFavs(scope) {
  (scope || document).querySelectorAll("[data-fav]").forEach(btn => {
    btn.onclick = (e) => {
      e.preventDefault();
      const active = toggleWish(btn.dataset.fav);
      btn.classList.toggle("active", active);
    };
  });
}

/* ---------- Page catalogue ---------- */
function initCatalog() {
  const state = { themes: new Set(), saisons: new Set(), durees: new Set(), maxPrix: 2500, q: "", sort: "populaire" };
  const listEl = document.getElementById("catalogList");
  const countEl = document.getElementById("catalogCount");

  // pré-filtre depuis l'URL (recherche depuis l'accueil)
  const params = new URLSearchParams(location.search);
  if (params.get("q")) { state.q = params.get("q").toLowerCase(); const s = document.getElementById("catSearch"); if (s) s.value = params.get("q"); }
  if (params.get("theme")) state.themes.add(params.get("theme"));

  function matches(c) {
    if (state.q) {
      const hay = (c.titre + " " + c.destination + " " + c.resume + " " + c.theme.join(" ")).toLowerCase();
      if (!hay.includes(state.q)) return false;
    }
    if (state.themes.size && !c.theme.some(t => state.themes.has(t))) return false;
    if (state.saisons.size && !c.saison.some(s => state.saisons.has(s))) return false;
    if (state.durees.size) {
      const band = c.duree === 1 ? "1" : c.duree <= 2 ? "2" : "3";
      if (!state.durees.has(band)) return false;
    }
    if (c.prix > state.maxPrix) return false;
    return true;
  }

  function render() {
    let list = CIRCUITS.filter(matches);
    if (state.sort === "prix-asc") list.sort((a, b) => a.prix - b.prix);
    else if (state.sort === "prix-desc") list.sort((a, b) => b.prix - a.prix);
    else if (state.sort === "note") list.sort((a, b) => b.note - a.note);
    else list.sort((a, b) => (b.populaire ? 1 : 0) - (a.populaire ? 1 : 0));

    countEl.innerHTML = `<b>${list.length}</b> offre(s) trouvée(s)`;
    listEl.innerHTML = list.length
      ? list.map(circuitCard).join("")
      : `<div class="empty" style="grid-column:1/-1"><h3>Aucun résultat</h3><p>Essayez d'élargir vos filtres ou de modifier votre recherche.</p></div>`;
    bindFavs(listEl);
  }

  // checkboxes thèmes / saisons / durées
  document.querySelectorAll("[data-filter]").forEach(chk => {
    const [type, val] = chk.dataset.filter.split(":");
    if ((type === "theme" && state.themes.has(val))) chk.checked = true;
    chk.addEventListener("change", () => {
      const set = type === "theme" ? state.themes : type === "saison" ? state.saisons : state.durees;
      chk.checked ? set.add(val) : set.delete(val);
      render();
    });
  });

  // prix
  const range = document.getElementById("priceRange");
  const rangeOut = document.getElementById("priceOut");
  if (range) range.addEventListener("input", () => { state.maxPrix = +range.value; rangeOut.textContent = `Jusqu'à ${range.value} DH`; render(); });

  // recherche interne
  const search = document.getElementById("catSearch");
  if (search) search.addEventListener("input", () => { state.q = search.value.toLowerCase().trim(); render(); });

  // tri
  const sort = document.getElementById("catSort");
  if (sort) sort.addEventListener("change", () => { state.sort = sort.value; render(); });

  // reset
  const reset = document.getElementById("resetFilters");
  if (reset) reset.addEventListener("click", () => {
    state.themes.clear(); state.saisons.clear(); state.durees.clear(); state.maxPrix = 2500; state.q = "";
    document.querySelectorAll("[data-filter]").forEach(c => c.checked = false);
    if (range) { range.value = 2500; rangeOut.textContent = "Jusqu'à 2500 DH"; }
    if (search) search.value = "";
    render();
  });

  render();
}

/* ---------- Barre de recherche accueil (autocomplétion) ---------- */
function initHomeSearch() {
  const input = document.getElementById("heroSearch");
  const box = document.getElementById("heroAuto");
  if (!input || !box) return;

  const pool = [
    ...CIRCUITS.map(c => ({ label: c.titre, sub: c.destination, href: `circuit.html?id=${c.id}` })),
    ...DESTINATIONS.map(d => ({ label: d.nom, sub: "Destination", href: `circuits.html?q=${encodeURIComponent(d.nom)}` })),
    ...Object.entries(THEME_LABELS).map(([k, v]) => ({ label: v, sub: "Thème", href: `circuits.html?theme=${k}` })),
  ];

  input.addEventListener("input", () => {
    const q = input.value.toLowerCase().trim();
    if (!q) { box.classList.remove("show"); return; }
    const hits = pool.filter(p => p.label.toLowerCase().includes(q)).slice(0, 6);
    box.innerHTML = hits.map(h => `<div onclick="location.href='${h.href}'"><b>${h.label}</b> <span class="muted" style="font-size:.82rem"> · ${h.sub}</span></div>`).join("");
    box.classList.toggle("show", hits.length > 0);
  });
  document.addEventListener("click", e => { if (!input.contains(e.target)) box.classList.remove("show"); });

  const form = document.getElementById("heroSearchForm");
  if (form) form.addEventListener("submit", e => {
    e.preventDefault();
    location.href = `circuits.html?q=${encodeURIComponent(input.value.trim())}`;
  });
}
