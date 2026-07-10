const API_BASE = window.API_BASE !== undefined ? window.API_BASE : ((window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' || window.location.protocol === 'file:' || window.location.hostname === '') ? 'http://localhost:4000' : '');

const salesValue = document.getElementById("salesValue");
const pendingOrdersValue = document.getElementById("pendingOrdersValue");
const completedOrdersValue = document.getElementById("completedOrdersValue");
const ordersBody = document.getElementById("ordersBody");
const reportSalesValue = document.getElementById("reportSalesValue");
const reportPendingOrdersValue = document.getElementById("reportPendingOrdersValue");
const reportCompletedOrdersValue = document.getElementById("reportCompletedOrdersValue");
const reportOrdersBody = document.getElementById("reportOrdersBody");
const quickNewSaleBtn = document.getElementById('quickNewSale');
const quickViewOrdersBtn = document.getElementById('quickViewOrders');
const quickViewReportBtn = document.getElementById('quickViewReport');
const settingsButton = document.getElementById('settingsButton');
const logoutButton = document.getElementById("logoutButton");
const dashboardSidebar = document.getElementById("dashboardSidebar");
const mobileMenuToggle = document.getElementById("mobileMenuToggle");
const navItems = Array.from(document.querySelectorAll(".sidebar-nav .nav-item"));
const topbarTitle = document.getElementById("topbarTitle");

const settingsStorageKey = 'rms_settings';
function getStoredSettings() { try { return JSON.parse(localStorage.getItem(settingsStorageKey) || '{}'); } catch { return {}; } }
function getCurrentCurrencySymbol() { const currency = getStoredSettings().financial?.currency || 'NGN'; return currency === 'USD' ? '$' : '₦'; }
function formatCurrency(amount) { const symbol = getCurrentCurrencySymbol(); return `${symbol}${Number(amount || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`; }

function parseOrderPayments(payments) {
  if (!payments) return [];
  let parsed = payments;
  if (typeof payments === 'string') {
    try { parsed = JSON.parse(payments); } catch (err) { return []; }
  }
  if (typeof parsed !== 'object' || parsed === null) return [];
  return Object.entries(parsed)
    .filter(([, amount]) => Number(amount) > 0)
    .map(([method]) => method);
}

const token = localStorage.getItem("rms_token");
if (!token) { window.location.href = "../../login.html"; }
if (window.auth && typeof window.auth.initAuth === 'function') window.auth.initAuth();

async function loadCashierDashboard() {
  try {
    const response = await fetch(`${API_BASE}/api/cashier/dashboard`, { headers: { Authorization: `Bearer ${token}` } });
    if (!response.ok) throw new Error("Unable to load dashboard data.");
    const data = await response.json();
    salesValue.textContent = formatCurrency(data.summary.sales || 0);
    pendingOrdersValue.textContent = data.summary.pending_orders || 0;
    completedOrdersValue.textContent = data.summary.completed_orders || 0;
    if (reportSalesValue) reportSalesValue.textContent = formatCurrency(data.summary.sales || 0);
    if (reportPendingOrdersValue) reportPendingOrdersValue.textContent = data.summary.pending_orders || 0;
    if (reportCompletedOrdersValue) reportCompletedOrdersValue.textContent = data.summary.completed_orders || 0;

    if (ordersBody) {
      ordersBody.innerHTML = "";
    }
    if (reportOrdersBody) {
      reportOrdersBody.innerHTML = "";
    }

    (data.orders || []).forEach(order => {
      const orderPayments = parseOrderPayments(order.payments);
      const paymentMethodDisplay = orderPayments.length ? orderPayments.join(', ') : '-';
      const row = document.createElement("tr");
      row.innerHTML = `
        <td>${new Date(order.created_at).toLocaleString()}</td>
        <td>${order.id}</td>
        <td>${order.items_count || 0}</td>
        <td>${formatCurrency(order.total_amount)}</td>
        <td>${paymentMethodDisplay}</td>
        <td><span class="status-badge ${order.status.toLowerCase()}">${order.status}</span></td>
      `;
      if (ordersBody) ordersBody.appendChild(row);
      if (reportOrdersBody) reportOrdersBody.appendChild(row.cloneNode(true));
    });
  } catch (err) {
    console.error(err);
    window.location.href = "../../login.html";
  }
}

function setActivePanel(panelName) {
  const selectedPanel = panelName || 'dashboard';
  navItems.forEach(item => item.classList.toggle('active', item.dataset.panel === selectedPanel));
  const panels = document.querySelectorAll('.panel');
  panels.forEach(panel => panel.classList.toggle('active', panel.dataset.panel === selectedPanel));
  if (topbarTitle) {
    const selectedItem = navItems.find(item => item.dataset.panel === selectedPanel);
    topbarTitle.textContent = selectedItem ? selectedItem.querySelector('.nav-text').textContent : 'Dashboard';
  }
  if (selectedPanel === 'pos') loadPosProducts();
  if (selectedPanel === 'sales') loadCashierSales();
  if (selectedPanel === 'dashboard' || selectedPanel === 'report') loadCashierDashboard();
}

async function loadCashierSales() {
  if (!salesCards) return;

  try {
    const response = await fetch(`${API_BASE}/api/cashier/dashboard`, { headers: { Authorization: `Bearer ${token}` } });
    if (!response.ok) throw new Error('Unable to load sales data.');

    const data = await response.json();
    const orders = data.orders || [];
    salesCards.innerHTML = '';

    if (orders.length === 0) {
      salesCards.innerHTML = `<div class="panel-card"><p class="panel-card-note">No recent sales available.</p></div>`;
      return;
    }

    orders.forEach(order => {
      const paymentMethods = parseOrderPayments(order.payments).join(', ') || 'N/A';
      const card = document.createElement('article');
      card.className = 'sales-card panel-card';
      card.innerHTML = `
        <div class="sales-card-header">
          <div>
            <p class="sales-card-meta">Order ID ${order.id}</p>
            <p class="sales-card-time">${new Date(order.created_at).toLocaleString()}</p>
          </div>
          <span class="status-badge ${order.status}">${order.status}</span>
        </div>
        <div class="sales-card-body">
          <p><strong>Total:</strong> ${formatCurrency(order.total_amount)}</p>
          <p><strong>Items:</strong> ${order.items_count || 0}</p>
          <p><strong>Payment:</strong> ${paymentMethods}</p>
          <p><strong>Breakdown:</strong> ${formatCurrency(order.total_amount)} total</p>
        </div>
      `;
      card.addEventListener('click', () => fetchOrderDetails(order.id));
      salesCards.appendChild(card);
    });
  } catch (error) {
    console.error(error);
    salesCards.innerHTML = `<div class="panel-card"><p class="panel-card-note">Unable to load sales.</p></div>`;
  }
}

async function fetchOrderDetails(orderId) {
  try {
    const response = await fetch(`${API_BASE}/api/cashier/orders/${orderId}`, { headers: { Authorization: `Bearer ${token}` } });
    if (!response.ok) throw new Error('Unable to load order details.');
    const data = await response.json();
    openOrderDetailsModal(data.order || data);
  } catch (error) {
    console.error(error);
    showToast('Unable to load order details.', 'error');
  }
}

function openOrderDetailsModal(order) {
  if (!orderDetailsModalBody) return;
  const paymentMethods = parseOrderPayments(order.payments);
  const paymentDisplay = paymentMethods.length ? paymentMethods.join(', ') : 'N/A';
  const items = order.items || [];
  const currency = getCurrentCurrencySymbol();

  const itemRows = items.map(item => {
    const lineTotal = item.price * item.quantity;
    return `<tr><td>${item.name}</td><td>${item.quantity}</td><td>${currency}${item.price.toFixed(2)}</td><td>${currency}${lineTotal.toFixed(2)}</td></tr>`;
  }).join('');

  orderDetailsModalBody.innerHTML = `
    <div class="receipt-preview">
      <div class="receipt-header">
        <p><strong>Order ID:</strong> ${order.id}</p>
        <p><strong>Date:</strong> ${new Date(order.created_at).toLocaleString()}</p>
        <p><strong>Status:</strong> ${order.status}</p>
      </div>
      <div class="receipt-details">
        <p><strong>Items Count:</strong> ${order.items_count || items.length}</p>
        <p><strong>Payment Method:</strong> ${paymentDisplay}</p>
      </div>
      <div class="receipt-details">
        <p><strong>Subtotal:</strong> ${formatCurrency(order.subtotal || 0)}</p>
        <p><strong>Tax:</strong> ${formatCurrency(order.tax || 0)}</p>
        <p><strong>Discount:</strong> ${formatCurrency(order.discount || 0)}</p>
        <p><strong>Total:</strong> ${formatCurrency(order.total_amount || order.total || 0)}</p>
      </div>
      <table>
        <thead>
          <tr><th>Item</th><th>Qty</th><th>Price</th><th>Total</th></tr>
        </thead>
        <tbody>${itemRows}</tbody>
      </table>
    </div>`;

  openModal(orderDetailsModal);
}

function closeMobileMenu() { if (!dashboardSidebar) return; dashboardSidebar.classList.remove('mobile-open'); document.body.classList.remove('mobile-menu-open'); }
function openMobileMenu() { if (!dashboardSidebar) return; dashboardSidebar.classList.add('mobile-open'); document.body.classList.add('mobile-menu-open'); }
if (mobileMenuToggle) mobileMenuToggle.addEventListener('click', () => { if (!dashboardSidebar) return; dashboardSidebar.classList.toggle('mobile-open'); document.body.classList.toggle('mobile-menu-open'); });
navItems.forEach(item => item.addEventListener('click', () => { setActivePanel(item.dataset.panel); if (window.innerWidth <= 900) closeMobileMenu(); }));

// POS elements
const posProductSearch = document.getElementById('posProductSearch');
const posCategoryFilter = document.getElementById('posCategoryFilter');
const posProductGrid = document.getElementById('posProductGrid');
const posCartItems = document.getElementById('posCartItems');
const posCartTotal = document.getElementById('posCartTotal');
const posCartCount = document.getElementById('posCartCount');
const posSubtotalAmount = document.getElementById('posSubtotalAmount');
const posTaxAmount = document.getElementById('posTaxAmount');
const posDiscountAmount = document.getElementById('posDiscountAmount');
const posTotalAmount = document.getElementById('posTotalAmount');
const posCheckoutBtn = document.getElementById('posCheckoutBtn');
const posPrevPageBtn = document.getElementById('posPrevPageBtn');
const posNextPageBtn = document.getElementById('posNextPageBtn');
const posPageInfo = document.getElementById('posPageInfo');
const posPaymentMethods = document.getElementById('posPaymentMethods');
const posDueAmount = document.getElementById('posDueAmount');
const posPaidAmount = document.getElementById('posPaidAmount');
const posRemainingAmount = document.getElementById('posRemainingAmount');
const posMethodSelector = document.getElementById('posMethodSelector');
const posPaymentInput = document.getElementById('posPaymentInput');
const posSelectedMethodLabel = document.getElementById('posSelectedMethodLabel');
const posPaymentAmount = document.getElementById('posPaymentAmount');
const posAddMethodBtn = document.getElementById('posAddMethodBtn');
const posClearMethodBtn = document.getElementById('posClearMethodBtn');
const posAvailableMethods = document.getElementById('posAvailableMethods');
const posPaymentFlow = document.getElementById('posPaymentFlow');
const confirmModal = document.getElementById('confirmModal');
const confirmModalTitle = document.getElementById('confirmModalTitle');
const confirmModalText = document.getElementById('confirmModalText');
const confirmModalConfirm = document.getElementById('confirmModalConfirm');
const settingsModal = document.getElementById('settingsModal');
const cashierBusinessName = document.getElementById('cashierBusinessName');
const cashierBusinessAddress = document.getElementById('cashierBusinessAddress');
const cashierBusinessPhone = document.getElementById('cashierBusinessPhone');
const cashierBusinessEmail = document.getElementById('cashierBusinessEmail');
const cashierReceiptFooter = document.getElementById('cashierReceiptFooter');
const saveCashierSettingsBtn = document.getElementById('saveCashierSettingsBtn');
const receiptModal = document.getElementById('receiptModal');
const receiptModalBody = document.getElementById('receiptModalBody');
const printReceiptBtn = document.getElementById('printReceiptBtn');
const closeReceiptBtn = document.getElementById('closeReceiptBtn');
const salesCards = document.getElementById('salesCards');
const orderDetailsModal = document.getElementById('orderDetailsModal');
const orderDetailsModalBody = document.getElementById('orderDetailsModalBody');
const closeOrderDetailsBtn = document.getElementById('closeOrderDetailsBtn');

let posProducts = [];
let currentReceiptData = null;
const posCart = [];
let cachedCategories = [];
let posCurrentPage = 1;
const posPageSize = 20;
const paymentAmounts = {}; // Track {method: amount}
let currentPaymentMethod = null; // Currently selecting payment for this method

function showToast(message, type = 'success') {
  let toast = document.getElementById('toastContainer');
  if (!toast) {
    toast = document.createElement('div');
    toast.id = 'toastContainer';
    toast.className = 'toast-container';
    document.body.appendChild(toast);
  }

  const toastEl = document.createElement('div');
  toastEl.className = `toast toast-${type}`;
  toastEl.textContent = message;
  toast.appendChild(toastEl);

  setTimeout(() => toastEl.classList.add('show'), 10);
  setTimeout(() => {
    toastEl.classList.remove('show');
    setTimeout(() => toastEl.remove(), 300);
  }, 3000);
}

function getPosSettings() {
  const settings = getStoredSettings();
  const taxRate = parseFloat(String(settings.financial?.taxRate || '0')) || 0;
  const discountRate = parseFloat(String(settings.financial?.defaultDiscount || '0')) || 0;
  return { taxRate, discountRate };
}

function getBusinessSettings() {
  const settings = getStoredSettings();
  return settings.business || {};
}

function loadCashierBusinessSettings() {
  const business = getBusinessSettings();
  if (cashierBusinessName) cashierBusinessName.value = business.businessName || '';
  if (cashierBusinessAddress) cashierBusinessAddress.value = business.businessAddress || '';
  if (cashierBusinessPhone) cashierBusinessPhone.value = business.businessPhone || '';
  if (cashierBusinessEmail) cashierBusinessEmail.value = business.businessEmail || '';
  if (cashierReceiptFooter) cashierReceiptFooter.value = business.receiptFooter || 'Thank you for shopping with us. Visit again!';
}

function saveCashierBusinessSettings() {
  const settings = getStoredSettings();
  settings.business = {
    businessName: cashierBusinessName?.value || '',
    businessAddress: cashierBusinessAddress?.value || '',
    businessPhone: cashierBusinessPhone?.value || '',
    businessEmail: cashierBusinessEmail?.value || '',
    receiptFooter: cashierReceiptFooter?.value || 'Thank you for shopping with us. Visit again!',
  };
  localStorage.setItem(settingsStorageKey, JSON.stringify(settings));
  showToast('Business settings saved successfully.');
  closeModal(settingsModal);
}

function openModal(modal) {
  if (!modal) return;
  modal.classList.add('active');
  modal.setAttribute('aria-hidden', 'false');
}

function closeModal(modal) {
  if (!modal) return;
  modal.classList.remove('active');
  modal.setAttribute('aria-hidden', 'true');
}

function openConfirmModal({ title = 'Confirm', message = 'Are you sure you want to proceed?', confirmText = 'Confirm', onConfirm }) {
  if (!confirmModal || !confirmModalTitle || !confirmModalText || !confirmModalConfirm) return;
  confirmModalTitle.textContent = title;
  confirmModalText.textContent = message;
  confirmModalConfirm.textContent = confirmText;
  confirmModalConfirm.onclick = () => {
    if (typeof onConfirm === 'function') onConfirm();
    closeModal(confirmModal);
  };
  openModal(confirmModal);
}

function openSettingsModal() {
  loadCashierBusinessSettings();
  openModal(settingsModal);
}

function filterPosProducts() {
  const q = posProductSearch?.value.toLowerCase().trim() || '';
  const cat = posCategoryFilter?.value || 'all';
  return posProducts.filter(p => {
    const matchesQ = !q || p.name.toLowerCase().includes(q) || (p.category_name || '').toLowerCase().includes(q);
    const matchesCat = cat === 'all' || String(p.category_id) === String(cat);
    return matchesQ && matchesCat;
  });
}
function getPosPageProducts() { const filtered = filterPosProducts(); const start = (posCurrentPage - 1) * posPageSize; return filtered.slice(start, start + posPageSize); }
function getPosPageCount() { const filtered = filterPosProducts(); return Math.max(1, Math.ceil(filtered.length / posPageSize)); }

function renderPosProducts() {
  const pageCount = getPosPageCount();
  if (posCurrentPage > pageCount) posCurrentPage = pageCount;
  const products = getPosPageProducts();
  if (!posProductGrid) return;
  posProductGrid.innerHTML = '';
  if (products.length === 0) {
    posProductGrid.innerHTML = `<div class="panel-card"><p class="panel-card-note">No available products match your search.</p></div>`;
    if (posPageInfo) posPageInfo.textContent = `Page ${posCurrentPage} of ${pageCount}`;
    if (posPrevPageBtn) posPrevPageBtn.disabled = posCurrentPage <= 1;
    if (posNextPageBtn) posNextPageBtn.disabled = posCurrentPage >= pageCount;
    return;
  }
  products.forEach(product => {
    const card = document.createElement('article');
    card.className = 'pos-product-card';
    card.innerHTML = `
      <h4>${product.name}</h4>
      <div class="product-meta">
        <span>${product.category_name || 'Uncategorized'}</span>
        <span>Stock: ${product.stock}</span>
      </div>
      <div class="product-meta">
        <span>${formatCurrency(product.price)}</span>
        <span class="badge ${product.stock > 0 ? 'available' : 'out-of-stock'}">${product.status}</span>
      </div>
      <button type="button" ${product.stock <= 0 ? 'disabled' : ''}>Add to cart</button>
    `;
    card.querySelector('button')?.addEventListener('click', () => addPosProductToCart(product));
    posProductGrid.appendChild(card);
  });
  if (posPageInfo) posPageInfo.textContent = `Page ${posCurrentPage} of ${pageCount}`;
  if (posPrevPageBtn) posPrevPageBtn.disabled = posCurrentPage <= 1;
  if (posNextPageBtn) posNextPageBtn.disabled = posCurrentPage >= pageCount;
}

function renderPaymentMethods() {
  const methods = [
    { id: 'Cash', label: 'Cash', icon: '💵' },
    { id: 'Transfer', label: 'Transfer', icon: '🔁' },
    { id: 'Card', label: 'Card', icon: '💳' },
    { id: 'Delivery', label: 'Delivery', icon: '📦' },
  ];

  const paidTotal = Object.values(paymentAmounts).reduce((s, v) => s + v, 0);
  const remainingAmount = Math.max(0, getCartSummary().total - paidTotal);
  const hasPayments = Object.keys(paymentAmounts).length > 0;

  posAvailableMethods.innerHTML = '';
  methods.forEach(m => {
    const btn = document.createElement('button');
    btn.className = 'pos-method-btn';
    if (currentPaymentMethod === m.id) btn.classList.add('active');
    btn.type = 'button';
    btn.dataset.method = m.id;
    const paidAmount = paymentAmounts[m.id] || 0;
    btn.innerHTML = `<span class="pos-method-icon">${m.icon}</span><span>${m.label}${paidAmount > 0 ? ` • ${formatCurrency(paidAmount)}` : ''}</span>`;
    if (paidAmount > 0) btn.classList.add('selected');

    btn.addEventListener('click', () => selectPaymentMethod(m.id));
    posAvailableMethods.appendChild(btn);
  });

  const label = posMethodSelector.querySelector('.pos-method-label');
  const helper = document.getElementById('posMethodHelper');
  if (label) {
    label.textContent = remainingAmount <= 0
      ? 'Total payment recorded.'
      : 'Select a payment method:';
  }
  if (helper) {
    helper.textContent = remainingAmount <= 0
      ? 'Order is fully paid.'
      : hasPayments
        ? 'Click another method to change selection or adjust amounts.'
        : 'Click a method to start payment.';
  }
}

function handleMethodClick(methodId) {
  selectPaymentMethod(methodId);
}

function handleMethodDoubleClick(methodId) {
  selectPaymentMethod(methodId);
}

function selectPaymentMethod(methodId) {
  currentPaymentMethod = methodId;
  const currentMethodAmount = paymentAmounts[methodId] || 0;
  const totalPaid = Object.values(paymentAmounts).reduce((s, v) => s + v, 0);
  const remainingAmount = Math.max(0, getCartSummary().total - (totalPaid - currentMethodAmount));

  posMethodSelector.style.display = 'grid';
  posPaymentInput.style.display = 'grid';

  const methodName = { 'Cash': 'Cash', 'Transfer': 'Transfer', 'Card': 'Card', 'Delivery': 'Delivery' }[methodId];
  posSelectedMethodLabel.textContent = `Amount for ${methodName}`;
  posPaymentAmount.value = currentMethodAmount > 0 ? currentMethodAmount.toFixed(2) : remainingAmount.toFixed(2);
  posPaymentAmount.focus();
  renderPaymentMethods();
}

function saveCurrentPaymentSelection() {
  if (!currentPaymentMethod) return true;

  const amount = parseFloat(posPaymentAmount.value) || 0;
  const currentMethodAmount = paymentAmounts[currentPaymentMethod] || 0;
  const paidWithoutCurrentMethod = Object.values(paymentAmounts).reduce((s, v) => s + v, 0) - currentMethodAmount;
  const maxAmount = Math.max(0, getCartSummary().total - paidWithoutCurrentMethod);

  if (amount <= 0) {
    showToast('Please enter a valid payment amount.', 'error');
    return false;
  }

  if (amount > maxAmount) {
    showToast('Entered amount cannot exceed remaining balance.', 'error');
    return false;
  }

  paymentAmounts[currentPaymentMethod] = amount;
  currentPaymentMethod = null;
  posPaymentAmount.value = '';
  posPaymentInput.style.display = 'none';
  posMethodSelector.style.display = 'grid';
  updatePaymentSummary();
  renderPaymentMethods();
  return true;
}

function addMethodToPayment() {
  if (!currentPaymentMethod) return;
  saveCurrentPaymentSelection();
}

function clearCurrentMethod() {
  currentPaymentMethod = null;
  posPaymentAmount.value = '';
  posPaymentInput.style.display = 'none';
  posMethodSelector.style.display = 'grid';
  renderPaymentMethods();
}

function handleCheckout() {
  // guard: don't process if checkout already in progress
  if (posCheckoutBtn && posCheckoutBtn.disabled) return;
  if (posCart.length === 0) { showToast('Please add at least one product to the cart before checkout.', 'error'); return; }

  const isEditingAmount = posPaymentInput.style.display !== 'none';
  if (currentPaymentMethod && isEditingAmount && !saveCurrentPaymentSelection()) {
    return;
  }

  const summary = getCartSummary();
  const paid = Object.values(paymentAmounts).reduce((s, v) => s + v, 0);

  if (paid === 0) {
    showToast('Please select a payment method and enter an amount before checkout.', 'error');
    return;
  }

  if (Math.abs(paid - summary.total) > 0.01) {
    showToast(`Payment total (${formatCurrency(paid)}) does not match order total (${formatCurrency(summary.total)}).`, 'error');
    return;
  }

  const orderPayload = {
    items: posCart.map(item => ({ id: item.id, name: item.name, quantity: item.quantity, price: item.price })),
    subtotal: summary.subtotal,
    tax: summary.tax,
    discount: summary.discount,
    total: summary.total,
    payments: paymentAmounts,
  };

  if (posCheckoutBtn) {
    posCheckoutBtn.disabled = true;
    posCheckoutBtn.classList.add('button-loading');
  }

  saveOrder(orderPayload)
    .then(orderResponse => {
      const receiptData = {
        orderId: orderResponse.orderId,
        createdAt: orderResponse.created_at,
        items: orderPayload.items,
        subtotal: orderPayload.subtotal,
        tax: orderPayload.tax,
        discount: orderPayload.discount,
        total: orderPayload.total,
        payments: paymentAmounts,
        business: getBusinessSettings(),
      };
      openReceiptModal(receiptData);
      showToast('Checkout complete. Receipt preview is ready.');
      posCart.length = 0;
      renderCartItems();
      Object.keys(paymentAmounts).forEach(k => delete paymentAmounts[k]);
      clearCurrentMethod();
      renderPaymentMethods();
      updateCartSummary();
    })
    .catch(error => {
      console.error(error);
      showToast('Unable to save order. Please try again.', 'error');
    })
    .finally(() => {
      if (posCheckoutBtn) {
        posCheckoutBtn.disabled = false;
        posCheckoutBtn.classList.remove('button-loading');
      }
    });
}

async function saveOrder(payload) {
  const response = await fetch(`${API_BASE}/api/cashier/orders`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.message || 'Unable to save order.');
  }

  return await response.json();
}

function openReceiptModal(data) {
  currentReceiptData = data;
  renderReceiptPreview(data);
  openModal(receiptModal);
}

function renderReceiptPreview(data) {
  if (!receiptModalBody) return;
  const currency = getCurrentCurrencySymbol();
  const businessName = data.business.businessName || 'Business Name';
  const businessAddress = data.business.businessAddress || '';
  const businessPhone = data.business.businessPhone ? `Phone: ${data.business.businessPhone}` : '';
  const businessEmail = data.business.businessEmail ? `Email: ${data.business.businessEmail}` : '';
  const receiptFooter = data.business.receiptFooter || 'Thank you for shopping with us. Visit again!';

  const itemRows = data.items.map(item => {
    const lineTotal = item.price * item.quantity;
    return `<tr><td>${item.name}</td><td>${item.quantity} x ${currency}${item.price.toFixed(2)}</td><td>${currency}${lineTotal.toFixed(2)}</td></tr>`;
  }).join('');

  const paymentRows = Object.entries(data.payments).map(([method, amount]) => `<tr><td>${method}</td><td></td><td>${currency}${amount.toFixed(2)}</td></tr>`).join('');

  receiptModalBody.innerHTML = `
    <div class="receipt-preview">
      <div class="receipt-header">
        <h3>${businessName}</h3>
        <p>${businessAddress}</p>
        <p>${businessPhone}</p>
        <p>${businessEmail}</p>
      </div>
      <div class="receipt-details">
        <p><strong>Order #:</strong> ${data.orderId}</p>
        <p><strong>Date:</strong> ${new Date(data.createdAt).toLocaleString()}</p>
      </div>
      <table>
        <thead>
          <tr><th style="text-align:left">Item</th><th style="text-align:right">Qty / Price</th><th style="text-align:right">Total</th></tr>
        </thead>
        <tbody>${itemRows}</tbody>
      </table>
      <table>
        <tr><td>Subtotal</td><td></td><td>${currency}${data.subtotal.toFixed(2)}</td></tr>
        <tr><td>Tax</td><td></td><td>${currency}${data.tax.toFixed(2)}</td></tr>
        <tr><td>Discount</td><td></td><td>${currency}${data.discount.toFixed(2)}</td></tr>
        <tr class="total-row"><td><strong>Total</strong></td><td></td><td><strong>${currency}${data.total.toFixed(2)}</strong></td></tr>
      </table>
      <table>
        <thead>
          <tr><th style="text-align:left">Payment</th><th></th><th style="text-align:right">Amount</th></tr>
        </thead>
        <tbody>${paymentRows}</tbody>
      </table>
      <div class="footer"><p>${receiptFooter}</p></div>
    </div>`;
}

function printReceiptFromModal() {
  if (!currentReceiptData) return;
  const data = currentReceiptData;
  const currency = getCurrentCurrencySymbol();
  const businessName = data.business.businessName || 'Business Name';
  const businessAddress = data.business.businessAddress || '';
  const businessPhone = data.business.businessPhone ? `Phone: ${data.business.businessPhone}` : '';
  const businessEmail = data.business.businessEmail ? `Email: ${data.business.businessEmail}` : '';
  const receiptFooter = data.business.receiptFooter || 'Thank you for shopping with us. Visit again!';

  const itemRows = data.items.map(item => {
    const lineTotal = item.price * item.quantity;
    return `<tr><td>${item.name}</td><td>${item.quantity} x ${currency}${item.price.toFixed(2)}</td><td>${currency}${lineTotal.toFixed(2)}</td></tr>`;
  }).join('');

  const paymentRows = Object.entries(data.payments).map(([method, amount]) => `<tr><td>${method}</td><td></td><td>${currency}${amount.toFixed(2)}</td></tr>`).join('');

  const printWindow = window.open('', '_blank');
  if (!printWindow) {
    showToast('Unable to open receipt print window.', 'error');
    return;
  }

  printWindow.document.write(`<!DOCTYPE html><html><head><title>Receipt</title><style>
      body { font-family: Arial, sans-serif; margin: 0; padding: 0; background: #fff; }
      @page { size: 80mm auto; margin: 4mm; }
      .receipt { width: 80mm; max-width: 80mm; padding: 12px; box-sizing: border-box; }
      .receipt h1, .receipt h2, .receipt h3, .receipt p { margin: 0; }
      .receipt h1 { font-size: 18px; text-align: center; margin-bottom: 6px; }
      .receipt p { font-size: 11px; line-height: 1.5; text-align: center; }
      .receipt .section { margin: 10px 0; }
      .receipt table { width: 100%; border-collapse: collapse; font-size: 11px; }
      .receipt td { padding: 3px 0; }
      .receipt .total-row td { font-weight: bold; }
      .receipt .footer { margin-top: 10px; font-size: 11px; text-align: center; }
      .receipt .footer p { margin-bottom: 4px; }
      @media print { body { margin: 0; } .receipt { box-shadow: none; } }
    </style></head><body>
    <div class="receipt">
      <h1>${businessName}</h1>
      <p>${businessAddress}</p>
      <p>${businessPhone}</p>
      <p>${businessEmail}</p>
      <div class="section">
        <p>Order #: ${data.orderId}</p>
        <p>Date: ${new Date(data.createdAt).toLocaleString()}</p>
      </div>
      <table>
        ${itemRows}
      </table>
      <div class="section">
        <table>
          <tr><td>Subtotal</td><td></td><td>${currency}${data.subtotal.toFixed(2)}</td></tr>
          <tr><td>Tax</td><td></td><td>${currency}${data.tax.toFixed(2)}</td></tr>
          <tr><td>Discount</td><td></td><td>${currency}${data.discount.toFixed(2)}</td></tr>
          <tr class="total-row"><td>Total</td><td></td><td>${currency}${data.total.toFixed(2)}</td></tr>
        </table>
      </div>
      <div class="section">
        <table>
          ${paymentRows}
        </table>
      </div>
      <div class="footer">
        <p>${receiptFooter}</p>
      </div>
    </div>
  </body></html>`);

  printWindow.document.close();
  printWindow.focus();
  printWindow.print();
}

function updatePaymentSummary() {
  const summary = getCartSummary();
  const due = summary.total;
  const paid = Object.values(paymentAmounts).reduce((s, v) => s + v, 0);
  const remaining = Math.max(0, due - paid);
  if (posDueAmount) posDueAmount.textContent = formatCurrency(due);
  if (posPaidAmount) posPaidAmount.textContent = formatCurrency(paid);
  if (posRemainingAmount) posRemainingAmount.textContent = formatCurrency(remaining);
}

function renderPosCategories() {
  if (!posCategoryFilter) return;
  posCategoryFilter.innerHTML = `<option value="all">All categories</option>`;
  cachedCategories.forEach(c => { const option = document.createElement('option'); option.value = c.id; option.textContent = c.name; posCategoryFilter.appendChild(option); });
}

function getCartSummary() {
  const subtotal = posCart.reduce((s, it) => s + it.price * it.quantity, 0);
  const { taxRate, discountRate } = getPosSettings();
  const tax = subtotal * (taxRate / 100);
  const discount = subtotal * (discountRate / 100);
  const total = subtotal + tax - discount;
  return { subtotal, tax, discount, total };
}

function updateCartSummary() {
  const summary = getCartSummary();
  if (posSubtotalAmount) posSubtotalAmount.textContent = formatCurrency(summary.subtotal);
  if (posTaxAmount) posTaxAmount.textContent = formatCurrency(summary.tax);
  if (posDiscountAmount) posDiscountAmount.textContent = formatCurrency(summary.discount);
  if (posTotalAmount) posTotalAmount.textContent = formatCurrency(summary.total);
  if (posCartTotal) posCartTotal.textContent = formatCurrency(summary.total);
  if (posCartCount) posCartCount.textContent = String(posCart.reduce((s, it) => s + it.quantity, 0));
  updatePaymentSummary();
  renderPaymentMethods();
}

function renderCartItems() {
  if (!posCartItems) return; posCartItems.innerHTML = '';
  if (posCart.length === 0) { posCartItems.innerHTML = `<p class="panel-card-note">No products added yet.</p>`; updateCartSummary(); return; }
  posCart.forEach((item, index) => {
    const row = document.createElement('div');
    row.className = 'pos-cart-item';
    row.innerHTML = `
      <div class="pos-cart-item-details">
        <strong>${item.name}</strong>
        <div class="pos-cart-item-qty">
          <button type="button" data-action="decrease">-</button>
          <span>${item.quantity}</span>
          <button type="button" data-action="increase">+</button>
        </div>
      </div>
      <div>
        <button type="button" class="remove-cart-item" aria-label="Remove ${item.name}">&times;</button>
        <p>${formatCurrency(item.price * item.quantity)}</p>
      </div>
    `;
    row.querySelector('[data-action="decrease"]').addEventListener('click', () => { changeCartQuantity(index, -1); updateCartSummary(); });
    row.querySelector('[data-action="increase"]').addEventListener('click', () => { changeCartQuantity(index, 1); updateCartSummary(); });
    row.querySelector('.remove-cart-item').addEventListener('click', () => { removeCartItem(index); updateCartSummary(); });
    posCartItems.appendChild(row);
  });
  updateCartSummary();
}

function changeCartQuantity(index, delta) {
  const item = posCart[index]; if (!item) return; item.quantity += delta; if (item.quantity <= 0) posCart.splice(index, 1); renderCartItems();
}
function removeCartItem(index) { posCart.splice(index, 1); renderCartItems(); }
function addPosProductToCart(product) { const existing = posCart.find(i => i.id === product.id); if (existing) existing.quantity += 1; else posCart.push({ ...product, quantity: 1 }); renderCartItems(); updateCartSummary(); }

async function loadPosProducts() {
  try {
    const response = await fetch(`${API_BASE}/api/inventory/products`, { headers: { Authorization: `Bearer ${token}` } });
    if (!response.ok) throw new Error('Unable to load available products.');
    const data = await response.json();
    posProducts = (data.products || []).map(p => ({ ...p, price: Number(p.price) || 0, stock: Number(p.stock) || 0 }));
    cachedCategories = Array.from(new Map(posProducts.map(p => [p.category_id, { id: p.category_id, name: p.category_name }])).values());
    renderPosCategories(); posCurrentPage = 1; renderPosProducts(); renderPaymentMethods();
  } catch (err) { console.error(err); if (posProductGrid) posProductGrid.innerHTML = `<div class="panel-card"><p class="panel-card-note">${err.message}</p></div>`; }
}

if (posProductSearch) posProductSearch.addEventListener('input', () => { renderPosProducts(); });
if (posCategoryFilter) posCategoryFilter.addEventListener('change', () => { renderPosProducts(); });
if (posPrevPageBtn) posPrevPageBtn.addEventListener('click', () => { if (posCurrentPage > 1) { posCurrentPage -= 1; renderPosProducts(); } });
if (posNextPageBtn) posNextPageBtn.addEventListener('click', () => { const pageCount = getPosPageCount(); if (posCurrentPage < pageCount) { posCurrentPage += 1; renderPosProducts(); } });
if (posAddMethodBtn) posAddMethodBtn.addEventListener('click', addMethodToPayment);
if (posClearMethodBtn) posClearMethodBtn.addEventListener('click', clearCurrentMethod);
if (posCheckoutBtn) posCheckoutBtn.addEventListener('click', handleCheckout);
settingsButton?.addEventListener('click', openSettingsModal);

if (confirmModal) {
  confirmModal.querySelectorAll('.modal-close').forEach(btn => btn.addEventListener('click', () => closeModal(confirmModal)));
  document.getElementById('confirmModalCancel')?.addEventListener('click', () => closeModal(confirmModal));
}
if (settingsModal) {
  settingsModal.querySelectorAll('.modal-close').forEach(btn => btn.addEventListener('click', () => closeModal(settingsModal)));
}
if (receiptModal) {
  receiptModal.querySelectorAll('.modal-close').forEach(btn => btn.addEventListener('click', () => closeModal(receiptModal)));
}
if (orderDetailsModal) {
  orderDetailsModal.querySelectorAll('.modal-close').forEach(btn => btn.addEventListener('click', () => closeModal(orderDetailsModal)));
  closeOrderDetailsBtn?.addEventListener('click', () => closeModal(orderDetailsModal));
}

quickNewSaleBtn?.addEventListener('click', () => setActivePanel('pos'));
quickViewOrdersBtn?.addEventListener('click', () => setActivePanel('dashboard'));
quickViewReportBtn?.addEventListener('click', () => setActivePanel('report'));

saveCashierSettingsBtn?.addEventListener('click', saveCashierBusinessSettings);
printReceiptBtn?.addEventListener('click', printReceiptFromModal);
closeReceiptBtn?.addEventListener('click', () => closeModal(receiptModal));

setActivePanel('dashboard');
logoutButton.addEventListener("click", () => {
  openConfirmModal({
    title: 'Log out',
    message: 'Are you sure you want to log out?',
    confirmText: 'Log out',
    onConfirm: () => { localStorage.removeItem("rms_token"); window.location.href = "../../login.html"; }
  });
});
loadCashierDashboard();
loadCashierBusinessSettings();
