/* ============================================================
   SNAKE LAB — Admin Panel Logic
   ============================================================ */

const Admin = {
  token: null,
  products: [],
  categories: [],
  orders: [],
  customers: [],
  settings: {},

  init() {
    this.checkAuth();
    this.bindEvents();
  },

  showLogin() {
    document.getElementById('login-overlay').style.display = 'flex';
    document.getElementById('admin-layout').style.display = 'none';
  },

  showAdmin() {
    document.getElementById('login-overlay').style.display = 'none';
    document.getElementById('admin-layout').style.display = 'flex';
  },

  async request(url, options = {}) {
    const headers = { ...(options.headers || {}) };
    if (this.token) headers.Authorization = 'Bearer ' + this.token;
    if (options.body && !(options.body instanceof FormData) && !headers['Content-Type']) {
      headers['Content-Type'] = 'application/json';
    }
    const res = await fetch(API.baseUrl + url, { ...options, headers });
    if (res.status === 401) {
      sessionStorage.removeItem('admin_token');
      this.token = null;
      this.showLogin();
      this.showToast('Sesión expirada. Inicia sesión de nuevo.', 'error');
    }
    return res;
  },

  async checkAuth() {
    this.token = sessionStorage.getItem('admin_token');
    if (!this.token) {
      this.showLogin();
      return;
    }
    try {
      const res = await this.request('/api/admin/me');
      if (!res.ok) {
        sessionStorage.removeItem('admin_token');
        this.token = null;
        this.showLogin();
        return;
      }
      this.showAdmin();
      this.loadDashboard();
    } catch (e) {
      this.showLogin();
    }
  },

  async login(e) {
    e.preventDefault();
    const username = document.getElementById('admin-username').value;
    const password = document.getElementById('admin-password').value;
    try {
      const res = await fetch(API.baseUrl + '/api/admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        sessionStorage.setItem('admin_token', data.token);
        this.token = data.token;
        this.showToast('Login exitoso');
        this.showAdmin();
        this.loadDashboard();
      } else {
        this.showToast(data.error || 'Credenciales incorrectas', 'error');
      }
    } catch (err) {
      this.showToast('Error de conexión', 'error');
    }
  },

  async logout() {
    try {
      await this.request('/api/admin/logout', { method: 'POST' });
    } catch (e) {}
    sessionStorage.removeItem('admin_token');
    this.token = null;
    this.showLogin();
  },

  bindEvents() {
    document.getElementById('login-form')?.addEventListener('submit', (e) => this.login(e));

    document.getElementById('prod-add-color')?.addEventListener('click', () => this.addManualColor());
    document.getElementById('prod-color-input')?.addEventListener('keydown', (event) => {
      if (event.key === 'Enter') {
        event.preventDefault();
        this.addManualColor();
      }
    });
    document.getElementById('prod-sizes')?.addEventListener('input', () => this.renderSizePriceEditor());
    document.getElementById('prod-add-variant')?.addEventListener('click', () => this.addVariantEditorRow());

    // Navigation
    document.querySelectorAll('.admin-nav a').forEach(link => {
      link.addEventListener('click', (e) => {
        e.preventDefault();
        const view = e.currentTarget.dataset.view;
        this.switchView(view);
        document.querySelectorAll('.admin-nav a').forEach(a => a.classList.remove('active'));
        e.currentTarget.classList.add('active');
      });
    });

    // Close modals on overlay click
    document.querySelectorAll('.admin-modal').forEach(m => {
      m.addEventListener('click', (e) => {
        if (e.target.classList.contains('admin-modal')) {
          m.classList.remove('show');
        }
      });
    });
  },

  parseImages(imagesValue) {
    try {
      const parsed = JSON.parse(imagesValue || '[]');
      return Array.isArray(parsed) ? parsed.filter(Boolean).map(String) : [];
    } catch (e) {
      return [];
    }
  },

  parseModelList(value) {
    if (!value) return [];
    try {
      const parsed = JSON.parse(value);
      if (Array.isArray(parsed)) {
        return parsed.filter(Boolean).map(String).map(url => url.trim()).filter(Boolean);
      }
      if (typeof parsed === 'string' && parsed.trim()) {
        return [parsed.trim()];
      }
    } catch (e) {
      const raw = String(value).trim();
      return raw ? [raw] : [];
    }
    return [];
  },

  parseArray(value) {
    try {
      const parsed = JSON.parse(value || '[]');
      return Array.isArray(parsed) ? parsed : [];
    } catch (e) {
      return [];
    }
  },

  parseSizePrices(value) {
    try {
      const parsed = JSON.parse(value || '{}');
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {};
      return Object.entries(parsed).reduce((acc, [size, price]) => {
        const key = String(size || '').trim();
        const numeric = Number.parseFloat(price);
        if (key && Number.isFinite(numeric)) acc[key] = numeric;
        return acc;
      }, {});
    } catch (e) {
      return {};
    }
  },

  parseVariants(value) {
    try {
      const parsed = JSON.parse(value || '[]');
      return Array.isArray(parsed) ? parsed.filter(variant => variant && variant.name).map(variant => ({
        name: String(variant.name), price: variant.price ?? '', comparePrice: variant.comparePrice ?? '', description: String(variant.description || ''), image: String(variant.image || '')
      })) : [];
    } catch { return []; }
  },

  renderVariantEditor(variants = null) {
    const editor = document.getElementById('prod-variant-editor');
    if (!editor) return;
    const items = variants || this.parseVariants(document.getElementById('prod-variants')?.value || '[]');
    editor.innerHTML = items.map((variant, index) => `
      <div class="variant-row" data-variant-index="${index}">
        <div class="variant-row-head"><strong>Referencia ${index + 1}</strong><button type="button" class="variant-remove" data-variant-remove="${index}">Eliminar</button></div>
        <input type="text" class="form-input variant-name" placeholder="Nombre o referencia" value="${Security.escapeHtml(variant.name)}">
        <div class="variant-price-row"><input type="number" min="0" class="form-input variant-price" placeholder="Precio" value="${variant.price}"><input type="number" min="0" class="form-input variant-compare" placeholder="Precio anterior" value="${variant.comparePrice}"></div>
        <textarea class="form-input variant-description" rows="2" placeholder="Descripción de esta referencia">${Security.escapeHtml(variant.description)}</textarea>
        <input type="text" class="form-input variant-image" placeholder="/uploads/images/imagen.webp" value="${Security.escapeHtml(variant.image)}">
        <input type="file" class="form-input variant-image-file" accept="image/*" aria-label="Imagen de la referencia">
      </div>
    `).join('');
    editor.querySelectorAll('input, textarea').forEach(input => input.addEventListener('input', () => this.syncVariants()));
    editor.querySelectorAll('[data-variant-remove]').forEach(button => button.addEventListener('click', () => {
      const items = this.getVariants().filter((variant, index) => index !== Number(button.dataset.variantRemove));
      this.renderVariantEditor(items);
      this.syncVariants();
    }));
    this.syncVariants();
  },

  addVariantEditorRow() {
    const items = this.getVariants();
    items.push({ name: '', price: '', comparePrice: '', description: '', image: '' });
    this.renderVariantEditor(items);
  },

  getVariants() {
    return [...document.querySelectorAll('#prod-variant-editor .variant-row')].map(row => ({
      name: row.querySelector('.variant-name')?.value.trim() || '', price: row.querySelector('.variant-price')?.value || '', comparePrice: row.querySelector('.variant-compare')?.value || '', description: row.querySelector('.variant-description')?.value.trim() || '', image: row.querySelector('.variant-image')?.value.trim() || ''
    }));
  },

  syncVariants() {
    const input = document.getElementById('prod-variants');
    if (input) input.value = JSON.stringify(this.getVariants().filter(variant => variant.name && variant.price !== ''));
  },

  renderSizePriceEditor(sizePrices = null) {
    const editor = document.getElementById('prod-size-price-editor');
    const sizesInput = document.getElementById('prod-sizes');
    if (!editor || !sizesInput) return;

    const sizes = this.parseArray(sizesInput.value).map(String).map(size => size.trim()).filter(Boolean);
    const prices = sizePrices || this.parseSizePrices(document.getElementById('prod-size-prices')?.value || '{}');
    editor.innerHTML = sizes.length ? sizes.map(size => `
      <label class="size-price-row">
        <span>${Security.escapeHtml(size)}</span>
        <input type="number" min="0" step="1" class="form-input size-price-input" data-size="${Security.escapeHtml(size)}" value="${prices[size] ?? ''}" placeholder="Precio base">
      </label>
    `).join('') : '<p class="size-price-empty">Agrega tamaños arriba para asignar precios individuales.</p>';

    editor.querySelectorAll('.size-price-input').forEach(input => {
      input.addEventListener('input', () => {
        document.getElementById('prod-size-prices').value = JSON.stringify(this.getSizePrices());
      });
    });
    document.getElementById('prod-size-prices').value = JSON.stringify(this.getSizePrices());
  },

  getSizePrices() {
    const prices = {};
    document.querySelectorAll('#prod-size-price-editor .size-price-input').forEach(input => {
      const size = String(input.dataset.size || '').trim();
      const price = Number.parseFloat(input.value);
      if (size && Number.isFinite(price)) prices[size] = price;
    });
    return prices;
  },

  colorPresets: ['#000000', '#ffffff', '#f5f5f5', '#6b7280', '#d62828', '#ef4444', '#ff8a00', '#f5c542', '#22c55e', '#3ecf91', '#00b8ff', '#2563eb', '#4f46e5', '#8b5cf6', '#c56eff', '#d9a441', '#8b5e3c', '#1a1a2e'],

  getSelectedColors() {
    const value = document.getElementById('prod-colors')?.value || '[]';
    const parsed = this.parseColors(value);
    return parsed;
  },

  parseColors(value) {
    try {
      const parsed = JSON.parse(value || '[]');
      if (!Array.isArray(parsed)) return [];
      const normalized = parsed.filter(Boolean).map(String).map(color => color.trim());
      return [...new Set(normalized.filter(color => /^#[0-9a-fA-F]{3,8}$/.test(color)))];
    } catch (e) {
      return [];
    }
  },

  renderColorPalette(selectedColors = []) {
    const palette = document.getElementById('prod-color-palette');
    if (!palette) return;

    const selectedSet = new Set(selectedColors.map(color => color.toLowerCase()));
    palette.innerHTML = this.colorPresets.map(color => `
      <button type="button" class="color-swatch ${selectedSet.has(color.toLowerCase()) ? 'selected' : ''}" data-color="${Security.escapeHtml(color)}" style="background:${Security.escapeHtml(color)}" title="${Security.escapeHtml(color)}" aria-label="${Security.escapeHtml(color)}"></button>
    `).join('');

    palette.querySelectorAll('.color-swatch').forEach(btn => {
      btn.addEventListener('click', () => {
        const color = btn.dataset.color;
        const current = this.getSelectedColors();
        const next = current.includes(color) ? current.filter(c => c !== color) : [...current, color];
        document.getElementById('prod-colors').value = JSON.stringify(next);
        document.getElementById('prod-color-input').value = next[0] || '';
        this.renderColorPalette(next);
      });
    });
  },

  addManualColor() {
    const input = document.getElementById('prod-color-input');
    if (!input) return;
    const raw = (input.value || '').trim();
    if (!/^#[0-9a-fA-F]{3,8}$/.test(raw)) {
      this.showToast('Ingresa un color válido en formato HEX, por ejemplo #3ecf91', 'error');
      return;
    }

    const current = this.getSelectedColors();
    const next = current.includes(raw.toLowerCase()) ? current : [...current, raw.toLowerCase()];
    document.getElementById('prod-colors').value = JSON.stringify(next);
    input.value = next[0] || '';
    this.renderColorPalette(next);
  },

  updateProductImageGallery(images) {
    const gallery = document.getElementById('prod-existing-images-gallery');
    const wrapper = document.getElementById('prod-existing-images-gallery-wrapper');
    if (!gallery || !wrapper) return;

    const current = images.filter(Boolean);
    if (!current.length) {
      wrapper.style.display = 'none';
      gallery.innerHTML = '';
      return;
    }

    wrapper.style.display = 'block';
    const originalCover = document.getElementById('prod-existing-cover')?.value || current[0];
    gallery.innerHTML = current.map((image, index) => {
      const isCover = image === originalCover;
      return `
        <div class="product-thumb-item ${isCover ? 'is-cover' : ''}">
          <img src="${Security.escapeHtml(Security.imageUrl(image))}" alt="Imagen ${index + 1}" onerror="this.style.display='none'">
          ${isCover ? '<span class="thumb-badge">Portada</span>' : ''}
          <button type="button" class="thumb-remove" data-index="${Security.integer(index)}" aria-label="Eliminar imagen">×</button>
          <button type="button" class="thumb-cover-button" data-action="cover" data-index="${Security.integer(index)}">${isCover ? 'Portada' : 'Usar portada'}</button>
        </div>
      `;
    }).join('');

    gallery.querySelectorAll('.thumb-remove').forEach(button => {
      button.addEventListener('click', () => {
        const index = Number(button.dataset.index);
        const nextImages = [...current];
        nextImages.splice(index, 1);
        if (!nextImages.length) {
          document.getElementById('prod-existing-cover').value = '';
          document.getElementById('prod-existing-images').value = '[]';
          this.updateProductImageGallery([]);
          return;
        }

        const nextCover = document.getElementById('prod-existing-cover').value || nextImages[0];
        document.getElementById('prod-existing-cover').value = nextCover;
        document.getElementById('prod-existing-images').value = JSON.stringify(nextImages.filter(url => url !== nextCover));
        this.updateProductImageGallery(nextImages);
      });
    });

    gallery.querySelectorAll('.thumb-cover-button').forEach(button => {
      button.addEventListener('click', () => {
        const index = Number(button.dataset.index);
        const selected = current[index];
        if (!selected) return;
        document.getElementById('prod-existing-cover').value = selected;
        document.getElementById('prod-existing-images').value = JSON.stringify(current.filter(url => url !== selected));
        this.updateProductImageGallery(current);
      });
    });
  },

  updateModelGallery(models) {
    const gallery = document.getElementById('prod-existing-models-gallery');
    const wrapper = document.getElementById('prod-existing-models-gallery-wrapper');
    if (!gallery || !wrapper) return;

    const current = models.filter(Boolean);
    if (!current.length) {
      wrapper.style.display = 'none';
      gallery.innerHTML = '';
      return;
    }

    wrapper.style.display = 'block';
    const defaultModel = document.getElementById('prod-existing-model')?.value || current[0];
    gallery.innerHTML = current.map((model, index) => {
      const isDefault = model === defaultModel;
      const fileName = model.split('/').pop() || `modelo-${index + 1}`;
      return `
        <div class="product-thumb-item ${isDefault ? 'is-cover' : ''}">
          <div style="padding:12px 14px; background:rgba(255,255,255,0.02); border-radius:10px; width:100%; color:var(--text-primary); font-size:0.8rem; word-break:break-all;">${Security.escapeHtml(fileName)}</div>
          <button type="button" class="thumb-remove" data-model-index="${Security.integer(index)}" aria-label="Eliminar modelo">×</button>
          <button type="button" class="thumb-cover-button" data-model-action="default" data-model-index="${Security.integer(index)}">${isDefault ? 'Predeterminado' : 'Usar por defecto'}</button>
        </div>
      `;
    }).join('');

    gallery.querySelectorAll('.thumb-remove').forEach(button => {
      button.addEventListener('click', () => {
        const index = Number(button.dataset.modelIndex);
        const nextModels = [...current];
        nextModels.splice(index, 1);
        document.getElementById('prod-existing-models').value = JSON.stringify(nextModels);
        document.getElementById('prod-existing-model').value = nextModels[0] || '';
        this.updateModelGallery(nextModels);
      });
    });

    gallery.querySelectorAll('[data-model-action="default"]').forEach(button => {
      button.addEventListener('click', () => {
        const index = Number(button.dataset.modelIndex);
        const selected = current[index];
        if (!selected) return;
        document.getElementById('prod-existing-model').value = selected;
        this.updateModelGallery(current);
      });
    });
  },

  switchView(viewId) {
    document.querySelectorAll('.admin-view').forEach(v => v.classList.remove('active'));
    document.getElementById(`view-${viewId}`)?.classList.add('active');

    if (viewId === 'dashboard') this.loadDashboard();
    if (viewId === 'products') this.loadProducts();
    if (viewId === 'orders') this.loadOrders();
    if (viewId === 'categories') this.loadCategories();
    if (viewId === 'customers') this.loadCustomers();
    if (viewId === 'settings') this.loadSettings();
  },

  // --- Dashboard ---
  async loadDashboard() {
    try {
      const statsRes = await this.request('/api/stats');
      const stats = await statsRes.json();
      
      const grid = document.getElementById('stats-grid');
      grid.innerHTML = `
        <div class="stat-card">
          <div class="stat-title">Ventas Totales</div>
          <div class="stat-value">${this.formatPrice(stats.revenue)}</div>
        </div>
        <div class="stat-card">
          <div class="stat-title">Pedidos</div>
          <div class="stat-value">${stats.orders}</div>
        </div>
        <div class="stat-card">
          <div class="stat-title">Productos</div>
          <div class="stat-value">${stats.products}</div>
        </div>
        <div class="stat-card">
          <div class="stat-title">Clientes</div>
          <div class="stat-value">${stats.customers}</div>
        </div>
      `;

      // Load recent orders
      const ordersRes = await this.request('/api/orders');
      const orders = await ordersRes.json();
      const tbody = document.getElementById('recent-orders-list');
      tbody.innerHTML = orders.slice(0, 5).map(o => `
        <tr>
          <td>#${Security.integer(o.id)}</td>
          <td>${Security.escapeHtml(o.customer_name)}</td>
          <td>${this.formatPrice(o.total)}</td>
          <td><span class="status-badge status-${Security.escapeHtml(o.status)}">${Security.escapeHtml(o.status)}</span></td>
          <td>${new Date(o.created_at).toLocaleDateString()}</td>
        </tr>
      `).join('');

    } catch (e) {
      console.error(e);
    }
  },

  // --- Products ---
  async loadProducts() {
    try {
      // Load categories for dropdown first
      const catRes = await this.request('/api/categories');
      this.categories = await catRes.json();

      const prodRes = await this.request('/api/products');
      this.products = await prodRes.json();

      const tbody = document.getElementById('products-list');
      tbody.innerHTML = this.products.map(p => {
        let img = '';
        const images = this.parseImages(p.images);
        img = images[0] || '';
        return `
        <tr>
          <td><img src="${Security.escapeHtml(Security.imageUrl(img))}" class="thumb-cell" onerror="this.style.display='none'"></td>
          <td>${Security.escapeHtml(p.name)}</td>
          <td>${Security.escapeHtml(p.category_name || '-')}</td>
          <td>${this.formatPrice(p.price)}</td>
          <td>${Security.integer(p.stock)}</td>
          <td>
            <div class="action-btns">
              <button class="icon-btn" onclick="Admin.editProduct(${Security.integer(p.id)})"><svg><use href="#icon-edit"/></svg></button>
              <button class="icon-btn" onclick="Admin.deleteProduct(${Security.integer(p.id)})"><svg><use href="#icon-trash"/></svg></button>
            </div>
          </td>
        </tr>
      `}).join('');
    } catch (e) {
      console.error(e);
    }
  },

  openProductModal() {
    document.getElementById('product-form').reset();
    document.getElementById('prod-id').value = '';
    document.getElementById('prod-existing-cover').value = '';
    document.getElementById('prod-existing-images').value = '[]';
    document.getElementById('prod-existing-model').value = '';
    document.getElementById('prod-existing-models').value = '[]';
    document.getElementById('prod-color-input').value = '';
    document.getElementById('prod-colors').value = '[]';
    document.getElementById('prod-size-prices').value = '{}';
    document.getElementById('prod-dimensions').value = '{}';
    document.getElementById('prod-customizable-parts').value = '[]';
    document.getElementById('prod-fixed-parts').value = '[]';
    document.getElementById('prod-show-3d').checked = true;
    document.getElementById('prod-variants').value = '[]';
    this.renderSizePriceEditor({});
    this.renderVariantEditor([]);
    this.renderColorPalette([]);
    this.updateProductImageGallery([]);
    this.updateModelGallery([]);
    
    // Populate categories
    const catSelect = document.getElementById('prod-category');
    catSelect.innerHTML = this.categories.map(c => `<option value="${Security.integer(c.id)}">${Security.escapeHtml(c.name)}</option>`).join('');
    
    document.getElementById('product-modal-title').textContent = 'Nuevo Producto';
    document.getElementById('product-modal').classList.add('show');
  },

  editProduct(id) {
    const p = this.products.find(x => x.id === id);
    if (!p) return;
    
    this.openProductModal();
    document.getElementById('product-modal-title').textContent = 'Editar Producto';
    
    const existingImages = this.parseImages(p.images);
    const coverImage = existingImages[0] || '';
    const galleryImages = existingImages.slice(1);
    const colorValues = this.parseColors(p.colors || '[]');
    const modelList = this.parseModelList(p.model_3d || '[]');
    const defaultModel = modelList[0] || '';
    const sizePrices = this.parseSizePrices(p.size_prices || '{}');

    document.getElementById('prod-id').value = p.id;
    document.getElementById('prod-name').value = p.name;
    document.getElementById('prod-category').value = p.category_id;
    document.getElementById('prod-desc').value = p.description;
    document.getElementById('prod-price').value = p.price;
    document.getElementById('prod-compare').value = p.compare_price || '';
    document.getElementById('prod-sizes').value = p.sizes || '[]';
    document.getElementById('prod-materials').value = p.materials || '[]';
    document.getElementById('prod-size-prices').value = JSON.stringify(sizePrices);
    document.getElementById('prod-dimensions').value = p.dimensions || '{}';
    document.getElementById('prod-customizable-parts').value = p.customizable_parts || '[]';
    document.getElementById('prod-fixed-parts').value = p.fixed_parts || '[]';
    document.getElementById('prod-show-3d').checked = p.show_3d !== 0;
    document.getElementById('prod-variants').value = p.variants || '[]';
    this.renderSizePriceEditor(sizePrices);
    this.renderVariantEditor(this.parseVariants(p.variants || '[]'));
    document.getElementById('prod-days').value = p.production_days || 3;
    document.getElementById('prod-stock').value = p.stock || 99;
    document.getElementById('prod-featured').checked = p.is_featured === 1;
    document.getElementById('prod-trending').checked = p.is_trending === 1;
    document.getElementById('prod-existing-cover').value = coverImage;
    document.getElementById('prod-existing-images').value = JSON.stringify(galleryImages);
    document.getElementById('prod-existing-models').value = JSON.stringify(modelList);
    document.getElementById('prod-existing-model').value = defaultModel;
    document.getElementById('prod-cover-image').value = '';
    document.getElementById('prod-images').value = '';
    ['prod-model-1', 'prod-model-2', 'prod-model-3'].forEach((inputId) => {
      document.getElementById(inputId).value = '';
    });
    document.getElementById('prod-colors').value = JSON.stringify(colorValues);
    document.getElementById('prod-color-input').value = colorValues[0] || '';
    this.renderColorPalette(colorValues);
    this.updateProductImageGallery(existingImages);
    this.updateModelGallery(modelList);
  },

  async saveProduct(e) {
    e.preventDefault();
    const id = document.getElementById('prod-id').value;
    
    const formData = new FormData();
    formData.append('name', document.getElementById('prod-name').value);
    formData.append('category_id', document.getElementById('prod-category').value);
    formData.append('description', document.getElementById('prod-desc').value);
    formData.append('price', document.getElementById('prod-price').value);
    formData.append('compare_price', document.getElementById('prod-compare').value);
    formData.append('sizes', document.getElementById('prod-sizes').value);
    formData.append('colors', document.getElementById('prod-colors').value || '[]');
    formData.append('materials', document.getElementById('prod-materials').value);
    formData.append('size_prices', JSON.stringify(this.getSizePrices()));
    formData.append('dimensions', document.getElementById('prod-dimensions').value || '{}');
    formData.append('customizable_parts', document.getElementById('prod-customizable-parts').value || '[]');
    formData.append('fixed_parts', document.getElementById('prod-fixed-parts').value || '[]');
    formData.append('show_3d', document.getElementById('prod-show-3d').checked ? '1' : '0');
    formData.append('variants', document.getElementById('prod-variants').value || '[]');
    formData.append('production_days', document.getElementById('prod-days').value);
    formData.append('stock', document.getElementById('prod-stock').value);
    formData.append('is_featured', document.getElementById('prod-featured').checked ? 1 : 0);
    formData.append('is_trending', document.getElementById('prod-trending').checked ? 1 : 0);
    
    const remainingImages = this.parseImages(document.getElementById('prod-existing-images').value || '[]');
    const coverImage = document.getElementById('prod-existing-cover').value || '';
    const orderedImages = coverImage ? [coverImage, ...remainingImages.filter(url => url !== coverImage)] : remainingImages;
    const existingModels = this.parseModelList(document.getElementById('prod-existing-models').value || '[]');
    const selectedModel = document.getElementById('prod-existing-model').value || existingModels[0] || '';

    formData.append('existing_cover', coverImage);
    formData.append('existing_images', JSON.stringify(orderedImages));
    formData.append('existing_models', JSON.stringify(existingModels));
    formData.append('existing_model', selectedModel);

    const coverFile = document.getElementById('prod-cover-image').files[0];
    if (coverFile) {
      formData.append('cover_image', coverFile);
    }
    
    const imageFiles = document.getElementById('prod-images').files;
    for (let i = 0; i < imageFiles.length; i++) {
      formData.append('images', imageFiles[i]);
    }
    
    ['prod-model-1', 'prod-model-2', 'prod-model-3'].forEach((inputId) => {
      const file = document.getElementById(inputId)?.files[0];
      if (file) formData.append('model', file);
    });
    document.querySelectorAll('.variant-image-file').forEach((input, index) => {
      if (input.files[0]) formData.append(`variant_image_${index}`, input.files[0]);
    });

    try {
      const url = id ? `/api/products/${id}` : '/api/products';
      const method = id ? 'PUT' : 'POST';
      
      const res = await this.request(url, { method, body: formData });
      if (res.ok) {
        this.showToast('Producto guardado');
        this.closeModal('product-modal');
        this.loadProducts();
      } else {
        const err = await res.json();
        this.showToast(err.error || 'Error al guardar', 'error');
      }
    } catch (e) {
      this.showToast('Error de conexión', 'error');
    }
  },

  async deleteProduct(id) {
    if (!confirm('¿Seguro que deseas eliminar este producto?')) return;
    try {
      await this.request(`/api/products/${id}`, { method: 'DELETE' });
      this.showToast('Producto eliminado');
      this.loadProducts();
    } catch (e) {
      this.showToast('Error al eliminar', 'error');
    }
  },

  // --- Orders ---
  async loadOrders() {
    try {
      const res = await this.request('/api/orders');
      this.orders = await res.json();
      
      const tbody = document.getElementById('orders-list');
      tbody.innerHTML = this.orders.map(o => `
        <tr>
          <td>#${Security.integer(o.id)}</td>
          <td>${Security.escapeHtml(o.customer_name)}</td>
          <td>${this.formatPrice(o.total)}</td>
          <td>${Security.escapeHtml(o.payment_method)}</td>
          <td>
            <select onchange="Admin.updateOrderStatus(${Security.integer(o.id)}, this.value)" class="form-input" style="padding:4px; font-size:0.8rem; height:auto;">
              <option value="pendiente" ${o.status === 'pendiente' ? 'selected' : ''}>Pendiente</option>
              <option value="pagado" ${o.status === 'pagado' ? 'selected' : ''}>Pagado</option>
              <option value="imprimiendo" ${o.status === 'imprimiendo' ? 'selected' : ''}>Imprimiendo</option>
              <option value="enviado" ${o.status === 'enviado' ? 'selected' : ''}>Enviado</option>
              <option value="completado" ${o.status === 'completado' ? 'selected' : ''}>Completado</option>
              <option value="cancelado" ${o.status === 'cancelado' ? 'selected' : ''}>Cancelado</option>
            </select>
          </td>
          <td>${new Date(o.created_at).toLocaleDateString()}</td>
          <td>
            <button class="icon-btn" onclick="Admin.viewOrder(${Security.integer(o.id)})"><svg><use href="#icon-eye"/></svg></button>
          </td>
        </tr>
      `).join('');
    } catch (e) {
      console.error(e);
    }
  },

  async updateOrderStatus(id, status) {
    try {
      await this.request(`/api/orders/${id}/status`, {
        method: 'PUT',
        body: JSON.stringify({ status })
      });
      this.showToast('Estado actualizado');
    } catch (e) {
      this.showToast('Error al actualizar', 'error');
    }
  },

  viewOrder(id) {
    const o = this.orders.find(x => x.id === id);
    if (!o) return;
    
    let items = [];
    try { items = JSON.parse(o.items); } catch(e){}

    const body = document.getElementById('order-modal-body');
    body.innerHTML = `
      <div style="display:grid; grid-template-columns:1fr 1fr; gap:20px; margin-bottom:20px;">
        <div>
          <h3 style="margin-bottom:10px; color:var(--accent);">Cliente</h3>
          <p><strong>Nombre:</strong> ${Security.escapeHtml(o.customer_name)}</p>
          <p><strong>Email:</strong> ${Security.escapeHtml(o.customer_email)}</p>
          <p><strong>Teléfono:</strong> ${Security.escapeHtml(o.customer_phone)}</p>
        </div>
        <div>
          <h3 style="margin-bottom:10px; color:var(--accent);">Detalles</h3>
          <p><strong>Fecha:</strong> ${new Date(o.created_at).toLocaleString()}</p>
          <p><strong>Método Pago:</strong> ${Security.escapeHtml(o.payment_method)}</p>
          <p><strong>Estado:</strong> ${Security.escapeHtml(o.status)}</p>
        </div>
      </div>
      
      <h3 style="margin-bottom:10px; color:var(--accent);">Productos</h3>
      <table class="admin-table" style="margin-bottom:20px;">
        <thead><tr><th>Item</th><th>Cant</th><th>Precio</th><th>Total</th></tr></thead>
        <tbody>
          ${items.map(i => `
            <tr>
              <td>${Security.escapeHtml(i.name)} ${i.size ? `(${Security.escapeHtml(i.size)})` : ''}</td>
              <td>${i.quantity}</td>
              <td>${this.formatPrice(i.price)}</td>
              <td>${this.formatPrice(i.price * i.quantity)}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
      
      <div style="text-align:right; font-size:1.2rem; font-weight:bold;">
        Total: <span style="color:var(--accent);">${this.formatPrice(o.total)}</span>
      </div>
      
      ${o.notes ? `
        <div style="margin-top:20px; padding:15px; background:var(--bg-tertiary); border-radius:8px;">
          <strong>Notas del cliente:</strong><br>
          ${Security.escapeHtml(o.notes)}
        </div>
      ` : ''}
    `;
    
    document.getElementById('order-modal').classList.add('show');
  },

  // --- Categories (simplified logic) ---
  async loadCategories() {
    try {
      const res = await this.request('/api/categories');
      this.categories = await res.json();
      const tbody = document.getElementById('categories-list');
      tbody.innerHTML = this.categories.map(c => `
        <tr>
          <td><svg width="24" height="24" style="color:var(--accent)"><use href="#icon-${Security.escapeHtml(c.icon || 'box')}"/></svg></td>
          <td>${Security.escapeHtml(c.name)}</td>
          <td>${Security.escapeHtml(c.slug)}</td>
          <td>${Security.integer(c.sort_order)}</td>
          <td>
            <button class="icon-btn" onclick="Admin.deleteCategory(${Security.integer(c.id)})"><svg><use href="#icon-trash"/></svg></button>
          </td>
        </tr>
      `).join('');
    } catch (e) {
      console.error(e);
    }
  },

  async deleteCategory(id) {
    if (!confirm('¿Seguro que deseas eliminar esta categoría? (Los productos quedarán sin categoría)')) return;
    try {
      await this.request(`/api/categories/${id}`, { method: 'DELETE' });
      this.showToast('Categoría eliminada');
      this.loadCategories();
    } catch (e) {
      this.showToast('Error', 'error');
    }
  },

  openCategoryModal() {
    const name = prompt('Nombre de la categoría:');
    if (!name) return;
    const icon = prompt('Icono (gamepad, sparkels, monitor-smartphone, lamp, wrench, flame):', 'box');
    
    this.request('/api/categories', {
      method: 'POST',
      body: JSON.stringify({ name, icon })
    }).then(r => r.json()).then(() => {
      this.showToast('Categoría creada');
      this.loadCategories();
    });
  },

  // --- Customers ---
  async loadCustomers() {
    try {
      const res = await this.request('/api/customers');
      this.customers = await res.json();
      const tbody = document.getElementById('customers-list');
      tbody.innerHTML = this.customers.map(c => `
        <tr>
          <td>${Security.escapeHtml(c.name)}</td>
          <td>${Security.escapeHtml(c.email)}</td>
          <td>${Security.escapeHtml(c.phone)}</td>
          <td>${Security.escapeHtml(c.city)}</td>
          <td>${new Date(c.created_at).toLocaleDateString()}</td>
        </tr>
      `).join('');
    } catch (e) {
      console.error(e);
    }
  },

  // --- Settings ---
  async loadSettings() {
    try {
      const res = await this.request('/api/settings');
      this.settings = await res.json();
      
      const form = document.getElementById('settings-form');
      form.innerHTML = `
        <div class="form-group">
          <label class="form-label">Número de WhatsApp (con código de país ej: 573001234567)</label>
          <input type="text" id="set-whatsapp" class="form-input" value="${Security.escapeHtml(this.settings.whatsapp_number)}">
        </div>
        <div class="form-group">
          <label class="form-label">Título Hero (Inicio)</label>
          <input type="text" id="set-hero-title" class="form-input" value="${Security.escapeHtml(this.settings.hero_title)}">
        </div>
        <div class="form-group">
          <label class="form-label">Subtítulo Hero (Inicio)</label>
          <textarea id="set-hero-subtitle" class="form-input" rows="3">${Security.escapeHtml(this.settings.hero_subtitle)}</textarea>
        </div>
        <div class="form-group">
          <label class="form-label">Instagram Link</label>
          <input type="text" id="set-ig" class="form-input" value="${Security.escapeHtml(this.settings.instagram)}">
        </div>
        <div class="form-group">
          <label class="form-label">Contraseña Admin</label>
          <input type="password" id="set-pass" class="form-input" placeholder="Dejar en blanco para no cambiar">
        </div>
      `;
    } catch (e) {
      console.error(e);
    }
  },

  async saveSettings() {
    const data = {
      whatsapp_number: document.getElementById('set-whatsapp').value,
      hero_title: document.getElementById('set-hero-title').value,
      hero_subtitle: document.getElementById('set-hero-subtitle').value,
      instagram: document.getElementById('set-ig').value,
    };

    const pass = document.getElementById('set-pass').value;

    try {
      const settingsRes = await this.request('/api/settings', {
        method: 'PUT',
        body: JSON.stringify(data)
      });
      if (!settingsRes.ok) {
        const err = await settingsRes.json().catch(() => ({}));
        this.showToast(err.error || 'Error al guardar', 'error');
        return;
      }

      if (pass) {
        const passRes = await this.request('/api/admin/password', {
          method: 'PUT',
          body: JSON.stringify({ password: pass })
        });
        const passData = await passRes.json().catch(() => ({}));
        if (!passRes.ok) {
          this.showToast(passData.error || 'No se pudo cambiar la contraseña', 'error');
          return;
        }
        this.showToast('Configuración guardada. Inicia sesión de nuevo.');
        sessionStorage.removeItem('admin_token');
        this.token = null;
        this.showLogin();
        return;
      }

      this.showToast('Configuración guardada');
    } catch (e) {
      this.showToast('Error al guardar', 'error');
    }
  },

  // --- Helpers ---
  closeModal(id) {
    document.getElementById(id).classList.remove('show');
  },

  formatPrice(price) {
    return new Intl.NumberFormat('es-CO', {
      style: 'currency', currency: 'COP', maximumFractionDigits: 0
    }).format(price || 0);
  },

  showToast(message, type = 'success') {
    const container = document.getElementById('toast-container');
    if (!container) return;
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.innerHTML = `<svg><use href="#icon-${type==='success'?'check-circle':'alert-circle'}"/></svg><span>${Security.escapeHtml(message)}</span>`;
    container.appendChild(toast);
    setTimeout(() => {
      toast.style.animation = 'toastOut 0.3s ease forwards';
      setTimeout(() => toast.remove(), 300);
    }, 3000);
  }
};

document.addEventListener('DOMContentLoaded', () => {
  Admin.init();
});
