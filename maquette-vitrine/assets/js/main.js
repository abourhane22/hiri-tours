/* =========================================================
   HIRI TOURS — Script partagé
   Header + footer injectés, i18n (FR/AR/EN), wishlist, menu mobile, WhatsApp
   ========================================================= */

const WHATSAPP = "212600000000"; // ← numéro WhatsApp Business à personnaliser
const AGENCE = {
  nom: "Hiri Tours",
  tel: "+212 5 28 00 00 00",
  email: "contact@hiritours.ma",
  adresse: "Avenue Hassan II, Talborjt, Agadir 80000, Maroc",
};

/* ---------- i18n : traduction du chrome (nav / boutons / footer) ---------- */
const I18N = {
  fr: {
    nav_home: "Accueil", nav_circuits: "Circuits & Excursions", nav_dest: "Destinations",
    nav_act: "Activités", nav_blog: "Blog", nav_contact: "Contact", nav_account: "Mon espace",
    book: "Réserver", quote: "Devis gratuit",
    foot_about: "Agence d'animation touristique à Agadir. Circuits, excursions et séjours dans la région du Souss-Massa et au-delà.",
    foot_explore: "Explorer", foot_help: "Aide & infos", foot_news: "Newsletter",
    foot_news_txt: "Recevez nos offres saisonnières et bons plans.", foot_sub: "OK",
    foot_rights: "Tous droits réservés.", search_go: "Rechercher",
  },
  en: {
    nav_home: "Home", nav_circuits: "Tours & Excursions", nav_dest: "Destinations",
    nav_act: "Activities", nav_blog: "Blog", nav_contact: "Contact", nav_account: "My account",
    book: "Book now", quote: "Free quote",
    foot_about: "Tourism activity agency in Agadir. Tours, excursions and stays across the Souss-Massa region and beyond.",
    foot_explore: "Explore", foot_help: "Help & info", foot_news: "Newsletter",
    foot_news_txt: "Get our seasonal offers and best deals.", foot_sub: "OK",
    foot_rights: "All rights reserved.", search_go: "Search",
  },
  ar: {
    nav_home: "الرئيسية", nav_circuits: "الجولات والرحلات", nav_dest: "الوجهات",
    nav_act: "الأنشطة", nav_blog: "المدونة", nav_contact: "اتصل بنا", nav_account: "حسابي",
    book: "احجز الآن", quote: "عرض سعر مجاني",
    foot_about: "وكالة تنشيط سياحي في أكادير. جولات ورحلات وإقامات في جهة سوس ماسة وما بعدها.",
    foot_explore: "استكشف", foot_help: "مساعدة ومعلومات", foot_news: "النشرة البريدية",
    foot_news_txt: "احصل على عروضنا الموسمية وأفضل الصفقات.", foot_sub: "حسناً",
    foot_rights: "جميع الحقوق محفوظة.", search_go: "بحث",
  },
};

function currentLang() { return localStorage.getItem("hiri_lang") || "fr"; }
function setLang(lang) {
  localStorage.setItem("hiri_lang", lang);
  document.documentElement.lang = lang;
  document.documentElement.dir = lang === "ar" ? "rtl" : "ltr";
  applyI18n();
  document.querySelectorAll(".lang button").forEach(b => b.classList.toggle("active", b.dataset.lang === lang));
}
function applyI18n() {
  const dict = I18N[currentLang()] || I18N.fr;
  document.querySelectorAll("[data-i18n]").forEach(el => {
    const k = el.getAttribute("data-i18n");
    if (dict[k]) el.textContent = dict[k];
  });
}

/* ---------- Wishlist (localStorage) ---------- */
function getWishlist() { try { return JSON.parse(localStorage.getItem("hiri_wish") || "[]"); } catch { return []; } }
function toggleWish(id) {
  let w = getWishlist();
  w = w.includes(id) ? w.filter(x => x !== id) : [...w, id];
  localStorage.setItem("hiri_wish", JSON.stringify(w));
  updateWishBadge();
  return w.includes(id);
}
function updateWishBadge() {
  const b = document.getElementById("wishBadge");
  const n = getWishlist().length;
  if (b) { b.textContent = n; b.style.display = n ? "grid" : "none"; }
}

/* ---------- WhatsApp ---------- */
function waLink(msg) {
  const text = encodeURIComponent(msg || "Bonjour Hiri Tours, je souhaite des informations sur vos circuits.");
  return `https://wa.me/${WHATSAPP}?text=${text}`;
}

/* ---------- Header ---------- */
function renderHeader(active) {
  const links = [
    ["index.html", "nav_home", "Accueil"],
    ["circuits.html", "nav_circuits", "Circuits & Excursions"],
    ["destinations.html", "nav_dest", "Destinations"],
    ["activites.html", "nav_act", "Activités"],
    ["blog.html", "nav_blog", "Blog"],
    ["contact.html", "nav_contact", "Contact"],
  ];
  const linksHtml = links.map(([href, key, label]) =>
    `<a href="${href}" data-i18n="${key}" class="${active === href ? "active" : ""}">${label}</a>`
  ).join("");

  return `
  <header class="site-header">
    <div class="wrap nav">
      <a href="index.html" class="brand">
        <span class="mark">✦</span>
        <span>Hiri Tours<small>Agadir · Souss-Massa</small></span>
      </a>
      <nav class="nav-links" id="navLinks">${linksHtml}</nav>
      <div class="nav-tools">
        <div class="lang" title="Langue">
          <button data-lang="fr">FR</button>
          <button data-lang="ar">ع</button>
          <button data-lang="en">EN</button>
        </div>
        <a href="compte.html" class="icon-btn" title="Mon espace" data-i18n-title="nav_account">${icon("user")}</a>
        <a href="compte.html#wishlist" class="icon-btn" title="Favoris">${icon("heart")}<span class="badge" id="wishBadge" style="display:none">0</span></a>
        <a href="contact.html" class="btn btn-primary" data-i18n="book">Réserver</a>
        <button class="icon-btn burger" id="burger" aria-label="Menu">${icon("menu")}</button>
      </div>
    </div>
  </header>`;
}

/* ---------- Footer ---------- */
function renderFooter() {
  return `
  <footer class="site-footer">
    <div class="wrap">
      <div class="footer-grid">
        <div>
          <div class="brand"><span class="mark">✦</span><span>Hiri Tours<small>Agadir · Souss-Massa</small></span></div>
          <p style="font-size:.92rem;line-height:1.7" data-i18n="foot_about">Agence d'animation touristique à Agadir. Circuits, excursions et séjours dans la région du Souss-Massa et au-delà.</p>
          <div class="socials">
            <a href="#" title="Instagram">${icon("instagram")}</a>
            <a href="#" title="Facebook">${icon("facebook")}</a>
            <a href="#" title="TikTok">${icon("tiktok")}</a>
            <a href="${waLink()}" title="WhatsApp" target="_blank">${icon("wa")}</a>
          </div>
        </div>
        <div>
          <h4 data-i18n="foot_explore">Explorer</h4>
          <ul class="footer-links">
            <li><a href="circuits.html">Circuits & Excursions</a></li>
            <li><a href="destinations.html">Destinations phares</a></li>
            <li><a href="activites.html">Activités</a></li>
            <li><a href="blog.html">Blog & guides</a></li>
          </ul>
        </div>
        <div>
          <h4 data-i18n="foot_help">Aide & infos</h4>
          <ul class="footer-links">
            <li><a href="contact.html">Nous contacter</a></li>
            <li><a href="contact.html">Demander un devis</a></li>
            <li><a href="compte.html">Mon espace client</a></li>
            <li><a href="contact.html">Politique d'annulation</a></li>
            <li><a href="contact.html">Confidentialité (loi 09-08)</a></li>
          </ul>
        </div>
        <div>
          <h4 data-i18n="foot_news">Newsletter</h4>
          <p style="font-size:.92rem" data-i18n="foot_news_txt">Recevez nos offres saisonnières et bons plans.</p>
          <form class="news-form" onsubmit="event.preventDefault(); this.reset(); alert('Merci ! Vous êtes bien inscrit à notre newsletter.');">
            <input type="email" placeholder="Votre email" required>
            <button class="btn btn-primary" data-i18n="foot_sub">OK</button>
          </form>
          <p style="font-size:.86rem;margin-top:16px">${icon("phone")} ${AGENCE.tel}<br>${icon("mail")} ${AGENCE.email}</p>
        </div>
      </div>
      <div class="footer-bottom">
        <span>© 2026 Hiri Tours — <span data-i18n="foot_rights">Tous droits réservés.</span></span>
        <div class="pay-badges">
          <span>HTTPS / SSL</span><span>CMI</span><span>VISA</span><span>Mastercard</span><span>PayPal</span>
        </div>
      </div>
    </div>
  </footer>`;
}

/* ---------- Bouton WhatsApp flottant ---------- */
function renderWaFloat() {
  return `<a class="wa-float" href="${waLink()}" target="_blank" title="Réserver via WhatsApp" aria-label="WhatsApp">${icon("wa")}</a>`;
}

/* ---------- Chat en ligne (assistant virtuel) ---------- */
function renderChat() {
  return `
  <button class="chat-float" id="chatToggle" title="Chat en ligne" aria-label="Chat">${icon("chat")}</button>
  <div class="chat-panel" id="chatPanel">
    <div class="chat-head">
      <span class="dot"></span>
      <div><b>Assistant Hiri Tours</b><small>En ligne — réponse immédiate</small></div>
    </div>
    <div class="chat-body" id="chatBody">
      <div class="chat-msg bot">Bonjour, je suis l'assistant Hiri Tours. Posez-moi une question sur nos circuits, tarifs, transferts ou réservations !</div>
    </div>
    <form class="chat-input" id="chatForm">
      <input type="text" id="chatText" placeholder="Écrivez votre message…" autocomplete="off">
      <button type="submit" aria-label="Envoyer">${icon("send")}</button>
    </form>
  </div>`;
}

function chatAnswer(q) {
  q = q.toLowerCase();
  if (/(prix|tarif|coût|cout|combien)/.test(q))
    return "Nos excursions à la journée démarrent à 200 DH (transfert aéroport) et 260 DH (Souk & Medina). Les séjours tout inclus vont jusqu'à 2 450 DH. Consultez la page Circuits pour tous les tarifs par saison.";
  if (/(désert|desert|sahara|dune|bivouac)/.test(q))
    return "Notre best-seller « Escapade au Sahara » (2 jours / 1 nuit, 1 290 DH) inclut le transport 4x4, le guide, la balade à dos de dromadaire et la nuit en bivouac (note 4.9/5).";
  if (/(surf|taghazout|vague)/.test(q))
    return "Nous proposons des cours de surf à Taghazout dès 320 DH (matériel fourni, moniteurs diplômés, tous niveaux).";
  if (/(transfert|aéroport|aeroport|navette)/.test(q))
    return "Transfert privé Aéroport Al Massira ↔ hôtel dès 200 DH : accueil avec pancarte, suivi de vol et véhicule climatisé.";
  if (/(annul|rembours|modifi)/.test(q))
    return "Annulation gratuite jusqu'à 48h avant le départ : remboursement intégral ou avoir client. Entre 48h et 24h : avoir de 50%. Détails dans nos CGV.";
  if (/(acompte|paiement|payer|cb|carte|paypal)/.test(q))
    return "Vous pouvez payer 100% en ligne (CMI, Visa, Mastercard, PayPal — 3D Secure), verser un acompte de 30% (solde à J-7), ou régler directement à l'agence, le tout sécurisé 3D Secure.";
  if (/(devis|groupe|entreprise|scolaire|mice)/.test(q))
    return "Pour les groupes, entreprises et événements, nous préparons un devis personnalisé gratuit sous 24h. Rendez-vous sur la page Contact, section « Devis ».";
  if (/(horaire|ouvert|adresse|où|ou êtes)/.test(q))
    return `Notre agence : ${AGENCE.adresse}. Ouvert du lundi au samedi, 9h–19h. Réservation en ligne 24h/24.`;
  if (/(bonjour|salut|hello|salam)/.test(q))
    return "Bonjour ! Comment puis-je vous aider : circuits, tarifs, transferts, réservation ?";
  return `Merci pour votre message ! Un conseiller va vous répondre rapidement. Pour une réponse immédiate, contactez-nous sur WhatsApp : wa.me/${WHATSAPP}`;
}

function initChat() {
  const toggle = document.getElementById("chatToggle");
  const panel = document.getElementById("chatPanel");
  const body = document.getElementById("chatBody");
  const form = document.getElementById("chatForm");
  const input = document.getElementById("chatText");
  if (!toggle || !panel) return;
  toggle.addEventListener("click", () => panel.classList.toggle("open"));
  form.addEventListener("submit", (e) => {
    e.preventDefault();
    const q = input.value.trim();
    if (!q) return;
    body.insertAdjacentHTML("beforeend", `<div class="chat-msg me"></div>`);
    body.lastElementChild.textContent = q;
    input.value = "";
    setTimeout(() => {
      body.insertAdjacentHTML("beforeend", `<div class="chat-msg bot"></div>`);
      body.lastElementChild.textContent = chatAnswer(q);
      body.scrollTop = body.scrollHeight;
    }, 500);
    body.scrollTop = body.scrollHeight;
  });
}

/* ---------- Initialisation commune ---------- */
function initLayout(activePage) {
  const h = document.getElementById("header-slot");
  const f = document.getElementById("footer-slot");
  if (h) h.innerHTML = renderHeader(activePage);
  if (f) f.innerHTML = renderFooter() + renderWaFloat() + renderChat();
  initChat();
  applyIcons();

  // langue
  document.querySelectorAll(".lang button").forEach(b => b.addEventListener("click", () => setLang(b.dataset.lang)));
  setLang(currentLang());

  // menu mobile
  const burger = document.getElementById("burger");
  if (burger) burger.addEventListener("click", () => document.getElementById("navLinks").classList.toggle("open"));

  updateWishBadge();
}
