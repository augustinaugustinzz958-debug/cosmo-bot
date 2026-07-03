// ================================================================
// COSMOBOT — REGISTER PAGE BACKGROUND CONTROLLER
// Interfaces with SpaceEngine to draw the infinite wormhole tunnel
// ================================================================

window.addEventListener('DOMContentLoaded', () => {
  // Initialize WebGL scene for Wormhole travel
  if (typeof SpaceEngine !== 'undefined') {
    SpaceEngine.init('galaxy-container');
    SpaceEngine.initRegisterScene();
  } else {
    console.error('SpaceEngine is not defined. Ensure space-engine.js is loaded.');
    const overlay = document.querySelector('.transition-overlay');
    if (overlay) {
      overlay.style.opacity = '0';
      overlay.style.display = 'none';
    }
  }
});
