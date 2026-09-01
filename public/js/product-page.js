/* ============================================================
   SNAKE LAB — Product Page Logic
   Handles the dedicated product view
   ============================================================ */

const ProductPage = {
  currentProduct: null,

  async ensure3DLibsReady() {
    // Check if already loaded
    if (window.THREE && window.THREE.Mesh && window.THREE.Scene) {
      return;
    }

    // Use cached promise if available
    if (window.__snakeThreeReadyPromise) {
      await window.__snakeThreeReadyPromise;
      return;
    }

    // Create a fresh promise for this initialization
    window.__snakeThreeReadyPromise = (async () => {
      try {
        // Wait for Three.js to be available from global scope
        let attempts = 0;
        while (!window.THREE && attempts < 20) {
          await new Promise(r => setTimeout(r, 100));
          attempts++;
        }

        if (!window.THREE) {
          throw new Error('Three.js library failed to load');
        }

        // Ensure STLLoader is globally available
        if (!window.STLLoader && window.THREE.STLLoader) {
          window.STLLoader = window.THREE.STLLoader;
        }

        // Ensure OrbitControls is globally available
        if (!window.OrbitControls && window.THREE.OrbitControls) {
          window.OrbitControls = window.THREE.OrbitControls;
        }

        return true;
      } catch (error) {
        console.warn('Error initializing 3D libraries:', error);
        return false;
      }
    })();

    await window.__snakeThreeReadyPromise;
  },

  async init() {
    Cart.init();
    Checkout.init();

    const params = new URLSearchParams(window.location.search);
    const id = params.get('id');

    if (!id) {
      window.location.href = '/';
      return;
    }

    try {
      this.currentProduct = await API.getProduct(id);
      this.render();
      this.setupNavbar();
    } catch (error) {
      console.error('Error loading product:', error);
      const productContainer = document.querySelector('.product-page-container');
      if (productContainer) {
        productContainer.innerHTML = `
          <div style="text-align:center; padding:60px; color:var(--text-muted)">
            <h2>Producto no encontrado</h2>
            <a href="/" class="btn btn-secondary" style="margin-top:20px;">Volver a la tienda</a>
          </div>
        `;
      }
    }
  },

  render() {
    const product = this.currentProduct;
    document.title = `${String(product.name || '')} | SNAKE LAB`;

    const images = this.parseJSON(product.images, []);
    const sizes = this.parseJSON(product.sizes, []);
    const colors = this.parseJSON(product.colors, []);
    const materials = this.parseJSON(product.materials, []);

    this.renderExtendedProductInfo(product, { images, sizes, colors, materials });
    this.ensure3DLibsReady().then(() => {
      this.render3DPreview(product, colors);
    }).catch(() => {
      this.render3DPreview(product, colors);
    });

    // Legacy gallery nodes were removed in favor of the premium configurator layout.
    const mainImageEl = document.getElementById('modal-main-image');
    if (mainImageEl) {
      const mainImage = Security.imageUrl(images[0]);
      if (mainImage) {
        mainImageEl.innerHTML = `<img src="${Security.escapeHtml(mainImage)}" alt="${Security.escapeHtml(product.name)}" onerror="this.remove()">`;
      } else {
        mainImageEl.innerHTML = `<div style="display:flex;align-items:center;justify-content:center;height:100%;color:var(--text-muted)">Sin imagen disponible</div>`;
      }
    }

    const thumbsEl = document.getElementById('modal-thumbnails');
    if (thumbsEl) {
      let thumbsHTML = images.map((img, i) => {
        const imageUrl = Security.imageUrl(img);
        if (!imageUrl) return '';
        return `
        <div class="modal-thumb ${i === 0 ? 'active' : ''}" data-image="${Security.escapeHtml(imageUrl)}" onclick="ProductPage.switchImage(this, this.dataset.image)">
          <img src="${Security.escapeHtml(imageUrl)}" alt="Vista ${i + 1}" onerror="this.style.display='none'">
        </div>
      `;
      }).join('');

      if (product.model_3d) {
        thumbsHTML += `
          <div class="modal-thumb modal-thumb-3d" onclick="ProductPage.show3D()">
            <svg><use href="#icon-cube"/></svg>
          </div>
        `;
      }
      thumbsEl.innerHTML = thumbsHTML;
    }

    // Calculate discount
    let discountHTML = '';
    if (product.compare_price && product.compare_price > product.price) {
      const discount = Math.round((1 - product.price / product.compare_price) * 100);
      discountHTML = `<span class="modal-discount-badge">-${discount}%</span>`;
    }

    const detailsEl = document.getElementById('modal-details');
    if (detailsEl) {
      detailsEl.innerHTML = `
        <span class="modal-category">${Security.escapeHtml(product.category_name || 'General')}</span>
        <h1 class="modal-title">${Security.escapeHtml(product.name)}</h1>
        <p class="modal-description">${Security.escapeHtml(product.description)}</p>
        
        <div class="modal-price-row">
          <span class="modal-price">${Cart.formatPrice(product.price)}</span>
          ${product.compare_price ? `<span class="modal-compare-price">${Cart.formatPrice(product.compare_price)}</span>` : ''}
          ${discountHTML}
        </div>

        ${sizes.length > 0 ? `
          <div class="option-group">
            <span class="option-label">Tamaño</span>
            <div class="option-chips" id="size-chips">
              ${sizes.map((s, i) => `<button class="option-chip ${i === 0 ? 'selected' : ''}" data-value="${Security.escapeHtml(s)}" onclick="ProductPage.selectOption(this, 'size-chips')">${Security.escapeHtml(s)}</button>`).join('')}
            </div>
          </div>
        ` : ''}

        ${colors.length > 0 ? `
          <div class="option-group">
            <span class="option-label">Color</span>
            <div class="option-chips" id="color-chips">
              ${colors.map((c, i) => `<div class="color-chip ${i === 0 ? 'selected' : ''}" style="background:${Security.color(c)}" data-value="${Security.escapeHtml(c)}" onclick="ProductPage.selectOption(this, 'color-chips')" title="${Security.escapeHtml(c)}"></div>`).join('')}
            </div>
          </div>
        ` : ''}

        ${materials.length > 0 ? `
          <div class="option-group">
            <span class="option-label">Material</span>
            <div class="option-chips" id="material-chips">
              ${materials.map((m, i) => `<button class="option-chip ${i === 0 ? 'selected' : ''}" data-value="${Security.escapeHtml(m)}" onclick="ProductPage.selectOption(this, 'material-chips')">${Security.escapeHtml(m)}</button>`).join('')}
            </div>
          </div>
        ` : ''}

        <div class="option-group">
          <span class="option-label">Cantidad</span>
          <div class="quantity-selector">
            <button class="qty-btn" onclick="ProductPage.changeQty(-1)">
              <svg><use href="#icon-minus"/></svg>
            </button>
            <input type="number" class="qty-value" id="modal-qty" value="1" min="1" max="99" readonly>
            <button class="qty-btn" onclick="ProductPage.changeQty(1)">
              <svg><use href="#icon-plus"/></svg>
            </button>
          </div>
        </div>

        <div class="modal-add-actions">
          <button class="btn btn-primary" onclick="ProductPage.addToCart()">
            <svg><use href="#icon-shopping-cart"/></svg>
            Agregar al Carrito
          </button>
          <button class="btn btn-secondary" onclick="ProductPage.buyNow()">
            <svg><use href="#icon-zap"/></svg>
            Comprar Ahora
          </button>
        </div>

        <div class="modal-meta">
          <div class="meta-item">
            <svg><use href="#icon-clock"/></svg>
            <span>Tiempo de producción: ${Security.integer(product.production_days, 3)} días hábiles</span>
          </div>
          <div class="meta-item">
            <svg><use href="#icon-truck"/></svg>
            <span>Envío a todo el país</span>
          </div>
          <div class="meta-item">
            <svg><use href="#icon-shield"/></svg>
            <span>Garantía de calidad en cada pieza</span>
          </div>
        </div>
      `;
    }
  },

  renderExtendedProductInfo(product, { sizes, colors, materials }) {
    const titleEl = document.getElementById('product-detail-title');
    const descriptionEl = document.getElementById('product-detail-description');
    const featureListEl = document.getElementById('product-feature-list');
    const specListEl = document.getElementById('product-spec-list');

    if (titleEl) titleEl.textContent = `Más sobre ${product.name || 'este producto'}`;
    if (descriptionEl) {
      const baseDescription = product.description || 'Producto diseñado para ofrecer una combinación de estilo, funcionalidad y calidad premium.';
      descriptionEl.textContent = baseDescription;
    }

    const featureItems = [
      {
        tag: 'Diseño',
        title: 'Estética premium',
        text: 'Forma cuidada, acabado limpio y una presencia visual sólida en cualquier espacio.'
      },
      {
        tag: 'Funcional',
        title: 'Uso diario',
        text: 'Pensado para ser práctico, resistente y cómodo en su uso cotidiano.'
      },
      {
        tag: 'Calidad',
        title: 'Fabricación controlada',
        text: 'Materiales seleccionados y producción con revisión de calidad en cada pieza.'
      }
    ];

    if (featureListEl) {
      featureListEl.innerHTML = featureItems.map(item => `
        <article class="feature-item">
          <span class="feature-tag">${Security.escapeHtml(item.tag)}</span>
          <h4>${Security.escapeHtml(item.title)}</h4>
          <p>${Security.escapeHtml(item.text)}</p>
        </article>
      `).join('');
    }

    const specItems = [
      { label: 'Tamaño', value: (sizes.length ? sizes.join(', ') : 'Estándar') },
      { label: 'Material', value: (materials.length ? materials.join(', ') : 'PLA / Premium') },
      { label: 'Colores', value: (colors.length ? colors.join(', ') : 'Personalizable') },
      { label: 'Producción', value: `${Security.integer(product.production_days, 3)} días hábiles` },
      { label: 'Entrega', value: 'A todo el país' }
    ];

    if (specListEl) {
      specListEl.innerHTML = specItems.map(item => `
        <li><span>${Security.escapeHtml(item.label)}</span><span>${Security.escapeHtml(item.value)}</span></li>
      `).join('');
    }
  },

  parseColorList(value) {
    try {
      const parsed = JSON.parse(value || '[]');
      if (!Array.isArray(parsed)) return [];
      return parsed.filter(Boolean).map(String).map(color => color.trim()).filter(color => /^#[0-9a-fA-F]{3,8}$/.test(color));
    } catch (e) {
      return [];
    }
  },

  hexToRgb(hex) {
    const normalized = hex.replace('#', '');
    const full = normalized.length === 3 ? normalized.split('').map(ch => ch + ch).join('') : normalized;
    const value = Number.parseInt(full, 16);
    return {
      r: (value >> 16) & 255,
      g: (value >> 8) & 255,
      b: value & 255
    };
  },

  parseModelList(value) {
    if (!value) return [];
    try {
      const parsed = JSON.parse(value);
      const urls = Array.isArray(parsed) ? parsed : [parsed];
      return urls.filter(Boolean).map(String).map(url => url.trim()).filter(url => url.startsWith('/uploads/models/') || url.startsWith('http'));
    } catch (e) {
      const raw = String(value).trim();
      return raw && (raw.startsWith('/uploads/models/') || raw.startsWith('http')) ? [raw] : [];
    }
  },

  renderSTLPreview(modelUrl) {
    const host = document.getElementById('maker-viewport');
    const THREE = window.THREE;
    const STLLoaderCtor = window.THREE?.STLLoader || window.STLLoader;
    const OrbitControlsCtor = window.THREE?.OrbitControls || window.OrbitControls;

    if (!host || !THREE || !STLLoaderCtor || !OrbitControlsCtor) return;

    if (host.clientWidth === 0 || host.clientHeight === 0) {
      host.style.width = '100%';
      host.style.height = '700px';
    }

    const existing = host.querySelector('.stl-preview-canvas');
    if (existing) existing.remove();

    const canvas = document.createElement('canvas');
    canvas.className = 'stl-preview-canvas';
    canvas.style.width = '100%';
    canvas.style.height = '100%';
    canvas.style.display = 'block';
    host.appendChild(canvas);

    const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setClearColor(0x000000, 0);

    const scene = new THREE.Scene();
    scene.fog = new THREE.Fog(0x0a0d13, 20, 36);

    const width = Math.max(host.clientWidth || 500, 500);
    const height = Math.max(host.clientHeight || 700, 700);
    const camera = new THREE.PerspectiveCamera(35, width / height, 0.1, 1000);
    camera.position.set(0, 1.5, 10);

    const controls = new OrbitControlsCtor(camera, canvas);
    controls.enableDamping = true;
    controls.enablePan = false;
    controls.minDistance = 4;
    controls.maxDistance = 18;
    controls.target.set(0, 0.8, 0);

    scene.add(new THREE.AmbientLight(0xffffff, 1.4));
    const keyLight = new THREE.DirectionalLight(0xffffff, 1.7);
    keyLight.position.set(5, 8, 6);
    scene.add(keyLight);

    const rimLight = new THREE.DirectionalLight(0x6ee7b7, 1.1);
    rimLight.position.set(-6, 3, -4);
    scene.add(rimLight);

    const loader = new STLLoaderCtor();
    loader.load(modelUrl, (geometry) => {
      geometry.center();
      const material = new THREE.MeshPhysicalMaterial({
        color: 0x4ade80,
        metalness: 0.2,
        roughness: 0.4,
        transparent: true,
        opacity: 1
      });
      const mesh = new THREE.Mesh(geometry, material);
      mesh.rotation.x = -Math.PI / 2;
      mesh.scale.setScalar(0.08);
      scene.add(mesh);

      const box = new THREE.Box3().setFromObject(mesh);
      const size = box.getSize(new THREE.Vector3()).length();
      const center = box.getCenter(new THREE.Vector3());
      mesh.position.sub(center);
      camera.position.set(0, size * 0.6, size * 1.6);
      controls.target.set(0, 0, 0);
      controls.update();
    }, undefined, () => {
      const info = document.getElementById('maker-info-text');
      if (info) {
        info.textContent = 'El archivo STL se cargó, pero el visor no pudo prepararlo. Intenta volver a subirlo o conviértelo a GLB/GLTF para obtener la mejor previsualización.';
      }
    });

    const resize = () => {
      const width = host.clientWidth;
      const height = host.clientHeight;
      renderer.setSize(width, height, false);
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
    };

    resize();
    window.addEventListener('resize', resize);

    const animate = () => {
      requestAnimationFrame(animate);
      controls.update();
      renderer.render(scene, camera);
    };
    animate();
  },

  render3DPreview(product, colors) {
    const viewer = document.getElementById('product-preview-model-viewer');
    const nameEl = document.getElementById('maker-product-name');
    const metaEl = document.getElementById('maker-product-meta');
    const bulletsEl = document.getElementById('maker-color-bullets');
    const controlsEl = document.getElementById('maker-color-panels');
    const toggleEl = document.getElementById('maker-toggle-bed');
    const infoEl = document.getElementById('maker-info-text');
    const downloadBtn = document.getElementById('download-model-btn');

    if (!viewer || !nameEl || !metaEl || !bulletsEl || !controlsEl) return;

    const modelList = this.parseModelList(product.model_3d);
    const modelUrl = modelList[0] ? Security.modelUrl(modelList[0]) : null;
    const defaultPalette = ['#3ecf91', '#e5e7eb', '#111827', '#ff5f57'];
    const availableColors = this.parseColorList(JSON.stringify(colors.length ? colors : defaultPalette));
    const palette = availableColors.length ? availableColors : defaultPalette;

    const selection = {
      base: palette[0] || '#3ecf91',
      accent: palette[1] || palette[0] || '#e5e7eb'
    };

    if (modelList.length > 1) {
      const selector = document.createElement('div');
      selector.className = 'maker-model-selector';
      selector.innerHTML = modelList.map((url, index) => `
        <button type="button" class="maker-model-button ${index === 0 ? 'active' : ''}" data-model-index="${index}" data-model-url="${Security.escapeHtml(url)}">${Security.escapeHtml(url.split('/').pop() || `Estilo ${index + 1}`)}</button>
      `).join('');
      selector.querySelectorAll('.maker-model-button').forEach((button) => {
        button.addEventListener('click', () => {
          selector.querySelectorAll('.maker-model-button').forEach(btn => btn.classList.toggle('active', btn === button));
          const targetUrl = button.dataset.modelUrl;
          if (!targetUrl) return;
          if (/(\.stl)$/i.test(targetUrl)) {
            viewer.style.display = 'none';
            this.renderSTLPreview(targetUrl);
            if (infoEl) infoEl.textContent = 'Vista 3D activa: puedes rotar, acercar y revisar el modelo STL cargado.';
            return;
          }
          viewer.style.display = 'block';
          viewer.setAttribute('src', targetUrl);
          if (infoEl) infoEl.textContent = `Modelo activo: ${button.textContent}. Ajusta los colores para ver la variación final.`;
        });
      });
      controlsEl.appendChild(selector);
    }

    if (modelUrl && /(\.stl)$/i.test(modelUrl)) {
      viewer.style.display = 'none';
      this.renderSTLPreview(modelUrl);
      if (infoEl) {
        infoEl.textContent = 'Vista 3D activa: puedes rotar, acercar y revisar el modelo STL cargado.';
      }
      return;
    }

    if (viewer) {
      viewer.style.display = 'block';
    }

    nameEl.textContent = product.name || 'Producto';
    metaEl.textContent = `${palette.length} tonos disponibles • Ajusta el acabado`;
    bulletsEl.innerHTML = palette.map((color) => `<span class="maker-color-bullet" style="background:${Security.color(color)}"></span>`).join('');

    controlsEl.innerHTML = [
      { label: 'Cuerpo', target: 'base', value: selection.base },
      { label: 'Detalle', target: 'accent', value: selection.accent }
    ].map(group => `
      <div class="maker-color-panel" data-panel="${group.target}">
        <div class="maker-color-panel-head">
          <strong>${group.label}</strong>
          <button type="button" data-reset="${group.target}">Reset</button>
        </div>
        <div class="maker-color-swatch-row">
          ${palette.map(color => `
            <button
              type="button"
              class="maker-color-swatch ${color.toLowerCase() === group.value.toLowerCase() ? 'active' : ''}"
              data-target="${group.target}"
              data-color="${Security.escapeHtml(color)}"
              style="background:${Security.escapeHtml(color)}"
              aria-label="${Security.escapeHtml(color)}"
            ></button>
          `).join('')}
        </div>
      </div>
    `).join('');

    const refreshSelectionState = () => {
      controlsEl.querySelectorAll('.maker-color-swatch').forEach((button) => {
        const isActive = button.dataset.color && button.dataset.color.toLowerCase() === selection[button.dataset.target].toLowerCase();
        button.classList.toggle('active', isActive);
      });
      bulletsEl.innerHTML = palette.map((color) => `<span class="maker-color-bullet" style="background:${Security.color(color)}; box-shadow: ${color.toLowerCase() === selection.base.toLowerCase() || color.toLowerCase() === selection.accent.toLowerCase() ? '0 0 0 2px rgba(0,255,136,0.35)' : 'none'}"></span>`).join('');
      if (infoEl) {
        infoEl.textContent = `Tu pieza actual combina ${selection.base} con ${selection.accent}. Ajusta los tonos para ver el acabado final.`;
      }
    };

    controlsEl.querySelectorAll('.maker-color-swatch').forEach((button) => {
      button.addEventListener('click', () => {
        const { target, color } = button.dataset;
        if (!target || !color) return;
        selection[target] = color;
        refreshSelectionState();
        if (viewer && viewer.model) {
          this.applyModelColor(viewer, color, target);
        }
      });
    });

    controlsEl.querySelectorAll('[data-reset]').forEach((button) => {
      button.addEventListener('click', () => {
        const target = button.dataset.reset;
        if (!target) return;
        selection[target] = target === 'accent' ? (palette[1] || palette[0] || '#e5e7eb') : (palette[0] || '#3ecf91');
        refreshSelectionState();
        if (viewer && viewer.model) {
          this.applyModelColor(viewer, selection[target], target);
        }
      });
    });

    if (toggleEl) {
      toggleEl.addEventListener('click', () => {
        toggleEl.classList.toggle('active');
        if (infoEl) {
          const showBed = toggleEl.classList.contains('active');
          infoEl.textContent = showBed
            ? 'La cama visible ayuda a comprobar el equilibrio del producto en su entorno real.'
            : `Tu pieza actual combina ${selection.base} con ${selection.accent}. Ajusta los tonos para ver el acabado final.`;
        }
      });
    }

    if (downloadBtn && viewer) {
      downloadBtn.addEventListener('click', () => {
        const currentSrc = viewer.getAttribute('src');
        if (!currentSrc) return;
        const link = document.createElement('a');
        link.href = currentSrc;
        const fileNameBase = (product.slug || product.name || 'producto').toLowerCase().replace(/[^a-z0-9]+/g, '-');
        link.download = `${fileNameBase}-${String(selection.base || '#3ecf91').replace('#', '')}.glb`;
        document.body.appendChild(link);
        link.click();
        link.remove();
      });
    }

    if (!modelUrl) {
      viewer.style.display = 'none';
      if (infoEl) {
        infoEl.textContent = 'Este producto aún no tiene un modelo 3D asociado para previsualización.';
      }
      return;
    }

    viewer.setAttribute('src', modelUrl);
    viewer.addEventListener('load', () => {
      this.applyModelColor(viewer, selection.base, 'base');
      this.applyModelColor(viewer, selection.accent, 'accent');
      refreshSelectionState();
    }, { once: true });
    refreshSelectionState();
  },

  applyModelColor(viewer, color, target) {
    if (!viewer || !viewer.model) return;
    const materials = viewer.model.materials || [];
    if (!materials.length) return;

    const chosenMaterials = target === 'accent' ? materials.slice(1) : materials.slice(0, 1);
    if (!chosenMaterials.length) return;

    const { r, g, b } = this.hexToRgb(String(color || '#ffffff'));
    chosenMaterials.forEach((material) => {
      try {
        if (material && material.pbrMetallicRoughness) {
          material.pbrMetallicRoughness.baseColorFactor = [r / 255, g / 255, b / 255, 1];
        }
      } catch (error) {
        console.warn('No se pudo cambiar el color del material', error);
      }
    });
  },

  switchImage(thumbEl, imageUrl) {
    document.querySelectorAll('#modal-thumbnails .modal-thumb').forEach(t => t.classList.remove('active'));
    thumbEl.classList.add('active');
    const mainImageEl = document.getElementById('modal-main-image');
    const safeImageUrl = Security.imageUrl(imageUrl);
    if (!safeImageUrl) return;
    mainImageEl.innerHTML = `<img src="${Security.escapeHtml(safeImageUrl)}" alt="${Security.escapeHtml(this.currentProduct?.name || 'Producto')}" style="animation: fadeIn 0.3s ease">`;
  },

  show3D() {
    const modelUrl = Security.modelUrl(this.currentProduct?.model_3d);
    if (!modelUrl) return;
    document.querySelectorAll('#modal-thumbnails .modal-thumb').forEach(t => t.classList.remove('active'));
    document.querySelector('.modal-thumb-3d')?.classList.add('active');
    const mainImageEl = document.getElementById('modal-main-image');
    mainImageEl.innerHTML = `
      <model-viewer
        src="${Security.escapeHtml(modelUrl)}"
        alt="${Security.escapeHtml(this.currentProduct.name)} - Modelo 3D"
        auto-rotate
        camera-controls
        shadow-intensity="1"
        style="width:100%;height:100%;background:transparent;"
      ></model-viewer>
    `;
  },

  selectOption(el, groupId) {
    const group = document.getElementById(groupId);
    if (!group) return;
    group.querySelectorAll('.option-chip, .color-chip').forEach(c => c.classList.remove('selected'));
    el.classList.add('selected');
  },

  changeQty(delta) {
    const input = document.getElementById('modal-qty');
    if (!input) return;
    let val = parseInt(input.value) + delta;
    if (val < 1) val = 1;
    if (val > 99) val = 99;
    input.value = val;
  },

  getSelectedOptions() {
    const getSelected = (id) => {
      const selected = document.querySelector(`#${id} .selected`);
      return selected ? selected.dataset.value : null;
    };

    return {
      size: getSelected('size-chips'),
      color: getSelected('color-chips'),
      material: getSelected('material-chips'),
      quantity: parseInt(document.getElementById('modal-qty')?.value || 1)
    };
  },

  addToCart() {
    if (!this.currentProduct) return;
    const options = this.getSelectedOptions();
    Cart.addItem(this.currentProduct, options);
  },

  buyNow() {
    if (!this.currentProduct) return;
    const options = this.getSelectedOptions();
    Cart.addItem(this.currentProduct, options);
    Cart.open();
  },

  parseJSON(str, fallback = []) {
    if (Array.isArray(str)) return str;
    try { return JSON.parse(str); } catch { return fallback; }
  },

  setupNavbar() {
    const navbar = document.getElementById('navbar');
    window.addEventListener('scroll', () => {
      if (window.scrollY > 50) {
        navbar.classList.add('scrolled');
      } else {
        navbar.classList.remove('scrolled');
      }
    });
  }
};

window.ProductPage = ProductPage;

document.addEventListener('DOMContentLoaded', () => {
  ProductPage.init();
});
