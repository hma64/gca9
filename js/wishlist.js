const WISH_KEY = "gca_stymode_wishlist";

export function getWishlist() {
  try {
    const raw = localStorage.getItem(WISH_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveWishlist(items) {
  localStorage.setItem(WISH_KEY, JSON.stringify(items));
}

export function isWished(productId) {
  return getWishlist().some((item) => item.id === productId);
}

export function toggleWish(product) {
  const list = getWishlist();
  const idx = list.findIndex((item) => item.id === product.id);
  if (idx === -1) {
    list.push({
      id: product.id,
      name: product.name,
      image: product.image,
      price: product.price,
      finalPrice: product.finalPrice ?? product.price,
      category: product.category
    });
  } else {
    list.splice(idx, 1);
  }
  saveWishlist(list);
  return idx === -1; // true = now wished, false = removed
}

export function removeFromWishlist(productId) {
  const list = getWishlist().filter((item) => item.id !== productId);
  saveWishlist(list);
}

export function wishCount() {
  return getWishlist().length;
}
