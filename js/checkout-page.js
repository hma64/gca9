import { getCart, setCart } from "./cart.js";
import { formatPrice } from "./product-model.js";
import { escapeHtml } from "./utils.js";
import { getLang, setLang, i18n } from "./i18n.js";

import { initializeApp, getApps } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getFirestore, doc, getDoc, collection, setDoc } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { firebaseConfig } from "./firebase-config.js";

const app = getApps().length ? getApps()[0] : initializeApp(firebaseConfig);
const db = getFirestore(app);

let ORDER_EMAIL = "mouhamedamineyousfi10@gmail.com";
let SHIPPING_DT = 7;

async function loadConfig() {
  try {
    const docSnap = await getDoc(doc(db, "config", "site"));
    if (docSnap.exists()) {
      const data = docSnap.data();
      ORDER_EMAIL = data.orderEmail || ORDER_EMAIL;
      SHIPPING_DT = data.shippingDt !== undefined ? data.shippingDt : SHIPPING_DT;
      renderReview();
    }
  } catch (e) {
    console.error("Error loading config:", e);
  }
}
loadConfig();

const GOVERNORATES = [
  "Tunis",
  "Bizerte",
  "Ariana",
  "Beja",
  "Ben Arous",
  "Gabes",
  "Gafsa",
  "Jendouba",
  "Kairouan",
  "Kasserine",
  "Kebili",
  "Kef",
  "Mahdia",
  "Mannouba",
  "Medenine",
  "Monastir",
  "Nabeul",
  "Sfax",
  "Sidi Bouzid",
  "Siliana",
  "Sousse",
  "Tataouine",
  "Tozeur",
  "Zaghouan"
];

const govSelect = document.getElementById("governorateSelect");
const checkoutForm = document.getElementById("checkoutForm");
const checkoutError = document.getElementById("checkoutError");
const checkoutStatus = document.getElementById("checkoutStatus");
const cartReview = document.getElementById("cartReview");
const subtotalEl = document.getElementById("subtotalEl");
const shippingEl = document.getElementById("shippingEl");
const grandTotalEl = document.getElementById("grandTotalEl");
const confirmBtn = document.getElementById("confirmBtn");
const langToggleBtn = document.getElementById("langToggleBtn");
const langMenu = document.getElementById("langMenu");
const menuBtn = document.getElementById("menuBtn");
const navLinks = document.getElementById("navLinks");
const closeNavDrawer = document.getElementById("closeNavDrawer");

GOVERNORATES.forEach((g) => {
  const opt = document.createElement("option");
  opt.value = g;
  opt.textContent = g;
  govSelect.appendChild(opt);
});

function buildOrderEmailBody({
  firstName,
  lastName,
  phone,
  address,
  addressExtra,
  governorate,
  items,
  subtotal,
  shipping,
  total,
  orderedAt
}) {
  const lines = items.map(
    (item, i) =>
      `${i + 1}. ${item.name}
   Couleur: ${item.color}${item.size ? ` | Taille: ${item.size}` : ""}
   Qté: ${item.qty} × ${item.unitPrice} DT = ${item.unitPrice * item.qty} DT`
  );

  const images = items.map((item, i) => `${i + 1}. ${item.name} — ${item.image}`).join("\n");

  return `BON DE COMMANDE — GCA STYMODE
────────────────────────────
Date de la commande : ${orderedAt}

CLIENT
Prénom / Nom : ${firstName} ${lastName}
Téléphone : ${phone}

LIVRAISON
Adresse : ${address}
Complément : ${addressExtra || "—"}
Gouvernorat : ${governorate}

DÉTAIL DES ARTICLES
${lines.join("\n\n")}

LIENS VERS LES IMAGES DES PRODUITS
(copiez-collez dans un navigateur pour voir chaque article)
${images}

MONTANTS
Prix total articles : ${subtotal} DT
Livraison : ${shipping} DT
TOTAL À PAYER : ${total} DT

—
Message généré depuis le site GCA styMode.`;
}

function applyI18n() {
  const lang = getLang();
  document.documentElement.lang = lang === "ar" ? "ar" : "fr";
  document.documentElement.dir = lang === "ar" ? "rtl" : "ltr";

  const map = [
    ["navHome", "navHome"],
    ["navShop", "navShop"],
    ["navCategories", "navCategories"],
    ["navContact", "navContact"],
    ["btnAllProducts", "navAllProducts"],
    ["pageTitle", "checkoutTitle"],
    ["pageSub", "checkoutSub"],
    ["labelFirst", "firstName"],
    ["labelLast", "lastName"],
    ["labelPhone", "phone"],
    ["labelAddress", "address"],
    ["labelExtra", "addressExtra"],
    ["labelGov", "governorate"],
    ["lblSubtotal", "subtotal"],
    ["lblShip", "shipping"],
    ["lblGrand", "grandTotal"],
    ["confirmBtn", "confirmOrder"],
    ["recapTitle", "recapTitle"]
  ];
  map.forEach(([id, key]) => {
    const el = document.getElementById(id);
    if (el) el.textContent = i18n[lang][key];
  });
  const first = govSelect.querySelector("option[value='']");
  if (first) first.textContent = i18n[lang].selectGov;

  langToggleBtn.innerHTML =
    lang === "ar"
      ? `<span dir="rtl" style="font-weight:800;">العربية</span>`
      : `<span style="font-weight:800;">Français</span>`;
  document.getElementById("langOptionFr").textContent = i18n.fr.langFr;
  document.getElementById("langOptionAr").textContent = i18n.ar.langAr;
  document.getElementById("cartLabelText").textContent = i18n[lang].cartLabel;
  document.querySelectorAll(".nav-lang-opt").forEach((b) => b.classList.toggle("active-lang", b.dataset.lang === lang));

  renderReview();
}

function renderReview() {
  const lang = getLang();
  const cart = getCart();
  cartReview.innerHTML = "";

  if (!cart.length) {
    cartReview.innerHTML = `<div class="state-box">${i18n[lang].checkoutEmpty}</div>`;
    checkoutForm.style.display = "none";
    return;
  }
  checkoutForm.style.display = "";

  const subtotal = cart.reduce((s, it) => s + Number(it.unitPrice) * Number(it.qty || 1), 0);
  const ship = SHIPPING_DT;
  const total = subtotal + ship;

  subtotalEl.textContent = formatPrice(subtotal);
  shippingEl.textContent = formatPrice(ship);
  grandTotalEl.textContent = formatPrice(total);

  cart.forEach((item) => {
    const row = document.createElement("div");
    row.className = "cart-mini-row";
    row.innerHTML = `
      <img src="${escapeHtml(item.image)}" alt="" />
      <div>
        <div style="font-weight:800;">${escapeHtml(item.name)}</div>
        <div style="color:#666;font-size:0.88rem;">${escapeHtml(item.color)}${item.size ? ` · ${escapeHtml(item.size)}` : ""}</div>
        <div>${i18n[lang].total}: ${formatPrice(item.unitPrice * item.qty)} × ${item.qty}</div>
      </div>
    `;
    cartReview.appendChild(row);
  });
}

checkoutForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  const lang = getLang();
  checkoutError.textContent = "";
  checkoutStatus.textContent = "";

  const cart = getCart();
  if (!cart.length) {
    checkoutError.textContent = i18n[lang].checkoutEmpty;
    return;
  }

  const firstName = document.getElementById("firstName").value.trim();
  const lastName = document.getElementById("lastName").value.trim();
  const phone = document.getElementById("phone").value.trim();
  const address = document.getElementById("address").value.trim();
  const addressExtra = document.getElementById("addressExtra").value.trim();
  const governorate = govSelect.value;

  if (!firstName || !lastName || !phone || !address || !governorate) {
    checkoutError.textContent = i18n[lang].fieldError;
    return;
  }

  const phoneRegex = /^[2579]\d{7}$/;
  if (!phoneRegex.test(phone)) {
    checkoutError.textContent = i18n[lang].phoneError;
    return;
  }

  const subtotal = cart.reduce((s, it) => s + Number(it.unitPrice) * Number(it.qty || 1), 0);
  const ship = SHIPPING_DT;
  const total = subtotal + ship;
  const orderedAt = new Date().toLocaleString("fr-FR", {
    dateStyle: "long",
    timeStyle: "short"
  });

  const items = cart.map((item) => ({
    name: item.name,
    color: item.color,
    size: item.size || "-",

    qty: item.qty,
    unitPrice: item.unitPrice,
    image: item.image
  }));

  const orderData = {
    firstName,
    lastName,
    phone,
    address,
    addressExtra,
    governorate,
    items,
    subtotal,
    shipping: ship,
    total,
    orderedAt,
    status: "completed",
    createdAt: new Date().toISOString()
  };

  const body = buildOrderEmailBody({
    firstName,
    lastName,
    phone,
    address,
    addressExtra,
    governorate,
    items,
    subtotal,
    shipping: ship,
    total,
    orderedAt
  });

  const subject = `Bon de commande GCA styMode — ${firstName} ${lastName} — ${orderedAt}`;
  confirmBtn.disabled = true;
  checkoutStatus.textContent = i18n[lang].sending;

  try {
    // 1. Save to Firestore
    const orderId = doc(collection(db, "orders")).id;
    await setDoc(doc(db, "orders", orderId), orderData);

    // 2. Send email via FormSubmit
    const res = await fetch(`https://formsubmit.co/ajax/${encodeURIComponent(ORDER_EMAIL)}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json"
      },
      body: JSON.stringify({
        _subject: subject,
        _template: "table",
        _captcha: "false",
        name: `${firstName} ${lastName}`,
        email: ORDER_EMAIL,
        phone,
        governorate,
        address,
        addressExtra,
        message: body
      })
    });
    const data = await res.json().catch(() => ({}));
    const ok = res.ok && (data.success === true || data.success === "true" || data.success === "OK");
    if (!ok || data.error) {
      throw new Error(data.message || data.error || `HTTP ${res.status}`);
    }
    
    // Success logic
    setCart([]);
    showSuccessModal();
  } catch (err) {
    console.error(err);
    checkoutError.textContent = i18n[lang].sendError;
    checkoutStatus.textContent = "";
    confirmBtn.disabled = false;
  }
});

function showSuccessModal() {
  const lang = getLang();
  const modal = document.createElement("div");
  modal.id = "successModal";
  modal.className = "success-modal-overlay";
  
  const isAr = lang === "ar";
  const title = isAr ? "تم إرسال طلبك بنجاح!" : "Commande passée avec succès !";
  const message = isAr ? "شكراً لثقتكم. سنقوم بالاتصال بكم قريباً لتأكيد الطلب." : "Merci de votre confiance. Nous vous contacterons très prochainement pour confirmer votre commande.";
  const btnText = isAr ? "مواصلة التسوق" : "Continuer mes achats";

  modal.innerHTML = `
    <div class="success-modal-content">
      <div class="success-icon">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
          <polyline points="20 6 9 17 4 12"></polyline>
        </svg>
      </div>
      <h2>${title}</h2>
      <p>${message}</p>
      <button id="modalContinueBtn" class="btn btn-primary">${btnText}</button>
    </div>
  `;
  document.body.appendChild(modal);

  document.getElementById("modalContinueBtn").onclick = () => {
    window.location.href = "index.html";
  };
}

// Styles for the success modal
const style = document.createElement('style');
style.textContent = `
  .success-modal-overlay {
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background: rgba(0,0,0,0.6);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 9999;
    backdrop-filter: blur(4px);
    animation: fadeIn 0.3s ease;
  }
  .success-modal-content {
    background: #fff;
    padding: 40px;
    border-radius: 20px;
    text-align: center;
    max-width: 450px;
    width: 90%;
    box-shadow: 0 20px 40px rgba(0,0,0,0.2);
    animation: slideUp 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275);
  }
  .success-icon {
    width: 80px;
    height: 80px;
    background: #4caf50;
    color: #fff;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    margin: 0 auto 24px;
  }
  .success-icon svg { width: 40px; height: 40px; }
  .success-modal-content h2 { margin-bottom: 16px; font-size: 1.5rem; color: #1a1a1a; }
  .success-modal-content p { color: #666; margin-bottom: 30px; line-height: 1.6; }
  #modalContinueBtn { width: 100%; padding: 14px; font-size: 1rem; }
  
  @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
  @keyframes slideUp { from { transform: translateY(30px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
`;
document.head.appendChild(style);

applyI18n();

langToggleBtn.addEventListener("click", () => langMenu.classList.toggle("open"));
langMenu.addEventListener("click", (event) => {
  const btn = event.target.closest("[data-lang]");
  if (!btn) return;
  setLang(btn.dataset.lang);
  langMenu.classList.remove("open");
  applyI18n();
});
document.addEventListener("click", (event) => {
  if (!event.target.closest(".lang-dropdown")) langMenu.classList.remove("open");
});

// Mobile nav lang buttons
document.querySelectorAll(".nav-lang-opt").forEach((btn) => {
  btn.addEventListener("click", () => {
    setLang(btn.dataset.lang);
    menuBtn.classList.remove("open");
    navLinks.classList.remove("open");
    applyI18n();
  });
});

menuBtn.addEventListener("click", () => {
  menuBtn.classList.toggle("open");
  navLinks.classList.toggle("open");
});

if (closeNavDrawer) {
  closeNavDrawer.addEventListener("click", () => {
    menuBtn.classList.remove("open");
    navLinks.classList.remove("open");
  });
}

navLinks.querySelectorAll("a").forEach((link) => {
  link.addEventListener("click", () => {
    menuBtn.classList.remove("open");
    navLinks.classList.remove("open");
  });
});

document.getElementById("year").textContent = String(new Date().getFullYear());
