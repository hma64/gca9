/**
 * cat-navbar.js
 * Populates the dark category navigation bar from Firestore.
 *
 * HOW IT WORKS:
 * 1. Reads the "categories" collection in Firestore.
 *    Each document should have: { name: string, slug?: string, order?: number, image?: string }
 *    If no "categories" collection exists, it falls back to deriving unique
 *    categories from the "products" collection automatically.
 *
 * 2. Renders <a> links inside #catNavbarInner and shows #catNavbar.
 *
 * FIRESTORE STRUCTURE (categories collection):
 *   /categories/{docId}
 *     name:  "Paniers"          ← display name shown in nav
 *     slug:  "paniers"          ← used in URL: produits.html?cat=paniers  (optional, falls back to name)
 *     order: 1                  ← sort order (optional)
 *     image: "https://..."      ← used on the homepage category cards (optional)
 */

import { initializeApp, getApps } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getFirestore, collection, onSnapshot, query, orderBy } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { firebaseConfig } from "./firebase-config.js";

// Reuse existing app instance if already initialized
const app = getApps().length ? getApps()[0] : initializeApp(firebaseConfig);
const db = getFirestore(app);

const catNavbar = document.getElementById("catNavbar");
const catNavbarInner = document.getElementById("catNavbarInner");

if (catNavbar && catNavbarInner) {
  // Try categories collection first
  const catQuery = query(collection(db, "categories"), orderBy("order", "asc"));

  onSnapshot(catQuery, (snap) => {
    if (!snap.empty) {
      buildNav(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    } else {
      // Fallback: derive from products
      onSnapshot(collection(db, "products"), (pSnap) => {
        const cats = new Set();
        pSnap.forEach(d => {
          const cat = d.data().category || d.data().Category;
          if (cat) cats.add(String(cat).trim());
        });
        buildNav([...cats].sort().map(name => ({ name, slug: name })));
      });
    }
  }, () => {
    // categories collection doesn't exist — fallback silently
    onSnapshot(collection(db, "products"), (pSnap) => {
      const cats = new Set();
      pSnap.forEach(d => {
        const cat = d.data().category || d.data().Category;
        if (cat) cats.add(String(cat).trim());
      });
      buildNav([...cats].sort().map(name => ({ name, slug: name })));
    });
  });
}

function buildNav(categories) {
  if (!catNavbar || !catNavbarInner) return;
  // Keep the "Tout voir" link, rebuild the rest
  catNavbarInner.innerHTML = `<a href="produits.html" class="cat-nav-link cat-nav-all">Tout voir</a>`;

  categories.forEach(cat => {
    const slug = cat.slug || cat.name;
    const a = document.createElement("a");
    a.className = "cat-nav-link";
    a.textContent = cat.name;
    a.href = `produits.html?cat=${encodeURIComponent(slug)}`;
    // Mark active based on URL param
    const urlCat = new URLSearchParams(window.location.search).get("cat");
    if (urlCat && (urlCat === slug || urlCat === cat.name)) {
      a.classList.add("active");
      catNavbarInner.querySelector(".cat-nav-all")?.classList.remove("active");
    }
    catNavbarInner.appendChild(a);
  });

  catNavbar.style.display = "block";
}
