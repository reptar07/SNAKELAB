/**
 * Local Three.js ES Module Loader for SNAKE LAB
 * 
 * This file polyfills Three.js and addon modules by importing from global window context
 * and assigning them to a module-like interface for compatibility with both direct
 * script-tag usage and dynamic import() calls.
 */

// Wait for Three.js library to be loaded from CDN/script
function waitForThree() {
  return new Promise((resolve) => {
    let attempts = 0;
    const check = () => {
      if (window.THREE) {
        resolve();
      } else if (attempts < 20) {
        attempts++;
        setTimeout(check, 100);
      } else {
        console.warn('Three.js failed to load');
        resolve(); // Resolve anyway to avoid hanging
      }
    };
    check();
  });
}

// Create ES module-style exports from global window objects
async function initializeThreeModules() {
  await waitForThree();

  // Create a module-like namespace that mimics ES imports
  window.__ThreeModules = {
    three: {
      ...window.THREE,
      // Ensure all key classes are exported
      WebGLRenderer: window.THREE?.WebGLRenderer,
      Scene: window.THREE?.Scene,
      PerspectiveCamera: window.THREE?.PerspectiveCamera,
      Mesh: window.THREE?.Mesh,
      MeshPhysicalMaterial: window.THREE?.MeshPhysicalMaterial,
      AmbientLight: window.THREE?.AmbientLight,
      DirectionalLight: window.THREE?.DirectionalLight,
      Box3: window.THREE?.Box3,
      Vector3: window.THREE?.Vector3,
      Fog: window.THREE?.Fog,
      default: window.THREE
    },
    STLLoader: {
      STLLoader: window.THREE?.STLLoader || window.STLLoader,
      default: window.THREE?.STLLoader || window.STLLoader
    },
    OrbitControls: {
      OrbitControls: window.THREE?.OrbitControls || window.OrbitControls,
      default: window.THREE?.OrbitControls || window.OrbitControls
    }
  };

  // Signal that modules are ready
  window.dispatchEvent(new Event('three-modules-ready'));
}

// Auto-initialize if Three.js is already loaded
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initializeThreeModules);
} else {
  initializeThreeModules();
}

// Export the initializer for manual invocation if needed
window.initializeThreeModules = initializeThreeModules;
