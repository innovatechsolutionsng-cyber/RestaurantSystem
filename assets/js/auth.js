const AUTH_API_BASE = window.API_BASE !== undefined ? window.API_BASE : ((window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' || window.location.protocol === 'file:' || window.location.hostname === '') ? 'http://localhost:4000' : '');
let _refreshTimer = null;

function getToken() {
  return localStorage.getItem('rms_token');
}

function setToken(token) {
  if (!token) return clearToken();
  localStorage.setItem('rms_token', token);
  scheduleTokenRefresh();
}

function clearToken() {
  localStorage.removeItem('rms_token');
  if (_refreshTimer) {
    clearTimeout(_refreshTimer);
    _refreshTimer = null;
  }
}

function scheduleTokenRefresh() {
  if (_refreshTimer) {
    clearTimeout(_refreshTimer);
    _refreshTimer = null;
  }
  const token = getToken();
  if (!token) return;
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return;
    const payload = JSON.parse(atob(parts[1]));
    const exp = (payload && payload.exp) ? payload.exp * 1000 : null;
    if (!exp) return;
    const now = Date.now();
    // refresh 60 seconds before expiry
    const ms = Math.max(1000 * 30, exp - now - 60000);
    _refreshTimer = setTimeout(() => { refreshToken().catch(() => {}); }, ms);
  } catch (e) {
    // fallback: refresh every 2 hours
    _refreshTimer = setTimeout(() => { refreshToken().catch(() => {}); }, 1000 * 60 * 60 * 2);
  }
}

async function refreshToken() {
  const token = getToken();
  if (!token) return;
  try {
    // refresh token is sent via httpOnly cookie; include credentials
    const resp = await fetch(`${AUTH_API_BASE}/api/auth/refresh`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
    });
    if (!resp.ok) {
      // clear token and force re-login
      clearToken();
      window.location.href = '/login.html';
      return;
    }
    const data = await resp.json();
    if (data && data.token) setToken(data.token);
  } catch (err) {
    console.error('Failed to refresh token', err);
  }
}

function initAuth() {
  scheduleTokenRefresh();
}

window.auth = { getToken, setToken, clearToken, refreshToken, initAuth };
