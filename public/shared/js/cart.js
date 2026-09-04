/* ============================================================
   SNAKE LAB — Cart Module
   Manages shopping cart state and UI
   ============================================================ */

const Cart = {
  items: [],
  
  init() {
    this.load();
    this.bindEvents();
    this.updateUI();
  },

  load() {
    try {
      const saved = localStorage.getItem('snakelab_cart');
      this.items = saved ? JSON.parse(saved) : [];
    } catch (e) {
      this.items = [];
    }
  },

  save() {
    localStorage.setItem('snakelab_cart', JSON.stringify(this.items));
  },

  addItem(product, options = {}) {
    const itemKey = `${product.id}-${options.size || ''}-${options.color || ''}-${options.material || ''}`;
    const existing = this.items.find(item => item.key === itemKey);

    if (existing) {
      existing.quantity += (options.quantity || 1);
    } else {
      this.items.push({
        key: itemKey,
        id: product.id,
        name: product.name,
        price: Number(options.price ?? product.price) || product.price,
        image: this.getFirstImage(product),
        size: options.size || null,
        color: options.color || null,
        colorHex: options.colorHex || options.color || null,
        colorSelections: options.colorSelections || {},
        variant: options.variant || null,
        variantImage: options.variantImage || null,
        material: options.material || null,
        quantity: options.quantity || 1
      });
    }

    this.save();
    this.updateUI();
    this.showToast(`${product.name} agregado al carrito`, 'success');
  },

  removeItem(key) {
    this.items = this.items.filter(item => item.key !== key);
    this.save();
    this.updateUI();
  },

  updateQuantity(key, delta) {
    const item = this.items.find(item => item.key === key);
    if (item) {
      item.quantity += delta;
      if (item.quantity <= 0) {
        this.removeItem(key);
        return;
      }
      this.save();
      this.updateUI();
    }
  },

  getTotal() {
    return this.items.reduce((sum, item) => sum + (item.price * item.quantity), 0);
  },

  getCount() {
    return this.items.reduce((sum, item) => sum + item.quantity, 0);
  },

  clear() {
    this.items = [];
    this.save();
    this.updateUI();
  },

  getFirstImage(product) {
    try {
      const images = typeof product.images === 'string' ? JSON.parse(product.images) : product.images;
      return images && images.length > 0 ? images[0] : '/uploads/images/placeholder.jpg';
    } catch {
      return '/uploads/images/placeholder.jpg';
    }
  },

  formatPrice(price) {
    return new Intl.NumberFormat('es-CO', {
      style: 'currency',
      currency: 'COP',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(price);
  },

  updateUI() {
    // Update badge
    const badge = document.getElementById('cart-badge');
    const count = this.getCount();
    if (badge) {
      badge.textContent = count;
      badge.classList.toggle('show', count > 0);
    }

    // Update count text
    const countText = document.getElementById('cart-count-text');
    if (countText) {
      countText.textContent = count > 0 ? `(${count} items)` : '';
    }

    // Update cart items
    const cartItemsEl = document.getElementById('cart-items');
    const cartEmptyEl = document.getElementById('cart-empty');
    const cartFooterEl = document.getElementById('cart-footer');

    if (!cartItemsEl) return;

    if (this.items.length === 0) {
      cartItemsEl.innerHTML = `
        <div class="cart-empty">
          <svg width="64" height="64"><use href="#icon-shopping-bag"/></svg>
          <p>Tu carrito está vacío</p>
          <button class="btn btn-secondary btn-sm" onclick="Cart.close(); document.getElementById('products').scrollIntoView({behavior:'smooth'})">Explorar productos</button>
        </div>
      `;
      if (cartFooterEl) cartFooterEl.style.display = 'none';
      return;
    }

    cartItemsEl.innerHTML = this.items.map(item => `
      <div class="cart-item" data-key="${Security.escapeHtml(item.key)}">
        <div class="cart-item-image">
          <img src="${Security.escapeHtml(Security.imageUrl(item.image))}" alt="${Security.escapeHtml(item.name)}" onerror="this.src='data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 200 200%22%3E%3Crect fill=%22%2314141e%22 width=%22200%22 height=%22200%22/%3E%3Ctext fill=%22%2371717a%22 font-family=%22sans-serif%22 font-size=%2214%22 x=%2250%25%22 y=%2250%25%22 text-anchor=%22middle%22 dy=%22.3em%22%3ESin imagen%3C/text%3E%3C/svg%3E'">
        </div>
        <div class="cart-item-details">
          <div class="cart-item-name">${Security.escapeHtml(item.name)}</div>
          <div class="cart-item-options">
            ${item.size ? `Tamaño: ${Security.escapeHtml(item.size)}` : ''}
            ${item.color ? ` · Color: ${Security.escapeHtml(item.color)}` : ''}
            ${item.colorSelections && Object.keys(item.colorSelections).length > 1 ? ` · ${Object.values(item.colorSelections).map(color => Security.escapeHtml(color)).join(' / ')}` : ''}
            ${item.variant ? ` · Ref: ${Security.escapeHtml(item.variant)}` : ''}
            ${item.material ? ` · ${Security.escapeHtml(item.material)}` : ''}
          </div>
          <div class="cart-item-bottom">
            <span class="cart-item-price">${this.formatPrice(item.price * item.quantity)}</span>
            <div class="cart-item-qty">
              <button onclick="Cart.updateQuantity(this.closest('.cart-item').dataset.key, -1)">
                <svg width="14" height="14"><use href="#icon-minus"/></svg>
              </button>
              <span>${Security.integer(item.quantity, 1)}</span>
              <button onclick="Cart.updateQuantity(this.closest('.cart-item').dataset.key, 1)">
                <svg width="14" height="14"><use href="#icon-plus"/></svg>
              </button>
            </div>
          </div>
        </div>
        <button class="cart-item-remove" onclick="Cart.removeItem(this.closest('.cart-item').dataset.key)">
          <svg><use href="#icon-trash-2"/></svg>
        </button>
      </div>
    `).join('');

    // Update totals
    const subtotal = this.getTotal();
    document.getElementById('cart-subtotal').textContent = this.formatPrice(subtotal);
    document.getElementById('cart-total').textContent = this.formatPrice(subtotal);

    if (cartFooterEl) cartFooterEl.style.display = 'block';
  },

  // Drawer toggle
  open() {
    document.getElementById('cart-overlay').classList.add('show');
    document.getElementById('cart-drawer').classList.add('open');
    document.body.style.overflow = 'hidden';
  },

  close() {
    document.getElementById('cart-overlay').classList.remove('show');
    document.getElementById('cart-drawer').classList.remove('open');
    document.body.style.overflow = '';
  },

  bindEvents() {
    document.getElementById('cart-toggle')?.addEventListener('click', () => this.open());
    document.getElementById('cart-close')?.addEventListener('click', () => this.close());
    document.getElementById('cart-overlay')?.addEventListener('click', () => this.close());
    document.getElementById('checkout-btn')?.addEventListener('click', () => {
      this.close();
      Checkout.open();
    });
  },

  showToast(message, type = 'success') {
    const container = document.getElementById('toast-container');
    if (!container) return;

    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.innerHTML = `
      <svg><use href="#icon-${type === 'success' ? 'check-circle' : 'alert-circle'}"/></svg>
      <span>${Security.escapeHtml(message)}</span>
    `;

    container.appendChild(toast);

    setTimeout(() => {
      toast.style.animation = 'toastOut 0.3s ease forwards';
      setTimeout(() => toast.remove(), 300);
    }, 3000);
  }
};
