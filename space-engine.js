// ================================================================
// COSMOBOT SPACE ENGINE
// Core Three.js & GSAP space scenes and page transition handlers
// ================================================================

const SpaceEngine = {
  scene: null,
  camera: null,
  renderer: null,
  clock: null,
  stars: null,
  nebula: null,
  container: null,
  activeSceneType: null,
  animId: null,
  // Visual tuning parameters (safe defaults optimized for 60fps)
  visuals: {
    starLayers: [
      { count: 900, size: 1.6, zRange: 1200, speed: 0.08, opacity: 0.7 },
      { count: 450, size: 2.6, zRange: 800, speed: 0.04, opacity: 0.85 },
      { count: 220, size: 4.2, zRange: 500, speed: 0.02, opacity: 0.95 }
    ],
    galaxies: { count: 6, opacity: 0.16 },
    floatingParticles: { count: 220, opacity: 0.14 },
    shootingStars: { minDelay: 3.0, maxDelay: 9.0, poolSize: 6 }
  },

  // Spawn a launch-only rocket on demand (separate from landing scene)
  spawnLaunchRocket() {
    if (this.launchElements) return this.launchElements;
    const loader = new THREE.TextureLoader();
    const rocketGroup = this.create3DRocket(loader);
    const rocketScale = 1.45;
    rocketGroup.scale.set(rocketScale, rocketScale, rocketScale);
    // Position in the center bottom of screen, initially hidden or low
    rocketGroup.position.set(0, -3.5, 0);
    rocketGroup.rotation.set(0, 0, 0);
    rocketGroup.visible = false; // Initially hidden until transition trigger
    this.scene.add(rocketGroup);

    const flameMat = rocketGroup.userData.flameMat;
    const flameMesh = rocketGroup.userData.flameMesh;
    const plumeLight = rocketGroup.userData.plumeLight;

    const smokeObj = this.createVolumetricSmoke(this.scene, 45);
    const sparksObj = this.createLaunchSparks(this.scene);
    const glowObj = this.createExhaustGlow(this.scene, 50);

    this.launchElements = {
      rocket: rocketGroup,
      flame: flameMat,
      plumeLight: plumeLight,
      smokeObj: smokeObj,
      sparksObj: sparksObj,
      glowObj: glowObj,
      smokeActive: false,
      sparksActive: false,
      glowActive: false,
      launched: false,
      smokeIndex: 0,
      glowIndex: 0,
      prevY: -3.5,
      initialPosition: new THREE.Vector3(0, -3.5, 0),
      setSmokeActive: (active) => {
        if (this.launchElements) {
          this.launchElements.smokeActive = active;
          this.launchElements.sparksActive = active;
          this.launchElements.glowActive = active;
        }
      }
    };

    return this.launchElements;
  },

  // Spawns and triggers rocket takeoff during login/register transitions
  playTransitionLaunch(timeline) {
    const el = this.spawnLaunchRocket();
    if (!el) return;
    el.launched = true;
    el.launchTime = this.clock.getElapsedTime();
    el.rocket.visible = true;
    el.rocket.position.set(0, -6, 0); // start at bottom
    
    if (el.plumeLight) el.plumeLight.color.setHex(0xffaa44);
    if (el.setSmokeActive) el.setSmokeActive(true);

    // Ignition vibration
    timeline.to(el.rocket.position, {
      x: "+=0.08", y: "+=0.08", duration: 0.05, repeat: 8, yoyo: true
    }, 0);

    // Launch climb (NASA gravity turn)
    timeline.to(el.rocket.position, {
      y: 28,
      x: 18,
      z: -180,
      duration: 2.2,
      ease: "power2.in"
    }, 0.4);

    // Aerodynamic pitch tilt
    timeline.to(el.rocket.rotation, {
      x: -0.15,
      z: -0.18,
      duration: 2.0,
      ease: "power1.inOut"
    }, 0.4);

    // Fade out rocket & flame before page switch
    timeline.to(el.flame, { opacity: 0.0, duration: 0.5 }, 1.8);
    if (el.rocket && el.rocket.userData.rocketMats) {
      timeline.to(el.rocket.userData.rocketMats, { opacity: 0.0, duration: 0.6 }, 1.8);
    }
    
    // Stop smoke
    timeline.add(() => {
      if (el.setSmokeActive) el.setSmokeActive(false);
    }, 2.4);
  },

  // Helper mapping classes to planets and destinations
  classPlanetMap: {
    1: { name: 'moon', title: 'Moon Base', color: '#80848a', theme: 'grey' },
    2: { name: 'mercury', title: 'Mercury Station', color: '#9c8c7c', theme: 'orange' },
    3: { name: 'mars', title: 'Mars Colony', color: '#d15332', theme: 'red' },
    4: { name: 'venus', title: 'Venus Research Center', color: '#e3a857', theme: 'yellow' },
    5: { name: 'earth', title: 'Earth Academy', color: '#2060cf', theme: 'blue' },
    6: { name: 'neptune', title: 'Neptune Outpost', color: '#3250b5', theme: 'blue' },
    7: { name: 'uranus', title: 'Uranus Exploration Hub', color: '#7cd6d6', theme: 'cyan' },
    8: { name: 'saturn', title: 'Saturn Ring Academy', color: '#e6c88e', theme: 'gold' },
    9: { name: 'jupiter', title: 'Jupiter Command Zone', color: '#bf7a50', theme: 'brown' },
    10: { name: 'jupiter', title: 'Jupiter Prime', color: '#bf7a50', theme: 'brown' },
    11: { name: 'saturn', title: 'Saturn Elite Command', color: '#e6c88e', theme: 'gold' },
    12: { name: 'earth', title: 'Galaxy Command Center', color: '#ffffff', theme: 'cyan' }
  },

  // Initialize basic WebGL rendering setup
  init(containerId) {
    this.container = document.getElementById(containerId);
    if (!this.container) return false;

    const w = window.innerWidth;
    const h = window.innerHeight;

    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(45, w / h, 0.1, 2000);
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    this.renderer.setSize(w, h);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    
    // Add canvas to container
    this.renderer.domElement.style.position = 'absolute';
    this.renderer.domElement.style.top = '0';
    this.renderer.domElement.style.left = '0';
    this.renderer.domElement.style.zIndex = '0';
    this.renderer.domElement.style.width = '100%';
    this.renderer.domElement.style.height = '100%';
    this.renderer.domElement.style.pointerEvents = 'none';
    this.container.appendChild(this.renderer.domElement);

    this.clock = new THREE.Clock();

    // Standard ambient light
    const ambient = new THREE.AmbientLight(0x0a0c16, 1.2);
    this.scene.add(ambient);

    // Dynamic resize listener
    window.addEventListener('resize', () => this.handleResize());

    // Fade out page overlay
    this.initTransitionOverlay();

    return true;
  },

  handleResize() {
    if (!this.camera || !this.renderer) return;
    const w = window.innerWidth;
    const h = window.innerHeight;
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h);
    if (this.activeSceneType === 'landing' && this.resizeLandingScene) {
      this.resizeLandingScene();
    }
  },

  // Setup visual page transition overlay
  initTransitionOverlay() {
    let overlay = document.querySelector('.transition-overlay');
    if (!overlay) {
      overlay = document.createElement('div');
      overlay.className = 'transition-overlay';
      overlay.style.position = 'fixed';
      overlay.style.inset = '0';
      overlay.style.backgroundColor = '#040814'; // Deep Space Navy
      overlay.style.zIndex = '9999';
      overlay.style.pointerEvents = 'none';
      document.body.appendChild(overlay);
    }
    
    // Fade out overlay on load
    gsap.to(overlay, {
      opacity: 0,
      duration: 1.2,
      ease: 'power2.out',
      onComplete: () => {
        overlay.style.display = 'none';
      }
    });
  },

  // Triggers exit transition and page navigation
  transitionTo(url, beforeNavAction) {
    // Save flag for dashboard to run launch transition on load
    localStorage.setItem('showLaunchTransition', 'true');
    const overlay = document.querySelector('.transition-overlay');
    if (overlay) {
      overlay.style.display = 'block';
      overlay.style.pointerEvents = 'all';

      const timeline = gsap.timeline({
        onComplete: () => {
          window.location.href = url;
        }
      });

      if (beforeNavAction) {
        beforeNavAction(timeline);
      }

      // Fade overlay to 1.0 at the end of the rocket launch
      timeline.fromTo(overlay, 
        { opacity: 0 },
        { opacity: 1, duration: 0.6, ease: 'power2.inOut' }, 
        beforeNavAction ? 1.8 : 0
      );
    } else {
      window.location.href = url;
    }
  },

  // Twinkling Starfield particle system (Swirling spiral vortex pattern)
  createStarfield(starCount = 1500) {
    const geo = new THREE.BufferGeometry();
    const pos = new Float32Array(starCount * 3);
    const speed = new Float32Array(starCount);

    for (let i = 0; i < starCount; i++) {
      // 4-arm spiral vortex distribution for hypnotic depth illusion
      const r = Math.random() * 500;
      const numArms = 4;
      const armIndex = Math.floor(Math.random() * numArms);
      const armAngle = (armIndex * Math.PI * 2) / numArms;
      const twist = r * 0.008;
      const spread = (Math.random() - 0.5) * 0.4;
      const theta = armAngle + twist + spread;

      pos[i * 3] = Math.cos(theta) * r;
      pos[i * 3 + 1] = Math.sin(theta) * r;
      pos[i * 3 + 2] = -Math.random() * 800;
      speed[i] = 0.2 + Math.random() * 0.8;
    }

    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('speed', new THREE.BufferAttribute(speed, 1));

    // Load texture
    const tex = new THREE.TextureLoader().load('assets/effects/starfield.png');
    const mat = new THREE.PointsMaterial({
      size: 2.2,
      map: tex,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      opacity: 0.85
    });

    this.stars = new THREE.Points(geo, mat);
    this.scene.add(this.stars);
  },

  // Create layered parallax star fields (multiple distances + spiral distribution)
  createParallaxStarLayers() {
    this.clearParallaxStarLayers();
    this.starLayers = [];
    const loader = new THREE.TextureLoader();
    const tex = loader.load('assets/effects/starfield.png');

    const layerConfigs = this.visuals.starLayers;
    layerConfigs.forEach((cfg, idx) => {
      const geo = new THREE.BufferGeometry();
      const pos = new Float32Array(cfg.count * 3);
      const speeds = new Float32Array(cfg.count);

      for (let i = 0; i < cfg.count; i++) {
        // 3-arm spiral layout for layered parallax depth illusion
        const r = Math.random() * 900;
        const numArms = 3;
        const armIndex = Math.floor(Math.random() * numArms);
        const armAngle = (armIndex * Math.PI * 2) / numArms;
        const twist = r * 0.005;
        const spread = (Math.random() - 0.5) * 0.45;
        const theta = armAngle + twist + spread;

        pos[i * 3] = Math.cos(theta) * r;
        pos[i * 3 + 1] = Math.sin(theta) * r;
        pos[i * 3 + 2] = -Math.random() * cfg.zRange - 50 - idx * 200;
        speeds[i] = cfg.speed * (0.6 + Math.random() * 0.8);
      }

      geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
      geo.setAttribute('speed', new THREE.BufferAttribute(speeds, 1));

      const mat = new THREE.PointsMaterial({
        size: cfg.size,
        map: tex,
        transparent: true,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        opacity: cfg.opacity
      });

      const points = new THREE.Points(geo, mat);
      this.scene.add(points);
      
      // Store a unique spin speed for each layer to multiply the illusion of rotation parallax
      const spinSpeed = 0.0004 * (1 + idx * 0.5) * (idx % 2 === 0 ? 1 : -1);
      this.starLayers.push({ points, cfg, spinSpeed });
    });
  },

  // Animate parallax star layers (drifts forward + rotates in X-Y plane for optical vortex)
  animateParallaxStars(speedMultiplier = 1) {
    if (!this.starLayers) return;
    this.starLayers.forEach(layer => {
      const pos = layer.points.geometry.attributes.position.array;
      const speeds = layer.points.geometry.attributes.speed.array;
      const count = pos.length / 3;
      
      // Rotational angle for swirl illusion
      const cosAngle = Math.cos(layer.spinSpeed * speedMultiplier);
      const sinAngle = Math.sin(layer.spinSpeed * speedMultiplier);

      for (let i = 0; i < count; i++) {
        // 1. Move Z forward
        pos[i * 3 + 2] += speeds[i] * 8 * speedMultiplier;
        if (pos[i * 3 + 2] > 100) {
          pos[i * 3 + 2] = -layer.cfg.zRange - Math.random() * 200;
          // Re-generate in spiral vortex
          const r = Math.random() * 900;
          const theta = Math.random() * Math.PI * 2;
          pos[i * 3] = Math.cos(theta) * r;
          pos[i * 3 + 1] = Math.sin(theta) * r;
        }
        
        // 2. Rotate coordinates in X-Y plane (hypnotic spiral swirl)
        const x = pos[i * 3];
        const y = pos[i * 3 + 1];
        pos[i * 3] = x * cosAngle - y * sinAngle;
        pos[i * 3 + 1] = x * sinAngle + y * cosAngle;
      }
      layer.points.geometry.attributes.position.needsUpdate = true;
    });
  },

  // Create distant galaxy sprites (soft large planes) for depth
  createGalaxySprites() {
    this.galaxies = [];
    const loader = new THREE.TextureLoader();
    const tex = loader.load('assets/effects/nebula.png');
    const gcount = this.visuals.galaxies.count || 6;
    const gopacity = this.visuals.galaxies.opacity || 0.16;

    for (let i = 0; i < gcount; i++) {
      const mat = new THREE.MeshBasicMaterial({ map: tex, transparent: true, opacity: gopacity, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });
      const geo = new THREE.PlaneGeometry(800 + Math.random() * 600, 400 + Math.random() * 400);
      const mesh = new THREE.Mesh(geo, mat);
      mesh.position.set((Math.random() - 0.5) * 1600, (Math.random() - 0.2) * 800, -600 - Math.random() * 1200);
      mesh.rotation.z = Math.random() * Math.PI * 2;
      this.scene.add(mesh);
      this.galaxies.push(mesh);
    }
  },

  // Floating particles and dust near the camera / atmosphere
  createFloatingParticles() {
    const count = this.visuals.floatingParticles.count || 220;
    const geo = new THREE.BufferGeometry();
    const pos = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      pos[i * 3] = (Math.random() - 0.5) * 1200;
      pos[i * 3 + 1] = (Math.random() - 0.5) * 800;
      pos[i * 3 + 2] = -Math.random() * 600 - 50;
    }
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    const mat = new THREE.PointsMaterial({ color: 0xa8dfff, size: 1.2, transparent: true, opacity: this.visuals.floatingParticles.opacity || 0.14, blending: THREE.AdditiveBlending, depthWrite: false });
    this.floatingParticles = new THREE.Points(geo, mat);
    this.scene.add(this.floatingParticles);
  },

  // Shooting star manager (pool + spawn) - uses GSAP for lightweight timing
  initShootingStars(poolSize = 6) {
    this.shootingPool = [];
    const loader = new THREE.TextureLoader();
    const tex = loader.load('assets/effects/starfield.png');
    poolSize = this.visuals.shootingStars.poolSize || poolSize;
    for (let i = 0; i < poolSize; i++) {
      const mat = new THREE.SpriteMaterial({ map: tex, color: 0xffffff, transparent: true, opacity: 0 });
      const sprite = new THREE.Sprite(mat);
      sprite.scale.set(120, 6, 1);
      sprite.visible = false;
      this.scene.add(sprite);
      this.shootingPool.push(sprite);
    }

    // Kick off recurring spawns
    const spawnLoop = () => {
      const min = this.visuals.shootingStars.minDelay || 3.0;
      const max = this.visuals.shootingStars.maxDelay || 9.0;
      const delay = min + Math.random() * (max - min);
      gsap.delayedCall(delay, () => {
        this.spawnShootingStar();
        spawnLoop();
      });
    };
    spawnLoop();
  },

  spawnShootingStar() {
    if (!this.shootingPool || this.shootingPool.length === 0) return;
    const sprite = this.shootingPool.find(s => !s.visible) || this.shootingPool[Math.floor(Math.random() * this.shootingPool.length)];
    const startX = -900 + Math.random() * 400;
    const startY = -200 + Math.random() * 800;
    const endX = 400 + Math.random() * 800;
    const endY = -200 + Math.random() * 800;
    sprite.position.set(startX, startY, -200 - Math.random() * 400);
    sprite.material.opacity = 0.0;
    sprite.visible = true;

    gsap.to(sprite.material, { opacity: 1.0, duration: 0.08, ease: 'power1.out' });
    gsap.to(sprite.position, { x: endX, y: endY, duration: 0.9 + Math.random() * 0.9, ease: 'expo.out', onComplete: () => { sprite.visible = false; sprite.material.opacity = 0; } });
  },

  // Clear star layers (remove from scene)
  clearParallaxStarLayers() {
    if (!this.starLayers) return;
    this.starLayers.forEach(layer => {
      if (layer.points) {
        this.scene.remove(layer.points);
        if (layer.points.geometry) layer.points.geometry.dispose();
        if (layer.points.material) layer.points.material.dispose();
      }
    });
    this.starLayers = null;
  },

  // Runtime visuals tuning: merge provided options and rebuild layers when necessary
  setVisuals(options = {}) {
    // shallow merge
    this.visuals = Object.assign({}, this.visuals, options);
    if (options.starLayers) {
      // Recreate star layers
      this.createParallaxStarLayers();
    } else if (this.starLayers) {
      // update opacity/speed on existing layers
      this.starLayers.forEach((layer, i) => {
        const cfg = this.visuals.starLayers[i] || layer.cfg;
        layer.cfg = cfg;
        if (layer.points && layer.points.material) layer.points.material.opacity = cfg.opacity;
        if (layer.points && layer.points.geometry && layer.points.geometry.attributes.speed) {
          const speeds = layer.points.geometry.attributes.speed.array;
          for (let j = 0; j < speeds.length; j++) speeds[j] = cfg.speed * (0.6 + Math.random() * 0.8);
          layer.points.geometry.attributes.speed.needsUpdate = true;
        }
      });
    }

    // Update galaxies opacity
    if (this.galaxies && options.galaxies && typeof options.galaxies.opacity === 'number') {
      this.galaxies.forEach(g => { if (g.material) g.material.opacity = options.galaxies.opacity; });
    }

    // Update floating particles opacity
    if (this.floatingParticles && options.floatingParticles && typeof options.floatingParticles.opacity === 'number') {
      if (this.floatingParticles.material) this.floatingParticles.material.opacity = options.floatingParticles.opacity;
    }
  },

  // Drift Stars forward to create high-speed space flight effect (Swirling travel vortex)
  animateTravelStars(speedMultiplier = 1) {
    if (!this.stars) return;
    const pos = this.stars.geometry.attributes.position.array;
    const speeds = this.stars.geometry.attributes.speed.array;
    const count = pos.length / 3;

    // Rotational swirl angle (optical travel tunnel illusion)
    const spinAngle = 0.0012 * speedMultiplier;
    const cosAngle = Math.cos(spinAngle);
    const sinAngle = Math.sin(spinAngle);

    for (let i = 0; i < count; i++) {
      // 1. Move Z forward
      pos[i * 3 + 2] += speeds[i] * 1.8 * speedMultiplier;
      
      // If star passes the camera, reset it far away in spiral vortex
      if (pos[i * 3 + 2] > 50) {
        pos[i * 3 + 2] = -800;
        const r = Math.random() * 500;
        const theta = Math.random() * Math.PI * 2;
        pos[i * 3] = Math.cos(theta) * r;
        pos[i * 3 + 1] = Math.sin(theta) * r;
      }

      // 2. Rotate coordinates in X-Y plane
      const x = pos[i * 3];
      const y = pos[i * 3 + 1];
      pos[i * 3] = x * cosAngle - y * sinAngle;
      pos[i * 3 + 1] = x * sinAngle + y * cosAngle;
    }
    this.stars.geometry.attributes.position.needsUpdate = true;
  },

  // Dynamic nebula dust clouds
  createNebula() {
    const loader = new THREE.TextureLoader();
    const tex = loader.load('assets/effects/nebula.png');
    
    const mat = new THREE.MeshBasicMaterial({
      map: tex,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      opacity: 0.45,
      side: THREE.DoubleSide
    });

    const geo = new THREE.PlaneGeometry(600, 400);
    this.nebula = new THREE.Mesh(geo, mat);
    this.nebula.position.set(0, 0, -350);
    this.scene.add(this.nebula);
  },

  // Fallback: generate a soft cloud texture using canvas when no cloud image is available
  createCloudTexture(width = 2048, height = 1024) {
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');

    // transparent background
    ctx.clearRect(0, 0, width, height);

    // soft blotches for clouds
    for (let i = 0; i < 110; i++) {
      const x = Math.random() * width;
      const y = Math.random() * height;
      const r = 60 + Math.random() * 260;
      const g = ctx.createRadialGradient(x, y, r * 0.05, x, y, r);
      const alpha = 0.03 + Math.random() * 0.18;
      g.addColorStop(0, `rgba(255,255,255,${alpha})`);
      g.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
    }

    // blur effect via drawImage scale trick
    const small = document.createElement('canvas');
    const sw = Math.max(64, Math.round(width * 0.18));
    const sh = Math.max(32, Math.round(height * 0.18));
    small.width = sw; small.height = sh;
    const sctx = small.getContext('2d');
    sctx.drawImage(canvas, 0, 0, sw, sh);
    ctx.clearRect(0, 0, width, height);
    ctx.drawImage(small, 0, 0, width, height);

    return new THREE.CanvasTexture(canvas);
  },

  // 1. Landing Page Scene: Earth & Planets (Jupiter)
  initLandingScene() {
    this.activeSceneType = 'landing';
    
    // Position camera centered
    this.camera.position.set(0, 0, 28);
    this.camera.lookAt(new THREE.Vector3(0, 0, 0));

    // Directional Sunlight (warmer tone)
    const sun = new THREE.DirectionalLight(0xffeedd, 3.8);
    sun.position.set(-20, 15, 20);
    this.scene.add(sun);

    const loader = new THREE.TextureLoader();
    const earthRadius = 6.5;
    const earthGeo = new THREE.SphereGeometry(earthRadius, 96, 96);

    // Load high-resolution realistic NASA-quality textures
    const dayMap = loader.load('assets/planets/earthmap1k.jpg');
    const nightMap = loader.load('assets/planets/earthlights1k.jpg');
    const specularMap = loader.load('assets/planets/earthspec1k.jpg');

    // Configure high-quality anisotropic filtering to make textures look sharp (like 4K)
    const maxAnisotropy = this.renderer.capabilities.getMaxAnisotropy();
    dayMap.anisotropy = Math.min(maxAnisotropy, 8);
    nightMap.anisotropy = Math.min(maxAnisotropy, 8);
    specularMap.anisotropy = Math.min(maxAnisotropy, 8);

    dayMap.wrapS = THREE.RepeatWrapping;
    dayMap.wrapT = THREE.ClampToEdgeWrapping;
    nightMap.wrapS = THREE.RepeatWrapping;
    nightMap.wrapT = THREE.ClampToEdgeWrapping;
    specularMap.wrapS = THREE.RepeatWrapping;
    specularMap.wrapT = THREE.ClampToEdgeWrapping;

    // Earth material with a custom shader performing smooth terminators, specular oceans, and edge haze
    const earthMat = new THREE.ShaderMaterial({
      uniforms: {
        dayMap: { value: dayMap },
        nightMap: { value: nightMap },
        specularMap: { value: specularMap },
        sunWorldDir: { value: new THREE.Vector3(-20, 15, 20).normalize() },
        cameraWorldPos: { value: new THREE.Vector3(0, 0, 28) }
      },
      vertexShader: `
        varying vec3 vWorldNormal;
        varying vec3 vWorldPosition;
        varying vec2 vUv;
        void main() {
          vWorldNormal = normalize((modelMatrix * vec4(normal, 0.0)).xyz);
          vWorldPosition = (modelMatrix * vec4(position, 1.0)).xyz;
          vUv = uv;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        uniform sampler2D dayMap;
        uniform sampler2D nightMap;
        uniform sampler2D specularMap;
        uniform vec3 sunWorldDir;
        uniform vec3 cameraWorldPos;

        varying vec3 vWorldNormal;
        varying vec3 vWorldPosition;
        varying vec2 vUv;

        // ACES Filmic Tone Mapping to roll off highlights smoothly and avoid blowouts
        vec3 ACESFilmic(vec3 x) {
          float a = 2.51;
          float b = 0.03;
          float c = 2.43;
          float d = 0.59;
          float e = 0.14;
          return clamp((x * (a * x + b)) / (x * (c * x + d) + e), 0.0, 1.0);
        }

        void main() {
          vec3 normal = normalize(vWorldNormal);
          vec3 viewDir = normalize(cameraWorldPos - vWorldPosition);
          vec3 lightDir = normalize(sunWorldDir);

          // Sample textures
          vec3 dayColorTex = texture2D(dayMap, vUv).rgb;
          vec3 nightColorTex = texture2D(nightMap, vUv).rgb;
          float specMask = texture2D(specularMap, vUv).r;

          // Target deep navy ocean colors (#0A1B33 = rgb(10,27,51), #12335B = rgb(18,51,91))
          vec3 deepNavy = vec3(0.0392, 0.1059, 0.2);
          vec3 midNavy = vec3(0.0706, 0.2, 0.3569);
          vec3 oceanBase = mix(deepNavy, midNavy, specMask);

          // Blend texture color with deep navy for oceans (55% blend to keep natural texture depth)
          vec3 baseColor = mix(dayColorTex, oceanBase, specMask * 0.55);

          // Day-night blending factor
          float cosTheta = dot(normal, lightDir);
          
          // Smooth terminator transition
          float dayWeight = smoothstep(-0.15, 0.15, cosTheta);

          // Shading on day side
          float diffuse = max(cosTheta, 0.0);
          float ambient = 0.05; // cinematic, deep space ambient light
          vec3 dayColor = baseColor * (diffuse + ambient);

          // Specular highlights (oceans only, realistic tightness)
          vec3 reflectDir = reflect(-lightDir, normal);
          float specAngle = max(dot(reflectDir, viewDir), 0.0);
          float specularIntensity = pow(specAngle, 28.0); // realistic soft specular reflection
          vec3 specularColor = vec3(0.8, 0.9, 1.0) * (specMask * specularIntensity * dayWeight * 1.2);

          // Boost night lights visibility on the dark side
          vec3 nightColor = nightColorTex * 1.8;

          // Blended day/night colors (no artificial blue overlays on Earth surface)
          vec3 blendedColor = mix(nightColor, dayColor, dayWeight) + specularColor;

          // Apply ACES Filmic Tone Mapping for cinematic tone reproduction (no blown-out highlights)
          vec3 filmicColor = ACESFilmic(blendedColor);

          gl_FragColor = vec4(filmicColor, 1.0);
        }
      `,
      transparent: false
    });
    const earth = new THREE.Mesh(earthGeo, earthMat);
    // Initial position (will be updated dynamically by resize)
    earth.position.set(6.5, 0, -5);
    this.scene.add(earth);

    // Cloud layer using a custom shader to extract white clouds from earthcloudmap.jpg's red channel
    // and ignore the blue ocean background.
    const cloudMapTex = loader.load('assets/planets/earthcloudmap.jpg');
    cloudMapTex.anisotropy = Math.min(maxAnisotropy, 8);
    cloudMapTex.wrapS = THREE.RepeatWrapping;
    cloudMapTex.wrapT = THREE.ClampToEdgeWrapping;

    const cloudsGeo = new THREE.SphereGeometry(earthRadius * 1.015, 64, 64);
    const cloudsMat = new THREE.ShaderMaterial({
      uniforms: {
        cloudMap: { value: cloudMapTex },
        sunWorldDir: { value: new THREE.Vector3(-20, 15, 20).normalize() }
      },
      vertexShader: `
        varying vec3 vWorldNormal;
        varying vec2 vUv;
        void main() {
          vWorldNormal = normalize((modelMatrix * vec4(normal, 0.0)).xyz);
          vUv = uv;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        uniform sampler2D cloudMap;
        uniform vec3 sunWorldDir;
        varying vec3 vWorldNormal;
        varying vec2 vUv;
        void main() {
          vec3 color = texture2D(cloudMap, vUv).rgb;
          
          // Use red channel as cloud mask (oceans are blue, so red is 0; clouds are white, so red is high)
          float alpha = color.r;
          
          // Cloud shading
          float cosTheta = dot(normalize(vWorldNormal), normalize(sunWorldDir));
          float diffuse = max(cosTheta, 0.0);
          float ambient = 0.15;
          float light = diffuse + ambient;
          
          // Render clouds as white, shaded by the sun
          gl_FragColor = vec4(vec3(1.0) * light, alpha * 0.75);
        }
      `,
      transparent: true,
      depthWrite: false,
      blending: THREE.NormalBlending
    });
    const clouds = new THREE.Mesh(cloudsGeo, cloudsMat);
    clouds.position.copy(earth.position);
    this.scene.add(clouds);

    // Atmospheric Fresnel glow (soft blue rim, hemisphere-aware)
    const glowMat = new THREE.ShaderMaterial({
      uniforms: {
        sunWorldDir: { value: new THREE.Vector3(-20, 15, 20).normalize() }
      },
      vertexShader: `
        varying vec3 vWorldNormal;
        varying vec3 vViewNormal;
        void main() {
          vWorldNormal = normalize((modelMatrix * vec4(normal, 0.0)).xyz);
          vViewNormal = normalize(normalMatrix * normal);
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        uniform vec3 sunWorldDir;
        varying vec3 vWorldNormal;
        varying vec3 vViewNormal;
        void main() {
          vec3 viewNormal = normalize(vViewNormal);
          vec3 worldNormal = normalize(vWorldNormal);
          
          // Fresnel glow intensity based on view-space normal (higher exponent for thinner glow)
          float intensity = pow(1.0 - abs(viewNormal.z), 5.0);
          
          // Hemisphere-aware light scattering factor (fades on dark side for soft shadow)
          float sunFacing = dot(worldNormal, normalize(sunWorldDir));
          float sunFactor = smoothstep(-0.2, 0.2, sunFacing);
          
          vec3 glowColor = vec3(0.2, 0.52, 1.0);
          gl_FragColor = vec4(glowColor, 1.0) * intensity * sunFactor * 1.8;
        }
      `,
      transparent: true,
      blending: THREE.AdditiveBlending,
      side: THREE.BackSide,
      depthWrite: false
    });
    const glow = new THREE.Mesh(new THREE.SphereGeometry(earthRadius * 1.018, 64, 64), glowMat);
    glow.position.copy(earth.position);
    this.scene.add(glow);

    // Moon — orbiting pivot with slight tilt close to Earth (exactly 10% Earth size)
    const moonGeo = new THREE.SphereGeometry(earthRadius * 0.10, 32, 32);
    const moonMat = new THREE.MeshStandardMaterial({
      map: loader.load('assets/planets/moon.png'),
      roughness: 0.95,
      metalness: 0.05
    });
    const moon = new THREE.Mesh(moonGeo, moonMat);
    const moonPivot = new THREE.Group();
    moonPivot.add(moon);
    moonPivot.position.copy(earth.position);
    moonPivot.rotation.x = 0.12;
    this.scene.add(moonPivot);

    const moonLight = new THREE.PointLight(0x99cfff, 0.08, 50);
    this.scene.add(moonLight);

    // Distant Jupiter removed per arrangement guidelines

    this.starWarp = 0;
    this.cameraShakeActive = false;
    this.cameraShakeIntensity = 0;
    this.originalCameraPos = this.camera.position.clone();

    // Define responsive layout adjustments
    this.resizeLandingScene = () => {
      const w = window.innerWidth;
      const h = window.innerHeight;
      const aspect = w / h;

      const earthZ = -5;
      const dist = this.camera.position.z - earthZ;
      
      const fovRad = (this.camera.fov * Math.PI) / 360;
      const visibleHeight = 2 * dist * Math.tan(fovRad);
      const visibleWidth = visibleHeight * aspect;

      // Earth size is 25-30% of viewport width, clamped to 350px–450px on desktop
      let earthPx = w * 0.28;
      if (w >= 768) {
        earthPx = Math.max(350, Math.min(450, earthPx));
      }
      const earthDiameter = (earthPx / w) * visibleWidth;
      const calculatedRadius = earthDiameter / 2;

      const scaleFactor = calculatedRadius / earthRadius;
      earth.scale.set(scaleFactor, scaleFactor, scaleFactor);
      clouds.scale.set(scaleFactor, scaleFactor, scaleFactor);
      glow.scale.set(scaleFactor, scaleFactor, scaleFactor);
      moon.scale.set(scaleFactor, scaleFactor, scaleFactor);
      
      // Moon orbital distance is visually set to 2.4x of Earth's radius
      const orbitDistance = calculatedRadius * 2.4;
      moon.position.set(orbitDistance, 0.12 * orbitDistance, 0);

      // Positioning Earth to the right side of the screen
      const cardWidthPx = w >= 768 ? 700 : w * 0.95;
      const cardWidth3D = (cardWidthPx / w) * visibleWidth;
      const cardRight3D = cardWidth3D / 2;

      let earthX = cardRight3D + calculatedRadius + 0.8;
      const screenRightEdge = visibleWidth / 2;
      const targetX = cardRight3D + (screenRightEdge - cardRight3D) / 2;
      earthX = Math.max(earthX, targetX);

      // Position Earth on the right side without touching screen edges (0.8 units margin)
      const maxEarthX = screenRightEdge - calculatedRadius - 0.8;
      if (earthX > maxEarthX) {
        earthX = maxEarthX;
      }
      
      earth.position.set(earthX, 0, earthZ);
      clouds.position.copy(earth.position);
      glow.position.copy(earth.position);
      moonPivot.position.copy(earth.position);
    };

    // Run once at init
    this.resizeLandingScene();

    // Minimal, subtle star layers for a premium, minimal background
    this.setVisuals({
      starLayers: [
        { count: 260, size: 1.2, zRange: 1200, speed: 0.03, opacity: 0.45 },
        { count: 120, size: 2.0, zRange: 800, speed: 0.02, opacity: 0.36 },
        { count: 60, size: 3.6, zRange: 500, speed: 0.01, opacity: 0.3 }
      ],
      galaxies: { count: 0, opacity: 0 },
      floatingParticles: { count: 0, opacity: 0 },
      shootingStars: { minDelay: 9999, maxDelay: 9999, poolSize: 0 }
    });
    this.createParallaxStarLayers();

    const tick = () => {
      if (this.activeSceneType !== 'landing') return;
      this.animId = requestAnimationFrame(tick);

      const t = this.clock.getElapsedTime();
      
      // Slow rotation speeds (Earth: 120s period, clouds: 100s period)
      earth.rotation.y = t * (Math.PI * 2 / 120.0);
      clouds.rotation.y = t * (Math.PI * 2 / 100.0);
      glow.rotation.y = t * 0.010;

      // Slow moon orbit (150s period)
      const orbitPeriod = 150.0;
      moonPivot.rotation.y = t * (Math.PI * 2 / orbitPeriod);

      const moonWorldPos = new THREE.Vector3();
      moon.getWorldPosition(moonWorldPos);
      moonLight.position.copy(moonWorldPos);

      // Copy camera position and dynamic sun direction vector to uniforms
      if (earthMat && earthMat.uniforms) {
        earthMat.uniforms.cameraWorldPos.value.copy(this.camera.position);
        
        const earthWorldPos = new THREE.Vector3();
        earth.getWorldPosition(earthWorldPos);
        const sunDirVec = new THREE.Vector3().copy(sun.position).sub(earthWorldPos).normalize();
        earthMat.uniforms.sunWorldDir.value.copy(sunDirVec);
        
        if (glowMat && glowMat.uniforms) {
          glowMat.uniforms.sunWorldDir.value.copy(sunDirVec);
        }
        
        if (cloudsMat && cloudsMat.uniforms) {
          cloudsMat.uniforms.sunWorldDir.value.copy(sunDirVec);
        }
      }

      // Camera shake is now applied temporarily at the end of the tick loop during rendering

      // Animate the floating rocket in center if we have one and it's not launched yet
      if (this.launchElements && !this.launchElements.launched) {
        const rocket = this.launchElements.rocket;
        rocket.position.y = -3.5 + Math.sin(t * 0.8) * 0.35; // smooth vertical float
        rocket.rotation.y = t * 0.15; // slow spin to showcase 3D details
        rocket.rotation.x = Math.sin(t * 0.4) * 0.04;
        rocket.rotation.z = Math.cos(t * 0.5) * 0.04;
      }

      // Handle launched animation, vibration, speed blur, flames, smoke trails, and glow particles
      if (this.launchElements && this.launchElements.launched) {
        const el = this.launchElements;
        const rocket = el.rocket;
        const elapsed = t - el.launchTime;

        // 1. Pre-liftoff ignition vibration (rumble in place for first 1.5 seconds)
        if (elapsed < 1.5) {
          const intensity = 0.08 * (elapsed / 1.5); // builds up
          rocket.position.x = el.initialPosition.x + (Math.random() - 0.5) * intensity;
          rocket.position.z = el.initialPosition.z + (Math.random() - 0.5) * intensity;
          rocket.position.y = el.initialPosition.y + (Math.random() - 0.5) * (intensity * 0.5);
        }

        // 2. Flame pulsation & flicker
        if (el.flame) {
          const flameMesh = rocket.userData.flameMesh;
          const time = t;
          const flicker = 1.0 + Math.sin(time * 65.0) * 0.12 + (Math.random() - 0.5) * 0.08;
          flameMesh.scale.set(flicker, flicker * (1.0 + Math.cos(time * 50.0) * 0.05), flicker);
          
          const plumeLight = rocket.userData.plumeLight;
          if (plumeLight) {
            plumeLight.intensity = 16.0 * (0.85 + Math.sin(time * 80.0) * 0.15);
          }

          const distortionMat = rocket.userData.distortionMat;
          if (distortionMat) {
            distortionMat.uniforms.time.value = time;
          }

          const atmGlowMat = rocket.userData.atmGlowMat;
          if (atmGlowMat && atmGlowMat.opacity > 0.01) {
            atmGlowMat.opacity = Math.max(0, 0.45 * (1.0 - (rocket.position.y - (-3.5)) / 25.0));
          }
        }

        // 3. Motion blur stretch based on velocity
        const speed = Math.abs(rocket.position.y - el.prevY);
        el.prevY = rocket.position.y;
        const stretch = 1.0 + Math.min(speed * 0.6, 0.22);
        const squeeze = 1.0 - Math.min(speed * 0.3, 0.11);
        rocket.scale.set(1.45 * squeeze, 1.45 * stretch, 1.45 * squeeze);

        // 4. Continuous Volumetric Smoke Trail Emitter
        if (el.smokeActive && el.smokeObj) {
          const smoke = el.smokeObj;
          if (Math.random() < 0.75 + speed * 2.0) {
            const idx = el.smokeIndex || 0;
            const p = smoke.planes[idx];
            el.smokeIndex = (idx + 1) % smoke.planes.length;

            p.position.copy(rocket.position);
            p.position.y -= 4.5;
            p.position.x += (Math.random() - 0.5) * 0.5;
            p.position.z += (Math.random() - 0.5) * 0.5;

            p.scale.set(0.6, 0.6, 0.6);
            p.material.opacity = p.userData.maxOpacity * 0.9;
            
            p.userData.vx = (Math.random() - 0.5) * 0.08;
            p.userData.vy = -0.06 - Math.random() * 0.12; 
            p.userData.vz = (Math.random() - 0.5) * 0.08;
            p.userData.scaleSpeed = 0.02 + Math.random() * 0.035;
          }

          smoke.planes.forEach(p => {
            p.position.x += p.userData.vx;
            p.position.y += p.userData.vy;
            p.position.z += p.userData.vz;
            p.rotation.z += p.userData.spin;
            
            const s = p.scale.x + p.userData.scaleSpeed;
            p.scale.set(s, s, s);
            p.material.opacity = Math.max(0, p.material.opacity - 0.006);
          });
        }

        // 5. Continuous High-Speed Glowing Exhaust Particles Emitter
        if (el.glowActive && el.glowObj) {
          const glow = el.glowObj;
          for (let k = 0; k < 3; k++) {
            const idx = el.glowIndex || 0;
            const p = glow.planes[idx];
            el.glowIndex = (idx + 1) % glow.planes.length;

            p.position.copy(rocket.position);
            p.position.y -= 4.2;
            p.position.x += (Math.random() - 0.5) * 0.28;
            p.position.z += (Math.random() - 0.5) * 0.28;

            const scale = 0.4 + Math.random() * 0.4;
            p.scale.set(scale, scale, scale);
            p.material.opacity = 1.0;

            p.userData.vx = (Math.random() - 0.5) * 0.12;
            p.userData.vy = -0.4 - Math.random() * 0.5;
            p.userData.vz = (Math.random() - 0.5) * 0.12;
            p.userData.shrinkSpeed = 0.015 + Math.random() * 0.02;
          }

          glow.planes.forEach(p => {
            p.position.x += p.userData.vx;
            p.position.y += p.userData.vy;
            p.position.z += p.userData.vz;
            p.rotation.z += p.userData.spin;

            const s = Math.max(0.001, p.scale.x - p.userData.shrinkSpeed);
            p.scale.set(s, s, s);
            p.material.opacity = Math.max(0, p.material.opacity - 0.04);
          });
        }
      }

      // Animate the expanding sparks particles if active (legacy static spark animation fallback)
      if (this.launchElements && this.launchElements.sparksActive && this.launchElements.sparksObj) {
        const sparks = this.launchElements.sparksObj;
        const posArr = sparks.points.geometry.attributes.position.array;
        const rocketPos = this.launchElements.rocket.position;
        for (let i = 0; i < sparks.count; i++) {
          posArr[i * 3] += sparks.vels[i].x;
          posArr[i * 3 + 1] += sparks.vels[i].y;
          posArr[i * 3 + 2] += sparks.vels[i].z;

          if (posArr[i * 3 + 1] < rocketPos.y - 12) {
            posArr[i * 3] = rocketPos.x + (Math.random() - 0.5) * 0.3;
            posArr[i * 3 + 1] = rocketPos.y - 4.5;
            posArr[i * 3 + 2] = rocketPos.z + (Math.random() - 0.5) * 0.3;
          }
        }
        sparks.points.geometry.attributes.position.needsUpdate = true;
      }

      this.animateParallaxStars(1.0);

      // Apply temporary camera shake offset before rendering
      const baseCamX = this.camera.position.x;
      const baseCamY = this.camera.position.y;
      if (this.cameraShakeActive && this.cameraShakeIntensity > 0) {
        this.camera.position.x += (Math.random() - 0.5) * this.cameraShakeIntensity;
        this.camera.position.y += (Math.random() - 0.5) * this.cameraShakeIntensity;
      }

      this.renderer.render(this.scene, this.camera);

      // Restore camera position immediately after rendering so GSAP animations are not corrupted
      this.camera.position.x = baseCamX;
      this.camera.position.y = baseCamY;
    };

    tick();
  },

  // Launch transition action
  triggerRocketLaunch(timeline) {
    if (!(this.activeSceneType === 'landing' || this.activeSceneType === 'launch')) return;

    const el = this.launchElements || this.landingElements;
    if (!el) return;
    el.launched = true; // Mark as launched to stop floating animations
    el.launchTime = this.clock.getElapsedTime();
    el.rocket.visible = true; // Make visible on launch!

    if (el.plumeLight) el.plumeLight.color.setHex(0xffaa44);

    // Turn on particles, glow, and distortion
    if (el.setSmokeActive) {
      el.setSmokeActive(true);
    }
    
    // Set initial flame opacities to 1.0 (ignition)
    timeline.to(el.flame, { opacity: 1.0, duration: 0.8, ease: 'power1.out' }, 0);
    timeline.to(el.plumeLight, { intensity: 16.0, duration: 0.8, ease: 'power2.out' }, 0);

    // Fade in heat distortion
    if (el.rocket && el.rocket.userData.distortionMat) {
      timeline.to(el.rocket.userData.distortionMat.uniforms.opacity, { value: 1.0, duration: 0.8, ease: 'power1.out' }, 0);
    }

    // Set initial atmospheric glow on rocket
    if (el.rocket && el.rocket.userData.atmGlowMat) {
      timeline.to(el.rocket.userData.atmGlowMat, { opacity: 0.45, duration: 1.0, ease: 'power1.out' }, 1.5);
    }

    // Camera shake (engine ignition shake and liftoff shake)
    this.originalCameraPos = this.camera.position.clone();
    this.cameraShakeActive = true;
    this.cameraShakeIntensity = 0;
    timeline.to(this, { cameraShakeIntensity: 0.35, duration: 0.8, ease: 'power1.out' }, 0);
    timeline.to(this, { cameraShakeIntensity: 0.50, duration: 1.6, ease: 'none' }, 0.8);
    timeline.to(this, { cameraShakeIntensity: 0.0, duration: 2.5, ease: 'power2.inOut' }, 2.4);

    // Smoothly align the rocket's rotation to upright (0, 0, 0) during engine ignition
    timeline.to(el.rocket.rotation, {
      x: 0,
      y: 0,
      z: 0,
      duration: 0.5,
      ease: 'power2.out'
    }, 0);

    // 3. Cinematic Liftoff & Curved Trajectory (Starts at t = 1.5s, slow majestic ease-in)
    // Separate axis animations create a perfect aerodynamic gravity turn
    // Y (Altitude) rises smoothly
    timeline.to(el.rocket.position, {
      y: 38.0,
      duration: 5.5,
      ease: 'power2.inOut'
    }, 1.5);

    // X (Drift Right) starts later as gravity turn takes effect
    timeline.to(el.rocket.position, {
      x: 28.0,
      duration: 4.6,
      ease: 'power2.in'
    }, 2.4);

    // Z (Recede into Space) starts later as horizontal speed increases
    timeline.to(el.rocket.position, {
      z: -240,
      duration: 4.8,
      ease: 'power2.in'
    }, 2.2);

    // 4. Aerodynamic Pitch Tilt (Gravity Turn) - tilts right and away slowly
    timeline.to(el.rocket.rotation, {
      x: -0.15, // tilt away from camera
      z: -0.18, // tilt right towards flight path
      duration: 3.8,
      ease: 'power2.inOut'
    }, 2.4);

    // 5. Warp/Atmospheric Speed Effect (starfield trails stretch at high-speed phase)
    timeline.to(this, { starWarp: 15.0, duration: 2.0, ease: 'power3.in' }, 1.5);
    timeline.to(this, { starWarp: 35.0, duration: 1.5, ease: 'power2.in' }, 3.5);
    timeline.to(this, { starWarp: 0.0, duration: 1.2, ease: 'power2.out' }, 5.8);
    
    // Camera moves slightly to track launch climb
    timeline.to(this.camera.position, { x: 4.0, y: 18.0, z: 28.0, duration: 4.8, ease: 'power2.inOut' }, 1.5);

    // 6. Smooth Fade out into Deep Space (both body and flame fade to 0)
    timeline.to(el.flame, { opacity: 0.0, duration: 1.2, ease: 'power1.in' }, 5.5);
    if (el.rocket && el.rocket.userData.rocketMats) {
      timeline.to(el.rocket.userData.rocketMats, { opacity: 0.0, duration: 1.2, ease: 'power1.in' }, 5.5);
    }
    if (el.rocket && el.rocket.userData.distortionMat && el.rocket.userData.distortionMat.uniforms.opacity) {
      timeline.to(el.rocket.userData.distortionMat.uniforms.opacity, { value: 0.0, duration: 1.2, ease: 'power1.in' }, 5.5);
    }

    // Stop emitting particles at the end of trajectory
    timeline.add(() => {
      if (el.setSmokeActive) {
        el.setSmokeActive(false);
      }
    }, 6.7);
  },

  // 2. Login Page Scene: Space cabin cockpit traveling view
  initLoginScene() {
    this.activeSceneType = 'login';
    this.camera.position.set(0, 0, 20);

    // Moving deep space background
    this.createStarfield(2000);
    this.createNebula();

    // Ambient floating planets passing in Z
    const loader = new THREE.TextureLoader();
    const planetTypes = ['mars', 'mercury', 'venus', 'neptune'];
    const planets = [];

    for (let i = 0; i < 4; i++) {
      const type = planetTypes[i];
      const size = 1.5 + Math.random() * 2.5;
      const geo = new THREE.SphereGeometry(size, 24, 24);
      const mat = new THREE.MeshStandardMaterial({
        map: loader.load(`assets/planets/${type}.png`),
        roughness: 0.9
      });
      const mesh = new THREE.Mesh(geo, mat);
      
      // Random coordinates in space
      mesh.position.set(
        (Math.random() - 0.5) * 80,
        (Math.random() - 0.5) * 60,
        -150 - i * 150
      );
      mesh.rotation.x = Math.random() * Math.PI;
      this.scene.add(mesh);
      planets.push(mesh);
    }

    // Directional headlight from visor cabin
    const light = new THREE.DirectionalLight(0xffffff, 2.2);
    light.position.set(0, 10, 30);
    this.scene.add(light);

    let travelSpeed = 1.0;

    const tick = () => {
      if (this.activeSceneType !== 'login') return;
      this.animId = requestAnimationFrame(tick);

      const t = this.clock.getElapsedTime();

      // Update stars coordinates
      this.animateTravelStars(travelSpeed);

      // Animate passing planets
      planets.forEach((mesh, index) => {
        mesh.rotation.y = t * 0.05;
        mesh.position.z += 0.25 * travelSpeed;
        
        // Reset planet if it flies past visor
        if (mesh.position.z > 30) {
          mesh.position.z = -600;
          mesh.position.x = (Math.random() - 0.5) * 80;
          mesh.position.y = (Math.random() - 0.5) * 60;
        }
      });

      this.renderer.render(this.scene, this.camera);
    };

    tick();

    // Expose speed parameter for acceleration triggers
    this.loginElements = {
      accelerate: (timeline) => {
        timeline.to({ val: 1.0 }, {
          val: 18.0,
          duration: 1.8,
          ease: 'power3.in',
          onUpdate: function() {
            travelSpeed = this.targets()[0].val;
          }
        });
      }
    };
  },

  // 3. Register Page Scene: Swirling 3D wormhole time-vortex
  initRegisterScene() {
    this.activeSceneType = 'register';
    this.camera.position.set(0, 0, 10);

    const loader = new THREE.TextureLoader();

    // Infinite Wormhole Cylinder Tube
    const tubeGeo = new THREE.CylinderGeometry(15, 15, 600, 32, 64, true);
    const tubeTex = loader.load('assets/effects/wormhole.png');
    // Set texture to wrap and repeat infinitely along cylinder height
    tubeTex.wrapS = THREE.RepeatWrapping;
    tubeTex.wrapT = THREE.RepeatWrapping;
    tubeTex.repeat.set(2, 8);

    const tubeMat = new THREE.MeshBasicMaterial({
      map: tubeTex,
      side: THREE.BackSide, // Render inner faces
      transparent: true,
      blending: THREE.AdditiveBlending
    });
    const wormhole = new THREE.Mesh(tubeGeo, tubeMat);
    wormhole.rotation.x = Math.PI / 2; // Orient along Z axis
    this.scene.add(wormhole);

    // Falling Star particles
    this.createStarfield(1200);

    let wormholeSpeed = 0.45;
    let starSpeed = 2.5;

    const tick = () => {
      if (this.activeSceneType !== 'register') return;
      this.animId = requestAnimationFrame(tick);

      const t = this.clock.getElapsedTime();

      // Rotate wormhole and offset texture map dynamically
      wormhole.rotation.y = t * 0.08;
      tubeTex.offset.y = -t * wormholeSpeed; // Move texture downward to simulate forward speed

      // Animate stars
      this.animateTravelStars(starSpeed);

      this.renderer.render(this.scene, this.camera);
    };

    tick();

    // Expose speed parameter for acceleration triggers
    this.registerElements = {
      accelerate: (timeline) => {
        timeline.to({ wSpeed: 0.45, sSpeed: 2.5 }, {
          wSpeed: 8.0,
          sSpeed: 20.0,
          duration: 1.8,
          ease: 'power3.in',
          onUpdate: function() {
            wormholeSpeed = this.targets()[0].wSpeed;
            starSpeed = this.targets()[0].sSpeed;
          }
        });
      }
    };
  },

  // Draw dynamic 3D spinning planet hologram inside registration card sidebar
  createHologramPlanet(planetName, containerId) {
    const parent = document.getElementById(containerId);
    if (!parent) return;
    
    // Clear previous hologram canvas
    parent.innerHTML = '';

    const w = parent.clientWidth || 180;
    const h = parent.clientHeight || 180;

    const holoScene = new THREE.Scene();
    const holoCam = new THREE.PerspectiveCamera(40, w / h, 0.1, 100);
    holoCam.position.set(0, 0, 5);

    const holoRenderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    holoRenderer.setSize(w, h);
    holoRenderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    parent.appendChild(holoRenderer.domElement);

    // Glowing cyan outline ambient lighting
    holoScene.add(new THREE.AmbientLight(0x00f0ff, 1.8));

    const light = new THREE.DirectionalLight(0xffffff, 1.5);
    light.position.set(5, 5, 5);
    holoScene.add(light);

    // Draw Planet Sphere
    const geo = new THREE.SphereGeometry(1.6, 32, 32);
    
    // Load local texture
    const texture = new THREE.TextureLoader().load(`assets/planets/${planetName}.png`);
    const mat = new THREE.MeshStandardMaterial({
      map: texture,
      roughness: 0.8,
      transparent: true,
      opacity: 0.8,
      metalness: 0.1
    });
    const sphere = new THREE.Mesh(geo, mat);
    holoScene.add(sphere);

    // Glowing wireframe aura overlay
    const wireGeo = new THREE.SphereGeometry(1.61, 16, 16);
    const wireMat = new THREE.MeshBasicMaterial({
      color: 0x00f0ff,
      wireframe: true,
      transparent: true,
      opacity: 0.18
    });
    const wire = new THREE.Mesh(wireGeo, wireMat);
    holoScene.add(wire);

    let active = true;
    const clock = new THREE.Clock();

    const loop = () => {
      if (!active) return;
      requestAnimationFrame(loop);
      
      const elapsed = clock.getElapsedTime();
      sphere.rotation.y = elapsed * 0.18;
      wire.rotation.y = -elapsed * 0.08;
      
      // Holographic flicker
      mat.opacity = 0.65 + Math.sin(elapsed * 45) * 0.1;
      wireMat.opacity = 0.12 + Math.sin(elapsed * 60) * 0.06;

      holoRenderer.render(holoScene, holoCam);
    };

    loop();

    return {
      destroy: () => {
        active = false;
        holoRenderer.dispose();
      }
    };
  },

  // 4. Dashboard Landing & Orbital Scene
  initDashboardScene(planetName, theme) {
    this.activeSceneType = 'dashboard';
    this.camera.position.set(0, 0, 35);

    const loader = new THREE.TextureLoader();

    // Map theme colors
    const themeColors = {
      grey:   { light: 0xa8adb8, ambient: 0x050608 },
      orange: { light: 0xffa500, ambient: 0x0f0b08 },
      red:    { light: 0xff5500, ambient: 0x120808 },
      yellow: { light: 0xffe57f, ambient: 0x121008 },
      blue:   { light: 0x4aa6ff, ambient: 0x060c16 },
      cyan:   { light: 0x00f0ff, ambient: 0x040c12 },
      brown:  { light: 0xd7ccc8, ambient: 0x100c0a },
      gold:   { light: 0xffdf00, ambient: 0x120e06 }
    };
    const colors = themeColors[theme] || themeColors.blue;

    // Apply specific light hue (neutral sun color, softer intensity)
    const sun = new THREE.DirectionalLight(0xffffff, 1.4);
    sun.position.set(-40, 25, 20);
    this.scene.add(sun);

    // Neutral ambient light to preserve original texture colors on both sides
    const ambient = new THREE.AmbientLight(0xffffff, 0.7);
    this.scene.add(ambient);

    // Planet configuration parameters (realistic NASA-style colors and properties)
    const planetConfigs = {
      mercury: {
        texture: 'assets/planets/mercury.png',
        glowColor: [0.55, 0.55, 0.55],
        glowIntensity: 0.3,
        roughness: 0.9,
        metalness: 0.0
      },
      venus: {
        texture: 'assets/planets/venus.png',
        glowColor: [0.85, 0.65, 0.35],
        glowIntensity: 1.8,
        roughness: 0.9,
        metalness: 0.0
      },
      mars: {
        texture: 'assets/planets/mars.png',
        glowColor: [0.8, 0.35, 0.2],
        glowIntensity: 1.1,
        roughness: 0.9,
        metalness: 0.0
      },
      saturn: {
        texture: 'assets/planets/saturn.png',
        glowColor: [0.75, 0.68, 0.5],
        glowIntensity: 1.4,
        roughness: 0.9,
        metalness: 0.0
      },
      uranus: {
        texture: 'assets/planets/uranus.png',
        glowColor: [0.45, 0.8, 0.8],
        glowIntensity: 1.6,
        roughness: 0.9,
        metalness: 0.0
      },
      neptune: {
        texture: 'assets/planets/neptune.png',
        glowColor: [0.2, 0.45, 0.9],
        glowIntensity: 1.8,
        roughness: 0.9,
        metalness: 0.0
      },
      jupiter: {
        texture: 'assets/planets/jupiter.png',
        glowColor: [0.85, 0.6, 0.45],
        glowIntensity: 1.5,
        roughness: 0.9,
        metalness: 0.0
      }
    };

    const config = planetConfigs[planetName] || planetConfigs.saturn;
    const planetTex = loader.load(config.texture);
    const maxAnisotropy = this.renderer.capabilities.getMaxAnisotropy();
    planetTex.anisotropy = Math.min(maxAnisotropy, 8);
    planetTex.wrapS = THREE.RepeatWrapping;

    // 3D realistic exoplanet
    const planetRadius = 10.0;
    const planetGeo = new THREE.SphereGeometry(planetRadius, 96, 96);
    const planetMat = new THREE.MeshStandardMaterial({
      map: planetTex,
      color: 0xffffff,
      emissive: 0x000000,
      metalness: 0.0,
      roughness: 0.9,
      toneMapped: false
    });

    const planetMesh = new THREE.Mesh(planetGeo, planetMat);
    planetMesh.position.set(10, 8, -25);
    this.scene.add(planetMesh);

    // 3D Cloud Layer (Earth only - Earth is never loaded in dashboard, so cloudsMesh is null)
    let cloudsMesh = null;
    if (planetName === 'earth') {
      const cloudsGeo = new THREE.SphereGeometry(planetRadius * 1.015, 64, 64);
      const cloudMapTex = loader.load('assets/planets/earthcloudmap.jpg');
      cloudMapTex.anisotropy = Math.min(maxAnisotropy, 8);
      cloudMapTex.wrapS = THREE.RepeatWrapping;

      const cloudsMat = new THREE.ShaderMaterial({
        uniforms: {
          cloudMap: { value: cloudMapTex },
          sunWorldDir: { value: new THREE.Vector3(-40, 25, 20).normalize() }
        },
        vertexShader: `
          varying vec3 vWorldNormal;
          varying vec2 vUv;
          void main() {
            vWorldNormal = normalize((modelMatrix * vec4(normal, 0.0)).xyz);
            vUv = uv;
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
          }
        `,
        fragmentShader: `
          uniform sampler2D cloudMap;
          uniform vec3 sunWorldDir;
          varying vec3 vWorldNormal;
          varying vec2 vUv;
          void main() {
            vec3 color = texture2D(cloudMap, vUv).rgb;
            float alpha = color.r;
            float cosTheta = dot(normalize(vWorldNormal), normalize(sunWorldDir));
            float diffuse = max(cosTheta, 0.0);
            float ambient = 0.15;
            gl_FragColor = vec4(vec3(1.0) * (diffuse + ambient), alpha * 0.7);
          }
        `,
        transparent: true,
        depthWrite: false
      });
      cloudsMesh = new THREE.Mesh(cloudsGeo, cloudsMat);
      cloudsMesh.position.copy(planetMesh.position);
      this.scene.add(cloudsMesh);
    }

    // 3D Atmospheric Fresnel Glow
    const glowMat = new THREE.ShaderMaterial({
      uniforms: {
        sunWorldDir: { value: new THREE.Vector3(-40, 25, 20).normalize() },
        glowColor: { value: new THREE.Color(config.glowColor[0], config.glowColor[1], config.glowColor[2]) },
        glowIntensity: { value: config.glowIntensity }
      },
      vertexShader: `
        varying vec3 vWorldNormal;
        varying vec3 vViewNormal;
        void main() {
          vWorldNormal = normalize((modelMatrix * vec4(normal, 0.0)).xyz);
          vViewNormal = normalize(normalMatrix * normal);
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        uniform vec3 sunWorldDir;
        uniform vec3 glowColor;
        uniform float glowIntensity;
        varying vec3 vWorldNormal;
        varying vec3 vViewNormal;
        void main() {
          vec3 viewNormal = normalize(vViewNormal);
          vec3 worldNormal = normalize(vWorldNormal);
          float intensity = pow(1.0 - abs(viewNormal.z), 5.0);
          float sunFacing = dot(worldNormal, normalize(sunWorldDir));
          float sunFactor = smoothstep(-0.2, 0.2, sunFacing);
          gl_FragColor = vec4(glowColor, 1.0) * intensity * sunFactor * glowIntensity;
        }
      `,
      transparent: true,
      blending: THREE.AdditiveBlending,
      side: THREE.BackSide,
      depthWrite: false
    });
    const glowMesh = new THREE.Mesh(new THREE.SphereGeometry(planetRadius * 1.018, 64, 64), glowMat);
    glowMesh.position.copy(planetMesh.position);
    this.scene.add(glowMesh);

    // Add Saturn Rings if planet is Saturn
    let saturnRings = null;
    if (planetName === 'saturn') {
      const ringGeo = new THREE.RingGeometry(planetRadius * 1.3, planetRadius * 2.1, 64);
      const ringMat = new THREE.MeshStandardMaterial({
        color: 0xdfc294,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.68
      });
      saturnRings = new THREE.Mesh(ringGeo, ringMat);
      saturnRings.rotation.x = Math.PI / 2.3;
      saturnRings.rotation.y = Math.PI / 8;
      saturnRings.position.copy(planetMesh.position);
      this.scene.add(saturnRings);
    }

    // Twinkling Starfield and Nebula
    this.createStarfield(1500);
    this.createNebula();

    // Define responsive layout adjustments (Planet size is 32% of viewport width)
    this.resizeDashboardScene = () => {
      const w = window.innerWidth;
      const h = window.innerHeight;
      const aspect = w / h;

      const planetZ = -25;
      const dist = this.camera.position.z - planetZ;
      
      const fovRad = (this.camera.fov * Math.PI) / 360;
      const visibleHeight = 2 * dist * Math.tan(fovRad);
      const visibleWidth = visibleHeight * aspect;

      // Planet size occupies exactly 32% of screen width
      const planetPx = w * 0.32;
      const planetDiameter = (planetPx / w) * visibleWidth;
      const calculatedRadius = planetDiameter / 2;

      // Base radius in model is 10.0
      const scaleFactor = calculatedRadius / planetRadius;
      
      planetMesh.scale.set(scaleFactor, scaleFactor, scaleFactor);
      if (glowMesh) glowMesh.scale.set(scaleFactor, scaleFactor, scaleFactor);
      if (cloudsMesh) cloudsMesh.scale.set(scaleFactor, scaleFactor, scaleFactor);
      if (saturnRings) saturnRings.scale.set(scaleFactor, scaleFactor, scaleFactor);

      // Position planet on the right side of the screen centered vertically
      const screenRightEdge = visibleWidth / 2;
      const planetX = screenRightEdge - calculatedRadius - 1.2;
      const planetY = 1.0; 

      planetMesh.position.set(planetX, planetY, planetZ);
      if (glowMesh) glowMesh.position.copy(planetMesh.position);
      if (cloudsMesh) cloudsMesh.position.copy(planetMesh.position);
      if (saturnRings) saturnRings.position.copy(planetMesh.position);
    };

    // Run once at initialization
    this.resizeDashboardScene();

    let mouseX = 0, mouseY = 0;
    document.addEventListener('mousemove', (e) => {
      mouseX = (e.clientX - window.innerWidth / 2) / (window.innerWidth / 2);
      mouseY = (e.clientY - window.innerHeight / 2) / (window.innerHeight / 2);
    });

    this.isDescentActive = false;
    this.cameraMode = 'chase';
    this.cameraShakeActive = false;
    this.cameraShakeIntensity = 0;

    // ================================================================
    // Earth-to-Destination Planet Rocket Transition Sequence Emitter
    // ================================================================
    const showLaunchTransition = localStorage.getItem('showLaunchTransition') === 'true';

    let earthMesh = null;
    let earthMat = null;
    let rocketGroup = null;
    let smokeObj = null;
    let sparksObj = null;
    let glowObj = null;
    let enableMouseParallax = true;

    if (showLaunchTransition) {
      enableMouseParallax = false;

      // Hide dashboard UI panels initially
      const dashContainer = document.querySelector('.dashboard-container');
      const botWidget = document.getElementById('cosmobot-widget');
      if (dashContainer) {
        dashContainer.style.opacity = '0';
        dashContainer.style.transform = 'translateY(20px)';
        dashContainer.style.pointerEvents = 'none';
      }
      if (botWidget) {
        botWidget.style.opacity = '0';
        botWidget.style.transform = 'translateY(20px)';
        botWidget.style.pointerEvents = 'none';
      }

      // 1. Create departure Earth
      const earthRadius = 5.0;
      const earthGeo = new THREE.SphereGeometry(earthRadius, 48, 48);
      const earthDayMap = loader.load('assets/planets/earthmap1k.jpg');
      earthMat = new THREE.MeshStandardMaterial({
        map: earthDayMap,
        roughness: 0.7,
        metalness: 0.1,
        transparent: true,
        opacity: 1.0
      });
      earthMesh = new THREE.Mesh(earthGeo, earthMat);
      earthMesh.position.set(-18, -6, -30);
      this.scene.add(earthMesh);

      // 2. Create rocket group
      rocketGroup = this.create3DRocket(loader);
      rocketGroup.scale.set(1.2, 1.2, 1.2);
      rocketGroup.position.set(-18, -0.6, -30);
      rocketGroup.rotation.set(0, 0, 0);
      rocketGroup.visible = true;
      this.scene.add(rocketGroup);

      const flameMat = rocketGroup.userData.flameMat;
      const plumeLight = rocketGroup.userData.plumeLight;

      // Setup smoke & spark particles
      smokeObj = this.createVolumetricSmoke(this.scene, 40);
      sparksObj = this.createLaunchSparks(this.scene);
      glowObj = this.createExhaustGlow(this.scene, 40);

      this.launchElements = {
        rocket: rocketGroup,
        flame: flameMat,
        plumeLight: plumeLight,
        smokeObj: smokeObj,
        sparksObj: sparksObj,
        glowObj: glowObj,
        smokeActive: false,
        sparksActive: false,
        launched: true,
        launchTime: this.clock.getElapsedTime(),
        smokeIndex: 0,
        prevY: -0.6,
        initialPosition: new THREE.Vector3(-18, -0.6, -30),
        setSmokeActive: (active) => {
          if (this.launchElements) {
            this.launchElements.smokeActive = active;
            this.launchElements.sparksActive = active;
          }
        }
      };

      // 3. Cinematic GSAP transition timeline
      const transitionTimeline = gsap.timeline({
        onComplete: () => {
          // Clean up transitional elements from the scene
          if (earthMesh) this.scene.remove(earthMesh);
          if (rocketGroup) this.scene.remove(rocketGroup);
          if (smokeObj && smokeObj.group) this.scene.remove(smokeObj.group);
          if (sparksObj && sparksObj.group) this.scene.remove(sparksObj.group);
          if (glowObj && glowObj.group) this.scene.remove(glowObj.group);
          
          this.launchElements = null;
          enableMouseParallax = true;
        }
      });

      // Phase 1 (0s - 0.4s): Ignition vibration & engine flame activation
      transitionTimeline.to(rocketGroup.position, {
        x: "+=0.06", y: "+=0.06", duration: 0.04, repeat: 10, yoyo: true
      }, 0);
      transitionTimeline.add(() => {
        if (plumeLight) plumeLight.intensity = 10;
        flameMat.forEach(m => m.opacity = 1.0);
        this.launchElements.smokeActive = true;
        this.launchElements.sparksActive = true;
      }, 0.2);

      // Phase 2 (0.4s - 1.5s): Lift-off & initial climb
      transitionTimeline.to(rocketGroup.position, {
        x: -12,
        y: 4,
        z: -28,
        duration: 1.1,
        ease: "power2.in"
      }, 0.4);
      transitionTimeline.to(rocketGroup.rotation, {
        x: -0.3,
        z: -0.4,
        duration: 1.1,
        ease: "power1.inOut"
      }, 0.4);

      // Phase 3 (1.5s - 3.2s): Smooth space travel across screen
      transitionTimeline.to(rocketGroup.position, {
        x: 6,
        y: 2,
        z: -24,
        duration: 1.7,
        ease: "power1.inOut"
      }, 1.5);
      transitionTimeline.to(rocketGroup.rotation, {
        x: -0.1,
        z: -0.2,
        duration: 1.7,
        ease: "power1.inOut"
      }, 1.5);
      
      // Earth rotation and fade away
      transitionTimeline.to(earthMesh.rotation, {
        y: "+=1.5",
        duration: 2.0,
        ease: "power1.inOut"
      }, 1.5);
      transitionTimeline.to(earthMat, {
        opacity: 0.0,
        duration: 1.5,
        ease: "power1.out"
      }, 1.8);

      // Phase 4 (3.2s - 4.5s): Approach and orbital arc around destination planet
      transitionTimeline.to(rocketGroup.position, {
        x: 10,
        y: 1.2,
        z: -28,
        duration: 1.3,
        ease: "power2.out"
      }, 3.2);
      transitionTimeline.to(rocketGroup.rotation, {
        x: 0.3,
        y: -1.0,
        z: 0.2,
        duration: 1.3,
        ease: "power1.out"
      }, 3.2);

      // Fade out rocket & flame naturally
      transitionTimeline.to(flameMat, {
        opacity: 0.0,
        duration: 0.8
      }, 3.5);
      if (rocketGroup.userData.rocketMats) {
        transitionTimeline.to(rocketGroup.userData.rocketMats, {
          opacity: 0.0,
          duration: 0.8
        }, 3.5);
      }
      transitionTimeline.add(() => {
        if (this.launchElements) {
          this.launchElements.smokeActive = false;
          this.launchElements.sparksActive = false;
        }
      }, 4.0);

      // Reveal dashboard UI panels smoothly near the end of the transition
      transitionTimeline.to(dashContainer, {
        opacity: 1,
        y: 0,
        duration: 1.5,
        ease: 'power2.out',
        onStart: () => {
          dashContainer.style.pointerEvents = 'all';
        }
      }, 4.2);
      
      transitionTimeline.to(botWidget, {
        opacity: 1,
        y: 0,
        duration: 1.5,
        ease: 'power2.out',
        onStart: () => {
          botWidget.style.pointerEvents = 'all';
        }
      }, 4.4);
    }

    const tick = () => {
      if (this.activeSceneType !== 'dashboard') return;
      this.animId = requestAnimationFrame(tick);

      const t = this.clock.getElapsedTime();

      // Planet rotation (slow, elegant: 120s period)
      planetMesh.rotation.y = t * (Math.PI * 2 / 120.0);
      if (glowMesh) {
        glowMesh.rotation.y = t * 0.010;
      }
      if (saturnRings) {
        saturnRings.rotation.z = -t * 0.005;
      }
      if (cloudsMesh) {
        cloudsMesh.rotation.y = t * (Math.PI * 2 / 100.0);
      }

      // Update shader uniforms for dynamic atmospheric lighting angles
      const planetWorldPos = new THREE.Vector3();
      planetMesh.getWorldPosition(planetWorldPos);
      const sunDirVec = new THREE.Vector3().copy(sun.position).sub(planetWorldPos).normalize();
      
      if (glowMesh && glowMesh.material && glowMesh.material.uniforms) {
        glowMesh.material.uniforms.sunWorldDir.value.copy(sunDirVec);
      }
      
      if (cloudsMesh && cloudsMesh.material && cloudsMesh.material.uniforms) {
        cloudsMesh.material.uniforms.sunWorldDir.value.copy(sunDirVec);
      }

      // Update particles during transition if active
      if (this.launchElements && this.launchElements.launched) {
        const el = this.launchElements;
        const rocket = el.rocket;
        const time = t;
        
        // Flame pulsation & flicker
        if (el.flame) {
          const flameMesh = rocket.userData.flameMesh;
          const flicker = 1.0 + Math.sin(time * 65.0) * 0.12 + (Math.random() - 0.5) * 0.08;
          flameMesh.scale.set(flicker, flicker * (1.0 + Math.cos(time * 50.0) * 0.05), flicker);
          
          const plumeLight = rocket.userData.plumeLight;
          if (plumeLight) {
            plumeLight.intensity = 16.0 * (0.85 + Math.sin(time * 80.0) * 0.15);
          }

          const distortionMat = rocket.userData.distortionMat;
          if (distortionMat) {
            distortionMat.uniforms.time.value = time;
          }
        }

        // Exhaust smoke particles trail update
        if (el.smokeActive && el.smokeObj) {
          const smoke = el.smokeObj;
          if (Math.random() < 0.65) {
            const idx = el.smokeIndex || 0;
            const p = smoke.planes[idx];
            el.smokeIndex = (idx + 1) % smoke.planes.length;

            p.position.copy(rocket.position);
            p.position.y -= 2.0;
            p.position.x += (Math.random() - 0.5) * 0.3;
            p.position.z += (Math.random() - 0.5) * 0.3;

            p.scale.set(0.4, 0.4, 0.4);
            p.material.opacity = p.userData.maxOpacity * 0.8;
            
            p.userData.vx = (Math.random() - 0.5) * 0.06;
            p.userData.vy = -0.04 - Math.random() * 0.08; 
            p.userData.vz = (Math.random() - 0.5) * 0.06;
            p.userData.scaleSpeed = 0.015 + Math.random() * 0.025;
          }

          smoke.planes.forEach(p => {
            p.position.x += p.userData.vx;
            p.position.y += p.userData.vy;
            p.position.z += p.userData.vz;
            p.rotation.z += p.userData.spin;
            
            const s = p.scale.x + p.userData.scaleSpeed;
            p.scale.set(s, s, s);
            p.material.opacity = Math.max(0, p.material.opacity - 0.01);
          });
        }
      }

      // Camera positioning (orbital view with mouse parallax)
      if (enableMouseParallax) {
        this.camera.position.x += (mouseX * 2.0 - this.camera.position.x) * 0.045;
        this.camera.position.y += (-mouseY * 1.5 - this.camera.position.y) * 0.045;
      }
      this.camera.lookAt(0, 0, 0);

      this.renderer.render(this.scene, this.camera);
    };

    tick();

    // Play smooth, landing sequence (Bypassed: rocket has already landed during transition!)
    this.playLandingSequence = (onImpactCallback, onCompleteCallback) => {
      if (onCompleteCallback) onCompleteCallback();
    };
  },

  // 3D Volumetric Exhaust Smoke Cloud Generator
  createVolumetricSmoke(parentGroup, count = 40) {
    const smokeGroup = new THREE.Group();
    const loader = new THREE.TextureLoader();
    const smokeTex = loader.load('assets/effects/nebula.png');
    
    const baseMat = new THREE.MeshLambertMaterial({
      map: smokeTex,
      transparent: true,
      opacity: 0, // starts invisible, fades in on ignition
      depthWrite: false,
      side: THREE.DoubleSide
    });

    const smokePlanes = [];
    const geo = new THREE.PlaneGeometry(3.5, 3.5);
    let smokeMat;

    for (let i = 0; i < count; i++) {
      smokeMat = baseMat.clone();
      const mesh = new THREE.Mesh(geo, smokeMat);
      
      // Randomize position in a cluster at the base of the rocket
      const radius = 0.3 + Math.random() * 1.5;
      const angle = Math.random() * Math.PI * 2;
      mesh.position.set(
        Math.cos(angle) * radius,
        -1.0 - Math.random() * 2.5,
        Math.sin(angle) * radius
      );

      // Random rotation and scale
      mesh.rotation.z = Math.random() * Math.PI * 2;
      const scale = 0.5 + Math.random() * 1.5;
      mesh.scale.set(scale, scale, scale);

      // Store initial drift velocities
      mesh.userData = {
        spin: (Math.random() - 0.5) * 0.008,
        vx: (Math.random() - 0.5) * 0.02,
        vy: -0.015 - Math.random() * 0.03, // drifts downward/outward
        vz: (Math.random() - 0.5) * 0.02,
        scaleSpeed: 0.004 + Math.random() * 0.006,
        maxOpacity: 0.35 + Math.random() * 0.4
      };

      smokeGroup.add(mesh);
      smokePlanes.push(mesh);
    }

    parentGroup.add(smokeGroup);
    return { group: smokeGroup, planes: smokePlanes, material: smokeMat };
  },

  // Spark particles for liftoff
  createLaunchSparks(parentGroup) {
    const count = 90;
    const geo = new THREE.BufferGeometry();
    const pos = new Float32Array(count * 3);
    const vels = [];

    for (let i = 0; i < count; i++) {
      pos[i * 3] = 0;
      pos[i * 3 + 1] = 0;
      pos[i * 3 + 2] = 0;
      vels.push({
        x: (Math.random() - 0.5) * 0.3,
        y: -0.2 - Math.random() * 0.4,
        z: (Math.random() - 0.5) * 0.3
      });
    }

    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    const mat = new THREE.PointsMaterial({
      color: 0xff8a00,
      size: 0.35,
      transparent: true,
      opacity: 0,
      blending: THREE.AdditiveBlending,
      depthWrite: false
    });

    const points = new THREE.Points(geo, mat);
    parentGroup.add(points);

    return { points, vels, material: mat, count };
  },

  // Exhaust glow particles pool
  createExhaustGlow(parentGroup, count = 50) {
    const glowGroup = new THREE.Group();
    const loader = new THREE.TextureLoader();
    const glowTex = loader.load('assets/effects/starfield.png');
    
    const baseMat = new THREE.MeshBasicMaterial({
      map: glowTex,
      color: 0xff8822,
      transparent: true,
      opacity: 0,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      side: THREE.DoubleSide
    });

    const planes = [];
    const geo = new THREE.PlaneGeometry(0.8, 0.8);

    for (let i = 0; i < count; i++) {
      const mat = baseMat.clone();
      const mesh = new THREE.Mesh(geo, mat);
      mesh.scale.set(0.001, 0.001, 0.001);
      mesh.userData = {
        vx: 0,
        vy: 0,
        vz: 0,
        spin: (Math.random() - 0.5) * 0.1,
        shrinkSpeed: 0.02 + Math.random() * 0.02
      };
      glowGroup.add(mesh);
      planes.push(mesh);
    }

    parentGroup.add(glowGroup);
    return { group: glowGroup, planes: planes };
  },

  // 3D Space Shuttle Stack Model Generator
  create3DRocket(loader) {
    const rocketGroup = new THREE.Group();

    const rocketTex = loader.load('assets/rocket/rocket.png');
    const maxAnisotropy = this.renderer.capabilities.getMaxAnisotropy();
    rocketTex.anisotropy = Math.min(maxAnisotropy, 8);

    // High quality metallic materials
    const bodyMat = new THREE.MeshStandardMaterial({ 
      map: rocketTex,
      color: 0xfcfcfc, 
      roughness: 0.22, 
      metalness: 0.58,
      transparent: true
    });
    const darkMat = new THREE.MeshStandardMaterial({ 
      color: 0x1d2026, 
      roughness: 0.4, 
      metalness: 0.75,
      transparent: true
    });
    const metalMat = new THREE.MeshStandardMaterial({ 
      color: 0x4e545e, 
      roughness: 0.3, 
      metalness: 0.88,
      transparent: true
    });
    const glowMat = new THREE.MeshStandardMaterial({ 
      color: 0xffaa00, 
      emissive: 0xff4400, 
      emissiveIntensity: 3.2,
      transparent: true
    });

    // 1. Tall Cylindrical Fuselage Core
    const coreHeight = 6.2;
    const coreRadius = 0.4;
    const coreBody = new THREE.Mesh(new THREE.CylinderGeometry(coreRadius, coreRadius, coreHeight, 32), bodyMat);
    coreBody.position.y = 0;
    rocketGroup.add(coreBody);

    // 2. Tapered Nose Cone
    const noseHeight = 1.8;
    const noseGeo = new THREE.CylinderGeometry(0.001, coreRadius, noseHeight, 32);
    const nose = new THREE.Mesh(noseGeo, bodyMat);
    nose.position.y = coreHeight / 2 + noseHeight / 2;
    rocketGroup.add(nose);

    // 3. Dark Interstage Ring Accents
    const ring1 = new THREE.Mesh(new THREE.CylinderGeometry(coreRadius + 0.002, coreRadius + 0.002, 0.4, 32), darkMat);
    ring1.position.y = 1.5;
    rocketGroup.add(ring1);

    const ring2 = new THREE.Mesh(new THREE.CylinderGeometry(coreRadius + 0.002, coreRadius + 0.002, 0.25, 32), darkMat);
    ring2.position.y = -1.8;
    rocketGroup.add(ring2);

    // 4. Vertical Conduit Raceway details
    const pipe = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, coreHeight, 8), darkMat);
    pipe.position.set(coreRadius + 0.005, 0, 0);
    rocketGroup.add(pipe);

    // 5. 4 Grid Fins near the top
    const finGeo = new THREE.BoxGeometry(0.18, 0.18, 0.02);
    for (let i = 0; i < 4; i++) {
      const angle = (i * Math.PI) / 2;
      const fin = new THREE.Mesh(finGeo, darkMat);
      fin.position.set(Math.cos(angle) * (coreRadius + 0.06), 2.2, Math.sin(angle) * (coreRadius + 0.06));
      fin.rotation.y = -angle;
      rocketGroup.add(fin);
    }

    // 6. 4 Angled Landing Legs at the base
    const legGroup = new THREE.Group();
    const strutGeo = new THREE.CylinderGeometry(0.022, 0.022, 1.3, 8);
    for (let i = 0; i < 4; i++) {
      const angle = (i * Math.PI) / 2 + Math.PI / 4;
      const leg = new THREE.Group();
      const strut = new THREE.Mesh(strutGeo, darkMat);
      strut.position.set(0.18, -0.5, 0);
      strut.rotation.z = -0.38; // angle out
      leg.add(strut);
      leg.position.set(Math.cos(angle) * (coreRadius - 0.02), -coreHeight / 2, Math.sin(angle) * (coreRadius - 0.02));
      leg.rotation.y = -angle;
      legGroup.add(leg);
    }
    rocketGroup.add(legGroup);

    // 7. Base Nozzles Cover / Engine Shield Plate
    const basePlate = new THREE.Mesh(new THREE.CylinderGeometry(coreRadius, coreRadius + 0.02, 0.2, 32), darkMat);
    basePlate.position.y = -coreHeight / 2 - 0.1;
    rocketGroup.add(basePlate);

    // 8. Octaweb Nozzles cluster (9 bell-shaped nozzles)
    const nozzleGeo = new THREE.CylinderGeometry(0.03, 0.07, 0.3, 16);
    const nozzleOffsets = [{ x: 0, z: 0 }]; // Center nozzle
    for (let i = 0; i < 8; i++) {
      const angle = (i * Math.PI) / 4;
      nozzleOffsets.push({
        x: Math.cos(angle) * 0.22,
        z: Math.sin(angle) * 0.22
      });
    }

    const nozzlesGroup = new THREE.Group();
    for (let i = 0; i < 9; i++) {
      const offset = nozzleOffsets[i];
      const bell = new THREE.Mesh(nozzleGeo, metalMat);
      bell.position.set(offset.x, -coreHeight / 2 - 0.25, offset.z);
      nozzlesGroup.add(bell);
    }
    rocketGroup.add(nozzlesGroup);

    // 9. 9 Column Engine Flames (3-layer concentric realistic plumes: white, yellow, orange)
    const flamesGroup = new THREE.Group();
    const flameTex = loader.load('assets/rocket/rocket-glow.png');
    
    const coreMat = new THREE.MeshBasicMaterial({
      map: flameTex,
      color: 0xffffff, // White core
      transparent: true,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
      opacity: 0,
      depthWrite: false
    });
    const midMat = new THREE.MeshBasicMaterial({
      map: flameTex,
      color: 0xffcc33, // Yellow midsection
      transparent: true,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
      opacity: 0,
      depthWrite: false
    });
    const outerMat = new THREE.MeshBasicMaterial({
      map: flameTex,
      color: 0xff3300, // Orange outer shell
      transparent: true,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
      opacity: 0,
      depthWrite: false
    });

    const flameHeight = 3.8;
    const coreGeo = new THREE.CylinderGeometry(0.04, 0.015, flameHeight, 16, 1, true);
    const midGeo = new THREE.CylinderGeometry(0.08, 0.03, flameHeight, 16, 1, true);
    const outerGeo = new THREE.CylinderGeometry(0.14, 0.05, flameHeight * 1.15, 16, 1, true);

    for (let i = 0; i < 9; i++) {
      const offset = nozzleOffsets[i];
      
      const corePlume = new THREE.Mesh(coreGeo, coreMat);
      corePlume.position.set(offset.x, -coreHeight / 2 - 0.35 - flameHeight / 2, offset.z);
      flamesGroup.add(corePlume);

      const midPlume = new THREE.Mesh(midGeo, midMat);
      midPlume.position.set(offset.x, -coreHeight / 2 - 0.35 - flameHeight / 2, offset.z);
      flamesGroup.add(midPlume);

      const outerPlume = new THREE.Mesh(outerGeo, outerMat);
      outerPlume.position.set(offset.x, -coreHeight / 2 - 0.35 - (flameHeight * 1.15) / 2, offset.z);
      flamesGroup.add(outerPlume);
    }
    rocketGroup.add(flamesGroup);

    // 10. Re-entry Plasma Glow Shield
    const plasmaGeo = new THREE.ConeGeometry(0.82, 7.8, 16, 1, true);
    const plasmaMat = new THREE.MeshBasicMaterial({
      color: 0xff4400,
      transparent: true,
      blending: THREE.AdditiveBlending,
      opacity: 0,
      side: THREE.DoubleSide,
      depthWrite: false
    });
    const plasmaShield = new THREE.Mesh(plasmaGeo, plasmaMat);
    plasmaShield.rotation.x = Math.PI;
    plasmaShield.position.y = 0.8;
    rocketGroup.add(plasmaShield);

    // 11. Point light at nozzles
    const plumeLight = new THREE.PointLight(0xff7700, 0, 18);
    plumeLight.position.y = -coreHeight / 2 - 0.4;
    rocketGroup.add(plumeLight);

    // 12. Heat Distortion Cone
    const distortionGeo = new THREE.CylinderGeometry(0.35, 1.2, 5.0, 16, 1, true);
    const distortionMat = new THREE.ShaderMaterial({
      uniforms: {
        time: { value: 0 },
        opacity: { value: 0 }
      },
      vertexShader: `
        uniform float time;
        varying vec2 vUv;
        void main() {
          vUv = uv;
          vec3 pos = position;
          if (pos.y < 0.0) {
            pos.x += sin(time * 50.0 + pos.y * 3.0) * 0.15;
            pos.z += cos(time * 45.0 + pos.y * 3.0) * 0.15;
          }
          gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
        }
      `,
      fragmentShader: `
        uniform float opacity;
        varying vec2 vUv;
        void main() {
          float shimmer = 0.5 + 0.5 * sin(vUv.y * 20.0 - vUv.x * 10.0);
          float alpha = (1.0 - vUv.y) * opacity * (0.35 + 0.15 * shimmer);
          gl_FragColor = vec4(1.0, 1.0, 1.0, 1.0) * alpha * 0.18;
        }
      `,
      transparent: true,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
      depthWrite: false
    });
    const heatDistortion = new THREE.Mesh(distortionGeo, distortionMat);
    heatDistortion.position.y = -coreHeight / 2 - 0.4 - 2.5;
    rocketGroup.add(heatDistortion);

    // 13. Atmospheric Glow Sprite/Sphere
    const atmGlowMat = new THREE.MeshBasicMaterial({
      color: 0x3b82f6,
      transparent: true,
      opacity: 0,
      blending: THREE.AdditiveBlending,
      side: THREE.BackSide,
      depthWrite: false
    });
    const atmGlow = new THREE.Mesh(new THREE.SphereGeometry(2.2, 16, 16), atmGlowMat);
    atmGlow.position.y = 0;
    rocketGroup.add(atmGlow);

    // Expose references
    rocketGroup.userData = {
      flameMat: [coreMat, midMat, outerMat],
      flameMesh: flamesGroup,
      plumeLight: plumeLight,
      plasmaShield: plasmaShield,
      rocketMats: [bodyMat, darkMat, metalMat, glowMat],
      distortionMat: distortionMat,
      atmGlowMat: atmGlowMat
    };

    return rocketGroup;
  }
};
