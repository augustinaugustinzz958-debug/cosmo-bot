// ================================================================
// COSMOBOT — LOGIN PAGE BACKGROUND CONTROLLER
// Interfaces with SpaceEngine to draw the cockpit visor flight view
// ================================================================

window.addEventListener('DOMContentLoaded', () => {
  // Initialize WebGL scene for Login Cockpit Visor
  if (typeof SpaceEngine !== 'undefined') {
    SpaceEngine.init('galaxy-container');
    SpaceEngine.initLoginScene();
  } else {
    console.error('SpaceEngine is not defined. Ensure space-engine.js is loaded.');
    const overlay = document.querySelector('.transition-overlay');
    if (overlay) {
      overlay.style.opacity = '0';
      overlay.style.display = 'none';
    }
  }
});
