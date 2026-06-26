import { initializeApp, getApps } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { 
  getFirestore, collection, onSnapshot, doc, setDoc, deleteDoc, getDoc, query, orderBy, collectionGroup, getDocs
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { firebaseConfig } from "./firebase-config.js";

const app = getApps().length ? getApps()[0] : initializeApp(firebaseConfig);
const db = getFirestore(app);

// --- State ---
let currentTab = 'products';
let products = [];
let categories = [];
let ads = [];
let orders = [];
let reviews = [];
let filteredOrders = [];
let siteConfig = {
  orderEmail: "mouhamedamineyousfi10@gmail.com",
  shippingDt: 7,
  adminPass: "admin123" // Default password
};

// --- DOM Elements ---
const loginOverlay = document.getElementById('loginOverlay');
const adminContent = document.getElementById('adminContent');
const loginBtn = document.getElementById('loginBtn');
const adminPasswordInput = document.getElementById('adminPassword');
const loginError = document.getElementById('loginError');
const togglePassword = document.getElementById('togglePassword');

const navBtns = document.querySelectorAll('.nav-btn[data-tab]');
const tabContents = document.querySelectorAll('.tab-content');
const logoutBtn = document.getElementById('logoutBtn');

const productsList = document.getElementById('productsList');
const categoriesList = document.getElementById('categoriesList');
const adsList = document.getElementById('adsList');
const reviewsListAdmin = document.getElementById('reviewsListAdmin');
const ordersList = document.getElementById('ordersList');
const noOrdersMessage = document.getElementById('noOrdersMessage');

const adminModal = document.getElementById('adminModal');
const orderDetailsModal = document.getElementById('orderDetailsModal');
const closeModals = document.querySelectorAll('.close-modal');
const adminForm = document.getElementById('adminForm');
const modalTitle = document.getElementById('modalTitle');

const configForm = document.getElementById('configForm');
const confOrderEmail = document.getElementById('confOrderEmail');
const confShippingDt = document.getElementById('confShippingDt');
const confAdminPass = document.getElementById('confAdminPass');
const toggleConfPassword = document.getElementById('toggleConfPassword');

const ordersSearchInput = document.getElementById('ordersSearchInput');
const exportOrdersBtn = document.getElementById('exportOrdersBtn');

// --- Authentication ---
async function checkAuth() {
  const savedPass = localStorage.getItem('gca_admin_pass');
  const docSnap = await getDoc(doc(db, "config", "site"));
  
  if (docSnap.exists()) {
    siteConfig = docSnap.data();
  } else {
    // Initialize config if it doesn't exist
    await setDoc(doc(db, "config", "site"), siteConfig);
  }

  if (savedPass === siteConfig.adminPass) {
    showAdmin();
  } else {
    showLogin();
  }
}

function showLogin() {
  loginOverlay.style.display = 'flex';
  adminContent.style.display = 'none';
}

function showAdmin() {
  loginOverlay.style.display = 'none';
  adminContent.style.display = 'block';
  loadData();
  fillConfigForm();
}

loginBtn.addEventListener('click', () => {
  const pass = adminPasswordInput.value;
  if (pass === siteConfig.adminPass) {
    localStorage.setItem('gca_admin_pass', pass);
    showAdmin();
  } else {
    loginError.textContent = "Mot de passe incorrect.";
  }
});

logoutBtn.addEventListener('click', () => {
  localStorage.removeItem('gca_admin_pass');
  location.reload();
});

togglePassword.addEventListener('click', () => {
  const type = adminPasswordInput.type === 'password' ? 'text' : 'password';
  adminPasswordInput.type = type;
  togglePassword.classList.toggle('fa-eye-slash');
});

toggleConfPassword.addEventListener('click', () => {
  const type = confAdminPass.type === 'password' ? 'text' : 'password';
  confAdminPass.type = type;
  toggleConfPassword.classList.toggle('fa-eye-slash');
});

// --- Tab Navigation ---
navBtns.forEach(btn => {
  btn.addEventListener('click', () => {
    const tab = btn.dataset.tab;
    currentTab = tab;
    
    navBtns.forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    
    tabContents.forEach(content => {
      content.classList.remove('active');
      if (content.id === `${tab}Tab`) content.classList.add('active');
    });
  });
});

// --- Data Loading ---
function loadData() {
  // Products
  onSnapshot(collection(db, "products"), (snap) => {
    products = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    renderProducts();
  });

  // Categories
  onSnapshot(collection(db, "categories"), (snap) => {
    categories = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    renderCategories();
  });

  // Ads
  onSnapshot(collection(db, "ad"), (snap) => {
    ads = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    renderAds();
  });

  // Orders
  onSnapshot(collection(db, "orders"), (snap) => {
    orders = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    filteredOrders = [...orders];
    renderOrders();
  });

  // Reviews (using collectionGroup for nested reviews)
  const reviewsQuery = query(collectionGroup(db, "reviews"), orderBy("createdAt", "desc"));
  onSnapshot(reviewsQuery, (snap) => {
    reviews = snap.docs.map(d => ({ 
      id: d.id, 
      path: d.ref.path, 
      ...d.data() 
    }));
    renderReviewsAdmin();
  });
}

// --- Rendering ---
function renderProducts() {
  productsList.innerHTML = products.map(p => `
    <tr>
      <td><img src="${p.image || ''}" class="admin-img-preview"></td>
      <td>${p.name || 'Sans nom'}</td>
      <td>${p.price || 0} DT</td>
      <td>${p.category || '-'}</td>
      <td>${p.tag || ''}</td>
      <td class="action-btns">
        <i class="fas fa-edit btn-edit" onclick="editProduct('${p.id}')"></i>
        <i class="fas fa-trash btn-delete" onclick="deleteItem('products', '${p.id}')"></i>
      </td>
    </tr>
  `).join('');
}

function renderCategories() {
  categoriesList.innerHTML = categories.map(c => `
    <tr>
      <td><img src="${c.image || ''}" class="admin-img-preview"></td>
      <td>${c.name || ''}</td>
      <td>${c.slug || ''}</td>
      <td>${c.order || 0}</td>
      <td class="action-btns">
        <i class="fas fa-edit btn-edit" onclick="editCategory('${c.id}')"></i>
        <i class="fas fa-trash btn-delete" onclick="deleteItem('categories', '${c.id}')"></i>
      </td>
    </tr>
  `).join('');
}

function renderAds() {
  adsList.innerHTML = ads.map(a => `
    <tr>
      <td>${a.text || ''}</td>
      <td>${a.order || 0}</td>
      <td>${a.active !== false ? 'Oui' : 'Non'}</td>
      <td class="action-btns">
        <i class="fas fa-edit btn-edit" onclick="editAd('${a.id}')"></i>
        <i class="fas fa-trash btn-delete" onclick="deleteItem('ad', '${a.id}')"></i>
      </td>
    </tr>
  `).join('');
}

function renderOrders() {
  if (filteredOrders.length === 0) {
    ordersList.innerHTML = '';
    noOrdersMessage.style.display = 'block';
    return;
  }

  noOrdersMessage.style.display = 'none';
  ordersList.innerHTML = filteredOrders.map(o => `
    <tr>
      <td>#${o.id.substring(0, 8).toUpperCase()}</td>
      <td>${o.orderedAt || 'N/A'}</td>
      <td>${o.firstName || ''} ${o.lastName || ''}</td>
      <td>${o.phone || ''}</td>
      <td>${o.governorate || ''}</td>
      <td>${o.total || 0} DT</td>
      <td><span class="order-status completed">Complétée</span></td>
      <td class="action-btns">
        <i class="fas fa-eye btn-view" onclick="viewOrderDetails('${o.id}')"></i>
        <i class="fas fa-trash btn-delete" onclick="deleteItem('orders', '${o.id}')"></i>
      </td>
    </tr>
  `).join('');
}

function renderReviewsAdmin() {
  reviewsListAdmin.innerHTML = reviews.map(r => {
    // Extract product ID from path: products/PRODUCT_ID/reviews/REVIEW_ID
    const parts = r.path.split('/');
    const productId = parts[1];
    const product = products.find(p => p.id === productId);
    
    return `
      <tr>
        <td>${product ? product.name : productId}</td>
        <td><span style="color:#ffc107">${"★".repeat(r.rating)}</span></td>
        <td>${r.comment || '<em style="color:#999">Pas de commentaire</em>'}</td>
        <td>${r.createdAt?.toDate().toLocaleDateString() || ''}</td>
        <td class="action-btns">
          <i class="fas fa-trash btn-delete" onclick="deleteReview('${r.path}')"></i>
        </td>
      </tr>
    `;
  }).join('');
}

window.deleteReview = async (path) => {
  if (confirm("Supprimer cet avis ?")) {
    await deleteDoc(doc(db, path));
  }
};

function fillConfigForm() {
  confOrderEmail.value = siteConfig.orderEmail;
  confShippingDt.value = siteConfig.shippingDt;
  confAdminPass.value = siteConfig.adminPass;
}

configForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const newConfig = {
    orderEmail: confOrderEmail.value,
    shippingDt: Number(confShippingDt.value),
    adminPass: confAdminPass.value
  };
  await setDoc(doc(db, "config", "site"), newConfig);
  siteConfig = newConfig;
  localStorage.setItem('gca_admin_pass', newConfig.adminPass);
  alert("Configuration enregistrée !");
});

// --- Cloudinary Config ---
const CLOUDINARY_URL = "https://api.cloudinary.com/v1_1/dw8eb6jgy/image/upload";
const UPLOAD_PRESET = "gcawebstore";

async function uploadImage(file) {
  const formData = new FormData();
  formData.append("file", file);
  formData.append("upload_preset", UPLOAD_PRESET);

  const res = await fetch(CLOUDINARY_URL, {
    method: "POST",
    body: formData
  });
  const data = await res.json();
  return data.secure_url;
}

// --- CRUD Operations ---
window.deleteItem = async (coll, id) => {
  if (confirm("Êtes-vous sûr de vouloir supprimer cet élément ?")) {
    await deleteDoc(doc(db, coll, id));
  }
};

function setupDropzone(dropzoneId, inputId, previewId, multiple = false) {
  const dropzone = document.getElementById(dropzoneId);
  const input = document.getElementById(inputId);
  const preview = document.getElementById(previewId);
  const spinner = dropzone.querySelector('.upload-spinner');

  dropzone.onclick = () => input.click();

  input.onchange = async () => {
    if (input.files.length > 0) {
      spinner.style.display = 'block';
      try {
        for (const file of input.files) {
          const url = await uploadImage(file);
          if (multiple) {
            addGalleryItem(url);
          } else {
            input.dataset.url = url;
            preview.innerHTML = `<div class="preview-item"><img src="${url}"><span class="remove-img" onclick="this.parentElement.remove(); document.getElementById('${inputId}').dataset.url=''">✕</span></div>`;
          }
        }
      } catch (e) {
        alert("Erreur lors de l'upload");
      }
      spinner.style.display = 'none';
    }
  };
}

function addGalleryItem(url, color = "") {
  const container = document.getElementById('galleryContainer');
  const div = document.createElement('div');
  div.className = 'gallery-item-row';
  div.innerHTML = `
    <img src="${url}">
    <input type="text" placeholder="URL Image" value="${url}" class="gallery-url">
    <input type="text" placeholder="Couleur liée" value="${color}" class="gallery-color">
    <i class="fas fa-trash btn-delete" onclick="this.parentElement.remove()"></i>
  `;
  container.appendChild(div);
}

window.addSizeRow = (label = "", price = "") => {
  const container = document.getElementById('sizesContainer');
  const div = document.createElement('div');
  div.className = 'size-item-row';
  div.style.cssText = 'display:flex;gap:10px;margin-bottom:10px;align-items:center;';
  div.innerHTML = `
    <input type="text" placeholder="Taille (ex: S, M, L)" value="${label}" class="size-label" style="flex:1;padding:8px;border:1px solid #ddd;border-radius:4px;">
    <input type="number" placeholder="Prix (DT)" value="${price}" class="size-price" style="flex:1;padding:8px;border:1px solid #ddd;border-radius:4px;">
    <i class="fas fa-trash btn-delete" onclick="this.parentElement.remove()" style="cursor:pointer;color:#d32f2f;"></i>
  `;
  container.appendChild(div);
};

window.editProduct = (id) => {
  const p = products.find(x => x.id === id) || {};
  modalTitle.textContent = id ? "Modifier le Produit" : "Ajouter un Produit";
  adminForm.innerHTML = `
    <input type="hidden" name="id" value="${id || ''}">
    <div class="form-group">
      <label>Nom du produit</label>
      <input type="text" name="name" value="${p.name || ''}" required>
    </div>
    <div class="form-row">
      <div class="form-group">
        <label>Prix (DT)</label>
        <input type="number" name="price" value="${p.price || 0}" required>
      </div>
      <div class="form-group">
        <label>Catégorie</label>
        <select name="category">
          ${categories.map(c => `<option value="${c.slug || c.name}" ${p.category === (c.slug || c.name) ? 'selected' : ''}>${c.name}</option>`).join('')}
        </select>
      </div>
    </div>
    
    <div class="form-group">
      <label>Image Principale</label>
      <div class="dropzone" id="mainDropzone">
        <i class="fas fa-cloud-upload-alt"></i>
        <p>Glissez ou cliquez pour uploader</p>
        <div class="upload-spinner"><i class="fas fa-spinner"></i></div>
      </div>
      <input type="file" id="mainImageInput" style="display:none" accept="image/*">
      <div id="mainImagePreview" class="image-previews">
        ${p.image ? `<div class="preview-item"><img src="${p.image}"><span class="remove-img" onclick="this.parentElement.remove(); document.getElementById('mainImageInput').dataset.url=''">✕</span></div>` : ''}
      </div>
    </div>

    <div class="form-group">
      <label>Tag (ex: -20%, Nouveauté, Rupture)</label>
      <input type="text" name="tag" value="${p.tag || ''}">
    </div>
    <div class="form-group">
      <label>Description</label>
      <textarea name="description">${p.description || ''}</textarea>
    </div>
    <div class="form-group">
      <label>Couleurs (séparées par des virgules)</label>
      <input type="text" name="colors" value="${(p.colors || []).join(', ')}">
    </div>
    <div class="form-group">
      <label>Tailles et Prix <small style="font-weight:400;color:#999;">(optionnel)</small></label>
      <div id="sizesContainer"></div>
      <button type="button" class="btn-secondary" onclick="addSizeRow()" style="margin-top:10px;padding:8px 16px;background:#f5f5f5;border:1px solid #ddd;border-radius:4px;cursor:pointer;">+ Ajouter une taille</button>
    </div>

    <div class="gallery-management">
      <label>Galerie d'images & Couleurs liées</label>
      <div class="dropzone" id="galleryDropzone">
        <i class="fas fa-images"></i>
        <p>Ajouter des images à la galerie</p>
        <div class="upload-spinner"><i class="fas fa-spinner"></i></div>
      </div>
      <input type="file" id="galleryImageInput" style="display:none" accept="image/*" multiple>
      <div id="galleryContainer"></div>
    </div>

    <button type="submit" class="btn-primary" style="margin-top:20px">Enregistrer</button>
  `;
  
  const mainInput = document.getElementById('mainImageInput');
  if (p.image) mainInput.dataset.url = p.image;
  setupDropzone('mainDropzone', 'mainImageInput', 'mainImagePreview');
  setupDropzone('galleryDropzone', 'galleryImageInput', 'galleryContainer', true);

  // Load existing gallery
  if (p.images && p.images.length) {
    p.images.forEach((img, idx) => {
      const color = (p.colorImages && p.colorImages[img]) || "";
      addGalleryItem(img, color);
    });
  }

  // Load existing sizes
  if (p.sizes && p.sizes.length) {
    p.sizes.forEach(size => {
      const label = size.label || size;
      const price = size.price || 0;
      addSizeRow(label, price);
    });
  }

  adminModal.style.display = 'flex';
};

window.editCategory = (id) => {
  const c = categories.find(x => x.id === id) || {};
  modalTitle.textContent = id ? "Modifier la Catégorie" : "Ajouter une Catégorie";
  adminForm.innerHTML = `
    <input type="hidden" name="id" value="${id || ''}">
    <div class="form-group">
      <label>Nom de la catégorie</label>
      <input type="text" name="name" value="${c.name || ''}" required>
    </div>
    <div class="form-group">
      <label>Slug (URL)</label>
      <input type="text" name="slug" value="${c.slug || ''}" required>
    </div>
    <div class="form-group">
      <label>Image</label>
      <div class="dropzone" id="categoryImageDropzone">
        <i class="fas fa-cloud-upload-alt"></i>
        <p>Glissez ou cliquez pour uploader</p>
        <div class="upload-spinner"><i class="fas fa-spinner"></i></div>
      </div>
      <input type="file" id="categoryImageInput" style="display:none" accept="image/*">
      <div id="categoryImagePreview" class="image-previews">
        ${c.image ? `<div class="preview-item"><img src="${c.image}"><span class="remove-img" onclick="this.parentElement.remove(); document.getElementById('categoryImageInput').dataset.url=''">✕</span></div>` : ''}
      </div>
    </div>
    <div class="form-group">
      <label>Ordre d'affichage</label>
      <input type="number" name="order" value="${c.order || 0}">
    </div>
    <button type="submit" class="btn-primary">Enregistrer</button>
  `;
  
  const categoryImageInput = document.getElementById('categoryImageInput');
  if (c.image) categoryImageInput.dataset.url = c.image;
  setupDropzone('categoryImageDropzone', 'categoryImageInput', 'categoryImagePreview');
  
  adminModal.style.display = 'flex';
};

window.editAd = (id) => {
  const a = ads.find(x => x.id === id) || {};
  modalTitle.textContent = id ? "Modifier la Publicité" : "Ajouter une Publicité";
  adminForm.innerHTML = `
    <input type="hidden" name="id" value="${id || ''}">
    <div class="form-group">
      <label>Texte de la pub</label>
      <input type="text" name="text" value="${a.text || ''}" required>
    </div>
    <div class="form-group">
      <label>Ordre</label>
      <input type="number" name="order" value="${a.order || 0}">
    </div>
    <div class="form-group">
      <label>
        <input type="checkbox" name="active" ${a.active !== false ? 'checked' : ''}> Actif
      </label>
    </div>
    <button type="submit" class="btn-primary">Enregistrer</button>
  `;
  adminModal.style.display = 'flex';
};

window.viewOrderDetails = (id) => {
  const order = orders.find(o => o.id === id);
  if (!order) return;

  const itemsHtml = (order.items || []).map(item => `
    <div class="order-item">
      <img src="${item.image || ''}" alt="${item.name}" class="order-item-image">
      <div class="order-item-details">
        <div class="order-item-name">${item.name}</div>
        <div class="order-item-specs">
          Couleur: ${item.color}
        </div>
        <div class="order-item-price">
          ${item.qty} × ${item.unitPrice} DT = ${item.unitPrice * item.qty} DT
        </div>
      </div>
    </div>
  `).join('');

  const detailsHtml = `
    <div class="order-details">
      <div class="order-header">
        <div class="order-info-group">
          <div class="order-info-label">Numéro de commande</div>
          <div class="order-info-value">#${order.id.substring(0, 8).toUpperCase()}</div>
        </div>
        <div class="order-info-group">
          <div class="order-info-label">Date</div>
          <div class="order-info-value">${order.orderedAt || 'N/A'}</div>
        </div>
        <div class="order-info-group">
          <div class="order-info-label">Client</div>
          <div class="order-info-value">${order.firstName} ${order.lastName}</div>
        </div>
        <div class="order-info-group">
          <div class="order-info-label">Téléphone</div>
          <div class="order-info-value">${order.phone}</div>
        </div>
        <div class="order-info-group">
          <div class="order-info-label">Adresse</div>
          <div class="order-info-value">${order.address}</div>
        </div>
        <div class="order-info-group">
          <div class="order-info-label">Gouvernorat</div>
          <div class="order-info-value">${order.governorate}</div>
        </div>
        ${order.addressExtra ? `
        <div class="order-info-group">
          <div class="order-info-label">Complément d'adresse</div>
          <div class="order-info-value">${order.addressExtra}</div>
        </div>
        ` : ''}
      </div>

      <div class="order-items">
        <div class="order-items-title">Articles commandés</div>
        ${itemsHtml}
      </div>

      <div class="order-totals">
        <div class="order-total-row">
          <span class="order-total-label">Sous-total</span>
          <span class="order-total-value">${order.subtotal || 0} DT</span>
        </div>
        <div class="order-total-row">
          <span class="order-total-label">Livraison</span>
          <span class="order-total-value">${order.shipping || 0} DT</span>
        </div>
        <div class="order-total-row final">
          <span class="order-total-label">TOTAL</span>
          <span class="order-total-value">${order.total || 0} DT</span>
        </div>
      </div>
    </div>
  `;

  document.getElementById('orderDetailsContent').innerHTML = detailsHtml;
  orderDetailsModal.style.display = 'flex';
};

document.getElementById('addProductBtn').onclick = () => editProduct();
document.getElementById('addCategoryBtn').onclick = () => editCategory();
document.getElementById('addAdBtn').onclick = () => editAd();

adminForm.onsubmit = async (e) => {
  e.preventDefault();
  const formData = new FormData(adminForm);
  const id = formData.get('id') || doc(collection(db, "temp")).id;
  const data = {};
  
  let coll = "";
  if (currentTab === 'products') {
    coll = "products";
    data.name = formData.get('name');
    data.price = Number(formData.get('price'));
    data.category = formData.get('category');
    data.image = document.getElementById('mainImageInput').dataset.url || "";
    data.tag = formData.get('tag');
    data.description = formData.get('description');
    data.colors = formData.get('colors').split(',').map(s => s.trim()).filter(Boolean);
    
    // Gallery & Color Mapping
    const galleryRows = document.querySelectorAll('.gallery-item-row');
    data.images = [];
    data.colorImages = {};
    galleryRows.forEach(row => {
      const url = row.querySelector('.gallery-url').value;
      const color = row.querySelector('.gallery-color').value.trim();
      if (url) {
        data.images.push(url);
        if (color) data.colorImages[color] = url;
      }
    });
    if (!data.images.includes(data.image) && data.image) data.images.unshift(data.image);
    
    // Sizes & Prices
    const sizeRows = document.querySelectorAll('.size-item-row');
    data.sizes = [];
    sizeRows.forEach(row => {
      const label = row.querySelector('.size-label').value.trim();
      const price = Number(row.querySelector('.size-price').value) || 0;
      if (label) {
        data.sizes.push({ label, price });
      }
    });
  } else if (currentTab === 'categories') {
    coll = "categories";
    data.name = formData.get('name');
    data.slug = formData.get('slug');
    data.image = document.getElementById('categoryImageInput').dataset.url || "";
    data.order = Number(formData.get('order'));
  } else if (currentTab === 'ads') {
    coll = "ad";
    data.text = formData.get('text');
    data.order = Number(formData.get('order'));
    data.active = adminForm.querySelector('[name="active"]').checked;
  }

  await setDoc(doc(db, coll, id), data);
  adminModal.style.display = 'none';
};

// Close modals
closeModals.forEach(closeBtn => {
  closeBtn.onclick = () => {
    adminModal.style.display = 'none';
    orderDetailsModal.style.display = 'none';
  };
});

window.onclick = (e) => {
  if (e.target === adminModal) adminModal.style.display = 'none';
  if (e.target === orderDetailsModal) orderDetailsModal.style.display = 'none';
};

// Orders search functionality
ordersSearchInput.addEventListener('input', (e) => {
  const searchTerm = e.target.value.toLowerCase();
  filteredOrders = orders.filter(order => {
    const fullName = `${order.firstName || ''} ${order.lastName || ''}`.toLowerCase();
    const orderId = order.id.substring(0, 8).toLowerCase();
    return fullName.includes(searchTerm) || orderId.includes(searchTerm);
  });
  renderOrders();
});

// Export orders to CSV
exportOrdersBtn.addEventListener('click', () => {
  if (filteredOrders.length === 0) {
    alert("Aucune commande à exporter");
    return;
  }

  let csv = "N° Commande,Date,Client,Téléphone,Adresse,Gouvernorat,Articles,Sous-total,Livraison,Total\n";
  
  filteredOrders.forEach(order => {
    const items = (order.items || []).map(i => `${i.name} (${i.qty}x)`).join('; ');
    const row = [
      `#${order.id.substring(0, 8).toUpperCase()}`,
      order.orderedAt || '',
      `${order.firstName} ${order.lastName}`,
      order.phone || '',
      order.address || '',
      order.governorate || '',
      `"${items}"`,
      order.subtotal || 0,
      order.shipping || 0,
      order.total || 0
    ].join(',');
    csv += row + '\n';
  });

  const blob = new Blob([csv], { type: 'text/csv' });
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `commandes_${new Date().toISOString().split('T')[0]}.csv`;
  a.click();
  window.URL.revokeObjectURL(url);
});

checkAuth();
