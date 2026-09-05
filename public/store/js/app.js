/* ============================================================
   SNAKE LAB — Main Application
   Initializes everything, renders categories and products
   ============================================================ */

const App = {
  categories: [],
  products: [],
  settings: {},
  currentFilter: 'all',

  async init() {
    // Initialize modules
    Cart.init();
    Checkout.init();

    // Load data
    await Promise.all([
      this.loadSettings(),
      this.loadCategories(),
      this.loadProducts()
    ]);

    // Setup UI
    this.setupNavbar();
    this.setupSearch();
    this.setupParticles();
    this.setupPrintScroll();
    this.setupScrollAnimations();
    this.setupScrollWorld();
    this.setupWhatsApp();
    this.setupMobileMenu();

    console.log('🐍 SNAKE LAB initialized');
  },

  // ---- Data Loading ----

  async loadSettings() {
    try {
      this.settings = await API.getSettings();
      // Update hero text if custom
      if (this.settings.hero_title) {
        const titleEl = document.getElementById('hero-title');
        if (titleEl) {
          const words = String(this.settings.hero_title).split(' ');
          titleEl.innerHTML = `<span class="gradient-text">${Security.escapeHtml(words.slice(0, 1).join(' '))}</span> ${Security.escapeHtml(words.slice(1).join(' '))}`;
        }
      }
    } catch (e) {
      console.warn('Could not load settings:', e);
    }
  },

  async loadCategories() {
    try {
      this.categories = await API.getCategories();
      this.renderCategories();
      this.renderFilterTabs();
      this.renderFooterCategories();
    } catch (e) {
      console.warn('Could not load categories:', e);
    }
  },

  async loadProducts() {
    try {
      this.products = await API.getProducts();
      this.renderProducts(this.products);
      this.renderTrending();
    } catch (e) {
      console.warn('Could not load products:', e);
      const productsGrid = document.getElementById('products-grid');
      if (productsGrid) {
        productsGrid.innerHTML = '<div class="empty-state"><h3>Productos no disponibles</h3><p>Conecta el frontend con la URL pública del backend en shared/js/config.js.</p></div>';
      }
    }
  },

  // ---- Icon mapping ----
  getIconSVG(iconName) {
    const icons = {
      'gamepad': '#icon-gamepad',
      'sparkles': '#icon-sparkles',
      'monitor-smartphone': '#icon-monitor-smartphone',
      'lamp': '#icon-lamp',
      'wrench': '#icon-wrench',
      'flame': '#icon-flame',
      'star': '#icon-sparkles',
      'settings': '#icon-wrench',
      'trending-up': '#icon-flame',
      'monitor': '#icon-monitor-smartphone',
      'home': '#icon-lamp'
    };
    return icons[iconName] || '#icon-box';
  },

  // ---- Rendering ----

  renderCategories() {
    const grid = document.getElementById('categories-grid');
    if (!grid) return;

    grid.innerHTML = this.categories.map(cat => `
      <div class="category-card animate-on-scroll" onclick="App.filterByCategory(this.dataset.category)" data-category="${Security.escapeHtml(cat.slug)}">
        <div class="category-icon">
          <svg><use href="${this.getIconSVG(cat.icon)}"/></svg>
        </div>
        <h3>${Security.escapeHtml(cat.name)}</h3>
        <p>${Security.escapeHtml(cat.description)}</p>
      </div>
    `).join('');

    // Trigger animations
    setTimeout(() => this.checkScrollAnimations(), 100);
  },

  renderFilterTabs() {
    const tabs = document.getElementById('filter-tabs');
    if (!tabs) return;

    tabs.innerHTML = `
      <button class="filter-tab active" data-filter="all" onclick="App.setFilter('all', this)">Todos</button>
      ${this.categories.map(cat => `
        <button class="filter-tab" data-filter="${Security.escapeHtml(cat.slug)}" onclick="App.setFilter(this.dataset.filter, this)">${Security.escapeHtml(cat.name)}</button>
      `).join('')}
    `;
  },

  renderFooterCategories() {
    const list = document.getElementById('footer-categories');
    if (!list) return;

    list.innerHTML = this.categories.map(cat => `
      <li><a href="#products" data-category="${Security.escapeHtml(cat.slug)}" onclick="App.filterByCategory(this.dataset.category)">${Security.escapeHtml(cat.name)}</a></li>
    `).join('');
  },

  renderProducts(products) {
    const grid = document.getElementById('products-grid');
    if (!grid) return;

    if (products.length === 0) {
      grid.innerHTML = `
        <div style="grid-column:1/-1; text-align:center; padding:60px 20px; color:var(--text-muted);">
          <svg width="48" height="48" style="opacity:0.3; margin-bottom:16px;"><use href="#icon-box"/></svg>
          <p>No se encontraron productos</p>
        </div>
      `;
      return;
    }

    grid.innerHTML = products.map(product => this.createProductCard(product)).join('');
  },

  renderTrending() {
    const grid = document.getElementById('trending-grid');
    if (!grid) return;

    const trending = this.products.filter(p => p.is_trending);
    if (trending.length === 0) {
      grid.innerHTML = '';
      return;
    }

    grid.innerHTML = trending.map(product => this.createProductCard(product)).join('');
  },

  createProductCard(product) {
    const images = this.parseJSON(product.images, []);
    const firstImage = Security.imageUrl(images[0]);
    const placeholderSVG = `data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 400 400'%3E%3Crect fill='%23191d24' width='400' height='400'/%3E%3Crect x='40' y='40' width='320' height='320' rx='18' fill='%23222832' stroke='%233ccf91' stroke-width='2'/%3E%3Cpath d='M140 200l40-40 40 50 55-65 55 95H100l40-40z' fill='%2300ff8840'/%3E%3Ccircle cx='165' cy='150' r='18' fill='%2300ff8840'/%3E%3Ctext fill='%23dfe7f0' font-family='sans-serif' font-size='20' x='50%25' y='86%25' text-anchor='middle'%3E${encodeURIComponent(product.name)}%3C/text%3E%3C/svg%3E`;

    let badgesHTML = '';
    if (product.is_trending) {
      badgesHTML += '<span class="badge badge-trending">Tendencia</span>';
    }
    if (product.compare_price && product.compare_price > product.price) {
      const discount = Math.round((1 - product.price / product.compare_price) * 100);
      badgesHTML += `<span class="badge badge-discount">-${discount}%</span>`;
    }

    return `
      <div class="product-card animate-on-scroll" data-product-id="${Security.integer(product.id)}">
        <div class="product-image">
          <img src="${Security.escapeHtml(firstImage || placeholderSVG)}" alt="${Security.escapeHtml(product.name)}" loading="lazy"
               onerror="this.src='${placeholderSVG}'">
          ${badgesHTML ? `<div class="product-badges">${badgesHTML}</div>` : ''}
          <div class="product-quick-actions">
            <button class="quick-btn quick-btn-cart" onclick="event.stopPropagation(); App.quickAdd(${Security.integer(product.id)})">
              <svg><use href="#icon-shopping-cart"/></svg>
              Agregar
            </button>
            <button class="quick-btn quick-btn-view" onclick="event.stopPropagation(); window.location.href='/producto/${encodeURIComponent(product.slug || product.id)}'">
              <svg><use href="#icon-eye"/></svg>
              Ver
            </button>
          </div>
        </div>
        <div class="product-info" onclick="window.location.href='/producto/${encodeURIComponent(product.slug || product.id)}'">
          <div class="product-category-tag">${Security.escapeHtml(product.category_name || 'General')}</div>
          <h3 class="product-name">${Security.escapeHtml(product.name)}</h3>
          <div class="product-pricing">
            <span class="product-price">${Cart.formatPrice(product.price)}</span>
            ${product.compare_price ? `<span class="product-compare-price">${Cart.formatPrice(product.compare_price)}</span>` : ''}
          </div>
        </div>
      </div>
    `;
  },

  // ---- Filters ----

  setFilter(filter, btn) {
    this.currentFilter = filter;

    // Update tab UI
    document.querySelectorAll('.filter-tab').forEach(t => t.classList.remove('active'));
    if (btn) btn.classList.add('active');

    // Filter products
    const filtered = filter === 'all'
      ? this.products
      : this.products.filter(p => {
          const cat = this.categories.find(c => c.id === p.category_id);
          return cat && cat.slug === filter;
        });

    this.renderProducts(filtered);
    setTimeout(() => this.checkScrollAnimations(), 100);
  },

  filterByCategory(slug) {
    // Scroll to products section
    document.getElementById('products')?.scrollIntoView({ behavior: 'smooth' });
    
    // Wait for scroll, then filter
    setTimeout(() => {
      const tab = document.querySelector(`.filter-tab[data-filter="${slug}"]`);
      this.setFilter(slug, tab);
    }, 500);
  },

  // ---- Quick Add ----

  quickAdd(productId) {
    const product = this.products.find(p => p.id === productId);
    if (product) {
      const sizes = this.parseJSON(product.sizes, []);
      const colors = this.parseJSON(product.colors, []);
      const materials = this.parseJSON(product.materials, []);
      Cart.addItem(product, {
        size: sizes[0] || null,
        color: colors[0] || null,
        material: materials[0] || null,
        quantity: 1
      });
    }
  },

  // ---- Navbar ----

  setupNavbar() {
    const navbar = document.getElementById('navbar');
    let lastScroll = 0;

    window.addEventListener('scroll', () => {
      const scrollY = window.scrollY;
      
      if (scrollY > 50) {
        navbar.classList.add('scrolled');
      } else {
        navbar.classList.remove('scrolled');
      }

      // Update active nav link based on scroll position
      this.updateActiveNavLink();
      lastScroll = scrollY;
    });
  },

  updateActiveNavLink() {
    const sections = ['hero', 'categories', 'products', 'trending', 'contact'];
    const scrollY = window.scrollY + 100;

    for (let i = sections.length - 1; i >= 0; i--) {
      const section = document.getElementById(sections[i]);
      if (section && section.offsetTop <= scrollY) {
        document.querySelectorAll('.nav-links a').forEach(a => a.classList.remove('active'));
        const activeLink = document.querySelector(`.nav-links a[data-section="${sections[i]}"]`);
        if (activeLink) activeLink.classList.add('active');
        break;
      }
    }
  },

  // ---- Mobile Menu ----

  setupMobileMenu() {
    const toggle = document.getElementById('menu-toggle');
    const navLinks = document.getElementById('nav-links');

    toggle?.addEventListener('click', () => {
      navLinks.classList.toggle('open');
      toggle.classList.toggle('active');
    });

    // Close menu on link click
    navLinks?.querySelectorAll('a').forEach(link => {
      link.addEventListener('click', () => {
        navLinks.classList.remove('open');
        toggle?.classList.remove('active');
      });
    });
  },

  // ---- Scroll World Section - Professional Scroll-Scrubbing ----

  setupScrollWorld() {
    const sceneCards = document.querySelectorAll('.scene-card');
    if (!sceneCards.length) return;

    const track = document.getElementById('process-track');
    const prevBtn = document.querySelector('.process-arrow-prev');
    const nextBtn = document.querySelector('.process-arrow-next');

    const updateArrowState = () => {
      if (!track || !prevBtn || !nextBtn) return;
      const maxScroll = track.scrollWidth - track.clientWidth;
      prevBtn.disabled = track.scrollLeft <= 8;
      nextBtn.disabled = track.scrollLeft >= maxScroll - 8;
    };

    if (track) {
      const scrollAmount = () => {
        const firstCard = track.querySelector('.scene-card');
        return firstCard ? firstCard.getBoundingClientRect().width + 22 : 380;
      };

      prevBtn?.addEventListener('click', () => {
        track.scrollBy({ left: -scrollAmount(), behavior: 'smooth' });
      });

      nextBtn?.addEventListener('click', () => {
        track.scrollBy({ left: scrollAmount(), behavior: 'smooth' });
      });

      track.addEventListener('scroll', updateArrowState, { passive: true });
      window.addEventListener('resize', updateArrowState);
      updateArrowState();
    }

    const modalContent = {
      1: {
        title: 'Diseño 3D innovador',
        text: 'Partimos de la idea del cliente, convertimos esa referencia en un modelo 3D pensado para impresión real, con proporciones funcionales y una estética clara.',
        points: ['Modelado profesional para piezas únicas o series.', 'Ajuste de proporciones, volúmenes y detalles.', 'Validación visual antes de fabricar la pieza final.']
      },
      2: {
        title: 'Impresión de precisión',
        text: 'La impresión se ejecuta con control constante de parámetros como capas, temperatura, velocidad y adherencia para lograr un acabado más preciso.',
        points: ['Ajuste fino de velocidad y temperatura.', 'Control de capas y resistencia del material.', 'Revisión de detalle para evitar imperfecciones.']
      },
      3: {
        title: 'Manufactura con control',
        text: 'Cada pieza pasa por una revisión mecánica y visual para asegurar que el resultado cumpla con tolerancias y calidad esperadas.',
        points: ['Verificación de acabados y dimensiones.', 'Corrección de defectos mínimos antes del cierre.', 'Producción uniforme en cada lote.']
      },
      4: {
        title: 'Acabado premium',
        text: 'Cuando la pieza ya está impresa, se realiza un tratamiento de acabado para mejorar la presencia visual, la sensación y la presentación final.',
        points: ['Limpieza, pulido y revisión estética.', 'Acabados pensados para presentación y uso.', 'Aseguramiento del detalle final.']
      },
      5: {
        title: 'Tecnología de punta',
        text: 'Mantenemos una operación basada en equipos profesionales para ganar velocidad sin perder precisión ni detalle en la pieza.',
        points: ['Máquinas para impresión de calidad profesional.', 'Monitoreo constante de rendimiento del equipo.', 'Producción eficiente y reproducible.']
      },
      6: {
        title: 'Materiales optimizados',
        text: 'La selección del material depende del uso final: resistencia, deformación, acabado visual y duración. Cada decision influye en la pieza final.',
        points: ['Filamentos con distintos acabados y resistencia.', 'Elección según uso funcional o decorativo.', 'Balance entre estética y durabilidad.']
      }
    };

    const modal = document.createElement('div');
    modal.className = 'process-modal hidden';
    modal.innerHTML = `
      <div class="process-modal-card">
        <button class="process-modal-close" type="button" aria-label="Cerrar">×</button>
        <div class="process-modal-visual">
          <img src="/uploads/images/scene-design.jpg" alt="Proceso">
        </div>
        <div class="process-modal-content">
          <h3>Diseño 3D innovador</h3>
          <p></p>
          <ul class="process-modal-list"></ul>
        </div>
      </div>
    `;
    document.body.appendChild(modal);

    const closeBtn = modal.querySelector('.process-modal-close');
    const title = modal.querySelector('h3');
    const text = modal.querySelector('p');
    const list = modal.querySelector('.process-modal-list');
    const visual = modal.querySelector('img');

    const openModal = (card) => {
      const scene = card.dataset.scene;
      const data = modalContent[scene];
      if (!data) return;
      title.textContent = data.title;
      text.textContent = data.text;
      list.innerHTML = data.points.map(point => `<li>${point}</li>`).join('');
      const imageMap = {
        1: '/uploads/images/scene-design.jpg',
        2: '/uploads/images/scene-prototype.jpg',
        3: '/uploads/images/scene-production.jpg',
        4: '/uploads/images/scene-gallery.jpg',
        5: '/uploads/images/scene-bambu.jpg',
        6: '/uploads/images/scene-filaments.jpg'
      };
      visual.src = imageMap[scene] || imageMap[1];
      modal.classList.remove('hidden');
      document.body.style.overflow = 'hidden';
    };

    const closeModal = () => {
      modal.classList.add('hidden');
      document.body.style.overflow = '';
    };

    sceneCards.forEach(card => {
      card.addEventListener('click', () => openModal(card));
      card.addEventListener('keydown', (event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          openModal(card);
        }
      });
    });

    closeBtn.addEventListener('click', closeModal);
    modal.addEventListener('click', (event) => {
      if (event.target === modal) closeModal();
    });
    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape' && !modal.classList.contains('hidden')) closeModal();
    });
  },

  // ---- Search ----

  setupSearch() {
    const input = document.getElementById('search-input');
    let timeout;

    input?.addEventListener('input', (e) => {
      clearTimeout(timeout);
      timeout = setTimeout(() => {
        const query = e.target.value.trim().toLowerCase();
        if (query === '') {
          this.renderProducts(this.products);
        } else {
          const filtered = this.products.filter(p => 
            p.name.toLowerCase().includes(query) ||
            (p.description && p.description.toLowerCase().includes(query)) ||
            (p.category_name && p.category_name.toLowerCase().includes(query))
          );
          this.renderProducts(filtered);
          
          // Scroll to products
          document.getElementById('products')?.scrollIntoView({ behavior: 'smooth' });
        }
        setTimeout(() => this.checkScrollAnimations(), 100);
      }, 300);
    });
  },

  // ---- Particles ----

  setupParticles() {
    const container = document.getElementById('hero-particles');
    if (!container) return;

    for (let i = 0; i < 20; i++) {
      const particle = document.createElement('div');
      particle.className = 'particle';
      particle.style.left = Math.random() * 100 + '%';
      particle.style.animationDelay = Math.random() * 8 + 's';
      particle.style.animationDuration = (6 + Math.random() * 6) + 's';
      particle.style.width = (2 + Math.random() * 3) + 'px';
      particle.style.height = particle.style.width;
      if (Math.random() > 0.5) {
        particle.style.background = '#8b5cf6';
      }
      container.appendChild(particle);
    }
  },

  // ---- Scroll-driven 3D print scene (DISABLED - scene removed) ----
  setupPrintScroll() {
    // Scene removed from HTML
  },

  // ---- Scroll Animations ----

  setupScrollAnimations() {
    this.scrollObserver = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add('visible');
        }
      });
    }, {
      threshold: 0.1,
      rootMargin: '0px 0px -50px 0px'
    });

    this.checkScrollAnimations();
  },

  checkScrollAnimations() {
    document.querySelectorAll('.animate-on-scroll:not(.visible)').forEach(el => {
      this.scrollObserver?.observe(el);
    });
  },

  // ---- WhatsApp ----

  setupWhatsApp() {
    const btn = document.getElementById('whatsapp-btn');
    const footerBtn = document.getElementById('footer-whatsapp');

    const updateLink = () => {
      const number = this.settings.whatsapp_number || '573001234567';
      const message = encodeURIComponent(this.settings.whatsapp_message || 'Hola SNAKE LAB! Me interesa un producto');
      const url = `https://wa.me/${number}?text=${message}`;
      
      if (btn) btn.href = url;
      if (footerBtn) footerBtn.href = url;
    };

    updateLink();
  },

  // ---- Helpers ----

  parseJSON(str, fallback = []) {
    if (Array.isArray(str)) return str;
    try { return JSON.parse(str); } catch { return fallback; }
  }
};

// ---- Initialize on DOM Ready ----
document.addEventListener('DOMContentLoaded', () => {
  App.init();
});
