import * as THREE from '/vendor/three/build/three.module.js';
import { OrbitControls } from '/vendor/three/examples/jsm/controls/OrbitControls.js';
import { GLTFLoader } from '/vendor/three/examples/jsm/loaders/GLTFLoader.js';
import { DRACOLoader } from '/vendor/three/examples/jsm/loaders/DRACOLoader.js';

const Product3D = {
  state: null,

  parseList(value) {
    if (Array.isArray(value)) return value;
    try {
      const parsed = JSON.parse(value || '[]');
      return Array.isArray(parsed) ? parsed : [];
    } catch { return []; }
  },

  parseModels(value) {
    const models = this.parseList(value);
    const fallback = models.length ? models : (value ? [value] : []);
    return fallback.map(model => Security.modelUrl(model)).filter(Boolean);
  },

  isMobileDevice() {
    return window.matchMedia?.('(max-width: 800px), (pointer: coarse)').matches
      || /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent);
  },

  mobileModelUrl(url) {
    return this.isMobileDevice() && /\.glb(\?.*)?$/i.test(url)
      ? url.replace(/\.glb(\?.*)?$/i, '.mobile.glb$1')
      : url;
  },

  showFallback(host, product, message) {
    host?.querySelector('.product-3d-fallback')?.remove();
    const images = this.parseList(product?.images);
    const imageUrl = images[0] ? Security.imageUrl(images[0]) : '';
    if (!host || !imageUrl) return;
    const fallback = document.createElement('div');
    fallback.className = 'product-3d-fallback';
    fallback.innerHTML = `<img src="${Security.escapeHtml(imageUrl)}" alt="${Security.escapeHtml(product?.name || 'Producto')}" loading="lazy"><span>${Security.escapeHtml(message)}</span>`;
    host.appendChild(fallback);
  },

  parseColors(colors) {
    const defaultColors = ['#000000', '#ffffff', '#d62828', '#ef4444', '#ff8a00', '#f5c542', '#22c55e', '#3ecf91', '#00b8ff', '#2563eb', '#4f46e5', '#8b5cf6', '#d9a441', '#8b5e3c', '#1a1a2e'];
    const source = [...colors, ...defaultColors];
    return source.map((color) => {
      if (typeof color === 'object' && color.hex) return { name: color.name || color.hex, hex: color.hex };
      return { name: color, hex: color };
    }).filter(color => /^#[0-9a-f]{3,8}$/i.test(color.hex)).filter((color, index, list) => list.findIndex(item => item.hex.toLowerCase() === color.hex.toLowerCase()) === index);
  },

  parseParts(product, key) {
    return this.parseList(product[key] || product[key.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`)]);
  },

  mount(product, colors) {
    const host = document.getElementById('maker-viewport');
    const status = document.getElementById('maker-viewport-status');
    const tools = document.getElementById('maker-viewport-tools');
    const panels = document.getElementById('maker-color-panels');
    const originalModelUrls = this.parseModels(product.model_3d);
    const modelUrls = originalModelUrls.map(url => this.mobileModelUrl(url));
    const modelUrl = modelUrls[0];
    const palette = this.parseColors(colors || []);

    if (!host || !status || !modelUrl || !/\.(glb|gltf)(\?.*)?$/i.test(modelUrl)) {
      if (status) status.textContent = 'Este producto todavía no tiene un modelo GLB/GLTF disponible.';
      if (panels) panels.innerHTML = '<p class="maker-info-muted">Sube un modelo GLB desde el panel de administración para activar esta vista.</p>';
      document.getElementById('maker-viewport-tools')?.setAttribute('hidden', 'hidden');
      document.getElementById('maker-toggle-bed')?.setAttribute('disabled', 'disabled');
      return;
    }

    status.textContent = 'Cargando modelo 3D...';
    const selector = document.createElement('div');
    selector.className = 'maker-model-selector';
    selector.innerHTML = modelUrls.map((url, index) => `<button type="button" class="maker-model-button ${index === 0 ? 'active' : ''}" data-model-url="${Security.escapeHtml(url)}">Modelo ${index + 1}</button>`).join('');
    if (modelUrls.length > 1) host.appendChild(selector);
    const canvas = document.createElement('canvas');
    canvas.className = 'product-3d-canvas';
    host.appendChild(canvas);

    const mobile = this.isMobileDevice();
    const renderer = new THREE.WebGLRenderer({ canvas, antialias: !mobile, alpha: true, powerPreference: 'high-performance' });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, mobile ? 1.25 : 1.75));
    renderer.setSize(host.clientWidth, host.clientHeight, false);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.shadowMap.enabled = !mobile;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(32, host.clientWidth / host.clientHeight, 0.01, 1000);
    const controls = new OrbitControls(camera, canvas);
    controls.enableDamping = true;
    controls.dampingFactor = 0.07;
    controls.enablePan = true;
    controls.screenSpacePanning = false;
    controls.minDistance = 1.2;
    controls.maxDistance = 12;
    controls.maxPolarAngle = Math.PI * 0.92;

    scene.add(new THREE.HemisphereLight(0xe8fff5, 0x10151c, 2.2));
    const key = new THREE.DirectionalLight(0xffffff, 3.2);
    key.position.set(4, 7, 5);
    key.castShadow = true;
    key.shadow.mapSize.set(1024, 1024);
    scene.add(key);
    const rim = new THREE.DirectionalLight(0x38d9a0, 1.6);
    rim.position.set(-4, 3, -4);
    scene.add(rim);

    const floor = new THREE.Mesh(new THREE.PlaneGeometry(2.56, 2.56), new THREE.MeshStandardMaterial({ color: 0x17211f, roughness: 0.78, metalness: 0.05, transparent: true, opacity: 0.78 }));
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = -0.02;
    floor.receiveShadow = true;
    floor.visible = false;
    scene.add(floor);

    const dracoLoader = new DRACOLoader();
    dracoLoader.setDecoderPath('/vendor/three/examples/jsm/libs/draco/');
    const loader = new GLTFLoader();
    loader.setDRACOLoader(dracoLoader);
    const loadModel = (url) => {
      if (this.state?.model) {
        scene.remove(this.state.model);
        this.state.model.traverse(object => {
          if (object.geometry) object.geometry.dispose();
          if (object.material) (Array.isArray(object.material) ? object.material : [object.material]).forEach(material => material.dispose());
        });
      }
      status.hidden = false;
      status.textContent = 'Cargando modelo 3D...';
      host.querySelector('.product-3d-fallback')?.remove();
      loader.load(url, (gltf) => {
      const model = gltf.scene;
      model.traverse((object) => {
        if (object.isMesh) {
          object.castShadow = true;
          object.receiveShadow = true;
        }
      });
      scene.add(model);
      host.querySelector('.product-3d-fallback')?.remove();
      const box = new THREE.Box3().setFromObject(model);
      const size = box.getSize(new THREE.Vector3());
      const center = box.getCenter(new THREE.Vector3());
      model.position.sub(center);
      const maxSize = Math.max(size.x, size.y, size.z) || 1;
      const distance = maxSize / (2 * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2))) * 1.35;
      camera.position.set(distance * 0.7, distance * 0.45, distance);
      controls.target.set(0, 0, 0);
      controls.minDistance = Math.max(maxSize * 0.7, 0.5);
      controls.maxDistance = Math.max(maxSize * 5, 4);
      controls.update();
      status.hidden = true;
      tools.hidden = false;
      const materials = new Set();
      model.traverse(object => {
        const objectMaterials = Array.isArray(object.material) ? object.material : [object.material];
        objectMaterials.forEach(material => { if (material?.uuid) materials.add(material.uuid); });
      });
      this.state = { model, renderer, scene, camera, controls, floor, product, palette, materialCount: materials.size, selections: {
        body: palette[0]?.hex || '#3ecf91',
        detail: palette[1]?.hex || palette[0]?.hex || '#3ecf91',
        accent: palette[2]?.hex || palette[1]?.hex || palette[0]?.hex || '#3ecf91'
      }, customParts: this.parseParts(product, 'customizableParts'), fixedParts: this.parseParts(product, 'fixedParts') };
      this.renderColorControls();
      }, (progress) => {
        if (progress.total) status.textContent = `Cargando modelo 3D... ${Math.round(progress.loaded / progress.total * 100)}%`;
      }, () => {
      status.hidden = false;
      tools.hidden = true;
      document.getElementById('maker-toggle-bed')?.setAttribute('disabled', 'disabled');
      status.textContent = /\.gltf(\?.*)?$/i.test(modelUrl)
        ? 'No se pudo cargar el GLTF. Convierte el modelo junto con sus archivos .bin y texturas a un GLB autocontenido.'
        : mobile
          ? 'El modelo móvil no pudo abrirse. Se muestra una vista previa del producto.'
          : 'No se pudo cargar el modelo GLB. Verifica que el archivo exista y esté optimizado.';
      if (mobile) this.showFallback(host, product, 'Vista previa disponible mientras se optimiza el modelo 3D');
      });
    };
    loadModel(modelUrl);
    selector.querySelectorAll('[data-model-url]').forEach(button => button.addEventListener('click', () => {
      selector.querySelectorAll('[data-model-url]').forEach(item => item.classList.toggle('active', item === button));
      tools.hidden = false;
      loadModel(button.dataset.modelUrl);
    }));

    const resize = () => {
      const width = host.clientWidth;
      const height = host.clientHeight;
      if (!width || !height) return;
      renderer.setSize(width, height, false);
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
    };
    const observer = new ResizeObserver(resize);
    observer.observe(host);
    const animate = () => {
      if (!document.body.contains(host)) { observer.disconnect(); renderer.dispose(); return; }
      requestAnimationFrame(animate);
      controls.update();
      renderer.render(scene, camera);
    };
    animate();

    document.querySelector('[data-3d-action="reset"]')?.addEventListener('click', () => this.reset());
    document.querySelector('[data-3d-action="dimensions"]')?.addEventListener('click', () => this.toggleDimensions());
    document.getElementById('maker-toggle-bed')?.addEventListener('click', (event) => {
      event.currentTarget.classList.toggle('active');
      floor.visible = event.currentTarget.classList.contains('active');
    });
  },

  renderColorControls() {
    const panels = document.getElementById('maker-color-panels');
    if (!panels || !this.state.palette.length) { if (panels) panels.innerHTML = '<p class="maker-info-muted">Este producto no tiene colores configurados.</p>'; return; }
    const slots = [{ id: 'body', label: 'Cuerpo' }, { id: 'detail', label: 'Detalle' }, { id: 'accent', label: 'Acento' }];
    panels.innerHTML = slots.map(slot => `<div class="maker-color-panel"><div class="maker-color-panel-head"><strong>${slot.label}</strong></div><div class="maker-color-swatch-row">${this.state.palette.map(color => `<button type="button" class="maker-color-swatch ${this.state.selections[slot.id].toLowerCase() === color.hex.toLowerCase() ? 'active' : ''}" data-3d-slot="${slot.id}" data-3d-color="${Security.escapeHtml(color.hex)}" title="${Security.escapeHtml(color.name)}" aria-label="${Security.escapeHtml(slot.label + ': ' + color.name)}" style="background:${Security.escapeHtml(color.hex)}"></button>`).join('')}</div></div>`).join('');
    panels.querySelectorAll('[data-3d-color]').forEach(button => button.addEventListener('click', () => {
      const slot = button.dataset['3dSlot'];
      this.state.selections[slot] = button.dataset['3dColor'];
      panels.querySelectorAll(`[data-3d-slot="${slot}"]`).forEach(item => item.classList.toggle('active', item === button));
      this.applyColor(button.dataset['3dColor'], slot);
      window.ProductPage?.selectColorFrom3D(button.dataset['3dColor']);
    }));
    Object.entries(this.state.selections).forEach(([slot, color]) => this.applyColor(color, slot));
    if (this.state.materialCount < 2) {
      const info = document.getElementById('maker-info-text');
      if (info) info.textContent = 'Este GLB tiene un solo material. Para usar Cuerpo, Detalle y Acento por separado, exporta el modelo con materiales independientes.';
    }
  },

  applyColor(hex, slot = 'body') {
    if (!this.state) return;
    const custom = this.state.customParts.map(String).map(value => value.toLowerCase());
    const fixed = this.state.fixedParts.map(String).map(value => value.toLowerCase());
    const color = new THREE.Color(hex);
    const slotPart = custom[slot === 'body' ? 0 : slot === 'detail' ? 1 : 2];
    const slotIndex = slot === 'body' ? 0 : slot === 'detail' ? 1 : 2;
    const materialIndexes = new Map();
    let nextMaterialIndex = 0;
    this.state.model.traverse((object) => {
      const materials = Array.isArray(object.material) ? object.material : [object.material];
      materials.forEach((material) => {
        if (material?.uuid && !materialIndexes.has(material.uuid)) materialIndexes.set(material.uuid, nextMaterialIndex++);
      });
    });
    this.state.model.traverse((object) => {
      if (!object.isMesh) return;
      const name = `${object.name} ${object.material?.name || ''}`.toLowerCase();
      if (fixed.some(part => name.includes(part))) return;
      if (custom.length && slotPart && !name.includes(slotPart)) return;
      if (custom.length && !slotPart && slot !== 'body') return;
      const materials = Array.isArray(object.material) ? object.material : [object.material];
      materials.forEach(material => {
        if (!material?.color) return;
        if (!custom.length && materialIndexes.get(material.uuid) !== slotIndex) return;
        material.color.copy(color);
      });
    });
  },

  getSelections() {
    return { ...(this.state?.selections || {}) };
  },

  reset() {
    if (!this.state) return;
    this.state.controls.reset();
    this.state.controls.target.set(0, 0, 0);
    this.state.controls.update();
  },

  toggleDimensions() {
    let dimensions = this.state?.product?.dimensions || this.state?.product?.dimensiones;
    if (typeof dimensions === 'string') {
      try { dimensions = JSON.parse(dimensions); } catch { dimensions = null; }
    }
    const values = dimensions && [dimensions.length, dimensions.width, dimensions.height].filter(value => value !== undefined && value !== null && value !== '');
    const unit = dimensions?.unit || 'cm';
    const text = values?.length ? `Medidas: ${values.join(' × ')} ${unit}.` : 'Medidas: configura largo, ancho y alto en los datos del producto.';
    const info = document.getElementById('maker-info-text');
    if (info) info.textContent = text;
  }
};

window.Product3D = Product3D;
window.dispatchEvent(new Event('snake-lab-3d-ready'));
