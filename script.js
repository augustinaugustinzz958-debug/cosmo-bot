// ================================================================
// COSMOBOT LANDING PAGE CONTROLLER
// Binds UI events to the SpaceEngine 3D Earth-rocket launchpad scene
// ================================================================

window.addEventListener('DOMContentLoaded', () => {
  const loginBtn = document.getElementById('loginBtn');
  const registerBtn = document.getElementById('registerBtn');
  const countdownHud = document.getElementById('countdown-hud');

  // Try to initialize SpaceEngine
  let engineLoaded = false;
  try {
    if (typeof SpaceEngine !== 'undefined' && SpaceEngine.init && SpaceEngine.init('galaxy-container')) {
      SpaceEngine.initLandingScene();
      engineLoaded = true;
    }
  } catch (err) {
    console.warn("SpaceEngine failed to initialize, running in fallback mode:", err);
  }

  // Fallback mode if engine fails
  if (!engineLoaded) {
    const overlay = document.querySelector('.transition-overlay');
    if (overlay) {
      overlay.style.opacity = '0';
      overlay.style.display = 'none';
    }
    
    // Bind simple redirect without rocket launch
    if (loginBtn) {
      loginBtn.addEventListener('click', () => { window.location.href = 'login.html'; });
    }
    if (registerBtn) {
      registerBtn.addEventListener('click', () => { window.location.href = 'register.html'; });
    }
    return;
  }

  let launchTriggered = false;

  function runLaunchSequence(targetUrl) {
    if (launchTriggered) return;
    launchTriggered = true;

    // Disable the auth buttons while transitioning
    if (loginBtn) loginBtn.disabled = true;
    if (registerBtn) registerBtn.disabled = true;

    // Pre-spawn the rocket immediately so it is guaranteed to exist for triggerRocketLaunch
    try {
      if (SpaceEngine && SpaceEngine.spawnLaunchRocket) {
        const el = SpaceEngine.spawnLaunchRocket();
        if (el && el.rocket) {
          el.rocket.visible = true;
        }
      }
    } catch (e) {
      console.warn('spawnLaunchRocket failed', e);
    }

    const heroContent = document.getElementById('heroContent');
    const overlay = document.querySelector('.transition-overlay');
    const tl = gsap.timeline({
      onComplete: () => {
        // Carry out page transition redirect
        SpaceEngine.transitionTo(targetUrl, (transitionTimeline) => {
          // Play the 3D rocket takeoff in the background
          SpaceEngine.triggerRocketLaunch(transitionTimeline);
        });
      }
    });

    // 1. Fade out the centered hero UI container first
    if (heroContent) {
      tl.to(heroContent, {
        opacity: 0,
        y: -30,
        duration: 0.7,
        ease: 'power2.inOut'
      }, 0);
    }

    // 2. Screen slightly darkens
    if (overlay) {
      overlay.style.display = 'block';
      overlay.style.pointerEvents = 'none';
      tl.to(overlay, {
        opacity: 0.45,
        duration: 0.7,
        ease: 'power2.inOut'
      }, 0);
    }
  }

  // Bind auth buttons to launch
  if (loginBtn) loginBtn.addEventListener('click', () => { runLaunchSequence('login.html'); });
  if (registerBtn) registerBtn.addEventListener('click', () => { runLaunchSequence('register.html'); });

  // Non-invasive smoke-test: verify SpaceEngine initialized and handlers attached
  (function runBindingsSmokeTest() {
    try {
      const okEngine = !!(SpaceEngine && SpaceEngine.init && SpaceEngine.initLandingScene);
      const okButtons = !!(loginBtn && registerBtn);
      console.info('CosmoBot smoke-test — engine:', okEngine ? 'ok' : 'missing', 'buttons:', okButtons ? 'ok' : 'missing');
      if (!okEngine) console.warn('SpaceEngine may not be fully initialized yet.');
    } catch (err) {
      console.error('Smoke-test error', err);
    }
  })();

  // Apply a mild visual tuning for balanced performance and style
  try {
    SpaceEngine.setVisuals({
      starLayers: [
        { count: 180, size: 1.2, zRange: 1200, speed: 0.02, opacity: 0.45 },
        { count: 80, size: 2.0, zRange: 800, speed: 0.01, opacity: 0.55 },
        { count: 30, size: 3.2, zRange: 500, speed: 0.005, opacity: 0.65 }
      ],
      galaxies: { count: 0, opacity: 0 },
      floatingParticles: { count: 0, opacity: 0 },
      shootingStars: { minDelay: 9999, maxDelay: 9999, poolSize: 0 }
    });
  } catch (e) {
    console.warn('Visual tuning failed:', e);
  }
});
