// ================================================================
// COSMOBOT — Procedural Responsive Starfield Generator
// Premium cinematic star colors: warm whites, silver, gold accents
// ================================================================

(function generateDynamicStars() {
  const container = document.createElement('div');
  container.style.cssText = 'position:fixed;inset:0;z-index:-1;pointer-events:none;overflow:hidden;';
  document.body.insertBefore(container, document.body.firstChild);

  const w = window.innerWidth;
  const h = window.innerHeight;
  const starCount = 200;

  for (let i = 0; i < starCount; i++) {
    const star = document.createElement('div');
    const size = Math.random() < 0.72 ? 1 : Math.random() < 0.88 ? 1.5 : 2;
    const x = Math.random() * w;
    const y = Math.random() * h;
    const opacity = 0.15 + Math.random() * 0.55;
    const delay = Math.random() * 8;
    const duration = 3 + Math.random() * 6;

    // Cinematic palette: warm whites, silver, subtle gold
    const colors = [
      '#F8FAFC',      // Starlight white
      '#E2E8F0',      // Soft silver
      '#C0C0C0',      // Moon silver
      '#F8FAFC',      // White (weighted)
      '#E8D5A0',      // Warm gold-white (rare)
      '#F8FAFC',      // White (weighted)
      '#CBD5E1',      // Cool silver
    ];
    const color = colors[Math.floor(Math.random() * colors.length)];

    star.style.cssText = `
      position:absolute;
      left:${x}px;
      top:${y}px;
      width:${size}px;
      height:${size}px;
      border-radius:50%;
      background:${color};
      opacity:${opacity};
      animation:starFlicker ${duration}s ${delay}s ease-in-out infinite alternate;
      box-shadow: 0 0 ${size + 1}px rgba(248,250,252,${opacity * 0.2});
    `;
    container.appendChild(star);
  }

  // Add the flicker keyframes dynamically (only once)
  if (!document.getElementById('starflicker-keyframes')) {
    const style = document.createElement('style');
    style.id = 'starflicker-keyframes';
    style.textContent = `
      @keyframes starFlicker {
        0%   { opacity: 0.1; transform: scale(0.85); }
        33%  { opacity: 0.6; transform: scale(1.05); }
        66%  { opacity: 0.25; transform: scale(0.92); }
        100% { opacity: 0.5; transform: scale(1); }
      }
    `;
    document.head.appendChild(style);
  }
})();
