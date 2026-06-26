import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getFirestore, doc, getDoc, collection, getDocs, query, where, limit, addDoc, serverTimestamp, onSnapshot, orderBy } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { firebaseConfig } from "./firebase-config.js";
import {
  sanitizeProduct,
  getPriceData,
  isOutOfStockGlobally,
  formatPrice
} from "./product-model.js";
import { getCart, setCart } from "./cart.js";
import { escapeHtml } from "./utils.js";
import { getLang, setLang, i18n } from "./i18n.js";
import { getWishlist, isWished, toggleWish, removeFromWishlist, wishCount } from "./wishlist.js";

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

let currentProduct = null;
let selectedColor = "";

let selectedSize = "";
let currentPrice = 0;

const params = new URLSearchParams(window.location.search);
const productId = params.get("id");

const detailMainImage = document.getElementById("detailMainImage");
const detailGallery = document.getElementById("detailGallery");
const detailName = document.getElementById("detailName");
const detailPrice = document.getElementById("detailPrice");
const detailCategory = document.getElementById("detailCategory");
const detailTagText = document.getElementById("detailTagText");
const detailDescription = document.getElementById("detailDescription");
const colorOptions = document.getElementById("colorOptions");

const colorGroup = document.getElementById("labelColor")?.closest(".option-group");
const selectionError = document.getElementById("selectionError");
const stockMsg = document.getElementById("stockMsg");
const addToCartBtn = document.getElementById("addToCartBtn");
const detailWishBtn = document.getElementById("detailWishBtn");
const langToggleBtn = document.getElementById("langToggleBtn");
const langMenu = document.getElementById("langMenu");
const menuBtn = document.getElementById("menuBtn");
const navLinks = document.getElementById("navLinks");
const closeNavDrawer = document.getElementById("closeNavDrawer");
const relatedProductsContainer = document.getElementById("relatedProductsContainer");
const relatedProductsSection = document.getElementById("relatedProductsSection");

const prevImageBtn = document.getElementById("prevImage");
const nextImageBtn = document.getElementById("nextImage");

// Rating Elements
const starRatingInput = document.getElementById("starRatingInput");
const ratingStatusMsg = document.getElementById("ratingStatusMsg");
const reviewsList = document.getElementById("reviewsList");
const ratingSummary = document.getElementById("ratingSummary");
const avgStars = document.getElementById("avgStars");
const ratingCount = document.getElementById("ratingCount");
const reviewModal = document.getElementById("reviewModal");
const reviewComment = document.getElementById("reviewComment");
const submitReviewBtn = document.getElementById("submitReview");
const cancelReviewBtn = document.getElementById("cancelReview");

let pendingRating = 0;

// Wishlist drawer
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

  const keys = [
    ["navHome", "navHome"],
    ["navShop", "navShop"],
    ["navCategories", "navCategories"],
    ["navContact", "navContact"],
    ["btnAllProducts", "navAllProducts"],
    ["labelColor", "colorLabel"],
    ["addToCartBtn", "addToCart"],
    ["backLink", "backShop"]
  ];
  keys.forEach(([id, key]) => {
    const el = document.getElementById(id);
    if (el) el.textContent = i18n[lang][key];
  });

  langToggleBtn.innerHTML =
    lang === "ar"
      ? `<span dir="rtl" style="font-weight:800;">العربية</span>`
      : `<span style="font-weight:800;">Français</span>`;

  document.getElementById("langOptionFr").textContent = i18n.fr.langFr;
  document.getElementById("langOptionAr").textContent = i18n.ar.langAr;

  document.getElementById("cartLabelText").textContent = i18n[lang].cartLabel;
  document.querySelectorAll(".nav-lang-opt").forEach((b) => b.classList.toggle("active-lang", b.dataset.lang === lang));

  const wishNavLabel = document.getElementById("wishlistNavLabel");
  if (wishNavLabel) wishNavLabel.textContent = i18n[lang].wishlistBtn;
  const wishDrawerTitle = document.getElementById("wishlistDrawerTitle");
  if (wishDrawerTitle) wishDrawerTitle.textContent = i18n[lang].wishlistTitle;
  const relatedTitle = document.getElementById("relatedProductsTitle");
  if (relatedTitle) relatedTitle.textContent = i18n[lang].relatedProducts;

  if (currentProduct) {
    addToCartBtn.textContent = isOutOfStockGlobally(currentProduct)
      ? i18n[lang].productOos
      : i18n[lang].addToCart;
    updateStockMessage();
  }
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

function syncDetailWishBtn() {
  if (!detailWishBtn || !currentProduct) return;
  const wished = isWished(currentProduct.id);
  detailWishBtn.classList.toggle("active", wished);
}

function updateStockMessage() {
  stockMsg.textContent = "";
}

function updatePriceDisplay() {
  if (!currentProduct) return;
  const priceData = getPriceData(currentProduct);
  let displayPrice = currentPrice || priceData.finalPrice;
  detailPrice.innerHTML = `${formatPrice(displayPrice)}${
    priceData.oldPrice ? ` <span class="old-price">${formatPrice(priceData.oldPrice)}</span>` : ""
  }`;
}

function renderOptionButtons(container, values, type) {
  container.innerHTML = "";
  values.forEach((value, idx) => {
    const btn = document.createElement("button");
    btn.type = "button";

    if (type === "size") {
      const sizePrice = currentProduct.sizeMap && currentProduct.sizeMap[value];
      btn.textContent = sizePrice !== undefined ? `${value} - ${formatPrice(sizePrice)}` : value;
      btn.className = "opt-btn size-opt-btn";
      btn.addEventListener("click", () => {
        const alreadySelected = btn.classList.contains("selected");
        if (alreadySelected) {
          btn.classList.remove("selected");
          selectedSize = "";
          currentPrice = 0;
          updatePriceDisplay();
          return;
        }
        container.querySelectorAll("button").forEach(b => b.classList.remove("selected"));
        btn.classList.add("selected");
        selectedSize = value;
        currentPrice = sizePrice !== undefined ? sizePrice : 0;
        updatePriceDisplay();
        selectionError.textContent = "";
      });
    } else if (type === "color") {
      btn.textContent = value;
      btn.className = "opt-btn color-opt-btn";
      btn.addEventListener("click", () => {
        const alreadySelected = btn.classList.contains("selected");
        if (alreadySelected) {
          btn.classList.remove("selected");
          selectedColor = "";
          updateStockMessage();
          return;
        }
        container.querySelectorAll("button").forEach(b => b.classList.remove("selected"));
        btn.classList.add("selected");
        selectedColor = value;
        selectionError.textContent = "";
        updateStockMessage();
        // Swap main image to the color's matching image
        if (currentProduct) {
          const img = (currentProduct.colorImages && currentProduct.colorImages[value])
            ? currentProduct.colorImages[value]
            : (currentProduct.images && currentProduct.images[idx] ? currentProduct.images[idx] : currentProduct.image);
          
          detailMainImage.src = img;
          // Sync gallery highlight
          const thumbs = detailGallery.querySelectorAll(".thumb");
          thumbs.forEach((t) => {
            const thumbImg = t.querySelector('img').src;
            t.classList.toggle("active", thumbImg === img);
          });
        }
      });
    } else {
      btn.className = "opt-btn";
      btn.addEventListener("click", () => {
        const alreadySelected = btn.classList.contains("selected");
        if (alreadySelected) {
          btn.classList.remove("selected");

          updateStockMessage();
          return;
        }
        container.querySelectorAll("button").forEach(b => b.classList.remove("selected"));
        btn.classList.add("selected");

        selectionError.textContent = "";
        updateStockMessage();
      });
    }
    container.appendChild(btn);
  });
}

function renderGallery(images) {
  detailGallery.innerHTML = "";
  if (!images || !images.length) return;

  images.forEach((imgUrl, index) => {
    const thumb = document.createElement("button");
    thumb.className = `thumb ${index === 0 ? "active" : ""}`;
    thumb.type = "button";
    thumb.innerHTML = `<img src="${escapeHtml(imgUrl)}" alt="" />`;
    thumb.addEventListener("click", () => {
      detailMainImage.src = imgUrl;
      detailGallery.querySelectorAll(".thumb").forEach((t) => t.classList.remove("active"));
      thumb.classList.add("active");
    });
    detailGallery.appendChild(thumb);
  });

  // Slider Arrows logic
  const updateSlider = (direction) => {
    const thumbs = Array.from(detailGallery.querySelectorAll(".thumb"));
    const currentIndex = thumbs.findIndex((t) => t.classList.contains("active"));
    let nextIndex = currentIndex + direction;

    if (nextIndex < 0) nextIndex = thumbs.length - 1;
    if (nextIndex >= thumbs.length) nextIndex = 0;

    thumbs[nextIndex].click();
  };

  if (prevImageBtn) {
    prevImageBtn.onclick = () => updateSlider(-1);
    prevImageBtn.style.display = images.length > 1 ? "flex" : "none";
  }
  if (nextImageBtn) {
    nextImageBtn.onclick = () => updateSlider(1);
    nextImageBtn.style.display = images.length > 1 ? "flex" : "none";
  }
}

function openProductDetails(product) {
  const lang = getLang();
  const L = i18n[lang];
  document.getElementById("labelColor").textContent = L.colorLabel;
  currentProduct = product;
  selectedColor = "";

  selectedSize = "";
  currentPrice = 0;
  selectionError.textContent = "";
  stockMsg.textContent = "";

  detailName.textContent = product.name;
  const priceData = getPriceData(product);
  detailPrice.innerHTML = `${formatPrice(priceData.finalPrice)}${
    priceData.oldPrice ? ` <span class="old-price">${formatPrice(priceData.oldPrice)}</span>` : ""
  }`;
  detailCategory.textContent = product.category;
  detailTagText.textContent = product.tag || "";
  detailDescription.textContent = product.description;
  detailMainImage.src = product.image;
  detailMainImage.alt = product.name;

  const oos = isOutOfStockGlobally(product);
  addToCartBtn.disabled = oos || false;
  addToCartBtn.textContent = oos ? i18n[lang].productOos : i18n[lang].addToCart;

  renderGallery(product.images);
  
  const sizeGroup = document.getElementById("sizeGroup");
  const sizeOptions = document.getElementById("sizeOptions");
  if (sizeGroup && sizeOptions) {
    const sizes = product.sizes && product.sizes.length ? product.sizes.map(s => s.label || s) : [];
    sizeGroup.style.display = sizes.length ? "" : "none";
    if (sizes.length) {
      const labelSize = document.getElementById("labelSize");
      if (labelSize) labelSize.textContent = L.sizeLabel || "Taille";
      renderOptionButtons(sizeOptions, sizes, "size");
    }
  }
  
  if (colorGroup) colorGroup.style.display = product.colors.length ? "" : "none";
  renderOptionButtons(colorOptions, product.colors, "color");

  syncDetailWishBtn();
  loadRelatedProducts(product);
  initRatingSystem(product.id);
}

// --- Rating System ---
function initRatingSystem(productId) {
  const lang = getLang();
  
  // Anti-spam check
  const hasRated = localStorage.getItem(`rated_${productId}`);
  if (hasRated) {
    starRatingInput.style.pointerEvents = "none";
    starRatingInput.style.opacity = "0.6";
    ratingStatusMsg.textContent = lang === "ar" ? "لقد قمت بتقييم هذا المنتج بالفعل" : "Vous avez déjà évalué ce produit.";
  }

  // Load Reviews
  const q = query(collection(db, `products/${productId}/reviews`), orderBy("createdAt", "desc"));
  onSnapshot(q, (snap) => {
    const reviews = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    renderReviews(reviews);
    updateRatingSummary(reviews);
  });

  // Star Hover/Click
  const stars = starRatingInput.querySelectorAll(".star");
  stars.forEach(star => {
    star.addEventListener("mouseover", () => {
      if (localStorage.getItem(`rated_${productId}`)) return;
      const val = parseInt(star.dataset.value);
      stars.forEach(s => {
        s.style.color = parseInt(s.dataset.value) <= val ? "#ffc107" : "#ddd";
      });
    });

    star.addEventListener("mouseout", () => {
      if (localStorage.getItem(`rated_${productId}`)) return;
      stars.forEach(s => {
        s.style.color = parseInt(s.dataset.value) <= pendingRating ? "#ffc107" : "#ddd";
      });
    });

    star.addEventListener("click", () => {
      if (localStorage.getItem(`rated_${productId}`)) return;
      
      const val = parseInt(star.dataset.value);
      pendingRating = val;
      
      // Update UI stars
      stars.forEach(s => {
        s.style.color = parseInt(s.dataset.value) <= val ? "#ffc107" : "#ddd";
      });
      
      if (val <= 2) {
        reviewModal.style.display = "flex";
      } else {
        saveReview(productId, val, "");
      }
    });
  });
}

async function saveReview(productId, rating, comment) {
  try {
    await addDoc(collection(db, `products/${productId}/reviews`), {
      rating,
      comment,
      createdAt: serverTimestamp(),
      approved: false 
    });
    
    localStorage.setItem(`rated_${productId}`, "true");
    reviewModal.style.display = "none";
    starRatingInput.style.pointerEvents = "none";
    starRatingInput.style.opacity = "0.6";
    ratingStatusMsg.textContent = getLang() === "ar" ? "شكرا لتقييمك!" : "Merci pour votre évaluation !";
  } catch (e) {
    console.error(e);
  }
}

function renderReviews(reviews) {
  if (!reviewsList) return;
  const filtered = reviews.filter(r => r.approved && r.comment && r.comment.trim());
  if (filtered.length === 0) {
    reviewsList.innerHTML = `<p style="color:#999; text-align:center; padding:20px;">${getLang() === 'ar' ? 'لا توجد تعليقات بعد' : 'Aucun avis pour le moment.'}</p>`;
    return;
  }
  
  reviewsList.innerHTML = filtered.map(r => `
    <div class="review-item">
      <div class="review-stars">${"★".repeat(r.rating)}${"☆".repeat(5 - r.rating)}</div>
      <p class="review-text">${escapeHtml(r.comment)}</p>
      <small class="review-date">${r.createdAt?.toDate().toLocaleDateString() || ""}</small>
    </div>
  `).join("");
}

function updateRatingSummary(reviews) {
  const approvedReviews = reviews.filter(r => r.approved);
  if (!approvedReviews.length) {
    ratingSummary.style.display = "none";
    return;
  }
  
  const sum = approvedReviews.reduce((acc, r) => acc + r.rating, 0);
  const avg = (sum / approvedReviews.length).toFixed(1);
  
  ratingSummary.style.display = "flex";
  avgStars.innerHTML = `<span style="color:#ffc107">${"★".repeat(Math.round(avg))}</span><span style="color:#ddd">${"☆".repeat(5 - Math.round(avg))}</span>`;
  ratingCount.textContent = `(${approvedReviews.length})`;
}

if (submitReviewBtn) {
  submitReviewBtn.onclick = () => {
    const comment = reviewComment.value.trim();
    if (comment.length < 5) {
      alert(getLang() === "ar" ? "يرجى كتابة سبب" : "Veuillez écrire une raison.");
      return;
    }
    saveReview(currentProduct.id, pendingRating, comment);
  };
}

if (cancelReviewBtn) {
  cancelReviewBtn.onclick = () => {
    reviewModal.style.display = "none";
    reviewComment.value = "";
    // Reset stars
    starRatingInput.querySelectorAll(".star").forEach(s => s.style.color = "#ddd");
  };
}

function renderRelatedProducts(items) {
  if (!relatedProductsContainer || !relatedProductsSection) return;
  relatedProductsContainer.innerHTML = "";
  if (!items.length) {
    relatedProductsSection.style.display = "none";
    return;
  }
  const lang = getLang();
  const titleEl = document.getElementById("relatedProductsTitle");
  if (titleEl) titleEl.textContent = i18n[lang].relatedProducts;
  relatedProductsSection.style.display = "";

  items.forEach((product) => {
    const pd = getPriceData(product);
    const wished = isWished(product.id);
    const card = document.createElement("a");
    card.className = "related-card";
    card.href = `product.html?id=${encodeURIComponent(product.id)}`;
    card.innerHTML = `
      <div class="related-card-img">
        <img src="${escapeHtml(product.image)}" alt="${escapeHtml(product.name)}" loading="lazy" />
        <button class="wish-btn${wished ? " active" : ""}" type="button" data-id="${escapeHtml(product.id)}" aria-label="${i18n[lang].addToWishlist}">${heartSvg()}</button>
      </div>
      <div class="related-card-info">
        <div class="related-card-badge">${escapeHtml(product.category)}</div>
        <div class="related-card-name">${escapeHtml(product.name)}</div>
        <div class="related-card-price">${formatPrice(pd.finalPrice)}</div>
      </div>
    `;
    relatedProductsContainer.appendChild(card);
  });

  // Wish button clicks inside related grid
  relatedProductsContainer.querySelectorAll(".wish-btn").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      const id = btn.dataset.id;
      const product = items.find((p) => p.id === id);
      if (!product) return;
      const pd = getPriceData(product);
      const wished = toggleWish({ ...product, finalPrice: pd.finalPrice });
      btn.classList.toggle("active", wished);
      updateWishlistBadge();
    });
  });
}

async function loadRelatedProducts(product) {
  if (!product) return;
  try {
    // First try same category
    const catQuery = query(
      collection(db, "products"),
      where("category", "==", product.category),
      limit(10)
    );
    const catSnap = await getDocs(catQuery);
    let items = [];
    catSnap.forEach((docSnap) => {
      if (docSnap.id !== product.id) items.push(sanitizeProduct(docSnap.id, docSnap.data()));
    });

    // If not enough, fill with random products from any category
    if (items.length < 4) {
      const allQuery = query(collection(db, "products"), limit(20));
      const allSnap = await getDocs(allQuery);
      const extra = [];
      allSnap.forEach((docSnap) => {
        if (docSnap.id !== product.id && !items.find((i) => i.id === docSnap.id)) {
          extra.push(sanitizeProduct(docSnap.id, docSnap.data()));
        }
      });
      // Shuffle extras for variety
      for (let i = extra.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [extra[i], extra[j]] = [extra[j], extra[i]];
      }
      items = [...items, ...extra].slice(0, 4);
    } else {
      items = items.slice(0, 4);
    }

    renderRelatedProducts(items);
  } catch (error) {
    console.error(error);
    if (relatedProductsSection) relatedProductsSection.style.display = "none";
  }
}


async function loadOneProduct() {
  const lang = getLang();
  if (!productId) {
    document.getElementById("productRoot").prepend(Object.assign(document.createElement("p"), { className: "state-box", textContent: i18n[lang].productNotFound }));
    return;
  }
  
  // Show loader
  const loader = document.createElement('div');
  loader.id = 'productLoader';
  loader.innerHTML = '<div class="spinner"></div>';
  document.body.appendChild(loader);

  try {
    const ref = doc(db, "products", productId);
    const snap = await getDoc(ref);
    if (!snap.exists()) {
      document.getElementById("productRoot").prepend(Object.assign(document.createElement("p"), { className: "state-box", textContent: i18n[lang].productNotFound }));
      return;
    }
    const product = sanitizeProduct(snap.id, snap.data());
    openProductDetails(product);
  } catch (e) {
    console.error(e);
    document.getElementById("productRoot").prepend(Object.assign(document.createElement("p"), { className: "state-box", textContent: i18n[lang].loadError }));
  } finally {
    const l = document.getElementById('productLoader');
    if (l) l.remove();
  }
}

function addProductToCart(product, color, size) {
  const priceData = getPriceData(product);
  const unitPrice = currentPrice || priceData.finalPrice;
  const cart = getCart();
  cart.push({
    cartId: `${Date.now()}_${Math.random().toString(16).slice(2)}`,
    productId: product.id,
    name: product.name,
    image: product.image,
    color: color || "-",
    size: size || "-",

    unitPrice: unitPrice,
    qty: 1
  });
  setCart(cart);
}

addToCartBtn.addEventListener("click", () => {
  const lang = getLang();
  if (!currentProduct) return;

  const needColor = currentProduct.colors.length > 0;
  if (needColor && !selectedColor) {
    selectionError.textContent = i18n[lang].needSelections;
    return;
  }
  if (isOutOfStockGlobally(currentProduct)) {
    selectionError.textContent = i18n[lang].productOos;
    return;
  }

	  addProductToCart(currentProduct, selectedColor, selectedSize);
  selectionError.textContent = "";
  sessionStorage.setItem("gca_open_cart", "1");
  window.location.href = "produits.html";
});

// Detail page wish button
if (detailWishBtn) {
  detailWishBtn.addEventListener("click", () => {
    if (!currentProduct) return;
    const pd = getPriceData(currentProduct);
    const wished = toggleWish({ ...currentProduct, finalPrice: pd.finalPrice });
    detailWishBtn.classList.toggle("active", wished);
    updateWishlistBadge();
  });
}

// Wishlist drawer events
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
    if (currentProduct && btn.dataset.id === currentProduct.id) {
      detailWishBtn && detailWishBtn.classList.remove("active");
    }
    document.querySelectorAll(`.wish-btn[data-id="${btn.dataset.id}"]`).forEach((b) => b.classList.remove("active"));
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

applyI18n();
updateWishlistBadge();
loadOneProduct();
