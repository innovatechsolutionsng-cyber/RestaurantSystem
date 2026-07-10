const API_BASE = window.API_BASE !== undefined ? window.API_BASE : (window.location.hostname === 'localhost' ? 'http://localhost:4000' : '');
let items = [];
let cart = [];
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
}

function removeFromCart(id) {
  cart = cart.filter(product => product.id !== id);
  renderCart();
}

function updateQuantity(id, quantity) {
  const item = cart.find(product => product.id === id);
  if (!item) return;
  item.quantity = Math.max(1, quantity);
  renderCart();
}

function getCartTotal() {
  return cart.reduce((sum, item) => sum + Number(item.price || 0) * item.quantity, 0);
}

function renderCart() {
  if (!cartList || !totalPrice) return;

  cartList.innerHTML = '';
  if (!cart.length) {
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

  const totalItems = cart.reduce((sum, item) => sum + item.quantity, 0);
  const totalText = `${totalItems} item${totalItems === 1 ? '' : 's'}`;
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
          <button class="btn btn-outline-secondary quantity-btn" data-action="decrement" data-id="${item.id}" style="min-width: 32px; width: 32px; height: 32px; padding: 0;">−</button>
          <button class="btn btn-outline-secondary" disabled style="min-width: 36px; width: 36px; height: 32px; padding: 0;">${item.quantity}</button>
          <button class="btn btn-outline-secondary quantity-btn" data-action="increment" data-id="${item.id}" style="min-width: 32px; width: 32px; height: 32px; padding: 0;">+</button>
        </div>
        <div class="fw-semibold text-primary">${formatPrice(Number(item.price || 0) * item.quantity)}</div>
      </div>
    `;
    cartList.appendChild(row);
  });

  cartList.querySelectorAll('.remove-item').forEach(button => {
    button.addEventListener('click', event => removeFromCart(Number(event.currentTarget.dataset.id)));
  });

  cartList.querySelectorAll('.quantity-btn').forEach(button => {
    button.addEventListener('click', event => {
      const id = Number(event.currentTarget.dataset.id);
      const action = event.currentTarget.dataset.action;
      const item = cart.find(product => product.id === id);
      if (!item) return;
      if (action === 'increment') updateQuantity(id, item.quantity + 1);
      if (action === 'decrement') updateQuantity(id, Math.max(1, item.quantity - 1));
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
  renderCart();
});
sendToWhatsAppBtn?.addEventListener('click', () => {
  if (!cart.length) {
    alert('Please add at least one item to your cart.');
    return;
  }
  alert(`Checkout is ready for ${cart.length} item(s).`);
});

loadProducts();
renderCart();
