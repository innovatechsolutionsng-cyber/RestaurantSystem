const API_BASE = window.API_BASE !== undefined ? window.API_BASE : ((window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' || window.location.protocol === 'file:' || window.location.hostname === '') ? 'http://localhost:4000' : '');

const token = localStorage.getItem('rms_token');
if (!token) {
  window.location.href = '/login.html';
}

const assignedCount = document.getElementById('assignedCount');
const inTransitCount = document.getElementById('inTransitCount');
const completedCount = document.getElementById('completedCount');
const deliveryTodayCount = document.getElementById('deliveryTodayCount');
const deliveryRevenueValue = document.getElementById('deliveryRevenueValue');
const deliveryCompletedSalesValue = document.getElementById('deliveryCompletedSalesValue');
const reportCompletedValue = document.getElementById('reportCompletedValue');
const reportInTransitValue = document.getElementById('reportInTransitValue');
const reportPendingValue = document.getElementById('reportPendingValue');
const deliveryOrdersList = document.getElementById('deliveryOrdersList');
const paymentModal = document.getElementById('paymentModal');
const paymentMethodSelect = document.getElementById('paymentMethodSelect');
const confirmPaymentBtn = document.getElementById('confirmPaymentBtn');
const topbarTitle = document.getElementById('topbarTitle');
const navItems = Array.from(document.querySelectorAll('.nav-item'));
const panels = Array.from(document.querySelectorAll('.panel'));
const sidebar = document.getElementById('dashboardSidebar');
const mobileMenuToggle = document.getElementById('mobileMenuToggle');
const logoutButton = document.getElementById('logoutIconButton');

if (window.auth && typeof window.auth.initAuth === 'function') {
  window.auth.initAuth();
}

function setActivePanel(panelName) {
  const safePanel = panelName || 'dashboard';
  panels.forEach(panel => {
    panel.classList.toggle('active', panel.dataset.panel === safePanel);
  });
  navItems.forEach(button => {
    button.classList.toggle('active', button.dataset.panel === safePanel);
  });
  if (topbarTitle) {
    const labels = { dashboard: 'Dashboard', orders: 'Orders', sales: 'Sales', report: 'Report' };
    topbarTitle.textContent = labels[safePanel] || 'Dashboard';
  }
  if (sidebar) {
    sidebar.classList.remove('mobile-open');
  }
}

navItems.forEach(button => {
  button.addEventListener('click', () => setActivePanel(button.dataset.panel));
});

mobileMenuToggle?.addEventListener('click', () => {
  sidebar?.classList.toggle('mobile-open');
});

logoutButton?.addEventListener('click', () => {
  if (window.auth && typeof window.auth.clearToken === 'function') {
    window.auth.clearToken();
  } else {
    localStorage.removeItem('rms_token');
  }
  window.location.href = '/login.html';
});

function formatCurrency(amount) {
  const symbol = '₦';
  return `${symbol}${Number(amount || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function showToast(message, type = 'success') {
  let toastContainer = document.getElementById('toastContainer');
  if (!toastContainer) {
    toastContainer = document.createElement('div');
    toastContainer.id = 'toastContainer';
    toastContainer.style.position = 'fixed';
    toastContainer.style.top = '1rem';
    toastContainer.style.right = '1rem';
    toastContainer.style.zIndex = '1100';
    toastContainer.style.display = 'grid';
    toastContainer.style.gap = '0.5rem';
    document.body.appendChild(toastContainer);
  }

  const toast = document.createElement('div');
  toast.textContent = message;
  toast.style.minWidth = '220px';
  toast.style.padding = '0.85rem 1rem';
  toast.style.borderRadius = '0.85rem';
  toast.style.boxShadow = '0 16px 30px rgba(15,23,42,0.12)';
  toast.style.color = '#fff';
  toast.style.opacity = '0';
  toast.style.transform = 'translateY(-10px)';
  toast.style.transition = 'opacity 200ms ease, transform 200ms ease';
  toast.style.background = type === 'error' ? '#dc2626' : '#2563eb';

  toastContainer.appendChild(toast);
  requestAnimationFrame(() => {
    toast.style.opacity = '1';
    toast.style.transform = 'translateY(0)';
  });
  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateY(-10px)';
    setTimeout(() => toast.remove(), 250);
  }, 3000);
}

function renderOrders(orders) {
  if (!deliveryOrdersList) return;
  if (!Array.isArray(orders) || !orders.length) {
    deliveryOrdersList.innerHTML = '<div class="panel-card"><p class="delivery-empty-state">No delivery orders available yet.</p></div>';
    return;
  }

  const latestOrder = (() => {
    try {
      return JSON.parse(localStorage.getItem('rms_latest_delivery_order') || 'null');
    } catch {
      return null;
    }
  })();

  const combinedOrders = latestOrder && !orders.some(order => Number(order.id) === Number(latestOrder.id))
    ? [latestOrder, ...orders]
    : orders;

  deliveryOrdersList.innerHTML = combinedOrders.map(order => {
    const breakdown = Array.isArray(order.breakdown) && order.breakdown.length
      ? order.breakdown.map(item => `
          <li>
            <span>${item.name}</span>
            <span>x${item.quantity || 1}</span>
          </li>
        `).join('')
      : '<li class="delivery-empty-state">No item breakdown available.</li>';

    return `
      <article class="panel-card delivery-order-card">
        <div class="delivery-order-header">
          <div>
            <p class="section-subtitle">Order #${order.id || '—'}</p>
            <h3>${order.customerName || 'Customer'}</h3>
          </div>
          <span class="delivery-order-status">${order.status || 'Pending'}</span>
        </div>
        <div class="delivery-order-details">
          <p><strong>Phone:</strong> ${order.customerPhone || '—'}</p>
          <p><strong>Address:</strong> ${order.address || 'Pending address'}</p>
          <p><strong>ETA:</strong> ${order.eta || 'Pending'}</p>
        </div>
        <div class="d-flex justify-content-between gap-2" style="flex-wrap:wrap; margin-top:0.75rem;">
          <button type="button" class="btn btn-sm btn-outline-danger cancel-order-btn" data-id="${order.id}">Cancel</button>
          <button type="button" class="btn btn-sm btn-primary process-payment-btn" data-id="${order.id}">Process payment</button>
        </div>
        <div class="delivery-order-breakdown" style="margin-top:1rem;">
          <h4>Order breakdown</h4>
          <ul>${breakdown}</ul>
        </div>
      </article>
    `;
  }).join('');
}

function formatStatusLabel(status) {
  const normalized = String(status || '').toLowerCase();
  const statusMap = {
    pending: '<span class="badge bg-warning text-dark">Pending</span>',
    completed: '<span class="badge bg-success">Completed</span>',
    cancelled: '<span class="badge bg-danger">Cancelled</span>',
  };
  return statusMap[normalized] || `<span class="badge bg-secondary">${status || 'Unknown'}</span>`;
}

let deliveryOrders = [];
let activePaymentOrderId = null;

function openPaymentModal(orderId) {
  activePaymentOrderId = orderId;
  if (paymentMethodSelect) paymentMethodSelect.value = '';
  if (typeof bootstrap !== 'undefined' && paymentModal) {
    const instance = bootstrap.Modal.getOrCreateInstance(paymentModal);
    instance.show();
  } else if (paymentModal) {
    paymentModal.style.display = 'block';
  }
}

function closePaymentModal() {
  if (typeof bootstrap !== 'undefined' && paymentModal) {
    const instance = bootstrap.Modal.getInstance(paymentModal);
    if (instance) instance.hide();
  } else if (paymentModal) {
    paymentModal.style.display = 'none';
  }
}

async function cancelDeliveryOrder(orderId) {
  try {
    const response = await fetch(`${API_BASE}/api/delivery/orders/${orderId}/cancel`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    });
    if (!response.ok) {
      const error = await response.json().catch(() => null);
      throw new Error(error?.message || 'Unable to cancel order.');
    }
    showToast(`Order #${orderId} cancelled.`);
    await loadDeliveryDashboard();
  } catch (error) {
    console.error(error);
    showToast(error.message || 'Unable to cancel order.', 'error');
  }
}

async function processDeliveryPayment(orderId, method) {
  try {
    const response = await fetch(`${API_BASE}/api/delivery/orders/${orderId}/payment`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ method }),
    });
    if (!response.ok) {
      const error = await response.json().catch(() => null);
      throw new Error(error?.message || 'Unable to process payment.');
    }
    showToast(`Payment completed for order #${orderId}.`);
    closePaymentModal();
    await loadDeliveryDashboard();
  } catch (error) {
    console.error(error);
    showToast(error.message || 'Unable to complete payment.', 'error');
  }
}

if (confirmPaymentBtn) {
  confirmPaymentBtn.addEventListener('click', () => {
    const method = paymentMethodSelect?.value || '';
    if (!method) {
      alert('Please select a payment method.');
      return;
    }
    if (activePaymentOrderId) {
      processDeliveryPayment(activePaymentOrderId, method);
    }
  });
}

function attachOrderActionHandlers() {
  if (deliveryOrdersList) {
    deliveryOrdersList.querySelectorAll('.cancel-order-btn').forEach(button => {
      button.addEventListener('click', event => {
        const id = Number(event.currentTarget.dataset.id);
        if (id) cancelDeliveryOrder(id);
      });
    });
    deliveryOrdersList.querySelectorAll('.process-payment-btn').forEach(button => {
      button.addEventListener('click', event => {
        const id = Number(event.currentTarget.dataset.id);
        if (id) openPaymentModal(id);
      });
    });
  }
}

async function loadDeliveryDashboard() {
  try {
    const response = await fetch(`${API_BASE}/api/delivery/dashboard`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(error.message || 'Unable to load delivery dashboard.');
    }

    const data = await response.json();
    const summary = data.summary || {};
    const orders = Array.isArray(data.orders) ? data.orders : [];

    if (assignedCount) assignedCount.textContent = summary.assigned || 0;
    if (inTransitCount) inTransitCount.textContent = summary.inTransit || 0;
    if (completedCount) completedCount.textContent = summary.completed || 0;
    if (deliveryTodayCount) deliveryTodayCount.textContent = Number(summary.assigned || 0) + Number(summary.inTransit || 0) + Number(summary.completed || 0);
    if (deliveryRevenueValue) deliveryRevenueValue.textContent = formatCurrency(summary.revenue || 0);
    if (deliveryCompletedSalesValue) deliveryCompletedSalesValue.textContent = summary.completed || 0;
    if (reportCompletedValue) reportCompletedValue.textContent = summary.completed || 0;
    if (reportInTransitValue) reportInTransitValue.textContent = summary.inTransit || 0;
    if (reportPendingValue) reportPendingValue.textContent = summary.assigned || 0;

    deliveryOrders = orders;
    renderOrders(orders);
    attachOrderActionHandlers();
  } catch (error) {
    console.error(error);
    if (deliveryOrdersList) {
      deliveryOrdersList.innerHTML = '<div class="panel-card"><p class="delivery-empty-state">Unable to load delivery data.</p></div>';
    }
  }
}

setActivePanel('dashboard');
window.addEventListener('storage', event => {
  if (event.key === 'rms_latest_delivery_order') {
    loadDeliveryDashboard();
  }
});
loadDeliveryDashboard();
