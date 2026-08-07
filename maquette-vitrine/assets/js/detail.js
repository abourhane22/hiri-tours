/* =========================================================
   HIRI TOURS — Fiche circuit : rendu détaillé + module de réservation
   ========================================================= */

function initDetail() {
  const id = new URLSearchParams(location.search).get("id");
  const c = getCircuit(id) || CIRCUITS[0];
  document.title = `${c.titre} — Hiri Tours`;

  // Bannière
  document.getElementById("dTitle").textContent = c.titre;
  document.getElementById("dCrumb").textContent = c.titre;
  document.getElementById("dMeta").innerHTML =
    `<span>${icon("pin")} ${c.destination}</span> · <span>${icon("clock")} ${c.dureeTxt}</span> · <span class="stars" style="color:var(--star)">${stars(c.note)}</span> ${c.note} (${c.avis} avis)`;

  // Galerie
  const g = document.getElementById("dGallery");
  g.innerHTML = `
    <img class="main" src="${c.galerie[0]}" alt="${c.titre}">
    <img class="thumb" src="${c.galerie[1] || c.img}" alt="">
    <img class="thumb" src="${c.galerie[2] || c.img}" alt="">
    <img class="thumb" src="${c.galerie[3] || c.img}" alt="">
    <img class="thumb" src="${c.galerie[1] || c.img}" alt="">`;

  // Onglets : description / itinéraire / inclus / avis
  document.getElementById("tabDesc").innerHTML = `
    <p style="font-size:1.05rem">${c.resume}</p>
    <div style="display:flex;gap:26px;flex-wrap:wrap;margin-top:22px">
      <div><small class="muted">Durée</small><br><b>${c.dureeTxt}</b></div>
      <div><small class="muted">Point de départ</small><br><b>${c.depart}</b></div>
      <div><small class="muted">Saisons conseillées</small><br><b>${c.saison.map(s => SAISON_LABELS[s]).join(", ")}</b></div>
      <div><small class="muted">Thèmes</small><br><b>${c.theme.map(t => THEME_LABELS[t]).join(", ")}</b></div>
    </div>`;

  document.getElementById("tabItin").innerHTML = `
    <div class="timeline">
      ${c.itineraire.map(i => `<div class="tl-item"><h4>${i.t}</h4><p>${i.d}</p></div>`).join("")}
    </div>`;

  document.getElementById("tabIncl").innerHTML = `
    <ul class="incl">
      ${c.inclus.map(x => `<li><span class="yes">✓</span> ${x}</li>`).join("")}
      ${c.exclus.map(x => `<li><span class="no">✕</span> ${x}</li>`).join("")}
    </ul>`;

  document.getElementById("tabAvis").innerHTML = AVIS.map(a => `
    <div style="border-bottom:1px solid var(--line);padding:16px 0">
      <div class="stars" style="color:var(--star)">${stars(a.note)}</div>
      <p style="font-style:italic;margin:6px 0">"${a.txt}"</p>
      <b>${a.nom}</b> <span class="muted">· ${a.pays} · <span class="verified">✓ Avis vérifié</span></span>
    </div>`).join("");

  document.querySelectorAll(".detail-tabs button").forEach(b => b.addEventListener("click", () => {
    document.querySelectorAll(".detail-tabs button").forEach(x => x.classList.remove("active"));
    document.querySelectorAll(".tab-panel").forEach(x => x.classList.remove("active"));
    b.classList.add("active");
    document.getElementById(b.dataset.tab).classList.add("active");
  }));

  // ---- Module de réservation ----
  const priceEl = document.getElementById("bPrice");
  priceEl.innerHTML = `${c.prix} <span>DH / adulte</span>`;
  let adults = 2, kids = 0;
  const CHILD_RATE = 0.6; // enfant = -40%
  const PROMOS = { HIRI10: 0.10, EARLYBIRD: 0.15, FIDELITE5: 0.05 };
  let promo = 0, promoCode = "";

  function refresh() {
    document.getElementById("nbAdults").textContent = adults;
    document.getElementById("nbKids").textContent = kids;
    let sub = adults * c.prix + kids * Math.round(c.prix * CHILD_RATE);
    const remise = Math.round(sub * promo);
    sub -= remise;
    const pay = document.querySelector('input[name="payopt"]:checked')?.value || "full";
    const acompte = Math.round(sub * 0.30);
    document.getElementById("sumAdults").textContent = `${adults} × ${c.prix} DH`;
    document.getElementById("sumKids").textContent = `${kids} × ${Math.round(c.prix * CHILD_RATE)} DH`;
    const promoLine = document.getElementById("sumPromoLine");
    if (promoLine) {
      promoLine.style.display = promo ? "flex" : "none";
      if (promo) document.getElementById("sumPromo").textContent = `−${remise} DH (${promoCode})`;
    }
    document.getElementById("sumTotal").textContent = `${sub} DH`;
    const dueNow = pay === "acompte" ? acompte : (pay === "agence" ? 0 : sub);
    document.getElementById("sumDue").textContent = pay === "agence" ? "0 DH (à l'agence)" : `${dueNow} DH`;
    document.getElementById("sumDueLabel").textContent =
      pay === "acompte" ? "À payer maintenant (acompte 30%)" : pay === "agence" ? "À régler en agence" : "À payer maintenant";
  }

  // code promo
  const promoBtn = document.getElementById("bPromoBtn");
  if (promoBtn) promoBtn.addEventListener("click", () => {
    const input = document.getElementById("bPromo");
    const code = input.value.trim().toUpperCase();
    const msg = document.getElementById("bPromoMsg");
    if (PROMOS[code]) {
      promo = PROMOS[code]; promoCode = code;
      msg.textContent = `✓ Code « ${code} » appliqué : −${Math.round(promo * 100)}%`;
      msg.style.color = "var(--ok)";
    } else {
      promo = 0; promoCode = "";
      msg.textContent = "✕ Code invalide ou expiré";
      msg.style.color = "#c0392b";
    }
    refresh();
  });

  document.getElementById("aPlus").onclick = () => { adults++; refresh(); };
  document.getElementById("aMinus").onclick = () => { if (adults > 1) adults--; refresh(); };
  document.getElementById("kPlus").onclick = () => { kids++; refresh(); };
  document.getElementById("kMinus").onclick = () => { if (kids > 0) kids--; refresh(); };
  document.querySelectorAll('input[name="payopt"]').forEach(r => r.addEventListener("change", refresh));

  // fav
  const fav = document.getElementById("dFav");
  fav.classList.toggle("active", getWishlist().includes(c.id));
  fav.onclick = () => fav.classList.toggle("active", toggleWish(c.id));

  // soumission réservation → confirmation
  document.getElementById("bookForm").addEventListener("submit", (e) => {
    e.preventDefault();
    const date = document.getElementById("bDate").value;
    const dossier = "HT-" + Math.floor(100000 + (date ? date.replaceAll("-", "").slice(4) * 1 : 12345) % 900000);
    document.getElementById("bookForm").style.display = "none";
    document.getElementById("bookDone").style.display = "block";
    document.getElementById("doneRef").textContent = dossier;
    document.getElementById("doneWa").href = waLink(
      `Bonjour Hiri Tours, je confirme ma réservation ${dossier} pour "${c.titre}" le ${date || "(date à préciser)"}, ${adults} adulte(s) et ${kids} enfant(s).`
    );
  });

  // WhatsApp direct
  document.getElementById("bWa").href = waLink(`Bonjour, je souhaite réserver le circuit "${c.titre}". Pouvez-vous me renseigner ?`);

  // circuits similaires
  const sim = CIRCUITS.filter(x => x.id !== c.id && x.theme.some(t => c.theme.includes(t))).slice(0, 3);
  document.getElementById("similar").innerHTML = sim.map(circuitCard).join("");
  bindFavs(document.getElementById("similar"));

  refresh();
}
