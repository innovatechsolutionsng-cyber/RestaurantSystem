const API_BASE = window.API_BASE !== undefined ? window.API_BASE : ((window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' || window.location.protocol === 'file:' || window.location.hostname === '') ? 'http://localhost:4000' : '');
let items = [];
let cart = [];
let packs = [];
let editingPackId = null;
let activeCategory = '';

const productContainer = document.getElementById('productContainer');
const searchInput = document.getElementById('searchInput');
const categoryList = document.getElementById('categoryList');
const cartList = document.getElementById('cartList');
const totalPrice = document.getElementById('totalPrice');
const cartCountBadge = document.getElementById('cartCountBadge');
const cartSummaryBadge = document.getElementById('cartSummaryBadge');
const cartInlineBadge = document.getElementById('cartCountBadgeInline');
const clearCartBtn = document.getElementById('clearCartBtn');
const sendToWhatsAppBtn = document.getElementById('sendToWhatsAppBtn');
const loadingText = document.getElementById('loadingText');
const packModal = document.getElementById('packModal');
const packNameInput = document.getElementById('packName');
const packQuantityInput = document.getElementById('packQuantity');
const packQtyDecrement = document.getElementById('packQtyDecrement');
const packQtyIncrement = document.getElementById('packQtyIncrement');
const packItemsContainer = document.getElementById('packItemsContainer');
const packContentAddItem = document.getElementById('packContentAddItem');
const savePackBtn = document.getElementById('savePackBtn');
const whatsappModal = document.getElementById('whatsappModal');

function saveState() {
  try {
    localStorage.setItem('rms_cart', JSON.stringify(cart));
    localStorage.setItem('rms_packs', JSON.stringify(packs));
  } catch (e) {
    console.warn('Unable to persist cart state', e);
  }
}

function loadState() {
  try {
    const storedCart = JSON.parse(localStorage.getItem('rms_cart') || 'null');
    const storedPacks = JSON.parse(localStorage.getItem('rms_packs') || 'null');
    if (Array.isArray(storedCart)) cart = storedCart;
    if (Array.isArray(storedPacks)) packs = storedPacks;
  } catch (e) {
    console.warn('Unable to load saved cart/packs', e);
  }
}
const settingsStorageKey = 'rms_settings';

function getStoredSettings() {
  try {
    return JSON.parse(localStorage.getItem(settingsStorageKey) || '{}');
  } catch {
    return {};
  }
}

function getCurrentCurrencySymbol() {
  return getStoredSettings().financial?.currency === 'USD' ? '$' : '₦';
}

function formatPrice(value) {
  return `${getCurrentCurrencySymbol()}${Number(value || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function getCategoryName(item) {
  return (item.category_name || item.category || 'Uncategorized').trim() || 'Uncategorized';
}

function getStatusClass(status) {
  return {
    Available: 'bg-success',
    'Out of stock': 'bg-danger',
    Discontinued: 'bg-secondary'
  }[status] || 'bg-secondary';
}

function getItemStatus(status, stock) {
  if (String(status).toLowerCase() === 'available' && Number(stock) > 0) return 'Available';
  if (Number(stock) <= 0) return 'Out of stock';
  return status || 'Unavailable';
}

function renderCategories() {
  if (!categoryList) return;

  categoryList.innerHTML = '';
  const allItem = document.createElement('li');
  allItem.className = 'list-group-item list-group-item-action';
  allItem.dataset.cat = '';
  allItem.dataset.sub = '';
  allItem.role = 'button';
  allItem.textContent = 'All Products';
  allItem.addEventListener('click', () => {
    activeCategory = '';
    renderProducts();
    setActiveCategory();
    closeCategorySidebar();
  });
  categoryList.appendChild(allItem);

  const categories = Array.from(new Set(items.map(getCategoryName))).sort();
  categories.forEach(category => {
    const item = document.createElement('li');
    item.className = 'list-group-item list-group-item-action';
    item.dataset.cat = category;
    item.dataset.sub = '';
    item.role = 'button';
    item.textContent = category;
    item.addEventListener('click', () => {
      activeCategory = category;
      renderProducts();
      setActiveCategory();
      closeCategorySidebar();
    });
    categoryList.appendChild(item);
  });

  setActiveCategory();
}

function setActiveCategory() {
  if (!categoryList) return;
  categoryList.querySelectorAll('.list-group-item').forEach(item => {
    const isActive = item.dataset.cat === activeCategory;
    item.classList.toggle('active', isActive);
  });
}

function closeCategorySidebar() {
  const sidebar = document.getElementById('sidebar');
  if (!sidebar) return;
  const instance = bootstrap.Offcanvas.getInstance(sidebar);
  if (instance) {
    instance.hide();
  } else if (window.bootstrap?.Offcanvas) {
    new window.bootstrap.Offcanvas(sidebar).hide();
  }
}

function renderProducts() {
  if (!productContainer) return;

  const query = (searchInput?.value || '').trim().toLowerCase();
  const filteredItems = items.filter(item => {
    const category = getCategoryName(item);
    const matchesCategory = !activeCategory || category === activeCategory;
    const matchesQuery = !query || item.name.toLowerCase().includes(query) || (item.description || '').toLowerCase().includes(query);
    return matchesCategory && matchesQuery;
  });

  if (!filteredItems.length) {
    productContainer.innerHTML = '<div class="col-12"><div class="alert alert-light">No products found for the current search.</div></div>';
    return;
  }

  productContainer.innerHTML = '';
  filteredItems.forEach(item => {
    const col = document.createElement('div');
    col.className = 'col-12 col-md-6 col-lg-4';

    const status = getItemStatus(item.status, item.stock);
    const isOutOfStock = status === 'Out of stock' || status === 'Discontinued';
    const priceLabel = formatPrice(item.price);

    col.innerHTML = `
      <div class="card h-100 product-card ${isOutOfStock ? 'out-of-stock' : ''}">
        <div class="card-body text-start">
          <div class="d-flex justify-content-between align-items-start mb-2">
            <span class="badge bg-light text-dark">${getCategoryName(item)}</span>
            <span class="badge ${getStatusClass(status)} text-white">${status}</span>
          </div>
          <h5 class="card-title">${item.name}</h5>
          <p class="muted-small mb-3">${(item.description || 'Freshly prepared and served hot.').slice(0, 100)}${(item.description || '').length > 100 ? '...' : ''}</p>
          <div class="d-flex justify-content-between align-items-center mt-3">
            <strong class="text-primary">${priceLabel}</strong>
            <div class="d-flex align-items-center gap-2">
              <input type="number" class="form-control form-control-sm qty-input" min="1" max="99" value="1" aria-label="Quantity for ${item.name}" style="width: 70px;">
              <button type="button" class="btn btn-outline-primary btn-sm add-to-cart" data-id="${item.id}" ${isOutOfStock ? 'disabled' : ''}>${isOutOfStock ? 'Unavailable' : 'Add'}</button>
            </div>
          </div>
        </div>
      </div>
    `;

    productContainer.appendChild(col);
  });

  productContainer.querySelectorAll('.add-to-cart').forEach(button => {
    button.addEventListener('click', event => {
      const id = Number(event.currentTarget.dataset.id);
      const item = items.find(product => product.id === id);
      const cardBody = event.currentTarget.closest('.card-body');
      const quantityInput = cardBody?.querySelector('.qty-input');
      const quantity = Number(quantityInput?.value || 1);
      if (item) addToCart(item, quantity);
    });
  });
}

function addToCart(item, quantity = 1) {
  const normalizedQuantity = Math.max(1, Number(quantity) || 1);
  const existing = cart.find(product => product.id === item.id);
  if (existing) {
    existing.quantity += normalizedQuantity;
  } else {
    cart.push({ ...item, quantity: normalizedQuantity });
  }
  renderCart();
  saveState();
}

function addPack(pack) {
  const normalizedQuantity = Math.max(1, Number(pack.quantity) || 1);
  packs.push({
    id: Date.now(),
    name: pack.name || `Pack ${packs.length + 1}`,
    quantity: normalizedQuantity,
    contents: pack.contents.map(content => ({ ...content }))
  });
  renderCart();
  saveState();
}

function removeFromCart(id) {
  cart = cart.filter(product => product.id !== id);
  renderCart();
  saveState();
}

function removePack(id) {
  packs = packs.filter(p => p.id !== id);
  renderCart();
  saveState();
}

function updateQuantity(id, quantity) {
  const item = cart.find(product => product.id === id);
  if (!item) return;
  item.quantity = Math.max(1, quantity);
  renderCart();
  saveState();
}

function updatePackQuantity(id, quantity) {
  const p = packs.find(pk => pk.id === id);
  if (!p) return;
  p.quantity = Math.max(1, quantity);
  renderCart();
  saveState();
}

function getCartTotal() {
  const cartTotal = cart.reduce((sum, item) => sum + Number(item.price || 0) * item.quantity, 0);
  const packTotal = packs.reduce((sum, pack) => {
    const packContentTotal = pack.contents.reduce((contentSum, content) => contentSum + Number(content.price || 0) * content.quantity, 0);
    return sum + packContentTotal * pack.quantity;
  }, 0);
  return cartTotal + packTotal;
}

function renderCart() {
  if (!cartList || !totalPrice) return;

  cartList.innerHTML = '';
  if (!cart.length && !packs.length) {
    cartList.innerHTML = '<li class="list-group-item text-muted">Your cart is empty.</li>';
    totalPrice.textContent = '0';
    if (cartCountBadge) {
      cartCountBadge.textContent = '0 items';
      cartCountBadge.classList.add('hidden');
    }
    if (cartSummaryBadge) {
      cartSummaryBadge.textContent = '0 items';
      cartSummaryBadge.classList.add('hidden');
    }
    if (cartInlineBadge) {
      cartInlineBadge.textContent = '0 items';
    }
    return;
  }

  const totalUnits = cart.reduce((sum, item) => sum + item.quantity, 0) + packs.reduce((s, p) => s + p.quantity, 0);
  const totalText = `${totalUnits} item${totalUnits === 1 ? '' : 's'}`;
  if (cartCountBadge) {
    cartCountBadge.textContent = totalText;
    cartCountBadge.classList.remove('hidden');
  }
  if (cartSummaryBadge) {
    cartSummaryBadge.textContent = totalText;
    cartSummaryBadge.classList.remove('hidden');
  }
  if (cartInlineBadge) {
    cartInlineBadge.textContent = totalText;
  }
  totalPrice.textContent = getCartTotal().toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  // render simple products
  cart.forEach(item => {
    const row = document.createElement('li');
    row.className = 'list-group-item';
    row.innerHTML = `
      <div class="d-flex justify-content-between align-items-start gap-2">
        <div class="flex-grow-1">
          <strong>${item.name}</strong>
          <div class="muted-small mt-1">${formatPrice(item.price)}</div>
        </div>
        <button class="btn btn-sm btn-outline-danger remove-item" data-id="${item.id}" aria-label="Remove ${item.name}" style="min-width: 38px; width: 38px; height: 38px; padding: 0; display: inline-flex; align-items: center; justify-content: center;">
          <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"></path><path d="M10 11v6"></path><path d="M14 11v6"></path><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"></path></svg>
        </button>
      </div>
      <div class="mt-2 d-flex justify-content-between align-items-center">
        <div class="btn-group btn-group-sm" role="group" style="gap: 0.35rem;">
          <button class="btn btn-outline-secondary quantity-btn" data-action="decrement" data-type="product" data-id="${item.id}" style="min-width: 32px; width: 32px; height: 32px; padding: 0;">−</button>
          <button class="btn btn-outline-secondary" disabled style="min-width: 36px; width: 36px; height: 32px; padding: 0;">${item.quantity}</button>
          <button class="btn btn-outline-secondary quantity-btn" data-action="increment" data-type="product" data-id="${item.id}" style="min-width: 32px; width: 32px; height: 32px; padding: 0;">+</button>
        </div>
        <div class="fw-semibold text-primary">${formatPrice(Number(item.price || 0) * item.quantity)}</div>
      </div>
    `;
    cartList.appendChild(row);
  });

  // render packs
  packs.forEach(pack => {
    const row = document.createElement('li');
    row.className = 'list-group-item';
    const packContentHtml = pack.contents.map(c => `<div class="d-flex justify-content-between"><div>${c.name} × ${c.quantity}</div><div class="muted-small">${formatPrice(Number(c.price || 0) * c.quantity)}</div></div>`).join('');
    row.innerHTML = `
      <div class="d-flex justify-content-between align-items-start gap-2">
        <div class="flex-grow-1">
          <strong>${pack.name} <span class="muted-small">(pack)</span></strong>
          <div class="muted-small mt-1">Contains: ${pack.contents.map(c=>c.name).slice(0,3).join(', ')}${pack.contents.length>3? '...':''}</div>
        </div>
        <div style="display:inline-flex; gap:6px; align-items:center;">
          <button class="btn btn-sm btn-outline-secondary edit-pack" data-id="${pack.id}" aria-label="Edit pack ${pack.name}" title="Edit" style="min-width: 38px; width: 38px; height: 38px; padding: 0; display: inline-flex; align-items: center; justify-content: center;">✎</button>
          <button class="btn btn-sm btn-outline-danger remove-pack" data-id="${pack.id}" aria-label="Remove pack ${pack.name}" style="min-width: 38px; width: 38px; height: 38px; padding: 0; display: inline-flex; align-items: center; justify-content: center;">
          <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"></path><path d="M10 11v6"></path><path d="M14 11v6"></path><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"></path></svg>
          </button>
        </div>
      </div>
      <div class="mt-2">
        <div class="mb-2">${packContentHtml}</div>
        <div class="d-flex justify-content-between align-items-center">
          <div class="btn-group btn-group-sm" role="group" style="gap: 0.35rem;">
            <button class="btn btn-outline-secondary quantity-btn" data-action="decrement" data-type="pack" data-id="${pack.id}" style="min-width: 32px; width: 32px; height: 32px; padding: 0;">−</button>
            <button class="btn btn-outline-secondary" disabled style="min-width: 36px; width: 36px; height: 32px; padding: 0;">${pack.quantity}</button>
            <button class="btn btn-outline-secondary quantity-btn" data-action="increment" data-type="pack" data-id="${pack.id}" style="min-width: 32px; width: 32px; height: 32px; padding: 0;">+</button>
          </div>
          <div class="fw-semibold text-primary">${formatPrice(pack.contents.reduce((s,c)=>s + Number(c.price||0) * c.quantity, 0) * pack.quantity)}</div>
        </div>
      </div>
    `;
    cartList.appendChild(row);
  });

  cartList.querySelectorAll('.remove-item').forEach(button => {
    button.addEventListener('click', event => removeFromCart(Number(event.currentTarget.dataset.id)));
  });

  cartList.querySelectorAll('.remove-pack').forEach(button => {
    button.addEventListener('click', event => removePack(Number(event.currentTarget.dataset.id)));
  });

  cartList.querySelectorAll('.edit-pack').forEach(button => {
    button.addEventListener('click', event => {
      const id = Number(event.currentTarget.dataset.id);
      openPackModalForEdit(id);
    });
  });

  cartList.querySelectorAll('.quantity-btn').forEach(button => {
    button.addEventListener('click', event => {
      const id = Number(event.currentTarget.dataset.id);
      const action = event.currentTarget.dataset.action;
      const type = event.currentTarget.dataset.type || 'product';
      if (type === 'product') {
        const item = cart.find(product => product.id === id);
        if (!item) return;
        if (action === 'increment') updateQuantity(id, item.quantity + 1);
        if (action === 'decrement') updateQuantity(id, Math.max(1, item.quantity - 1));
      } else if (type === 'pack') {
        const p = packs.find(pk => pk.id === id);
        if (!p) return;
        if (action === 'increment') updatePackQuantity(id, p.quantity + 1);
        if (action === 'decrement') updatePackQuantity(id, Math.max(1, p.quantity - 1));
      }
    });
  });
}

async function loadProducts() {
  if (!productContainer) return;
  if (loadingText) loadingText.textContent = 'Loading products...';

  try {
    const response = await fetch(`${API_BASE}/api/public/products`);
    if (!response.ok) {
      throw new Error('Unable to fetch products');
    }
    const data = await response.json();
    items = Array.isArray(data.products) ? data.products : [];
    renderCategories();
    renderProducts();
  } catch (error) {
    console.error(error);
    if (productContainer) {
      productContainer.innerHTML = '<div class="col-12"><div class="alert alert-danger">Unable to load menu items right now.</div></div>';
    }
  }
}

searchInput?.addEventListener('input', renderProducts);
clearCartBtn?.addEventListener('click', () => {
  cart = [];
  packs = [];
  renderCart();
});

sendToWhatsAppBtn?.addEventListener('click', () => {
  if (!cart.length && !packs.length) {
    alert('Please add at least one item or pack to your cart.');
    return;
  }
  // show whatsapp modal to collect details
  if (typeof bootstrap !== 'undefined' && whatsappModal) {
    const bs = new bootstrap.Modal(whatsappModal);
    // show/hide fields based on choice default
    document.getElementById('eatInFields').style.display = 'none';
    document.getElementById('takeOutFields').style.display = 'block';
    document.getElementById('diningOption').value = 'takeout';
    bs.show();
  } else {
    alert('Checkout ready.');
  }
});

// build message and send to WhatsApp
const confirmSendBtn = document.getElementById('confirmSendBtn');
confirmSendBtn?.addEventListener('click', () => {
  const name = (document.getElementById('customerName')?.value || '').trim();
  const phone = (document.getElementById('customerPhone')?.value || '').trim();
  const address = (document.getElementById('customerAddress')?.value || '').trim();
  const dining = (document.getElementById('diningOption')?.value || 'takeout');

  let lines = [];
  lines.push('New order from Restaurant Management System');
  if (name) lines.push(`Name: ${name}`);
  if (phone) lines.push(`Phone: ${phone}`);
  if (address) lines.push(`Address: ${address}`);
  lines.push(`Dining option: ${dining}`);
  lines.push('--- Order items ---');

  cart.forEach(it => {
    lines.push(`${it.name} x ${it.quantity} — ${formatPrice(Number(it.price || 0) * it.quantity)}`);
  });

  packs.forEach(p => {
    lines.push(`${p.name} x ${p.quantity} (pack)`);
    p.contents.forEach(c => {
      lines.push(`  - ${c.name} x ${c.quantity} — ${formatPrice(Number(c.price || 0) * c.quantity)}`);
    });
  });

  lines.push('---');
  lines.push(`Total: ${formatPrice(getCartTotal())}`);

  const msg = lines.join('\n');
  const url = `https://wa.me/?text=${encodeURIComponent(msg)}`;
  window.open(url, '_blank');
  // close modal
  const bs = bootstrap.Modal.getInstance(whatsappModal);
  if (bs) bs.hide();
});

loadProducts();
// load persisted cart/packs before initial render
loadState();
renderCart();

// Pack modal behavior
function createPackItemRow(selected = null) {
  const id = Date.now() + Math.floor(Math.random() * 1000);
  const el = document.createElement('div');
  el.className = 'list-group-item d-flex gap-2 align-items-center';
  el.dataset.rowId = id;
  el.innerHTML = `
    <select class="form-select form-select-sm pack-item-select" aria-label="Select product">
      <option value="">Select item...</option>
      ${items.map(it => `<option value="${it.id}" data-price="${it.price}">${it.name} (${formatPrice(it.price)})</option>`).join('')}
    </select>
    <input type="number" class="form-control form-control-sm pack-item-qty" min="1" value="1" style="width:90px;">
    <button type="button" class="btn btn-sm btn-outline-danger pack-item-remove">✕</button>
  `;
  if (selected) {
    const sel = el.querySelector('.pack-item-select');
    sel.value = selected.id;
    el.querySelector('.pack-item-qty').value = selected.quantity || 1;
  }
  el.querySelector('.pack-item-remove').addEventListener('click', () => el.remove());
  return el;
}

packContentAddItem?.addEventListener('click', () => {
  packItemsContainer.appendChild(createPackItemRow());
});

packQtyDecrement?.addEventListener('click', () => {
  packQuantityInput.value = Math.max(1, Number(packQuantityInput.value || 1) - 1);
});
packQtyIncrement?.addEventListener('click', () => {
  packQuantityInput.value = Math.max(1, Number(packQuantityInput.value || 1) + 1);
});

savePackBtn?.addEventListener('click', () => {
  const name = (packNameInput.value || '').trim();
  const quantity = Math.max(1, Number(packQuantityInput.value || 1));
  const rows = Array.from(packItemsContainer.querySelectorAll('.list-group-item'));
  const contents = [];
  for (const r of rows) {
    const select = r.querySelector('.pack-item-select');
    const qty = Number(r.querySelector('.pack-item-qty')?.value || 1);
    if (!select || !select.value) continue;
    const product = items.find(it => String(it.id) === String(select.value));
    if (!product) continue;
    contents.push({ id: product.id, name: product.name, price: product.price, quantity: Math.max(1, qty) });
  }
  if (!contents.length) {
    alert('Please add at least one item to the pack.');
    return;
  }

  if (editingPackId) {
    const idx = packs.findIndex(p => p.id === editingPackId);
    if (idx !== -1) {
      packs[idx] = { id: editingPackId, name: name || packs[idx].name, quantity, contents };
    }
    showPackModalMessage('Pack updated successfully.');
    renderCart();
    saveState();
    window.setTimeout(() => {
      const bs = bootstrap.Modal.getInstance(packModal);
      if (bs) bs.hide();
      setPackModalDefaults();
      editingPackId = null;
      packNameInput.value = '';
      packQuantityInput.value = 1;
      packItemsContainer.innerHTML = '';
    }, 900);
    return;
  }

  addPack({ name, quantity, contents });

  // reset modal for new pack
  packNameInput.value = '';
  packQuantityInput.value = 1;
  packItemsContainer.innerHTML = '';
  const bs = bootstrap.Modal.getInstance(packModal);
  if (bs) bs.hide();
});

// open pack modal: ensure items are loaded
document.querySelectorAll('[data-bs-target="#packModal"]').forEach(btn => {
  btn.addEventListener('click', () => {
    editingPackId = null;
    setPackModalEditingState(false);
    packItemsContainer.innerHTML = '';
    packItemsContainer.appendChild(createPackItemRow());
  });
});

function setPackModalEditingState(isEditing) {
  const title = document.querySelector('#packModal .modal-title');
  const saveBtn = savePackBtn;
  if (title) title.textContent = isEditing ? '✏️ Edit food pack' : '📦 Build a food pack';
  if (saveBtn) saveBtn.textContent = isEditing ? 'Save pack' : 'Add pack to cart';
  hidePackModalMessage();
}

function showPackModalMessage(message) {
  const messageEl = document.getElementById('packModalMessage');
  if (!messageEl) return;
  messageEl.textContent = message;
  messageEl.style.display = 'block';
}

function hidePackModalMessage() {
  const messageEl = document.getElementById('packModalMessage');
  if (!messageEl) return;
  messageEl.style.display = 'none';
  messageEl.textContent = '';
}

function setPackModalDefaults() {
  setPackModalEditingState(false);
  hidePackModalMessage();
}

function openPackModalForEdit(packId) {
  const pack = packs.find(p => p.id === packId);
  if (!pack) return;
  editingPackId = packId;
  packNameInput.value = pack.name || '';
  packQuantityInput.value = pack.quantity || 1;
  packItemsContainer.innerHTML = '';
  for (const c of pack.contents) {
    packItemsContainer.appendChild(createPackItemRow({ id: c.id, quantity: c.quantity }));
    const last = packItemsContainer.lastElementChild;
    const sel = last.querySelector('.pack-item-select');
    if (sel) sel.value = String(c.id);
  }
  setPackModalEditingState(true);
  const bs = new bootstrap.Modal(packModal);
  bs.show();
}
