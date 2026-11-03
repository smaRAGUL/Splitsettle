const BASE_URL = (import.meta.env.VITE_API_URL || 'http://localhost:5000/api').replace(/\/+$/, '');
const TOKEN_KEY = 'splitsettle_token';

export function getAuthToken() {
  try {
    return localStorage.getItem(TOKEN_KEY) || '';
  } catch {
    return '';
  }
}

export function setAuthToken(token) {
  try {
    if (token) {
      localStorage.setItem(TOKEN_KEY, token);
    } else {
      localStorage.removeItem(TOKEN_KEY);
    }
  } catch (err) {
    console.error('Failed to update auth token in localStorage', err);
  }
}

export function clearAuthToken() {
  setAuthToken('');
}

export async function apiClient(endpoint, options = {}) {
  const cleanEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
  const url = `${BASE_URL}${cleanEndpoint}`;

  const token = getAuthToken();
  const headers = {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(options.headers || {})
  };

  const config = {
    ...options,
    headers
  };

  if (config.body && typeof config.body === 'object' && !(config.body instanceof FormData)) {
    config.body = JSON.stringify(config.body);
  }

  let response;
  try {
    response = await fetch(url, config);
  } catch (netErr) {
    throw new Error('Unable to connect to the backend server. Please verify it is running on http://localhost:5000.');
  }

  const text = await response.text();
  let data = {};
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = { message: text };
    }
  }

  if (!response.ok) {
    const errorMsg = data.message || data.error || `HTTP error ${response.status}: ${response.statusText}`;
    const error = new Error(errorMsg);
    error.status = response.status;
    error.data = data;
    throw error;
  }

  return data;
}

// API Resource helpers
export const api = {
  auth: {
    register: (payload) => apiClient('/auth/register', { method: 'POST', body: payload }),
    login: (payload) => apiClient('/auth/login', { method: 'POST', body: payload }),
    getMe: () => apiClient('/auth/me', { method: 'GET' })
  },
  groups: {
    getAll: () => apiClient('/groups', { method: 'GET' }),
    getById: (id) => apiClient(`/groups/${id}`, { method: 'GET' }),
    create: (payload) => apiClient('/groups', { method: 'POST', body: payload }),
    addMember: (groupId, email) => apiClient(`/groups/${groupId}/members`, { method: 'POST', body: { email } })
  },
  expenses: {
    getAll: (groupId) => apiClient(`/groups/${groupId}/expenses`, { method: 'GET' }),
    create: (groupId, payload) => apiClient(`/groups/${groupId}/expenses`, { method: 'POST', body: payload }),
    update: (expenseId, payload) => apiClient(`/expenses/${expenseId}`, { method: 'PUT', body: payload }),
    delete: (expenseId) => apiClient(`/expenses/${expenseId}`, { method: 'DELETE' })
  },
  settlements: {
    getBalances: (groupId) => apiClient(`/groups/${groupId}/balances`, { method: 'GET' }),
    settle: (groupId, payload) => apiClient(`/groups/${groupId}/settle`, { method: 'POST', body: payload })
  }
};

export default apiClient;

