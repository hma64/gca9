/**
 * marquee-ad.js
 * Loads scrolling ad texts from the Firestore "ad" collection.
 *
 * FIRESTORE STRUCTURE  /ad/{docId}
 *   text   : "🚚 Livraison rapide 24–48h partout en Tunisie"
 *   order  : 1   (optional, controls display order)
 *   active : true (optional; if false the message is hidden)
 *
 * The bar is hidden until at least one ad is found.
 */

import { initializeApp, getApps } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getFirestore, collection, onSnapshot, query, orderBy } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { firebaseConfig } from "./firebase-config.js";

const app = getApps().length ? getApps()[0] : initializeApp(firebaseConfig);
const db  = getFirestore(app);

const bar   = document.getElementById("marqueeBar");
const track = document.getElementById("marqueeTrack");

if (bar && track) {
  const q = query(collection(db, "ad"), orderBy("order", "asc"));

  onSnapshot(q, snap => {
    const items = [];
    snap.forEach(d => {
      const data = d.data();
      // skip inactive entries
      if (data.active === false) return;
      items.push(data.text || "");
    });
    renderMarquee(items.filter(Boolean));
  }, () => {
    // orderBy fails if no index — retry without ordering
    onSnapshot(collection(db, "ad"), snap => {
      const items = [];
      snap.forEach(d => {
        const data = d.data();
        if (data.active === false) return;
        items.push(data.text || "");
      });
      renderMarquee(items.filter(Boolean));
    });
  });
}

function renderMarquee(texts) {
  if (!bar || !track || !texts.length) return;

  const SEP = "  ·  ";
  const single = texts.join(SEP);
  // Repeat enough times so scrolling is seamless
  const repeated = (single + SEP).repeat(6);

  track.textContent = "";
  const span = document.createElement("span");
  span.textContent = repeated;
  track.appendChild(span);

  bar.style.display = "block";
}
