const API_BASE = "http://localhost:4000";
const revenueValue = document.getElementById("revenueValue");
const openOrdersValue = document.getElementById("openOrdersValue");
const cancelledOrdersValue = document.getElementById("cancelledOrdersValue");
const ordersBody = document.getElementById("ordersBody");
const salesRevenueValue = document.getElementById("salesRevenueValue");
const salesOrderCountValue = document.getElementById("salesOrderCountValue");
const salesCompletedCountValue = document.getElementById("salesCompletedCountValue");
const logoutButton = document.getElementById("logoutButton");
const logoutIconButton = document.getElementById('logoutIconButton');
const topbarTitle = document.getElementById('topbarTitle');
const dashboardSidebar = document.getElementById("dashboardSidebar");
const mobileMenuToggle = document.getElementById("mobileMenuToggle");
const navItems = Array.from(document.querySelectorAll(".sidebar-nav .nav-item"));

const token = localStorage.getItem("rms_token");
if (!token) {
  window.location.href = "../../login.html";
}

const activeUsersBody = document.getElementById('activeUsersBody');

// initialize auth token refresh if utility is available
if (window.auth && typeof window.auth.initAuth === 'function') {
  window.auth.initAuth();
}

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

function getPaymentMethodIcon(method) {
  if (!method) return '💲';
  const normalized = method.toLowerCase();
  if (normalized.includes('card') || normalized.includes('visa') || normalized.includes('master')) return '💳';
  if (normalized.includes('cash')) return '💵';
  if (normalized.includes('mobile') || normalized.includes('phone') || normalized.includes('mpesa') || normalized.includes('wallet')) return '📱';
  if (normalized.includes('transfer') || normalized.includes('bank')) return '🏦';
  if (normalized.includes('voucher') || normalized.includes('coupon') || normalized.includes('gift')) return '🎟️';
  return '💲';
}

function renderPaymentMethods(methods) {
  if (!Array.isArray(methods) || methods.length === 0) {
    return '<span class="payment-method-chip payment-method-default"><span class="payment-method-icon">💲</span>Unknown</span>';
  }
  return methods.map(method => {
    const normalized = String(method).trim().toLowerCase().replace(/\s+/g, '-');
    const icon = getPaymentMethodIcon(method);
    return `<span class="payment-method-chip payment-method-${normalized}"><span class="payment-method-icon">${icon}</span>${method}</span>`;
  }).join(' ');
}

async function loadDashboard() {
  try {
    const response = await fetch(`${API_BASE}/api/manager/dashboard`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      throw new Error("Unable to load dashboard data.");
    }

    const data = await response.json();
    applyCurrencyToSummary(data.summary.revenue);
    // show total orders if provided, fall back to open_orders for backward compatibility
    openOrdersValue.textContent = (data.summary && (data.summary.total_orders !== undefined ? data.summary.total_orders : data.summary.open_orders)) || 0;
    cancelledOrdersValue.textContent = data.summary.cancelled_orders || 0;
    salesOrders.splice(0, salesOrders.length, ...(data.orders || []).map(order => ({
      ...order,
      items: order.items_count || order.items || 0,
      cashier: order.cashier || order.cashier_username || 'Unknown',
      voided_items: order.voided_items || 0,
    })));
    populateCashierFilter();
    renderSalesData();

    if (salesRevenueValue) salesRevenueValue.textContent = formatCurrency(data.summary.revenue || 0);
    if (salesOrderCountValue) salesOrderCountValue.textContent = `${formatNumber(data.orders.length || 0)} orders`;
    if (salesCompletedCountValue) {
      const completedCount = data.orders.filter(order => order.status === 'completed').length;
      salesCompletedCountValue.textContent = `${formatNumber(completedCount)} completed`;
    }

    ordersBody.innerHTML = "";
    const recentOrders = (data.orders || []).slice(0, 10);
    recentOrders.forEach(order => {
      const orderPayments = parseOrderPayments(order.payments);
      const row = document.createElement("tr");
      row.innerHTML = `
        <td>${new Date(order.created_at).toLocaleString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</td>
        <td>${order.cashier || order.cashier_username || 'Unknown'}</td>
        <td>${formatCurrency(order.total_amount)}</td>
        <td>${renderPaymentMethods(orderPayments)}</td>
      `;
      ordersBody.appendChild(row);
    });

    currentActiveCashierCount = Array.isArray(data.active_cashiers) ? data.active_cashiers.length : 0;
    updateSalesSectionMetrics(data.orders);

    if (activeUsersBody) {
      activeUsersBody.innerHTML = '';
      if (Array.isArray(data.active_cashiers) && data.active_cashiers.length > 0) {
        data.active_cashiers.forEach(cashier => {
          const row = document.createElement('tr');
          row.innerHTML = `
            <td>
              <div class="cashier-name-cell">
                <span>${cashier.name || cashier.username || 'Unknown'}</span>
                <span class="status-badge status-badge--active">Online</span>
              </div>
            </td>
            <td>${formatCurrency(cashier.total_sales || 0)}</td>
          `;
          activeUsersBody.appendChild(row);
        });
      } else {
        const row = document.createElement('tr');
        row.innerHTML = '<td colspan="2">No active cashiers currently online.</td>';
        activeUsersBody.appendChild(row);
      }
    }

    orderItems.splice(0, orderItems.length, ...(Array.isArray(data.order_items) ? data.order_items : []).map(item => ({
      ...item,
      created_at: item.created_at || item.order_created_at,
    })));

    staffPerformanceData = Array.isArray(data.staff_performance) ? data.staff_performance : [];
    renderReportSection();
  } catch (error) {
    console.error(error);
    window.location.href = "../../login.html";
  }
}

let staffPerformanceData = [];

function getReportRange() {
  const startDate = reportStartDateInput?.value || '';
  return {
    startDate: startDate ? new Date(`${startDate}T00:00:00`) : null,
  };
}

function isInReportRange(dateValue) {
  const range = getReportRange();
  // if no startDate filter is set, include everything
  if (!range.startDate) return true;
  // when a startDate is set, exclude records missing a valid date
  if (!dateValue) return false;
  const date = new Date(dateValue);
  return date >= range.startDate;
}

function getFilteredReportOrders() {
  return salesOrders.filter(order => isInReportRange(order.created_at));
}

function getFilteredReportItems() {
  return orderItems.filter(item => isInReportRange(item.created_at));
}

function getBestSellingItem(items) {
  const salesByProduct = items.reduce((acc, item) => {
    if (!item.name) return acc;
    acc[item.name] = (acc[item.name] || 0) + Number(item.quantity || 0);
    return acc;
  }, {});
  const topEntry = Object.entries(salesByProduct).sort((a, b) => b[1] - a[1])[0];
  return topEntry ? `${topEntry[0]} (${formatNumber(topEntry[1])})` : '—';
}

function getDailySalesTrend(orders) {
  const dailyTotals = orders.reduce((acc, order) => {
    const dateKey = new Date(order.created_at).toISOString().slice(0, 10);
    acc[dateKey] = (acc[dateKey] || 0) + Number(order.total_amount || 0);
    return acc;
  }, {});

  const sortedKeys = Object.keys(dailyTotals).sort();
  return sortedKeys.map(key => ({ label: key, total: dailyTotals[key] }));
}

function getTopProducts(items) {
  const productTotals = items.reduce((acc, item) => {
    if (!item.name) return acc;
    const quantity = Number(item.quantity || 0);
    acc[item.name] = (acc[item.name] || 0) + quantity;
    return acc;
  }, {});
  return Object.entries(productTotals)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([name, quantity]) => ({ name, quantity }));
}

function renderDailySalesTrendChart(orders) {
  if (!reportDailySalesTrendEl) return;
  const dailyData = getDailySalesTrend(orders);
  if (dailyData.length === 0) {
    reportDailySalesTrendEl.innerHTML = '<p class="report-chart-empty">No sales found in this range.</p>';
    return;
  }

  const maxValue = Math.max(...dailyData.map(item => item.total), 1);
  reportDailySalesTrendEl.innerHTML = `
    <div class="report-chart-title-row">
      <span class="report-chart-title">Sales trend</span>
      <span class="report-chart-subtitle">Showing sales totals by day</span>
    </div>
    <div class="report-chart-data">
      ${dailyData.map(item => {
        const width = Math.round((item.total / maxValue) * 100);
        return `
          <div class="report-chart-row">
            <span class="report-chart-label">${item.label}</span>
            <div class="report-chart-bar-wrapper">
              <div class="report-chart-bar" style="width: 0%; --target-width: ${width}%;"></div>
            </div>
            <span class="report-chart-value">${formatCurrency(item.total)}</span>
          </div>
        `;
      }).join('')}
    </div>
  `;

  requestAnimationFrame(() => {
    reportDailySalesTrendEl.querySelectorAll('.report-chart-bar').forEach(bar => {
      // trigger animation which reads --target-width in keyframes
      bar.classList.add('animate');
    });
  });
}

function renderTopProductsChart(items) {
  if (!reportTopProductsChartEl) return;
  const topProducts = getTopProducts(items);
  if (topProducts.length === 0) {
    reportTopProductsChartEl.innerHTML = '<p class="report-chart-empty">No product activity in this range.</p>';
    return;
  }

  const maxQuantity = Math.max(...topProducts.map(item => item.quantity), 1);
  reportTopProductsChartEl.innerHTML = `
    <div class="report-chart-title-row">
      <span class="report-chart-title">Top products</span>
      <span class="report-chart-subtitle">Best-selling items by quantity</span>
    </div>
    <div class="report-chart-data">
      ${topProducts.map(item => {
        const width = Math.round((item.quantity / maxQuantity) * 100);
        return `
          <div class="report-product-row">
            <div class="report-product-meta">
              <span class="report-product-title">${item.name}</span>
              <span class="report-product-count">${formatNumber(item.quantity)} sold</span>
            </div>
            <div class="report-product-bar-wrapper">
              <div class="report-product-bar" style="width: 0%; --target-width: ${width}%;"></div>
            </div>
          </div>
        `;
      }).join('')}
    </div>
  `;

  requestAnimationFrame(() => {
    reportTopProductsChartEl.querySelectorAll('.report-product-bar').forEach(bar => {
      bar.classList.add('animate');
    });
  });
}

function renderStaffPerformanceTable() {
  if (!staffPerformanceBody) return;
  const rows = Array.isArray(staffPerformanceData) ? [...staffPerformanceData] : [];
  rows.sort((a, b) => Number(b.total_sales || 0) - Number(a.total_sales || 0));

  if (rows.length === 0) {
    staffPerformanceBody.innerHTML = '<tr><td colspan="3">No staff performance data available.</td></tr>';
    return;
  }

  staffPerformanceBody.innerHTML = rows.map(staff => `
    <tr>
      <td>${staff.staff_name || 'Unknown'}</td>
      <td>${formatNumber(staff.sales_count || 0)}</td>
      <td>${formatCurrency(staff.total_sales || 0)}</td>
    </tr>
  `).join('');
}

function formatISODate(date) {
  return date.toISOString().slice(0, 10);
}

function setDefaultReportDates() {
  const today = new Date();
  const oneWeekAgo = new Date(today);
  oneWeekAgo.setDate(today.getDate() - 7);
  // prefer persisted start date for reports
  const stored = localStorage.getItem('rms_report_startDate');
  if (reportStartDateInput) {
    if (stored) {
      reportStartDateInput.value = stored;
    } else if (!reportStartDateInput.value) {
      reportStartDateInput.value = formatISODate(oneWeekAgo);
    }
  }
}

function renderReportSection() {
  if (!reportTodaysSalesValue || !reportTotalSalesCountValue || !reportBestSellingItemValue) return;

  const filteredOrders = getFilteredReportOrders();
  const filteredItems = getFilteredReportItems();

  // metrics should reflect only the selected day (or today if none selected)
  const selectedDateKey = (reportStartDateInput && reportStartDateInput.value) ? reportStartDateInput.value : new Date().toISOString().slice(0, 10);

  const dailyOrders = salesOrders.filter(order => {
    if (!order || !order.created_at) return false;
    const orderKey = new Date(order.created_at).toISOString().slice(0, 10);
    return orderKey === selectedDateKey && String(order.status || '').toLowerCase() === 'completed';
  });
  const dailySales = dailyOrders.reduce((sum, order) => sum + Number(order.total_amount || 0), 0);

  reportTodaysSalesValue.textContent = formatCurrency(dailySales);
  reportTotalSalesCountValue.textContent = formatNumber(dailyOrders.length);

  const dailyItems = orderItems.filter(item => {
    if (!item || !item.created_at) return false;
    return new Date(item.created_at).toISOString().slice(0, 10) === selectedDateKey;
  });
  reportBestSellingItemValue.textContent = getBestSellingItem(dailyItems);

  // charts and staff table remain range-based
  renderDailySalesTrendChart(filteredOrders);
  renderTopProductsChart(filteredItems);
  renderStaffPerformanceTable();
}

function setActivePanel(panelName) {
  const validPanel = panelName && document.querySelector(`.panel[data-panel="${panelName}"]`);
  const selectedPanel = validPanel ? panelName : 'summary';

  document.querySelectorAll('.panel').forEach(panel => {
    panel.classList.toggle('active', panel.dataset.panel === selectedPanel);
  });

  navItems.forEach(item => {
    item.classList.toggle('active', item.dataset.panel === selectedPanel);
  });

  localStorage.setItem('rms_active_panel', selectedPanel);
  updateTopbarTitle(selectedPanel);
}

function updateTopbarTitle(panelName) {
  if (!topbarTitle) return;
  const item = navItems.find(i => i.dataset.panel === panelName);
  const label = item ? (item.querySelector('.nav-text') || {}).textContent : null;
  topbarTitle.textContent = label || panelName || 'Dashboard';
}

const sidebarHoverArea = dashboardSidebar;

sidebarHoverArea.addEventListener('mouseenter', () => {
  if (window.innerWidth > 900) {
    dashboardSidebar.classList.remove('collapsed');
  }
});

sidebarHoverArea.addEventListener('mouseleave', () => {
  if (window.innerWidth > 900) {
    dashboardSidebar.classList.add('collapsed');
  }
});

// Mobile menu behavior: left slide-in overlay with backdrop
const BACKDROP_ID = 'mobileMenuBackdrop';

function createBackdrop() {
  if (document.getElementById(BACKDROP_ID)) return;
  const b = document.createElement('div');
  b.id = BACKDROP_ID;
  b.className = 'mobile-backdrop';
  document.body.appendChild(b);
  b.addEventListener('click', closeMobileMenu);
  document.addEventListener('keydown', handleKeydown);
}

function removeBackdrop() {
  const b = document.getElementById(BACKDROP_ID);
  if (b) b.remove();
  document.removeEventListener('keydown', handleKeydown);
}

function handleKeydown(e) {
  if (e.key === 'Escape') closeMobileMenu();
}

function openMobileMenu() {
  dashboardSidebar.classList.add('mobile-open');
  createBackdrop();
  document.body.style.overflow = 'hidden';
}

function closeMobileMenu() {
  dashboardSidebar.classList.remove('mobile-open');
  removeBackdrop();
  document.body.style.overflow = '';

  window.requestAnimationFrame(() => {
    if (mobileMenuToggle instanceof HTMLElement && typeof mobileMenuToggle.focus === 'function') {
      mobileMenuToggle.focus({ preventScroll: true });
    } else {
      const active = document.activeElement;
      if (active instanceof HTMLElement) {
        active.blur();
      }
    }
  });
}

mobileMenuToggle.addEventListener('click', () => {
  if (window.innerWidth <= 900) {
    if (dashboardSidebar.classList.contains('mobile-open')) {
      closeMobileMenu();
    } else {
      openMobileMenu();
    }
  }
});

navItems.forEach(item => {
  item.addEventListener("click", () => {
    setActivePanel(item.dataset.panel);
    if (window.innerWidth <= 900) {
      // close after selection
      closeMobileMenu();
    }
  });
});


const setupButton = document.getElementById("setupButton");
if (setupButton) {
  setupButton.addEventListener("click", () => {
    window.location.href = "../../manager-setup.html";
  });
}

function performLogout() {
  localStorage.removeItem('rms_token');
  window.location.href = '../../login.html';
}

if (logoutButton) {
  logoutButton.addEventListener('click', () => {
    openConfirmModal({
      title: 'Log out',
      message: 'Are you sure you want to log out?',
      confirmText: 'Log out',
      onConfirm: performLogout,
    });
  });
}

if (logoutIconButton) {
  logoutIconButton.addEventListener('click', () => {
    openConfirmModal({
      title: 'Log out',
      message: 'Are you sure you want to log out?',
      confirmText: 'Log out',
      onConfirm: performLogout,
    });
  });
}

const settingsButton = document.getElementById('settingsButton');
const settingsMenu = document.getElementById('settingsMenu');

function closeSettingsMenu() {
  if (!settingsMenu || !settingsButton) return;
  settingsMenu.classList.remove('active');
  settingsMenu.setAttribute('aria-hidden', 'true');
  settingsButton.setAttribute('aria-expanded', 'false');
}

function openSettingsMenu() {
  if (!settingsMenu || !settingsButton) return;
  settingsMenu.classList.add('active');
  settingsMenu.setAttribute('aria-hidden', 'false');
  settingsButton.setAttribute('aria-expanded', 'true');
}

settingsButton?.addEventListener('click', () => {
  if (settingsMenu?.classList.contains('active')) {
    closeSettingsMenu();
  } else {
    openSettingsMenu();
  }
});

document.addEventListener('click', event => {
  if (!settingsMenu || !settingsButton) return;
  if (settingsMenu.contains(event.target) || settingsButton.contains(event.target)) return;
  closeSettingsMenu();
});

const settingsTabs = Array.from(document.querySelectorAll('.settings-tab'));
const settingsSections = Array.from(document.querySelectorAll('.settings-section'));
const settingsBackBtn = document.getElementById('settingsBackBtn');
const settingsStorageKey = 'rms_settings';
const saveBusinessSettingsBtn = document.getElementById('saveBusinessSettingsBtn');
const saveFinancialSettingsBtn = document.getElementById('saveFinancialSettingsBtn');
const saveSystemSettingsBtn = document.getElementById('saveSystemSettingsBtn');
const businessNameInput = document.getElementById('businessNameInput');
const businessAddressInput = document.getElementById('businessAddressInput');
const businessPhoneInput = document.getElementById('businessPhoneInput');
const businessEmailInput = document.getElementById('businessEmailInput');
const receiptFooterInput = document.getElementById('receiptFooterInput');
const taxRateInput = document.getElementById('taxRateInput');
const defaultDiscountInput = document.getElementById('defaultDiscountInput');
const currencyInput = document.getElementById('currencyInput');
const timezoneInput = document.getElementById('systemTimezoneInput');
const backupFrequencyInput = document.getElementById('systemBackupFrequencyInput');
const notificationAlertsInput = document.getElementById('systemNotificationAlertsInput');
const dataRetentionInput = document.getElementById('systemDataRetentionInput');
const systemPaginationSizeInput = document.getElementById('systemPaginationSizeInput');
const systemStockCountingInput = document.getElementById('systemStockCountingInput');

const salesStartDateInput = document.getElementById('salesStartDateInput');
const salesEndDateInput = document.getElementById('salesEndDateInput');
const salesCashierFilter = document.getElementById('salesCashierFilter');
const salesStatusFilter = document.getElementById('salesStatusFilter');
const salesTotalValue = document.getElementById('salesTotalValue');
const salesActiveUsersValue = document.getElementById('salesActiveUsersValue');
const salesItemsValue = document.getElementById('salesItemsValue');
const salesVoidedValue = document.getElementById('salesVoidedValue');
const salesCancelledValue = document.getElementById('salesCancelledValue');
const salesTableBody = document.getElementById('salesTableBody');
const salesPagination = document.getElementById('salesPagination');
const salesPrevBtn = document.getElementById('salesPrevBtn');
const salesNextBtn = document.getElementById('salesNextBtn');
const salesPageInfo = document.getElementById('salesPageInfo');
const reportStartDateInput = document.getElementById('reportStartDateInput');
const saveReportBtn = document.getElementById('saveReportBtn');
const reportTodaysSalesValue = document.getElementById('reportTodaysSalesValue');
const reportTotalSalesCountValue = document.getElementById('reportTotalSalesCountValue');
const reportBestSellingItemValue = document.getElementById('reportBestSellingItemValue');
const reportDailySalesTrendEl = document.getElementById('reportDailySalesTrend');
const reportTopProductsChartEl = document.getElementById('reportTopProductsChart');
const staffPerformanceBody = document.getElementById('staffPerformanceBody');
let salesCurrentPage = 1;
const salesOrders = [];
const orderItems = [];
let currentActiveCashierCount = 0;


function updateSalesSectionMetrics(orders = []) {
  const filteredOrders = Array.isArray(orders) ? orders : [];
  const totalSales = filteredOrders.reduce((sum, order) => sum + Number(order.total_amount || 0), 0);
  const totalItems = filteredOrders.reduce((sum, order) => sum + Number(order.items || order.items_count || 0), 0);
  const voidedCount = filteredOrders.filter(order => String(order.status || '').toLowerCase() === 'voided').length;
  const cancelledCount = filteredOrders.filter(order => String(order.status || '').toLowerCase() === 'cancelled').length;

  if (salesTotalValue) salesTotalValue.textContent = formatCurrency(totalSales);
  if (salesActiveUsersValue) salesActiveUsersValue.textContent = formatNumber(currentActiveCashierCount);
  if (salesItemsValue) salesItemsValue.textContent = formatNumber(totalItems);
  if (salesVoidedValue) salesVoidedValue.textContent = formatNumber(voidedCount);
  if (salesCancelledValue) salesCancelledValue.textContent = formatNumber(cancelledCount);
}


function getStoredSettings() {
  try {
    return JSON.parse(localStorage.getItem(settingsStorageKey) || '{}');
  } catch (error) {
    return {};
  }
}

function saveStoredSettings(settings) {
  localStorage.setItem(settingsStorageKey, JSON.stringify(settings));
}

function getCurrentCurrency() {
  return getStoredSettings().financial?.currency || 'NGN';
}

function getCurrentCurrencySymbol() {
  return getCurrentCurrency() === 'USD' ? '$' : '₦';
}

function formatCurrency(amount) {
  const symbol = getCurrentCurrencySymbol();
  const value = Number(amount || 0);
  return `${symbol}${value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function formatNumber(value) {
  return Number(value || 0).toLocaleString('en-US');
}

function getOrderStatusBadge(status) {
  const normalized = String(status || '').toLowerCase();
  const statusClass = {
    completed: 'completed',
    pending: 'pending',
    cancelled: 'cancelled',
    voided: 'cancelled',
  }[normalized] || 'inactive';
  return `<span class="status-badge ${statusClass}">${status || 'Unknown'}</span>`;
}

function getPaginationSize() {
  const settings = getStoredSettings();
  const size = Number(settings.system?.paginationSize || 10);
  return Number.isInteger(size) && size > 0 ? size : 10;
}

function isStockCountingEnabled() {
  const settings = getStoredSettings();
  return !!settings.system?.stockCountingEnabled;
}

function loadStoredSettings() {
  const stored = getStoredSettings();
  if (stored.business) {
    if (businessNameInput) businessNameInput.value = stored.business.businessName || businessNameInput.value;
    if (businessAddressInput) businessAddressInput.value = stored.business.businessAddress || businessAddressInput.value;
    if (businessPhoneInput) businessPhoneInput.value = stored.business.businessPhone || businessPhoneInput.value;
    if (businessEmailInput) businessEmailInput.value = stored.business.businessEmail || businessEmailInput.value;
    if (receiptFooterInput) receiptFooterInput.value = stored.business.receiptFooter || receiptFooterInput.value;
  }

  if (stored.financial) {
    if (taxRateInput) taxRateInput.value = stored.financial.taxRate || taxRateInput.value;
    if (defaultDiscountInput) defaultDiscountInput.value = stored.financial.defaultDiscount || defaultDiscountInput.value;
    if (currencyInput) currencyInput.value = stored.financial.currency || currencyInput.value;
  }

  if (stored.system) {
    if (timezoneInput) timezoneInput.value = stored.system.timezone || timezoneInput.value;
    if (backupFrequencyInput) backupFrequencyInput.value = stored.system.backupFrequency || backupFrequencyInput.value;
    if (notificationAlertsInput) notificationAlertsInput.value = stored.system.notificationAlerts || notificationAlertsInput.value;
    if (dataRetentionInput) dataRetentionInput.value = stored.system.dataRetention || dataRetentionInput.value;
    if (systemPaginationSizeInput) systemPaginationSizeInput.value = stored.system.paginationSize || systemPaginationSizeInput.value;
    if (systemStockCountingInput) systemStockCountingInput.checked = !!stored.system.stockCountingEnabled;
  }
}

function persistSettings() {
  const current = getStoredSettings();
  saveStoredSettings(current);
}

function applyCurrencyToSummary(revenue) {
  if (!revenueValue) return;
  revenueValue.textContent = formatCurrency(revenue);
}

function saveBusinessSettings() {
  const current = getStoredSettings();
  current.business = {
    businessName: businessNameInput?.value || '',
    businessAddress: businessAddressInput?.value || '',
    businessPhone: businessPhoneInput?.value || '',
    businessEmail: businessEmailInput?.value || '',
    receiptFooter: receiptFooterInput?.value || '',
  };
  saveStoredSettings(current);
  showToast('Business settings saved successfully.');
}

function saveFinancialSettings() {
  const current = getStoredSettings();
  current.financial = {
    taxRate: taxRateInput?.value || '',
    defaultDiscount: defaultDiscountInput?.value || '',
    currency: currencyInput?.value || 'NGN',
  };
  saveStoredSettings(current);
  renderProductList();
  loadDashboard();
  renderSalesData();
  const status = document.getElementById('currencyStatusMessage');
  if (status) {
    status.textContent = `Currency set to ${currencyInput?.value === 'USD' ? '$ US Dollar' : '₦ Nigerian Naira'}. All values are now displayed in ${currencyInput?.value}.`;
  }
  showToast('Financial settings saved successfully.');
}

function saveSystemSettings() {
  const current = getStoredSettings();
  current.system = {
    timezone: timezoneInput?.value || '',
    backupFrequency: backupFrequencyInput?.value || '',
    notificationAlerts: notificationAlertsInput?.value || '',
    dataRetention: dataRetentionInput?.value || '',
    paginationSize: systemPaginationSizeInput?.value || '',
    stockCountingEnabled: !!(systemStockCountingInput && systemStockCountingInput.checked),
  };
  saveStoredSettings(current);
  usersCurrentPage = 1;
  renderSalesData();
  renderUsersTable();
  showToast('System settings saved successfully.');
}

saveBusinessSettingsBtn?.addEventListener('click', saveBusinessSettings);
saveFinancialSettingsBtn?.addEventListener('click', saveFinancialSettings);
saveSystemSettingsBtn?.addEventListener('click', saveSystemSettings);

function getSalesFilterValues() {
  return {
    startDate: salesStartDateInput?.value || '',
    endDate: salesEndDateInput?.value || '',
    cashier: salesCashierFilter?.value || 'all',
    status: salesStatusFilter?.value || 'all',
  };
}

function filterSalesOrders() {
  const { startDate, endDate, cashier, status } = getSalesFilterValues();

  return salesOrders.filter(order => {
    const createdAt = new Date(order.created_at);
    const startMatch = startDate ? createdAt >= new Date(startDate) : true;
    const endMatch = endDate ? createdAt <= new Date(`${endDate}T23:59:59`) : true;
    const cashierMatch = cashier === 'all' || order.cashier === cashier;
    const statusMatch = status === 'all' || order.status === status;
    return startMatch && endMatch && cashierMatch && statusMatch;
  });
}

function populateCashierFilter() {
  if (!salesCashierFilter) return;
  const cashiers = Array.from(new Set(salesOrders.map(order => order.cashier).filter(Boolean)));
  const existing = salesCashierFilter.value || 'all';
  salesCashierFilter.innerHTML = '<option value="all">All cashiers</option>';
  cashiers.forEach(name => {
    const option = document.createElement('option');
    option.value = name;
    option.textContent = name;
    salesCashierFilter.appendChild(option);
  });
  salesCashierFilter.value = cashiers.includes(existing) ? existing : 'all';
}

function renderSalesData() {
  if (!salesTableBody) return;

  const filtered = filterSalesOrders();
  const paginationSize = getPaginationSize();
  const totalPages = Math.max(1, Math.ceil(filtered.length / paginationSize));

  if (salesCurrentPage > totalPages) salesCurrentPage = totalPages;
  if (salesCurrentPage < 1) salesCurrentPage = 1;

  const pageStart = (salesCurrentPage - 1) * paginationSize;
  const pageOrders = filtered.slice(pageStart, pageStart + paginationSize);

  salesTableBody.innerHTML = '';
  pageOrders.forEach(order => {
    const row = document.createElement('tr');
    const itemCount = Number(order.items_count || order.items) || 0;
    row.innerHTML = `
      <td>${new Date(order.created_at).toLocaleString()}</td>
      <td>${order.id}</td>
      <td>${order.cashier || 'Unknown'}</td>
      <td>${formatNumber(itemCount)}</td>
      <td>${formatCurrency(order.total_amount)}</td>
      <td>${getOrderStatusBadge(order.status)}</td>
      <td>
        <button type="button" class="icon-button table-action-button" aria-label="View order ${order.id}">
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
        </button>
      </td>
    `;
    salesTableBody.appendChild(row);
  });

  if (salesPagination) {
    if (totalPages > 1) {
      salesPagination.style.display = 'flex';
      salesPageInfo && (salesPageInfo.textContent = `Page ${salesCurrentPage} of ${totalPages}`);
      salesPrevBtn && (salesPrevBtn.disabled = salesCurrentPage === 1);
      salesNextBtn && (salesNextBtn.disabled = salesCurrentPage === totalPages);
    } else {
      salesPagination.style.display = 'none';
    }
  }
}

salesStartDateInput?.addEventListener('change', () => {
  salesCurrentPage = 1;
  renderSalesData();
});

salesEndDateInput?.addEventListener('change', () => {
  salesCurrentPage = 1;
  renderSalesData();
});

salesCashierFilter?.addEventListener('change', () => {
  salesCurrentPage = 1;
  renderSalesData();
});

salesStatusFilter?.addEventListener('change', () => {
  salesCurrentPage = 1;
  renderSalesData();
});

salesPrevBtn?.addEventListener('click', () => {
  if (salesCurrentPage > 1) {
    salesCurrentPage -= 1;
    renderSalesData();
  }
});

salesNextBtn?.addEventListener('click', () => {
  const filtered = filterSalesOrders();
  const totalPages = Math.max(1, Math.ceil(filtered.length / getPaginationSize()));
  if (salesCurrentPage < totalPages) {
    salesCurrentPage += 1;
    renderSalesData();
  }
});

window.addEventListener('resize', () => {
  renderSalesData();
});

function activateSettingsSection(sectionName) {
  let sectionFound = false;

  settingsSections.forEach(section => {
    const isActive = section.dataset.settingsSection === sectionName;
    section.classList.toggle('active', isActive);
    if (isActive) sectionFound = true;
  });

  settingsTabs.forEach(tab => {
    tab.classList.toggle('active', tab.dataset.settingsTab === sectionName);
  });

  if (!sectionFound) {
    const placeholder = settingsSections.find(section => section.dataset.settingsSection === 'placeholder');
    if (placeholder) {
      settingsSections.forEach(section => {
        section.classList.toggle('active', section.dataset.settingsSection === 'placeholder');
      });
    }
    settingsTabs.forEach(tab => tab.classList.remove('active'));
    return;
  }

  setActivePanel('settings');
}

document.querySelectorAll('.settings-menu-item').forEach(item => {
  item.addEventListener('click', event => {
    const action = event.currentTarget.dataset.action;
    closeSettingsMenu();
    if (action === 'profile') {
      activateSettingsSection('profile');
    } else if (action === 'business') {
      activateSettingsSection('business');
    } else if (action === 'financial') {
      activateSettingsSection('financial');
    } else if (action === 'system') {
      activateSettingsSection('system');
    }
  });
});

settingsTabs.forEach(tab => {
  tab.addEventListener('click', () => {
    activateSettingsSection(tab.dataset.settingsTab);
  });
});

settingsBackBtn?.addEventListener('click', () => {
  setActivePanel('summary');
});

loadStoredSettings();

// initialize report date and bind report controls
setDefaultReportDates();
reportStartDateInput?.addEventListener('change', () => {
  // immediate preview when date changed
  renderReportSection();
});
saveReportBtn?.addEventListener('click', () => {
  if (reportStartDateInput) {
    localStorage.setItem('rms_report_startDate', reportStartDateInput.value);
  }
  renderReportSection();
  showToast('Report filter applied.');
});

loadDashboard();

setInterval(loadDashboard, 10000);

const viewSalesBtn = document.getElementById('viewSalesBtn');
viewSalesBtn?.addEventListener('click', () => setActivePanel('sales'));

const generateReportBtn = document.getElementById('generateReportBtn');
const reportPreviewModal = document.getElementById('reportPreviewModal');
const reportPreviewBody = document.getElementById('reportPreviewBody');
const downloadReportBtn = document.getElementById('downloadReportBtn');

function getPaymentBreakdown(orders) {
  const breakdown = {};
  orders.forEach(order => {
    let payments = order.payments;
    if (!payments) return;
    if (typeof payments === 'string') {
      try { payments = JSON.parse(payments); } catch (e) { return; }
    }
    if (typeof payments !== 'object' || payments === null) return;
    Object.entries(payments).forEach(([method, amount]) => {
      const key = String(method || 'Unknown').trim();
      breakdown[key] = (breakdown[key] || 0) + Number(amount || 0);
    });
  });
  return breakdown;
}

function getSalesByCashier(orders) {
  const byCashier = {};
  orders.forEach(o => {
    const name = o.cashier || o.cashier_username || 'Unknown';
    byCashier[name] = byCashier[name] || { orders: 0, total: 0 };
    byCashier[name].orders += 1;
    byCashier[name].total += Number(o.total_amount || 0);
  });
  return byCashier;
}

function getTopItems(items, limit = 10) {
  const map = {};
  items.forEach(i => {
    if (!i.name) return;
    map[i.name] = map[i.name] || { qty: 0, total: 0 };
    map[i.name].qty += Number(i.quantity || 0);
    map[i.name].total += Number((i.price || i.unit_price) * (i.quantity || 0) || 0);
  });
  return Object.entries(map).map(([name, v]) => ({ name, quantity: v.qty, total: v.total }))
    .sort((a, b) => b.quantity - a.quantity)
    .slice(0, limit);
}

function getSalesByCategory(items) {
  const map = {};
  items.forEach(i => {
    const cat = i.category_name || i.category || 'Uncategorized';
    map[cat] = map[cat] || { qty: 0, total: 0 };
    map[cat].qty += Number(i.quantity || 0);
    map[cat].total += Number((i.price || i.unit_price) * (i.quantity || 0) || 0);
  });
  return map;
}

function buildReportHTMLForDate(dateKey) {
  // dateKey is YYYY-MM-DD
  const dayOrders = salesOrders.filter(o => o.created_at && new Date(o.created_at).toISOString().slice(0,10) === dateKey);
  const dayItems = orderItems.filter(i => i.created_at && new Date(i.created_at).toISOString().slice(0,10) === dateKey);

  const totalOrders = dayOrders.length;
  const totalSales = dayOrders.reduce((s,o)=>s+Number(o.total_amount||0),0);
  const pending = dayOrders.filter(o => String(o.status||'').toLowerCase() === 'pending').length;
  const voided = dayOrders.filter(o => String(o.status||'').toLowerCase() === 'voided').length;

  const payments = getPaymentBreakdown(dayOrders);
  const topItems = getTopItems(dayItems, 10);
  const byItem = getTopItems(dayItems, 1000); // full list sorted
  const byCategory = getSalesByCategory(dayItems);
  const byCashier = getSalesByCashier(dayOrders);
  const onlineOrders = dayOrders.filter(o => o.is_online || String(o.source||'').toLowerCase() === 'online' || o.delivery === 1).length;

  return `
    <section class="report-preview">
      <h4>Sales Summary (${dateKey})</h4>
      <ul>
        <li>Total orders: ${totalOrders}</li>
        <li>Total sales: ${formatCurrency(totalSales)}</li>
        <li>Pending orders: ${pending}</li>
        <li>Voided orders: ${voided}</li>
      </ul>

      <h4>Payment method breakdown</h4>
      <ul>
        ${Object.keys(payments).length === 0 ? '<li>No payments recorded</li>' : Object.entries(payments).map(([m,a])=>`<li>${m}: ${formatCurrency(a)}</li>`).join('')}
      </ul>

      <h4>Top ${Math.min(10, topItems.length)} selling items</h4>
      <ol>
        ${topItems.length === 0 ? '<li>None</li>' : topItems.map(it=>`<li>${it.name} — ${formatNumber(it.quantity)} sold (${formatCurrency(it.total)})</li>`).join('')}
      </ol>

      <h4>Sales by item</h4>
      <div class="report-grid">
        ${byItem.length === 0 ? '<p>No item sales.</p>' : byItem.map(it=>`<div class="report-grid-row"><strong>${it.name}</strong><span>${formatNumber(it.quantity)} sold</span><span>${formatCurrency(it.total)}</span></div>`).join('')}
      </div>

      <h4>Sales by category</h4>
      <ul>
        ${Object.keys(byCategory).length === 0 ? '<li>None</li>' : Object.entries(byCategory).map(([c,v])=>`<li>${c}: ${formatNumber(v.qty)} items — ${formatCurrency(v.total)}</li>`).join('')}
      </ul>

      <h4>Sales by cashier</h4>
      <ul>
        ${Object.keys(byCashier).length === 0 ? '<li>None</li>' : Object.entries(byCashier).map(([c,v])=>`<li>${c}: ${v.orders} orders — ${formatCurrency(v.total)}</li>`).join('')}
      </ul>

      <h4>Online orders</h4>
      <p>${onlineOrders} online order(s)</p>
    </section>
  `;
}

generateReportBtn?.addEventListener('click', () => {
  console.log('[debug] generateReportBtn click handler invoked');
  const dateKey = (reportStartDateInput && reportStartDateInput.value) ? reportStartDateInput.value : new Date().toISOString().slice(0,10);
  if (!reportPreviewBody || !reportPreviewModal) return;
  // ensure modal is attached to body so it's not hidden by panel display:none
  if (reportPreviewModal.parentElement !== document.body) document.body.appendChild(reportPreviewModal);
  reportPreviewBody.innerHTML = buildReportHTMLForDate(dateKey);
  const sub = document.getElementById('reportPreviewSubtitle');
  if (sub) sub.textContent = `Report for ${dateKey}`;
  openModal(reportPreviewModal);
});

// Delegated fallback: handle clicks even if button was not present at bind time
document.body.addEventListener('click', (ev) => {
  const btn = ev.target instanceof Element ? ev.target.closest('#generateReportBtn') : null;
  if (!btn) return;
  console.log('[debug] delegated click for generateReportBtn');
  ev.preventDefault();
  const dateKey = (reportStartDateInput && reportStartDateInput.value) ? reportStartDateInput.value : new Date().toISOString().slice(0,10);
  if (!reportPreviewBody || !reportPreviewModal) return;
  if (reportPreviewModal.parentElement !== document.body) document.body.appendChild(reportPreviewModal);
  reportPreviewBody.innerHTML = buildReportHTMLForDate(dateKey);
  const sub = document.getElementById('reportPreviewSubtitle');
  if (sub) sub.textContent = `Report for ${dateKey}`;
  openModal(reportPreviewModal);
});

// pointerdown fallback (fires earlier) and keyboard activation
document.body.addEventListener('pointerdown', (ev) => {
  const btn = ev.target instanceof Element ? ev.target.closest('#generateReportBtn') : null;
  if (!btn) return;
  console.log('[debug] pointerdown on generateReportBtn');
  // quick visual feedback
  btn.classList.add('action-active');
  setTimeout(() => btn.classList.remove('action-active'), 180);
});

document.body.addEventListener('keydown', (ev) => {
  if (ev.key !== 'Enter' && ev.key !== ' ') return;
  const active = document.activeElement instanceof Element ? document.activeElement.closest('#generateReportBtn') : null;
  if (!active) return;
  ev.preventDefault();
  active.click();
});

downloadReportBtn?.addEventListener('click', () => {
  // simple download: generate text content
  const html = reportPreviewBody ? reportPreviewBody.innerText : 'Report';
  const blob = new Blob([html], { type: 'text/plain' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `report-${(reportStartDateInput && reportStartDateInput.value) || new Date().toISOString().slice(0,10)}.txt`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
});

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

  setTimeout(() => {
    toastEl.classList.add('show');
  }, 10);

  setTimeout(() => {
    toastEl.classList.remove('show');
    setTimeout(() => toastEl.remove(), 300);
  }, 3000);
}

const categories = [];
const products = [];

// Pagination state
let categoryCurrentPage = 1;
let productCurrentPage = 1;
const categoryPagination = document.getElementById('categoryPagination');
const categoryPageInfo = document.getElementById('categoryPageInfo');
const categoryPrevBtn = document.getElementById('categoryPrevBtn');
const categoryNextBtn = document.getElementById('categoryNextBtn');
const productPagination = document.getElementById('productPagination');
const productPageInfo = document.getElementById('productPageInfo');
const productPrevBtn = document.getElementById('productPrevBtn');
const productNextBtn = document.getElementById('productNextBtn');

function getCategoryItemsPerPage() {
  return window.innerWidth <= 640 ? 7 : 15;
}

function getProductItemsPerPage() {
  return window.innerWidth <= 640 ? 7 : 15;
}

const categoryList = document.getElementById('categoryList');
const productList = document.getElementById('productList');
const openCategoryModalBtn = document.getElementById('openCategoryModalBtn');
const openProductModalBtn = document.getElementById('openProductModalBtn');
const categoryModal = document.getElementById('categoryModal');
const productModal = document.getElementById('productModal');
const saveCategoryBtn = document.getElementById('saveCategoryBtn');
const saveProductBtn = document.getElementById('saveProductBtn');
const modalCategoryName = document.getElementById('modalCategoryName');
const modalCategoryDescription = document.getElementById('modalCategoryDescription');
const modalCategoryMessage = document.getElementById('modalCategoryMessage');
const modalProductName = document.getElementById('modalProductName');
const modalProductCategorySelect = document.getElementById('modalProductCategorySelect');
const modalProductPrice = document.getElementById('modalProductPrice');
const modalProductStock = document.getElementById('modalProductStock');
const modalProductStatus = document.getElementById('modalProductStatus');
const modalProductDescription = document.getElementById('modalProductDescription');
const modalProductMessage = document.getElementById('modalProductMessage');
const confirmModal = document.getElementById('confirmModal');
const confirmModalTitle = document.getElementById('confirmModalTitle');
const confirmModalText = document.getElementById('confirmModalText');
const confirmModalConfirm = document.getElementById('confirmModalConfirm');
let confirmModalAction = null;
const openUserModalBtn = document.getElementById('openUserModalBtn');
const usersSearchInput = document.getElementById('usersSearchInput');
const usersRoleFilter = document.getElementById('usersRoleFilter');
const usersStatusFilter = document.getElementById('usersStatusFilter');
const usersTableBody = document.getElementById('usersTableBody');
const usersPagination = document.getElementById('usersPagination');
const usersPrevBtn = document.getElementById('usersPrevBtn');
const usersNextBtn = document.getElementById('usersNextBtn');
const usersPageInfo = document.getElementById('usersPageInfo');
const userModal = document.getElementById('userModal');
const modalUserFullName = document.getElementById('modalUserFullName');
const modalUserUsername = document.getElementById('modalUserUsername');
const modalUserPassword = document.getElementById('modalUserPassword');
const modalUserRole = document.getElementById('modalUserRole');
const modalUserStatus = document.getElementById('modalUserStatus');
const modalUserMessage = document.getElementById('modalUserMessage');
const saveUserBtn = document.getElementById('saveUserBtn');
const manageUsersBtn = document.getElementById('manageUsersBtn');

let users = [];
let usersCurrentPage = 1;
let editingProductId = null;
let editingUserId = null;
let editingCategoryId = null;

loadStoredSettings();

const savedPanel = localStorage.getItem('rms_active_panel');
if (savedPanel) {
  setActivePanel(savedPanel);
} else {
  setActivePanel('summary');
}

function openConfirmModal({ title = 'Confirm', message = 'Are you sure you want to proceed?', confirmText = 'Confirm', onConfirm }) {
  if (!confirmModal || !confirmModalTitle || !confirmModalText || !confirmModalConfirm) return;
  confirmModalTitle.textContent = title;
  confirmModalText.textContent = message;
  confirmModalConfirm.textContent = confirmText;
  confirmModalAction = typeof onConfirm === 'function' ? onConfirm : null;
  openModal(confirmModal);
}

if (confirmModalConfirm) {
  confirmModalConfirm.addEventListener('click', () => {
    if (confirmModalAction) {
      confirmModalAction();
    }
    confirmModalAction = null;
    closeModal(confirmModal);
  });
}

fetchCategories();

function renderCategoryList() {
  if (!categoryList) return;
  categoryList.innerHTML = '';
  
  if (categories.length === 0) {
    categoryList.innerHTML = '<p class="empty-state">No categories yet. Add a category to begin.</p>';
    categoryPagination.style.display = 'none';
    return;
  }

  const itemsPerPage = getCategoryItemsPerPage();
  const totalPages = Math.ceil(categories.length / itemsPerPage);
  
  // Ensure current page is valid
  if (categoryCurrentPage > totalPages) {
    categoryCurrentPage = totalPages;
  }
  if (categoryCurrentPage < 1) {
    categoryCurrentPage = 1;
  }

  const startIndex = (categoryCurrentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const paginatedCategories = categories.slice(startIndex, endIndex);

  paginatedCategories.forEach(category => {
    const productCount = products.filter(product => product.category_id === category.id).length;
    const item = document.createElement('article');
    item.className = 'category-card';
    item.innerHTML = `
      <div class="category-card-header">
        <strong>${category.name}</strong>
        <span class="category-product-count">${productCount} product${productCount === 1 ? '' : 's'}</span>
      </div>
      <p>${category.description || 'No description provided.'}</p>
      <div class="category-card-actions">
        <button type="button" class="category-action-btn" data-action="edit" data-id="${category.id}" aria-label="Edit category ${category.name}">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5Z"/></svg>
        </button>
        <button type="button" class="category-action-btn" data-action="delete" data-id="${category.id}" aria-label="Delete category ${category.name}">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/></svg>
        </button>
      </div>
    `;
    categoryList.appendChild(item);
  });

  // Update pagination controls
  if (totalPages > 1) {
    categoryPagination.style.display = 'flex';
    categoryPageInfo.textContent = `Page ${categoryCurrentPage} of ${totalPages}`;
    categoryPrevBtn.disabled = categoryCurrentPage === 1;
    categoryNextBtn.disabled = categoryCurrentPage === totalPages;
  } else {
    categoryPagination.style.display = 'none';
  }
}

// Pagination controls handlers
categoryPrevBtn?.addEventListener('click', () => {
  if (categoryCurrentPage > 1) {
    categoryCurrentPage -= 1;
    renderCategoryList();
    categoryPagination?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }
});

categoryNextBtn?.addEventListener('click', () => {
  const itemsPerPage = getCategoryItemsPerPage();
  const totalPages = Math.max(1, Math.ceil(categories.length / itemsPerPage));
  if (categoryCurrentPage < totalPages) {
    categoryCurrentPage += 1;
    renderCategoryList();
    categoryPagination?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }
});

productPrevBtn?.addEventListener('click', () => {
  if (productCurrentPage > 1) {
    productCurrentPage -= 1;
    renderProductList();
    productPagination?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }
});

productNextBtn?.addEventListener('click', () => {
  const itemsPerPage = getProductItemsPerPage();
  const totalPages = Math.max(1, Math.ceil(getFilteredProducts().length / itemsPerPage));
  if (productCurrentPage < totalPages) {
    productCurrentPage += 1;
    renderProductList();
    productPagination?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }
});

// Adjust pagination when viewport changes (desktop/mobile page size)
let _lastCategoryItemsPerPage = getCategoryItemsPerPage();
let _lastProductItemsPerPage = getProductItemsPerPage();
window.addEventListener('resize', () => {
  const categoryNow = getCategoryItemsPerPage();
  const productNow = getProductItemsPerPage();
  if (categoryNow !== _lastCategoryItemsPerPage) {
    _lastCategoryItemsPerPage = categoryNow;
    const totalPages = Math.max(1, Math.ceil(categories.length / categoryNow));
    if (categoryCurrentPage > totalPages) categoryCurrentPage = totalPages;
    renderCategoryList();
  }
  if (productNow !== _lastProductItemsPerPage) {
    _lastProductItemsPerPage = productNow;
    const totalPages = Math.max(1, Math.ceil(getFilteredProducts().length / productNow));
    if (productCurrentPage > totalPages) productCurrentPage = totalPages;
    renderProductList();
  }
});

categoryList?.addEventListener('click', event => {
  const button = event.target.closest('.category-action-btn');
  if (!(button instanceof HTMLElement)) return;
  const action = button.dataset.action;
  const categoryId = Number(button.dataset.id);
  if (!action || Number.isNaN(categoryId)) return;

  const category = categories.find(cat => cat.id === categoryId);
  if (!category) return;

  if (action === 'edit') {
    openCategoryModal(category);
    return;
  }

  if (action === 'delete') {
    openConfirmModal({
      title: 'Delete category',
      message: `Delete category "${category.name}"? This cannot be undone.`,
      confirmText: 'Delete',
      onConfirm: () => deleteCategory(categoryId),
    });
  }
});

function getFilteredProducts() {
  const query = productSearchInput?.value.trim().toLowerCase() || '';
  const statusFilter = productStatusFilter?.value || 'all';

  return products
    .map((product, index) => ({ product, index }))
    .filter(({ product }) => {
      const matchesQuery = query
        ? product.name.toLowerCase().includes(query) || product.category_name.toLowerCase().includes(query)
        : true;
      const matchesStatus = statusFilter === 'all' || product.status === statusFilter;
      return matchesQuery && matchesStatus;
    });
}

function renderProductList() {
  if (!productList) return;
  const visibleProducts = getFilteredProducts();
  productList.innerHTML = '';

  if (visibleProducts.length === 0) {
    const message = products.length === 0
      ? 'No products yet. Add a product to populate this list.'
      : 'No products match the current filters.';
    productList.innerHTML = `<p class="empty-state">${message}</p>`;
    if (productPagination) productPagination.style.display = 'none';
    return;
  }

  const itemsPerPage = getProductItemsPerPage();
  const totalPages = Math.max(1, Math.ceil(visibleProducts.length / itemsPerPage));

  if (productCurrentPage > totalPages) {
    productCurrentPage = totalPages;
  }
  if (productCurrentPage < 1) {
    productCurrentPage = 1;
  }

  const startIndex = (productCurrentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const paginatedProducts = visibleProducts.slice(startIndex, endIndex);

  const currencySymbol = getCurrentCurrencySymbol();
  paginatedProducts.forEach(({ product, index }) => {
    const item = document.createElement('div');
    item.className = 'inventory-item';
    const priceValue = Number(product.price) || 0;
    item.innerHTML = `
      <span class="product-badge badge-${CSS.escape(product.status)}">${product.status}</span>
      <strong>${product.name}</strong>
      <span>${product.category_name || 'Unknown category'} • ${formatCurrency(priceValue)}</span>
      <span>${formatNumber(product.stock)} in stock</span>
      <p>${product.description || 'No product description provided.'}</p>
      <div class="inventory-card-actions">
        <button type="button" class="category-action-btn edit-button" data-index="${index}" aria-label="Edit product ${product.name}">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5Z"/></svg>
        </button>
        <button type="button" class="category-action-btn delete-button" data-index="${index}" aria-label="Delete product ${product.name}">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/></svg>
        </button>
      </div>
    `;
    productList.appendChild(item);
  });

  if (totalPages > 1) {
    if (productPagination) productPagination.style.display = 'flex';
    if (productPageInfo) productPageInfo.textContent = `Page ${productCurrentPage} of ${totalPages}`;
    if (productPrevBtn) productPrevBtn.disabled = productCurrentPage === 1;
    if (productNextBtn) productNextBtn.disabled = productCurrentPage === totalPages;
  } else {
    if (productPagination) productPagination.style.display = 'none';
  }
}

function updateModalCategoryOptions() {
  if (!modalProductCategorySelect) return;
  const selected = modalProductCategorySelect.value;
  modalProductCategorySelect.innerHTML = '<option value="">Select category</option>';
  categories.forEach(category => {
    const option = document.createElement('option');
    option.value = String(category.id);
    option.textContent = category.name;
    modalProductCategorySelect.appendChild(option);
  });
  if (selected) modalProductCategorySelect.value = selected;
}

function showFormMessage(element, message, isError = false) {
  if (!element) return;
  element.textContent = message;
  element.style.color = isError ? '#dc2626' : '#2563eb';
}

function openModal(modal) {
  if (!modal) return;
  modal.classList.add('active');
  modal.setAttribute('aria-hidden', 'false');
  document.body.style.overflow = 'hidden';
}

function openCategoryModal(category = null) {
  resetCategoryModal();
  if (category && category.id) {
    editingCategoryId = category.id;
    modalCategoryName.value = category.name;
    modalCategoryDescription.value = category.description || '';
    if (saveCategoryBtn) saveCategoryBtn.textContent = 'Update category';
  }
  openModal(categoryModal);
}

window.openCategoryModal = openCategoryModal;

function closeModal(modal) {
  if (!modal) return;
  modal.classList.remove('active');
  modal.setAttribute('aria-hidden', 'true');
  document.body.style.overflow = '';
}

function resetCategoryModal() {
  editingCategoryId = null;
  if (!modalCategoryName || !modalCategoryDescription || !modalCategoryMessage || !saveCategoryBtn) return;
  modalCategoryName.value = '';
  modalCategoryDescription.value = '';
  saveCategoryBtn.textContent = 'Save category';
  showFormMessage(modalCategoryMessage, '');
}

function resetProductModal() {
  if (!modalProductName || !modalProductCategorySelect || !modalProductPrice || !modalProductStock || !modalProductStatus || !modalProductDescription || !modalProductMessage) return;
  modalProductName.value = '';
  modalProductCategorySelect.value = '';
  modalProductPrice.value = '';
  modalProductStock.value = '';
  modalProductStatus.value = '';
  modalProductDescription.value = '';
  showFormMessage(modalProductMessage, '');
}

function resetUserModal() {
  if (!modalUserFullName || !modalUserUsername || !modalUserPassword || !modalUserRole || !modalUserStatus || !modalUserMessage) return;
  modalUserFullName.value = '';
  modalUserUsername.value = '';
  modalUserPassword.value = '';
  modalUserRole.value = 'cashier';
  modalUserStatus.value = 'Active';
  showFormMessage(modalUserMessage, '');
}

function getUserFilterValues() {
  return {
    query: usersSearchInput?.value.trim().toLowerCase() || '',
    role: usersRoleFilter?.value || 'all',
    status: usersStatusFilter?.value || 'all',
  };
}

function filterUsers() {
  const { query, role, status } = getUserFilterValues();
  return users.filter(user => {
    const name = (user.full_name || '').toLowerCase();
    const username = (user.username || '').toLowerCase();
    const queryMatch = !query || name.includes(query) || username.includes(query);
    const roleMatch = role === 'all' || user.role === role;
    const statusMatch = status === 'all' || user.status === status;
    return queryMatch && roleMatch && statusMatch;
  });
}

function renderUsersTable() {
  if (!usersTableBody) return;
  const filtered = filterUsers();
  const paginationSize = getPaginationSize();
  const totalPages = Math.max(1, Math.ceil(filtered.length / paginationSize));

  if (usersCurrentPage > totalPages) usersCurrentPage = totalPages;
  if (usersCurrentPage < 1) usersCurrentPage = 1;

  const start = (usersCurrentPage - 1) * paginationSize;
  const pageUsers = filtered.slice(start, start + paginationSize);

  usersTableBody.innerHTML = '';

  if (pageUsers.length === 0) {
    const emptyRow = document.createElement('tr');
    emptyRow.innerHTML = `<td colspan="6" class="empty-state">No staff members match your search.</td>`;
    usersTableBody.appendChild(emptyRow);
    if (usersPagination) usersPagination.style.display = 'none';
    return;
  }

  pageUsers.forEach(user => {
    const row = document.createElement('tr');
    const statusValue = user.status || 'Active';
    const statusClass = statusValue.toLowerCase() === 'active' ? 'status-badge--active' : 'status-badge--inactive';

    row.innerHTML = `
      <td>${user.full_name || '—'}</td>
      <td>${user.username || '—'}</td>
      <td>${user.role || '—'}</td>
      <td><span class="status-badge ${statusClass}">${statusValue}</span></td>
      <td>${user.last_seen ? new Date(user.last_seen).toLocaleString() : 'Never'}</td>
      <td class="user-actions-cell">
        <button type="button" class="icon-button table-action-button" data-action="edit" data-user-id="${user.id}" aria-label="Edit ${user.full_name || user.username}">
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5l4 4L7 21H3v-4L16.5 3.5Z"/></svg>
        </button>
        <button type="button" class="icon-button table-action-button" data-action="toggle" data-user-id="${user.id}" aria-label="${statusValue === 'Active' ? 'Deactivate' : 'Activate'} ${user.full_name || user.username}">
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2v10"/><path d="M5.5 8.5a7 7 0 1 0 13 0"/></svg>
        </button>
        <button type="button" class="icon-button table-action-button" data-action="delete" data-user-id="${user.id}" aria-label="Delete ${user.full_name || user.username}">
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"></path><path d="M10 11v6"></path><path d="M14 11v6"></path><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"></path></svg>
        </button>
      </td>
    `;
    usersTableBody.appendChild(row);
  });

  if (usersPagination) {
    if (totalPages > 1) {
      usersPagination.style.display = 'flex';
      usersPageInfo && (usersPageInfo.textContent = `Page ${usersCurrentPage} of ${totalPages}`);
      usersPrevBtn && (usersPrevBtn.disabled = usersCurrentPage === 1);
      usersNextBtn && (usersNextBtn.disabled = usersCurrentPage === totalPages);
    } else {
      usersPagination.style.display = 'none';
    }
  }
}

async function fetchUsers() {
  try {
    const response = await fetch(`${API_BASE}/api/manager/users`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      const text = await response.text();
      let errorBody = {};
      try { errorBody = JSON.parse(text); } catch (e) { errorBody = { message: text }; }
      throw new Error(errorBody.message || 'Unable to load users.');
    }

    const data = await response.json();
    users.splice(0, users.length, ...(data.users || []));
    renderUsersTable();
  } catch (error) {
    console.error('Unable to load users:', error);
    showToast(error.message || 'Unable to load users.', 'error');
  }
}

async function saveUser() {
  if (!modalUserFullName || !modalUserUsername || !modalUserPassword || !modalUserRole || !modalUserStatus || !modalUserMessage) return;
  const fullName = modalUserFullName.value.trim();
  const username = modalUserUsername.value.trim();
  const password = modalUserPassword.value.trim();
  const role = modalUserRole.value;
  const status = modalUserStatus.value;

  if (!fullName || !username) {
    showFormMessage(modalUserMessage, 'Full name and username are required.', true);
    return;
  }

  if (!['manager', 'cashier'].includes(role)) {
    showFormMessage(modalUserMessage, 'Select a valid role.', true);
    return;
  }

  try {
    let response, data;
    if (editingUserId) {
      // Update existing user (password optional)
      response = await fetch(`${API_BASE}/api/manager/users/${editingUserId}`, {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ full_name: fullName, username, role, status, password: password || undefined }),
      });
      data = await response.json();
      if (!response.ok) throw new Error(data.message || 'Unable to update user.');

      // update local users array
      const idx = users.findIndex(u => u.id === editingUserId);
      if (idx !== -1) users[idx] = { ...users[idx], ...data };
      showToast('User updated successfully.', 'success');
    } else {
      // Create new user
      if (!password) {
        showFormMessage(modalUserMessage, 'Password is required for new users.', true);
        return;
      }
      response = await fetch(`${API_BASE}/api/manager/users`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ full_name: fullName, username, password, role, status }),
      });
      data = await response.json();
      if (!response.ok) throw new Error(data.message || 'Unable to create user.');

      users.unshift(data);
      showToast('User created successfully.', 'success');
    }

    renderUsersTable();
    closeModal(userModal);
    resetUserModal();
    editingUserId = null;
  } catch (error) {
    console.error('Unable to save user:', error);
    showFormMessage(modalUserMessage, error.message || 'Unable to save user.', true);
  }
}

if (saveUserBtn) {
  saveUserBtn.addEventListener('click', saveUser);
}

usersSearchInput?.addEventListener('input', () => {
  usersCurrentPage = 1;
  renderUsersTable();
});

usersRoleFilter?.addEventListener('change', () => {
  usersCurrentPage = 1;
  renderUsersTable();
});

usersStatusFilter?.addEventListener('change', () => {
  usersCurrentPage = 1;
  renderUsersTable();
});

usersPrevBtn?.addEventListener('click', () => {
  if (usersCurrentPage > 1) {
    usersCurrentPage -= 1;
    renderUsersTable();
  }
});

usersNextBtn?.addEventListener('click', () => {
  const filtered = filterUsers();
  const totalPages = Math.max(1, Math.ceil(filtered.length / getPaginationSize()));
  if (usersCurrentPage < totalPages) {
    usersCurrentPage += 1;
    renderUsersTable();
  }
});

// Handle action buttons in the users table (edit, reset, deactivate, delete)
usersTableBody?.addEventListener('click', async (e) => {
  const btn = e.target.closest('button');
  if (!btn) return;
  const action = btn.dataset.action;
  const userId = Number(btn.dataset.userId);
  if (!action || !userId) return;

  if (action === 'edit') {
    const user = users.find(u => u.id === userId);
    if (!user) return showToast('User not found.', 'error');
    // populate modal for editing
    modalUserFullName.value = user.full_name || '';
    modalUserUsername.value = user.username || '';
    modalUserPassword.value = '';
    modalUserRole.value = user.role || 'cashier';
    modalUserStatus.value = user.status || 'Active';
    editingUserId = userId;
    if (saveUserBtn) saveUserBtn.textContent = 'Update user';
    openModal(userModal);
    return;
  }

  if (action === 'reset') {
    openConfirmModal({
      title: 'Reset password',
      message: 'Reset password for this user to a temporary value?',
      confirmText: 'Reset',
      onConfirm: async () => {
        try {
          const resp = await fetch(`${API_BASE}/api/manager/users/${userId}/reset-password`, {
            method: 'POST',
            headers: { Authorization: `Bearer ${token}` },
          });
          const text = await resp.text();
          let data = {};
          try { data = JSON.parse(text); } catch (e) { data = null; }
          if (!resp.ok) throw new Error((data && data.message) ? data.message : (text || `Server responded ${resp.status}`));
          showToast('Password reset. Temporary password: ' + ((data && data.tempPassword) ? data.tempPassword : ''), 'success');
        } catch (err) {
          console.error(err);
          showToast(err.message || 'Unable to reset password.', 'error');
        }
      }
    });
    return;
  }

  if (action === 'toggle') {
    const user = users.find(u => u.id === userId);
    if (!user) return showToast('User not found.', 'error');
    const targetStatus = (user.status || 'Active') === 'Active' ? 'Inactive' : 'Active';
    const title = targetStatus === 'Inactive' ? 'Deactivate account' : 'Activate account';
    const msg = targetStatus === 'Inactive' ? 'Set this user status to Inactive?' : 'Set this user status to Active?';
    const confirmText = targetStatus === 'Inactive' ? 'Deactivate' : 'Activate';
    openConfirmModal({
      title,
      message: msg,
      confirmText,
      onConfirm: async () => {
        try {
          const resp = await fetch(`${API_BASE}/api/manager/users/${userId}`, {
            method: 'PUT',
            headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ status: targetStatus }),
          });
          const text = await resp.text();
          let data = {};
          try { data = JSON.parse(text); } catch (e) { data = null; }
          if (!resp.ok) throw new Error((data && data.message) ? data.message : (text || `Server responded ${resp.status}`));
          // update local user
          const idx = users.findIndex(u => u.id === userId);
          if (idx !== -1 && data) users[idx] = { ...users[idx], ...data };
          renderUsersTable();
          showToast(`User ${targetStatus === 'Inactive' ? 'deactivated' : 'activated'}.`, 'success');
        } catch (err) {
          console.error(err);
          showToast(err.message || 'Unable to update user status.', 'error');
        }
      }
    });
    return;
  }

  if (action === 'delete') {
    openConfirmModal({
      title: 'Delete user',
      message: 'Permanently delete this user? This cannot be undone.',
      confirmText: 'Delete',
      onConfirm: async () => {
        try {
          const resp = await fetch(`${API_BASE}/api/manager/users/${userId}`, {
            method: 'DELETE',
            headers: { Authorization: `Bearer ${token}` },
          });
          if (!resp.ok) {
            const body = await resp.json().catch(() => ({}));
            throw new Error(body.message || 'Unable to delete user.');
          }
          users = users.filter(u => u.id !== userId);
          renderUsersTable();
          showToast('User deleted.', 'success');
        } catch (err) {
          console.error(err);
          showToast(err.message || 'Unable to delete user.', 'error');
        }
      }
    });
    return;
  }
});

async function fetchCategories() {
  try {
    const response = await fetch(`${API_BASE}/api/inventory/categories`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      throw new Error('Unable to load categories.');
    }

    const data = await response.json();
    categories.splice(0, categories.length, ...(data.categories || []));
    renderCategoryList();
    updateModalCategoryOptions();
    updateMetrics();
  } catch (error) {
    console.error('Unable to load categories:', error);
  }
}

async function fetchProducts() {
  try {
    const response = await fetch(`${API_BASE}/api/inventory/products`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    // Try to parse JSON body for better diagnostic messages
    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      const msg = data && data.message ? data.message : `Server responded with ${response.status}`;
      throw new Error(msg);
    }
    const normalized = (data.products || []).map(product => ({
      ...product,
      price: Number(product.price) || 0,
      stock: Number(product.stock) || 0,
      category_name: product.category_name || '',
    }));
    products.splice(0, products.length, ...normalized);
    renderProductList();
    renderCategoryList();
    updateMetrics();
  } catch (error) {
    console.error('Unable to load products:', error);
    // Surface the server-provided message to the user via toast for faster debugging
    try { showToast(error.message || 'Unable to load products.', 'error'); } catch (e) { /* ignore */ }
  }
}

function setProductModalMode(index) {
  editingProductId = index === null ? null : products[index]?.id ?? null;
  if (saveProductBtn) {
    saveProductBtn.textContent = index === null ? 'Save product' : 'Update product';
  }
  if (modalProductMessage) {
    showFormMessage(modalProductMessage, '');
  }
}

function populateProductModal(product) {
  if (!product) return;
  modalProductName.value = product.name;
  modalProductCategorySelect.value = String(product.category_id);
  modalProductPrice.value = String(product.price);
  modalProductStock.value = String(product.stock);
  modalProductStatus.value = product.status;
  modalProductDescription.value = product.description || '';
}

if (openCategoryModalBtn) {
  openCategoryModalBtn.addEventListener('click', openCategoryModal);
  openCategoryModalBtn.addEventListener('keydown', event => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      openCategoryModal();
    }
  });
}

if (openProductModalBtn) {
  openProductModalBtn.addEventListener('click', () => {
    setProductModalMode(null);
    updateModalCategoryOptions();
    resetProductModal();
    openModal(productModal);
  });
}

if (openUserModalBtn) {
  openUserModalBtn.addEventListener('click', () => {
    editingUserId = null;
    resetUserModal();
    if (saveUserBtn) saveUserBtn.textContent = 'Save user';
    openModal(userModal);
  });
}

if (manageUsersBtn) {
  manageUsersBtn.addEventListener('click', () => {
    setActivePanel('users');
  });
}

const addItemBtn = document.getElementById('addItemBtn');
if (addItemBtn) {
  addItemBtn.addEventListener('click', () => {
    setProductModalMode(null);
    updateModalCategoryOptions();
    resetProductModal();
    openModal(productModal);
  });
}

Array.from(document.querySelectorAll('.modal-close')).forEach(button => {
  button.addEventListener('click', event => {
    const parentModal = event.target.closest('.modal-overlay');
    if (parentModal) {
      closeModal(parentModal);
      if (parentModal === productModal) setProductModalMode(null);
      if (parentModal === userModal) resetUserModal();
    }
  });
});

if (saveCategoryBtn) {
  saveCategoryBtn.addEventListener('click', async () => {
    const name = modalCategoryName?.value.trim();
    const description = modalCategoryDescription?.value.trim();

    if (!name) {
      showFormMessage(modalCategoryMessage, 'Category name is required.', true);
      return;
    }

    const isDuplicate = categories.some(category => category.name.toLowerCase() === name.toLowerCase() && category.id !== editingCategoryId);
    if (isDuplicate) {
      showFormMessage(modalCategoryMessage, 'This category already exists.', true);
      return;
    }

    try {
      const method = editingCategoryId !== null ? 'PUT' : 'POST';
      const url = editingCategoryId !== null
        ? `${API_BASE}/api/inventory/categories/${editingCategoryId}`
        : `${API_BASE}/api/inventory/categories`;

      const response = await fetch(url, {
        method,
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ name, description }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.message || 'Unable to save category.');
      }

      if (editingCategoryId !== null) {
        const existingIndex = categories.findIndex(cat => cat.id === editingCategoryId);
        if (existingIndex !== -1) {
          categories[existingIndex] = { id: editingCategoryId, name: data.name, description: data.description };
        }

        products.forEach(product => {
          if (product.category_id === editingCategoryId) {
            product.category_name = data.name;
          }
        });
      } else {
        categories.push({ id: data.id, name: data.name, description: data.description });
      }

      renderCategoryList();
      renderProductList();
      updateMetrics();
      updateModalCategoryOptions();
      closeModal(categoryModal);
      showToast(editingCategoryId !== null ? 'Category updated successfully' : 'Category created successfully', 'success');
    } catch (error) {
      console.error(error);
      showFormMessage(modalCategoryMessage, error.message || 'Unable to save category.', true);
      showToast(error.message || 'Unable to save category.', 'error');
    }
  });
}

async function deleteCategory(categoryId) {
  try {
    const response = await fetch(`${API_BASE}/api/inventory/categories/${categoryId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      throw new Error(data.message || 'Unable to delete category.');
    }

    const index = categories.findIndex(cat => cat.id === categoryId);
    if (index !== -1) {
      categories.splice(index, 1);
    }

    renderCategoryList();
    updateMetrics();
    updateModalCategoryOptions();
    showToast('Category deleted successfully', 'success');
  } catch (error) {
    console.error(error);
    window.alert(error.message || 'Unable to delete category.');
    showToast(error.message || 'Unable to delete category.', 'error');
  }
}

if (saveProductBtn) {
  saveProductBtn.addEventListener('click', async () => {
    const name = modalProductName?.value.trim();
    const categoryId = parseInt(modalProductCategorySelect?.value, 10);
    const price = parseFloat(modalProductPrice?.value);
    const stock = parseInt(modalProductStock?.value, 10);
    const status = modalProductStatus?.value;
    const description = modalProductDescription?.value.trim();

    if (!name || Number.isNaN(categoryId) || Number.isNaN(price) || Number.isNaN(stock) || stock < 0 || !status) {
      showFormMessage(modalProductMessage, 'Name, category, price, stock, and status are required.', true);
      return;
    }

    try {
      const payload = {
        name,
        category_id: categoryId,
        price,
        stock,
        status,
        description,
      };

      const method = editingProductId !== null ? 'PUT' : 'POST';
      const url = editingProductId !== null
        ? `${API_BASE}/api/inventory/products/${editingProductId}`
        : `${API_BASE}/api/inventory/products`;

      const response = await fetch(url, {
        method,
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.message || 'Unable to save product.');
      }

      if (editingProductId !== null) {
        const existingIndex = products.findIndex(product => product.id === editingProductId);
        if (existingIndex !== -1) {
          products[existingIndex] = data;
        }
      } else {
        products.push(data);
      }

      renderProductList();
      renderCategoryList();
      updateMetrics();
      setProductModalMode(null);
      closeModal(productModal);
      showToast(editingProductId !== null ? 'Product updated successfully' : 'Product created successfully', 'success');
    } catch (error) {
      console.error(error);
      showFormMessage(modalProductMessage, error.message || 'Unable to save product.', true);
      showToast(error.message || 'Unable to save product.', 'error');
    }
  });
}

function updateMetrics() {
  const productCount = document.getElementById('inventoryProductCount');
  const outOfStockCount = document.getElementById('inventoryOutOfStockCount');

  if (productCount) productCount.textContent = String(products.length);
  if (outOfStockCount) outOfStockCount.textContent = String(products.filter(item => item.status === 'Out of stock').length);
}

productList?.addEventListener('click', event => {
  const button = event.target.closest('button');
  if (!(button instanceof HTMLElement)) return;
  const index = button.dataset.index ? Number(button.dataset.index) : NaN;
  if (Number.isNaN(index) || index < 0) return;

  if (button.classList.contains('edit-button')) {
    setProductModalMode(index);
    updateModalCategoryOptions();
    populateProductModal(products[index]);
    openModal(productModal);
    return;
  }

  if (button.classList.contains('delete-button')) {
    const product = products[index];
    if (!product) return;

    openConfirmModal({
      title: 'Delete product',
      message: 'Are you sure you want to delete this product? This action cannot be undone.',
      confirmText: 'Delete',
      onConfirm: async () => {
        try {
          const response = await fetch(`${API_BASE}/api/inventory/products/${product.id}`, {
            method: 'DELETE',
            headers: { Authorization: `Bearer ${token}` },
          });

          if (!response.ok) {
            const data = await response.json().catch(() => ({}));
            throw new Error(data.message || 'Unable to delete product.');
          }

          products.splice(index, 1);
          renderProductList();
          renderCategoryList();
          updateMetrics();
          showToast('Product deleted successfully', 'success');
        } catch (error) {
          console.error(error);
          showToast(error.message || 'Unable to delete product.', 'error');
        }
      },
    });
    return;
  }
});

productSearchInput?.addEventListener('input', () => {
  productCurrentPage = 1;
  renderProductList();
});
productStatusFilter?.addEventListener('change', () => {
  productCurrentPage = 1;
  renderProductList();
});

fetchCategories().then(() => fetchProducts());
fetchUsers();

// initialize topbar title from the active nav item
const initialActive = document.querySelector('.nav-item.active');
if (initialActive) updateTopbarTitle(initialActive.dataset.panel);
