import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getFirestore, collection, onSnapshot } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { firebaseConfig } from "./firebase-config.js";
import { sanitizeProduct, getPriceData, isOutOfStockGlobally, formatPrice } from "./product-model.js";
import { getCart, setCart, cartLineTotal, cartCount } from "./cart.js";
import { escapeHtml } from "./utils.js";
import { getLang, setLang, i18n } from "./i18n.js";
import { getWishlist, isWished, toggleWish, removeFromWishlist, wishCount } from "./wishlist.js";

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

const validCat = [];
let currentFilter = new URLSearchParams(window.location.search).get("cat") || "all";

let allProducts = [];
let currentSearch = "";
let availableMinPrice = 0;
let availableMaxPrice = 1000;
let currentMinPrice = 0;
let currentMaxPrice = 1000;
let previewVertical = false;

const PAGE_SIZE = 12;
let visibleCount = PAGE_SIZE;
let filteredProducts = [];

const productsContainer = document.getElementById("productsContainer");
const stateBox = document.getElementById("stateBox");
const filterBar = document.getElementById("filterBar");
const searchInput = document.getElementById("searchInput");
const priceMinInput = document.getElementById("priceMinInput");
const priceMaxInput = document.getElementById("priceMaxInput");
const priceMinRange = document.getElementById("priceMinRange");
const priceMaxRange = document.getElementById("priceMaxRange");
const rangeProgress = document.getElementById("rangeProgress");
const priceResetBtn = document.getElementById("priceResetBtn");
const layoutKebab = document.getElementById("layoutKebab");
const openFilterBtn = document.getElementById("openFilterBtn");
const priceFilterPanel = document.getElementById("priceFilterPanel");
const loopTrack = document.getElementById("loopTrack");
const cartDrawer = document.getElementById("cartDrawer");
const cartDim = document.getElementById("cartDim");
const openCartBtn = document.getElementById("openCartBtn");
const closeCartBtn = document.getElementById("closeCartBtn");
const cartItems = document.getElementById("cartItems");
const cartTotal = document.getElementById("cartTotal");
const cartCountEl = document.getElementById("cartCount");
const checkoutBtn = document.getElementById("checkoutBtn");
const menuBtn = document.getElementById("menuBtn");
const navLinks = document.getElementById("navLinks");
const closeNavDrawer = document.getElementById("closeNavDrawer");
const langToggleBtn = document.getElementById("langToggleBtn");
const langMenu = document.getElementById("langMenu");

// Wishlist
const openWishlistBtn = document.getElementById("openWishlistBtn");
const closeWishlistBtn = document.getElementById("closeWishlistBtn");
const wishlistDrawer = document.getElementById("wishlistDrawer");
const wishlistDim = document.getElementById("wishlistDim");
const wishlistItems = document.getElementById("wishlistItems");
const wishlistCountBadge = document.getElementById("wishlistCountBadge");

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
    ["pageCatalogTitle", "catalogPageTitle", true],
    ["pageCatalogSub", "catalogPageSub"],
    ["searchInput", "searchPlaceholder", false, "placeholder"],
    ["priceFilterLabel", "priceFilter"],
    ["cartHeadLabel", "cartTitle"],
    ["cartTotalLabel", "total"],
    ["checkoutBtn", "validatePurchases"],
    ["footerNote", "footer"]
  ];

  for (const row of map) {
    const el = document.getElementById(row[0]);
    if (!el) continue;
    const key = row[1];
    const html = row[2] === true;
    const attr = row[3];
    const val = i18n[lang][key] || i18n.fr[key];
    if (attr === "placeholder") el.setAttribute("placeholder", val);
    else if (html) el.innerHTML = val;
    else el.textContent = val;
  }

  langToggleBtn.innerHTML =
    lang === "ar"
      ? `<span dir="rtl" style="font-weight:800;">العربية</span>`
      : `<span style="font-weight:800;">Français</span>`;

  document.getElementById("langOptionFr").textContent = i18n.fr.langFr;
  document.getElementById("langOptionAr").textContent = i18n.ar.langAr;

  updateCartLabel();
  applyFilter();
  const _lang = getLang();
  document.querySelectorAll(".nav-lang-opt").forEach((b) => b.classList.toggle("active-lang", b.dataset.lang === _lang));
}

function updateCartLabel() {
  document.getElementById("cartLabelText").textContent = i18n[getLang()].cartLabel;
  const wishNavLabel = document.getElementById("wishlistNavLabel");
  if (wishNavLabel) wishNavLabel.textContent = i18n[getLang()].wishlistBtn;
  const wishDrawerTitle = document.getElementById("wishlistDrawerTitle");
  if (wishDrawerTitle) wishDrawerTitle.textContent = i18n[getLang()].wishlistTitle;
}

function showState(msg) {
  stateBox.style.display = "block";
  stateBox.textContent = msg;
}

function hideState() {
  stateBox.style.display = "none";
  stateBox.textContent = "";
}

function parseDiscountTag(tag) {
  if (!tag) return null;
  const match = tag.match(/-?\s*(\d{1,2})\s*%/);
  if (!match) return null;
  const value = Number(match[1]);
  if (!Number.isFinite(value) || value <= 0 || value >= 100) return null;
  return value;
}

function getTagMeta(tag = "") {
  const normalized = tag.toLowerCase();
  if (!tag) return { cardClass: "", text: "" };
  if (parseDiscountTag(tag)) return { cardClass: "promo", text: tag };
  if (normalized.includes("out of stock") || normalized.includes("rupture")) return { cardClass: "stock", text: tag };
  return { cardClass: "", text: tag };
}

function updatePriceUi() {
  priceMinInput.value = String(currentMinPrice);
  priceMaxInput.value = String(currentMaxPrice);
  const minPercent = ((currentMinPrice - availableMinPrice) / Math.max(1, availableMaxPrice - availableMinPrice)) * 100;
  const maxPercent = ((currentMaxPrice - availableMinPrice) / Math.max(1, availableMaxPrice - availableMinPrice)) * 100;
  rangeProgress.style.left = `${Math.max(0, minPercent)}%`;
  rangeProgress.style.right = `${Math.max(0, 100 - maxPercent)}%`;
}

function getCategoryProducts() {
  if (!currentFilter || currentFilter === "all") return allProducts;
  const norm = (s) => String(s || "").trim().toLowerCase();
  const filterNorm = norm(currentFilter);
  return allProducts.filter(p => {
    const pCat = norm(p.category);
    const pCatSlug = pCat.replace(/\s+/g, "-");
    return pCat === filterNorm || pCatSlug === filterNorm;
  });
}

function syncPriceBoundsForCurrentCategory(resetValues = true) {
  const baseProducts = getCategoryProducts();
  const prices = baseProducts.map((product) => getPriceData(product).finalPrice).filter((x) => Number.isFinite(x));
  availableMinPrice = 0;
  availableMaxPrice = prices.length ? Math.max(...prices) : 1000;
  if (availableMaxPrice < 1) availableMaxPrice = 1;
  if (resetValues) {
    currentMinPrice = 0;
    currentMaxPrice = availableMaxPrice;
  } else {
    currentMinPrice = Math.max(0, Math.min(currentMinPrice, availableMaxPrice));
    currentMaxPrice = Math.max(currentMinPrice, Math.min(currentMaxPrice, availableMaxPrice));
  }
  priceMinInput.min = "0";
  priceMinInput.max = String(availableMaxPrice);
  priceMaxInput.min = "0";
  priceMaxInput.max = String(availableMaxPrice);
  priceMinRange.min = String(availableMinPrice);
  priceMinRange.max = String(availableMaxPrice);
  priceMaxRange.min = String(availableMinPrice);
  priceMaxRange.max = String(availableMaxPrice);
  priceMinRange.value = String(currentMinPrice);
  priceMaxRange.value = String(currentMaxPrice);
  updatePriceUi();
}

function renderLoopGallery() {
  if (!allProducts.length) {
    loopTrack.innerHTML = "";
    return;
  }
  const loopItems = allProducts;
  const chunk = loopItems
    .map(
      (product) => `
    <div class="loop-item">
      <img src="${escapeHtml(product.image)}" alt="${escapeHtml(product.name)}" />
      <span>${escapeHtml(product.name)}</span>
    </div>
  `
    )
    .join("");
  loopTrack.innerHTML = chunk + chunk;
}

function heartSvg() {
  return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>`;
}

function openWishlist() {
  if (!wishlistDrawer) return;
  wishlistDrawer.classList.add("open");
  wishlistDim.classList.add("show");
  wishlistDrawer.setAttribute("aria-hidden", "false");
  renderWishlistDrawer();
}

function closeWishlist() {
  if (!wishlistDrawer) return;
  wishlistDrawer.classList.remove("open");
  wishlistDim.classList.remove("show");
  wishlistDrawer.setAttribute("aria-hidden", "true");
}

function updateWishlistBadge() {
  if (!wishlistCountBadge) return;
  const count = wishCount();
  wishlistCountBadge.textContent = String(count);
  wishlistCountBadge.classList.toggle("visible", count > 0);
}

function renderWishlistDrawer() {
  if (!wishlistItems) return;
  const lang = getLang();
  const list = getWishlist();
  const title = document.getElementById("wishlistDrawerTitle");
  if (title) title.textContent = i18n[lang].wishlistTitle;
  wishlistItems.innerHTML = "";
  if (!list.length) {
    wishlistItems.innerHTML = `<div class="state-box">${i18n[lang].wishlistEmpty}</div>`;
    return;
  }
  list.forEach((item) => {
    const row = document.createElement("div");
    row.className = "wishlist-row";
    row.innerHTML = `
      <a href="product.html?id=${encodeURIComponent(item.id)}"><img src="${escapeHtml(item.image)}" alt="${escapeHtml(item.name)}" /></a>
      <div class="wishlist-row-info">
        <div class="wishlist-row-name">${escapeHtml(item.name)}</div>
        <div class="wishlist-row-price">${item.finalPrice ?? item.price} DT</div>
      </div>
      <button class="wishlist-row-remove" data-id="${escapeHtml(item.id)}" title="${i18n[lang].removeFromWishlist}">✕</button>
    `;
    wishlistItems.appendChild(row);
  });
}

function bagSvg() {
  return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true" width="16" height="16">
    <path d="M6 7h15l-1.5 9h-12z"/><path d="M6 7 5 3H2"/><circle cx="9" cy="20" r="1.5"/><circle cx="17" cy="20" r="1.5"/></svg>`;
}

function createProductCard(product, index, lang) {
  const card = document.createElement("article");
  card.className = `product-card ${isOutOfStockGlobally(product) ? "is-out" : ""}`;
  card.style.animationDelay = `${(index % PAGE_SIZE) * 60}ms`;
  const pd   = getPriceData(product);
  const tagM = getTagMeta(product.tag);
  const href = `product.html?id=${encodeURIComponent(product.id)}`;
  const tagHtml = tagM.text
    ? `<span class="product-tag ${tagM.cardClass || "tag-custom"}">${escapeHtml(tagM.text)}</span>`
    : "";
  card.innerHTML = `
    <a class="product-image-wrap" href="${href}">
      <img src="${escapeHtml(product.image)}" alt="${escapeHtml(product.name)}" loading="lazy" data-product-id="${escapeHtml(product.id)}" />
      ${tagHtml}
      <button class="wish-btn${isWished(product.id) ? " active" : ""}" type="button" data-id="${escapeHtml(product.id)}" aria-label="${i18n[lang].addToWishlist}">${heartSvg()}</button>
    </a>
    <div class="product-info">
      <span class="badge">${escapeHtml(product.category)}</span>
      <h3 class="product-name">${escapeHtml(product.name)}</h3>
      <div class="price-wrap">
        <span class="price">${formatPrice(pd.finalPrice)}</span>
        ${pd.oldPrice ? `<span class="old-price">${formatPrice(pd.oldPrice)}</span>` : ""}
      </div>
      <div class="product-actions">
        <a class="mini-btn btn-primary" href="${href}">${bagSvg()} ${lang === "ar" ? i18n.ar.buyAr : i18n.fr.buy}</a>
      </div>
    </div>
  `;
  return card;
}

function showSkeletons(count = PAGE_SIZE) {
  for (let i = 0; i < count; i++) {
    const card = document.createElement("article");
    card.className = "product-card skeleton";
    card.innerHTML = `
      <div class="product-image-wrap"></div>
      <div class="product-info">
        <span class="badge"> </span>
        <h3 class="product-name"> </h3>
        <div class="price-wrap"><span class="price"> </span></div>
      </div>`;
    productsContainer.appendChild(card);
  }
}

function getOrCreateVoirPlusBtn() {
  let wrap = document.getElementById("voirPlusWrap");
  if (!wrap) {
    wrap = document.createElement("div");
    wrap.id = "voirPlusWrap";
    wrap.className = "voir-plus-wrap";
    const btn = document.createElement("button");
    btn.id = "voirPlusBtn";
    btn.className = "voir-plus-btn";
    btn.type = "button";
    btn.textContent = "Voir plus";
    btn.addEventListener("click", () => {
      visibleCount += PAGE_SIZE;
      renderVisibleProducts();
    });
    wrap.appendChild(btn);
    productsContainer.parentNode.insertBefore(wrap, productsContainer.nextSibling);
  }
  return document.getElementById("voirPlusWrap");
}

function renderVisibleProducts() {
  const lang = getLang();
  const toShow = filteredProducts.slice(0, visibleCount);

  // Remove skeletons
  productsContainer.querySelectorAll(".skeleton").forEach(s => s.remove());

  // Append only newly visible cards (avoid re-rendering existing)
  const existing = productsContainer.querySelectorAll(".product-card:not(.skeleton)").length;
  const newItems = filteredProducts.slice(existing, visibleCount);
  newItems.forEach((product, i) => {
    productsContainer.appendChild(createProductCard(product, existing + i, lang));
  });

  // Voir plus button
  const wrap = getOrCreateVoirPlusBtn();
  const btn = document.getElementById("voirPlusBtn");
  if (visibleCount >= filteredProducts.length) {
    wrap.style.display = "none";
  } else {
    wrap.style.display = "flex";
    btn.textContent = lang === "ar" ? "عرض المزيد" : "Voir plus";
    btn.disabled = false;
  }
}

function renderProducts(list) {
  const lang = getLang();
  filteredProducts = list;
  visibleCount = PAGE_SIZE;
  productsContainer.innerHTML = "";

  if (!list.length) {
    showState(i18n[lang].noProducts);
    const wrap = document.getElementById("voirPlusWrap");
    if (wrap) wrap.style.display = "none";
    return;
  }
  hideState();

  // Show skeletons immediately, then render real cards
  showSkeletons(Math.min(PAGE_SIZE, list.length));
  requestAnimationFrame(() => {
    productsContainer.querySelectorAll(".skeleton").forEach(s => s.remove());
    renderVisibleProducts();
  });
}

function setActiveFilterButton(category) {
  if (!filterBar) return;
  filterBar.querySelectorAll(".filter-btn").forEach((btn) => {
    btn.classList.toggle("active", btn.dataset.category === category);
  });
}

function applyFilter() {
  const lang = getLang();
  const filteredByCategory = getCategoryProducts();
  const filtered = filteredByCategory.filter((item) => {
    const text = `${item.name} ${item.category}`.toLowerCase();
    const price = getPriceData(item).finalPrice;
    return text.includes(currentSearch.toLowerCase()) && price >= currentMinPrice && price <= currentMaxPrice;
  });
  renderProducts(filtered);
  setActiveFilterButton(currentFilter);
}

function openCart() {
  cartDrawer.classList.add("open");
  cartDim.classList.add("show");
  cartDrawer.setAttribute("aria-hidden", "false");
}

function closeCart() {
  cartDrawer.classList.remove("open");
  cartDim.classList.remove("show");
  cartDrawer.setAttribute("aria-hidden", "true");
}

function renderCart() {
  const lang = getLang();
  const cart = getCart();
  cartItems.innerHTML = "";
  if (!cart.length) {
    cartItems.innerHTML = `<div class="state-box">${i18n[lang].cartEmpty}</div>`;
  } else {
    cart.forEach((item) => {
      const row = document.createElement("div");
      row.className = "cart-row";
      row.innerHTML = `
        <img src="${escapeHtml(item.image)}" alt="" />
        <div>
          <div style="font-weight:700;">${escapeHtml(item.name)}</div>
          <div style="font-size:0.86rem;color:#666;">${escapeHtml(item.color)} · USA ${escapeHtml(item.tailleUSA || "-")} / EUR ${escapeHtml(item.tailleEUR || "-")}</div>
          <div style="font-weight:700;">${formatPrice(item.unitPrice * item.qty)}</div>
          <div class="qty-wrap">
            <button class="qty-btn" type="button" data-action="minus" data-id="${escapeHtml(item.cartId)}">-</button>
            <span class="qty-num">${item.qty}</span>
            <button class="qty-btn" type="button" data-action="plus" data-id="${escapeHtml(item.cartId)}">+</button>
            <button class="remove-btn" type="button" data-action="remove" data-id="${escapeHtml(item.cartId)}">${i18n[lang].remove}</button>
          </div>
        </div>
      `;
      cartItems.appendChild(row);
    });
  }
  cartTotal.textContent = formatPrice(cartLineTotal(cart));
  cartCountEl.textContent = String(cartCount(cart));
}

function loadProducts() {
  const lang = getLang();
  showState(i18n[lang].loading);
  onSnapshot(
    collection(db, "products"),
    (snapshot) => {
      const fetched = [];
      snapshot.forEach((docSnap) => {
        fetched.push(sanitizeProduct(docSnap.id, docSnap.data()));
      });
      allProducts = fetched;
      if (!allProducts.length) {
        showState(i18n[lang].noFirestore);
        productsContainer.innerHTML = "";
        loopTrack.innerHTML = "";
        return;
      }
      hideState();
      syncPriceBoundsForCurrentCategory(true);
      renderLoopGallery();
      applyFilter();
    },
    () => showState(i18n[lang].loadError)
  );
}

if (filterBar) {
  filterBar.addEventListener("click", (event) => {
    const btn = event.target.closest(".filter-btn");
    if (!btn) return;
    currentFilter = btn.dataset.category;
    syncPriceBoundsForCurrentCategory(true);
    applyFilter();
  });
}

if (openFilterBtn && priceFilterPanel) {
  openFilterBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    priceFilterPanel.classList.toggle('open');
  });
  // Close when clicking outside
  document.addEventListener('click', (e) => {
    if (!priceFilterPanel.contains(e.target) && e.target !== openFilterBtn) {
      priceFilterPanel.classList.remove('open');
    }
  });
}

searchInput.addEventListener("input", () => {
  currentSearch = searchInput.value.trim();
  applyFilter();
});

priceMinRange.addEventListener("input", () => {
  currentMinPrice = Number(priceMinRange.value);
  if (currentMinPrice > currentMaxPrice) currentMinPrice = currentMaxPrice;
  priceMinRange.value = String(currentMinPrice);
  updatePriceUi();
  applyFilter();
});

priceMaxRange.addEventListener("input", () => {
  currentMaxPrice = Number(priceMaxRange.value);
  if (currentMaxPrice < currentMinPrice) currentMaxPrice = currentMinPrice;
  priceMaxRange.value = String(currentMaxPrice);
  updatePriceUi();
  applyFilter();
});

priceMinInput.addEventListener("input", () => {
  currentMinPrice = Number(priceMinInput.value || 0);
  if (currentMinPrice < 0) currentMinPrice = 0;
  if (currentMinPrice > currentMaxPrice) currentMinPrice = currentMaxPrice;
  priceMinRange.value = String(currentMinPrice);
  updatePriceUi();
  applyFilter();
});

priceMaxInput.addEventListener("input", () => {
  currentMaxPrice = Number(priceMaxInput.value || 0);
  if (currentMaxPrice > availableMaxPrice) currentMaxPrice = availableMaxPrice;
  if (currentMaxPrice < currentMinPrice) currentMaxPrice = currentMinPrice;
  priceMaxRange.value = String(currentMaxPrice);
  updatePriceUi();
  applyFilter();
});

priceResetBtn.addEventListener("click", () => {
  currentMinPrice = 0;
  currentMaxPrice = availableMaxPrice;
  priceMinRange.value = String(currentMinPrice);
  priceMaxRange.value = String(currentMaxPrice);
  updatePriceUi();
  applyFilter();
});

layoutKebab.addEventListener("click", () => {
  previewVertical = !previewVertical;
  productsContainer.classList.toggle("vertical", previewVertical);
  layoutKebab.classList.toggle("is-vertical", previewVertical);
  layoutKebab.setAttribute("aria-pressed", previewVertical ? "true" : "false");
});

openCartBtn.addEventListener("click", openCart);

// Wishlist events
if (openWishlistBtn) openWishlistBtn.addEventListener("click", openWishlist);
if (closeWishlistBtn) closeWishlistBtn.addEventListener("click", closeWishlist);
if (wishlistDim) wishlistDim.addEventListener("click", closeWishlist);
if (wishlistItems) {
  wishlistItems.addEventListener("click", (e) => {
    const btn = e.target.closest(".wishlist-row-remove");
    if (!btn) return;
    removeFromWishlist(btn.dataset.id);
    updateWishlistBadge();
    renderWishlistDrawer();
    document.querySelectorAll(`.wish-btn[data-id="${btn.dataset.id}"]`).forEach((b) => b.classList.remove("active"));
  });
}

// Wish button delegation on products container
if (productsContainer) {
  productsContainer.addEventListener("click", (e) => {
    const btn = e.target.closest(".wish-btn");
    if (!btn) return;
    e.preventDefault();
    e.stopPropagation();
    const id = btn.dataset.id;
    const product = allProducts.find((p) => p.id === id);
    if (!product) return;
    const pd = getPriceData(product);
    const wished = toggleWish({ ...product, finalPrice: pd.finalPrice });
    btn.classList.toggle("active", wished);
    updateWishlistBadge();
  });
}
closeCartBtn.addEventListener("click", closeCart);
cartDim.addEventListener("click", closeCart);
cartItems.addEventListener("click", (event) => {
  const btn = event.target.closest("button[data-id]");
  if (!btn) return;
  const id = btn.dataset.id;
  const action = btn.dataset.action;
  const cart = getCart();
  const itemIndex = cart.findIndex((x) => x.cartId === id);
  if (itemIndex === -1) return;

  if (action === "plus") cart[itemIndex].qty = Number(cart[itemIndex].qty || 0) + 1;
  if (action === "minus") {
    const currentQty = Number(cart[itemIndex].qty || 0);
    cart[itemIndex].qty = Math.max(1, currentQty - 1);
  }
  if (action === "remove") cart.splice(itemIndex, 1);
  setCart(cart);
  renderCart();
});

checkoutBtn.addEventListener("click", () => {
  if (!getCart().length) return;
  window.location.href = "checkout.html";
});

menuBtn.addEventListener("click", () => {
  menuBtn.classList.toggle("open");
  navLinks.classList.toggle("open");
});

navLinks.querySelectorAll("a").forEach((link) => {
  link.addEventListener("click", () => {
    menuBtn.classList.remove("open");
    navLinks.classList.remove("open");
  });
});

if (closeNavDrawer) {
  closeNavDrawer.addEventListener('click', () => {
    menuBtn.classList.remove('open');
    navLinks.classList.remove('open');
  });
}

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

function updateMobileLangActive() {
  const lang = getLang();
  document.querySelectorAll(".nav-lang-opt").forEach((btn) => {
    btn.classList.toggle("active-lang", btn.dataset.lang === lang);
  });
}

const observer = new IntersectionObserver((entries) => {
  entries.forEach((entry) => {
    if (entry.isIntersecting) entry.target.classList.add("show");
  });
});
document.querySelectorAll(".reveal").forEach((el) => observer.observe(el));

document.getElementById("year").textContent = String(new Date().getFullYear());

setActiveFilterButton(currentFilter);
applyI18n();

// If a category is selected via URL, update page title
if (currentFilter && currentFilter !== "all") {
  const titleEl = document.getElementById("pageCatalogTitle");
  if (titleEl) titleEl.innerHTML = `<span>${currentFilter}</span>`;
  document.title = `${currentFilter} — GCA styMode`;
}

renderCart();
updateWishlistBadge();
loadProducts();

if (sessionStorage.getItem("gca_open_cart")) {
  sessionStorage.removeItem("gca_open_cart");
  setTimeout(() => openCart(), 400);
}
