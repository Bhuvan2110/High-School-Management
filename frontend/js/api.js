// frontend/js/api.js
// Central API client — all fetch calls go through here
// Handles token refresh, error extraction, and base URL

const API_BASE = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
  ? 'http://localhost:5000/api'
  : window.location.hostname.includes('onrender.com')
    ? 'https://hs-mgmt-api.onrender.com/api'
    : 'https://cool-parts-smash.loca.lt/api';

// ── Core fetch wrapper ──────────────────────────────────────
async function apiFetch(endpoint, options = {}) {
  const config = {
    credentials: 'include',   // send cookies
    headers: { 'Content-Type': 'application/json', ...options.headers },
    ...options,
  };
  if (config.body && typeof config.body === 'object') {
    config.body = JSON.stringify(config.body);
  }

  let res = await fetch(`${API_BASE}${endpoint}`, config);

  // Auto-refresh on 401 (token expired)
  if (res.status === 401 && endpoint !== '/auth/login' && endpoint !== '/auth/refresh') {
    const refreshed = await tryRefreshToken();
    if (refreshed) {
      res = await fetch(`${API_BASE}${endpoint}`, config);
    } else {
      // Refresh failed — redirect to login
      Auth.clearUser();
      window.location.href = '/frontend/pages/login.html';
      return null;
    }
  }

  const data = await res.json().catch(() => ({ success: false, message: 'Invalid server response' }));
  return { ok: res.ok, status: res.status, data };
}

async function tryRefreshToken() {
  try {
    const res = await fetch(`${API_BASE}/auth/refresh`, {
      method: 'POST', credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
    });
    return res.ok;
  } catch { return false; }
}

// ── Auth API ────────────────────────────────────────────────
const AuthAPI = {
  register: (payload)  => apiFetch('/auth/register', { method: 'POST', body: payload }),
  login:    (payload)  => apiFetch('/auth/login',    { method: 'POST', body: payload }),
  logout:   ()         => apiFetch('/auth/logout',   { method: 'POST' }),
  getMe:    ()         => apiFetch('/auth/me'),
  refresh:  ()         => apiFetch('/auth/refresh',  { method: 'POST' }),
};

// ── Auth helpers ─────────────────────────────────────────────
const Auth = {
  setUser: (user) => localStorage.setItem('hs_user', JSON.stringify(user)),
  getUser: ()     => { try { return JSON.parse(localStorage.getItem('hs_user')); } catch { return null; } },
  clearUser: ()   => localStorage.removeItem('hs_user'),
  isLoggedIn: ()  => !!Auth.getUser(),

  requireAuth: () => {
    if (!Auth.isLoggedIn()) {
      window.location.href = '/frontend/pages/login.html';
      return null;
    }
    return Auth.getUser();
  },

  requireRole: (role) => {
    const user = Auth.requireAuth();
    if (!user) return null;
    const roles = Array.isArray(role) ? role : [role];
    if (!roles.includes(user.role)) {
      window.location.href = '/frontend/pages/login.html';
      return null;
    }
    return user;
  },

  redirectIfLoggedIn: () => {
    const user = Auth.getUser();
    if (!user) return;
    const routes = { admin: 'admin.html', teacher: 'teacher.html', student: 'student.html' };
    window.location.href = `/frontend/pages/${routes[user.role] || 'login.html'}`;
  },
};

// ── UI helpers ────────────────────────────────────────────────
const UI = {
  showAlert: (containerId, message, type = 'error') => {
    const el = document.getElementById(containerId);
    if (!el) return;
    const icons = { success: '✅', error: '❌', info: 'ℹ️', warning: '⚠️' };
    el.innerHTML = `<div class="alert alert-${type}">${icons[type] || ''} ${message}</div>`;
    el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    if (type === 'success') setTimeout(() => { el.innerHTML = ''; }, 5000);
  },

  clearAlert: (containerId) => {
    const el = document.getElementById(containerId);
    if (el) el.innerHTML = '';
  },

  setLoading: (btnId, loading, text = 'Save') => {
    const btn = document.getElementById(btnId);
    if (!btn) return;
    btn.disabled = loading;
    btn.innerHTML = loading
      ? `<span class="spinner"></span> Please wait...`
      : text;
  },

  openModal:  (id) => document.getElementById(id)?.classList.add('open'),
  closeModal: (id) => document.getElementById(id)?.classList.remove('open'),

  initAvatar: (name) => {
    const initials = name?.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2) || '??';
    document.querySelectorAll('.user-avatar').forEach(el => el.textContent = initials);
    document.querySelectorAll('.user-name').forEach(el => el.textContent = name || '');
  },

  formatDate: (dateStr) => {
    if (!dateStr) return '—';
    return new Date(dateStr).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
  },

  capitalize: (str) => str ? str.charAt(0).toUpperCase() + str.slice(1) : '',
};

// ── Sidebar active link ───────────────────────────────────────
function initSidebar(user) {
  if (!user) return;
  document.querySelectorAll('.user-name').forEach(el  => el.textContent = user.name || '');
  document.querySelectorAll('.user-role').forEach(el  => el.textContent = user.role || '');
  UI.initAvatar(user.name);

  // Highlight active nav item
  const path = window.location.pathname;
  document.querySelectorAll('.nav-item').forEach(item => {
    if (item.getAttribute('href') && path.includes(item.getAttribute('href').split('/').pop())) {
      item.classList.add('active');
    }
  });

  // Logout button
  document.getElementById('logoutBtn')?.addEventListener('click', async () => {
    await AuthAPI.logout();
    Auth.clearUser();
    window.location.href = '/frontend/pages/login.html';
  });
}

// ── Mobile sidebar toggle ─────────────────────────────────────
document.getElementById('menuToggle')?.addEventListener('click', () => {
  document.querySelector('.sidebar')?.classList.toggle('open');
});

// Close modals on overlay click
document.querySelectorAll('.modal-overlay').forEach(overlay => {
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) overlay.classList.remove('open');
  });
});
