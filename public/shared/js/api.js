/* ============================================================
   SNAKE LAB — API Client
   Wrapper para todas las llamadas al backend
   ============================================================ */

// Values returned by the API are data, never markup.  Keep these helpers in the
// file that every page loads before its renderer.
const Security = {
  escapeHtml(value) {
    return String(value ?? '').replace(/[&<>'\"]/g, char => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;'
    })[char]);
  },

  integer(value, fallback = 0) {
    const number = Number.parseInt(value, 10);
    return Number.isSafeInteger(number) ? number : fallback;
  },

  imageUrl(value) {
    const url = String(value ?? '');
    return url.startsWith('/uploads/images/') ? (API.baseUrl + url) : '';
  },

  modelUrl(value) {
    const url = String(value ?? '');
    if (url.startsWith('/uploads/models/')) return API.baseUrl + url;
    return /^https?:\/\//i.test(url) ? url : '';
  },

  color(value) {
    const color = String(value ?? '').trim();
    return /^#[0-9a-f]{3,8}$/i.test(color) ? color : '#808080';
  }
};

const API = {
  baseUrl: String(window.SNAKE_LAB_API_URL || '').replace(/\/$/, ''),

  async request(endpoint, options = {}) {
    try {
      const response = await fetch(this.baseUrl + endpoint, {
        headers: {
          'Content-Type': 'application/json',
          ...options.headers
        },
        ...options
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Error en la solicitud');
      return data;
    } catch (error) {
      console.error(`API Error [${endpoint}]:`, error);
      throw error;
    }
  },

  // Categories
  async getCategories() {
    return this.request('/api/categories');
  },

  // Products
  async getProducts(params = {}) {
    const query = new URLSearchParams(params).toString();
    return this.request(`/api/products${query ? '?' + query : ''}`);
  },

  async getProduct(idOrSlug) {
    return this.request(`/api/products/${idOrSlug}`);
  },

  // Customers
  async createCustomer(data) {
    return this.request('/api/customers', {
      method: 'POST',
      body: JSON.stringify(data)
    });
  },

  // Orders
  async createOrder(data) {
    return this.request('/api/orders', {
      method: 'POST',
      body: JSON.stringify(data)
    });
  },

  // Settings
  async getSettings() {
    return this.request('/api/settings');
  }
};
