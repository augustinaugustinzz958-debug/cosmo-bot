(function() {
  if (typeof SpaceEngine === 'undefined') {
    console.error('SpaceEngine not loaded');
    const overlay = document.querySelector('.transition-overlay');
    if (overlay) {
      overlay.style.opacity = '0';
      overlay.style.display = 'none';
    }
    return;
  }

  // 1. Initialize space engine in galaxy-container
  let engineLoaded = false;
  try {
    if (SpaceEngine.init('galaxy-container')) {
      engineLoaded = true;
    }
  } catch (e) {
    console.warn("SpaceEngine init failed:", e);
  }

  if (engineLoaded) {
    // 2. Load user details
    const user = JSON.parse(localStorage.getItem('currentUser') || '{}');
    
    // Map student's class to assigned planet & theme
    const userClass = parseInt(user.class || '5', 10);
    let planet = 'saturn';
    let theme = 'gold';

    if (userClass === 1) { planet = 'mercury'; theme = 'orange'; }
    else if (userClass === 2) { planet = 'venus'; theme = 'yellow'; }
    else if (userClass === 3 || userClass === 4) { planet = 'mars'; theme = 'red'; }
    else if (userClass >= 5 && userClass <= 8) { planet = 'saturn'; theme = 'gold'; }
    else if (userClass === 9 || userClass === 10) { planet = 'uranus'; theme = 'cyan'; }
    else if (userClass === 11) { planet = 'neptune'; theme = 'blue'; }
    else if (userClass === 12) { planet = 'jupiter'; theme = 'brown'; }
    else {
      planet = user.planet || 'saturn';
      theme = user.theme || 'gold';
    }

    user.planet = planet;
    user.theme = theme;
    localStorage.setItem('currentUser', JSON.stringify(user));

    // 3. Initialize dashboard space scene
    SpaceEngine.initDashboardScene(planet, theme);

    // 4. Hide dashboard container for initial entry sequence
    const dashContainer = document.querySelector('.dashboard-container');
    if (dashContainer) {
      dashContainer.style.opacity = '0';
      dashContainer.style.transform = 'translateY(20px)';
      dashContainer.style.pointerEvents = 'none';
    }
    const botWidget = document.getElementById('cosmobot-widget');
    if (botWidget) {
      botWidget.style.opacity = '0';
      botWidget.style.transform = 'translateY(20px)';
      botWidget.style.pointerEvents = 'none';
      botWidget.style.display = 'block';
    }

    // Camera starts directly at Z=35 (no zoom transition)
    SpaceEngine.camera.position.z = 35;

    const showLaunchTransition = localStorage.getItem('showLaunchTransition') === 'true';
    localStorage.removeItem('showLaunchTransition'); // consume the flag

    if (showLaunchTransition) {
      // The timeline inside space-engine.js will handle the transition,
      // cleanup, and reveal of dashboard panels at the end of the rocket's flight.
      setTimeout(() => {
        if (typeof window.restoreDashboardAfterCrash === 'function') {
          window.restoreDashboardAfterCrash();
        }
      }, 100);
    } else {
      // Normal load: immediately reveal panels without delay
      setTimeout(() => {
        if (dashContainer) {
          gsap.to(dashContainer, {
            opacity: 1,
            y: 0,
            duration: 1.5,
            ease: 'power2.out',
            onStart: () => {
              dashContainer.style.pointerEvents = 'all';
            }
          });
        }
        if (botWidget) {
          gsap.to(botWidget, {
            opacity: 1,
            y: 0,
            duration: 1.5,
            ease: 'power2.out',
            onStart: () => {
              botWidget.style.pointerEvents = 'all';
            }
          });
        }
        if (typeof window.restoreDashboardAfterCrash === 'function') {
          window.restoreDashboardAfterCrash();
        }
      }, 100);
    }
  } else {
    // Fallback: hide overlay and show dashboard immediately without re-entry simulation
    const overlay = document.querySelector('.transition-overlay');
    if (overlay) {
      overlay.style.opacity = '0';
      overlay.style.display = 'none';
    }
    const dashContainer = document.querySelector('.dashboard-container');
    if (dashContainer) {
      dashContainer.style.opacity = '1';
      dashContainer.style.pointerEvents = 'all';
    }
    const botWidget = document.getElementById('cosmobot-widget');
    if (botWidget) {
      botWidget.style.display = 'block';
    }
  }
})();
