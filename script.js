// ================================================================
// COSMOBOT — PERFECT SOLAR SYSTEM (Three.js r128)
// All 8 planets orbit the Sun in correct order with
// proportional sizes, orbital rings, axial tilts, and Saturn rings.
// ================================================================

const canvas = document.getElementById('space-canvas');
const scene = new THREE.Scene();

// Camera: pulled back and elevated to see the full solar system
const camera = new THREE.PerspectiveCamera(
  50,
  window.innerWidth / window.innerHeight,
  0.1,
  2000
);
camera.position.set(0, 25, 55);
camera.lookAt(0, 0, 0);

// Renderer
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

// Texture loader
const textureLoader = new THREE.TextureLoader();
textureLoader.crossOrigin = '';

// Texture URLs
const TEX = {
  earth:      'https://raw.githubusercontent.com/mrdoob/three.js/master/examples/textures/planets/earth_atmos_2048.jpg',
  earthNorm:  'https://raw.githubusercontent.com/mrdoob/three.js/master/examples/textures/planets/earth_normal_2048.jpg',
  earthSpec:  'https://raw.githubusercontent.com/mrdoob/three.js/master/examples/textures/planets/earth_specular_2048.jpg',
  clouds:     'https://raw.githubusercontent.com/mrdoob/three.js/master/examples/textures/planets/earth_clouds_1024.png',
  moon:       'https://raw.githubusercontent.com/mrdoob/three.js/master/examples/textures/planets/moon_1024.jpg',
  sunPlasma:  'sun_plasma.png',
  sunRays:    'sun_rays.png'
};

// ================================================================
// HELPER: Procedural planet texture
// ================================================================
function createPlanetTexture(baseColor, bands, w, h) {
  const c = document.createElement('canvas');
  c.width = w || 512; c.height = h || 256;
  const ctx = c.getContext('2d');

  // Base
  ctx.fillStyle = baseColor;
  ctx.fillRect(0, 0, c.width, c.height);

  // Bands
  if (bands) {
    bands.forEach(b => {
      ctx.globalAlpha = b.a || 0.3;
      ctx.fillStyle = b.c;
      ctx.fillRect(0, b.y * (c.height / 128), c.width, b.h * (c.height / 128));
    });
  }
  ctx.globalAlpha = 1;

  // Surface noise
  for (let i = 0; i < 1200; i++) {
    ctx.fillStyle = `rgba(255,255,255,${Math.random() * 0.05})`;
    ctx.fillRect(Math.random() * c.width, Math.random() * c.height, 2, 1);
  }
  for (let i = 0; i < 800; i++) {
    ctx.fillStyle = `rgba(0,0,0,${Math.random() * 0.06})`;
    ctx.fillRect(Math.random() * c.width, Math.random() * c.height, 3, 1);
  }
  return new THREE.CanvasTexture(c);
}

// Soft radial glow for the Sun
function createGlowTexture() {
  const c = document.createElement('canvas');
  c.width = 256; c.height = 256;
  const ctx = c.getContext('2d');
  const g = ctx.createRadialGradient(128, 128, 0, 128, 128, 128);
  g.addColorStop(0,    'rgba(255,255,230,1.0)');
  g.addColorStop(0.12, 'rgba(255,200,50,0.85)');
  g.addColorStop(0.35, 'rgba(255,100,0,0.3)');
  g.addColorStop(0.65, 'rgba(255,50,0,0.08)');
  g.addColorStop(1,    'rgba(0,0,0,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 256, 256);
  return new THREE.CanvasTexture(c);
}

// ================================================================
// 1. LIGHTING
// ================================================================
scene.add(new THREE.AmbientLight(0x222233, 0.5));

// ================================================================
// 2. THE SUN (at the center of the solar system)
// ================================================================
const sunGroup = new THREE.Group();
sunGroup.position.set(0, 0, 0);
scene.add(sunGroup);

// Sun sphere
const sunGeo = new THREE.SphereGeometry(5, 64, 64);
const sunMat = new THREE.MeshStandardMaterial({
  map: textureLoader.load(TEX.sunPlasma),
  emissiveMap: textureLoader.load(TEX.sunPlasma),
  emissive: new THREE.Color(0xffddaa),
  emissiveIntensity: 1.3
});
const sunMesh = new THREE.Mesh(sunGeo, sunMat);
sunGroup.add(sunMesh);

// Glow sprite
const glowSprite = new THREE.Sprite(new THREE.SpriteMaterial({
  map: createGlowTexture(),
  transparent: true,
  blending: THREE.AdditiveBlending,
  opacity: 0.9
}));
glowSprite.scale.set(18, 18, 1);
sunGroup.add(glowSprite);

// Rays sprite
const raysSprite = new THREE.Sprite(new THREE.SpriteMaterial({
  map: textureLoader.load(TEX.sunRays),
  transparent: true,
  blending: THREE.AdditiveBlending,
  opacity: 0.15
}));
raysSprite.scale.set(22, 22, 1);
sunGroup.add(raysSprite);

// Point light from the Sun
const sunLight = new THREE.PointLight(0xffeedd, 2.5, 800);
sunGroup.add(sunLight);

// ================================================================
// 3. PLANET DEFINITIONS (correct order from Sun)
// ================================================================
// Sizes are scaled for visual appeal (not to real scale, which would
// make Mercury invisible). Orbit radii are spaced to look good.
// Orbital speeds are inversely proportional to distance (faster = closer).

const PLANET_DATA = [
  {
    name: 'Mercury',
    radius: 0.8,
    orbitRadius: 18,
    orbitSpeed: 0.012,
    rotSpeed: 0.003,
    tilt: 0.03,
    base: '#9e9e9e',
    bands: [
      { y: 15, h: 20, c: '#7a7a7a', a: 0.4 },
      { y: 50, h: 15, c: '#b0b0b0', a: 0.3 },
      { y: 85, h: 18, c: '#6e6e6e', a: 0.35 }
    ]
  },
  {
    name: 'Venus',
    radius: 1.5,
    orbitRadius: 28,
    orbitSpeed: 0.008,
    rotSpeed: 0.001,
    tilt: 177.4, // Venus rotates backwards
    base: '#e8c373',
    bands: [
      { y: 10, h: 25, c: '#d4a84a', a: 0.4 },
      { y: 45, h: 18, c: '#f0d899', a: 0.3 },
      { y: 75, h: 20, c: '#c99530', a: 0.35 },
      { y: 105, h: 12, c: '#dbb860', a: 0.25 }
    ]
  },
  {
    name: 'Earth',
    radius: 1.6,
    orbitRadius: 40,
    orbitSpeed: 0.006,
    rotSpeed: 0.004,
    tilt: 23.5,
    isEarth: true // Special handling: real texture + clouds + moon
  },
  {
    name: 'Mars',
    radius: 1.1,
    orbitRadius: 52,
    orbitSpeed: 0.0045,
    rotSpeed: 0.004,
    tilt: 25.2,
    base: '#c1440e',
    bands: [
      { y: 8, h: 22, c: '#8b3a0f', a: 0.45 },
      { y: 35, h: 12, c: '#e8713a', a: 0.3 },
      { y: 60, h: 25, c: '#a0410a', a: 0.4 },
      { y: 95, h: 15, c: '#d4683c', a: 0.25 },
      { y: 115, h: 8, c: '#8b3a0f', a: 0.3 }
    ]
  },
  {
    name: 'Jupiter',
    radius: 4.0,
    orbitRadius: 72,
    orbitSpeed: 0.002,
    rotSpeed: 0.008,
    tilt: 3.1,
    base: '#c8a76c',
    bands: [
      { y: 4, h: 8, c: '#a07040', a: 0.55 },
      { y: 15, h: 10, c: '#e8d0a0', a: 0.4 },
      { y: 28, h: 6, c: '#6b4226', a: 0.55 },
      { y: 38, h: 12, c: '#d4b87a', a: 0.35 },
      { y: 54, h: 5, c: '#8b5e3c', a: 0.5 },
      { y: 63, h: 10, c: '#f0dca0', a: 0.3 },
      { y: 78, h: 7, c: '#a07040', a: 0.45 },
      { y: 88, h: 12, c: '#c49060', a: 0.35 },
      { y: 104, h: 6, c: '#6b4226', a: 0.4 },
      { y: 115, h: 10, c: '#e8d0a0', a: 0.3 }
    ],
    // Jupiter's Great Red Spot (drawn as a special feature)
    hasGRS: true
  },
  {
    name: 'Saturn',
    radius: 3.5,
    orbitRadius: 100,
    orbitSpeed: 0.0012,
    rotSpeed: 0.007,
    tilt: 26.7,
    hasRings: true,
    base: '#e8d5a3',
    bands: [
      { y: 8, h: 14, c: '#c4a862', a: 0.35 },
      { y: 28, h: 8, c: '#b08c45', a: 0.4 },
      { y: 42, h: 15, c: '#f0e0b0', a: 0.25 },
      { y: 65, h: 10, c: '#a08040', a: 0.4 },
      { y: 82, h: 12, c: '#d4bc7a', a: 0.3 },
      { y: 100, h: 8, c: '#b09050', a: 0.35 },
      { y: 115, h: 10, c: '#e0cc90', a: 0.25 }
    ]
  },
  {
    name: 'Uranus',
    radius: 2.2,
    orbitRadius: 130,
    orbitSpeed: 0.0007,
    rotSpeed: 0.005,
    tilt: 97.8, // Uranus rolls on its side!
    base: '#7ec8d8',
    bands: [
      { y: 20, h: 25, c: '#5aa8b8', a: 0.3 },
      { y: 55, h: 15, c: '#a0e0f0', a: 0.2 },
      { y: 80, h: 20, c: '#4a98a8', a: 0.35 },
      { y: 110, h: 12, c: '#8cd0e0', a: 0.25 }
    ]
  },
  {
    name: 'Neptune',
    radius: 2.1,
    orbitRadius: 160,
    orbitSpeed: 0.0004,
    rotSpeed: 0.005,
    tilt: 28.3,
    base: '#2a4fc8',
    bands: [
      { y: 12, h: 15, c: '#1a3098', a: 0.45 },
      { y: 35, h: 20, c: '#4070e0', a: 0.3 },
      { y: 65, h: 10, c: '#0a2080', a: 0.5 },
      { y: 85, h: 18, c: '#3060d0', a: 0.3 },
      { y: 110, h: 10, c: '#1a40a0', a: 0.4 }
    ]
  }
];

// ================================================================
// 4. BUILD THE SOLAR SYSTEM
// ================================================================
const planets = [];

PLANET_DATA.forEach((data, index) => {

  // --- Orbit ring (thin torus or line) ---
  const orbitRingGeo = new THREE.RingGeometry(
    data.orbitRadius - 0.08,
    data.orbitRadius + 0.08,
    128
  );
  const orbitRingMat = new THREE.MeshBasicMaterial({
    color: 0x4466aa,
    side: THREE.DoubleSide,
    transparent: true,
    opacity: 0.12
  });
  const orbitRing = new THREE.Mesh(orbitRingGeo, orbitRingMat);
  orbitRing.rotation.x = -Math.PI / 2; // Flat on the XZ plane
  scene.add(orbitRing);

  // --- Planet group (holds planet mesh + optional extras) ---
  const planetGroup = new THREE.Group();
  let mesh;

  if (data.isEarth) {
    // EARTH: Use real textures
    const earthGeo = new THREE.SphereGeometry(data.radius, 64, 64);
    const earthMat = new THREE.MeshPhongMaterial({
      map: textureLoader.load(TEX.earth),
      normalMap: textureLoader.load(TEX.earthNorm),
      specularMap: textureLoader.load(TEX.earthSpec),
      specular: new THREE.Color(0x333333),
      shininess: 15
    });
    mesh = new THREE.Mesh(earthGeo, earthMat);
    mesh.rotation.z = data.tilt * Math.PI / 180;

    // Clouds
    const cloudGeo = new THREE.SphereGeometry(data.radius * 1.015, 64, 64);
    const cloudMat = new THREE.MeshPhongMaterial({
      map: textureLoader.load(TEX.clouds),
      transparent: true,
      opacity: 0.6,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
      depthWrite: false
    });
    const cloudMesh = new THREE.Mesh(cloudGeo, cloudMat);
    mesh.add(cloudMesh);
    mesh.userData.clouds = cloudMesh;

    // Moon
    const moonGeo = new THREE.SphereGeometry(data.radius * 0.27, 32, 32);
    const moonMat = new THREE.MeshPhongMaterial({
      map: textureLoader.load(TEX.moon),
      shininess: 5
    });
    const moonMesh = new THREE.Mesh(moonGeo, moonMat);
    planetGroup.add(moonMesh);
    planetGroup.userData.moon = moonMesh;
    planetGroup.userData.moonAngle = Math.random() * Math.PI * 2;

  } else {
    // Procedural planet
    const tex = createPlanetTexture(data.base, data.bands);
    const geo = new THREE.SphereGeometry(data.radius, 48, 48);

    // Jupiter Great Red Spot
    if (data.hasGRS) {
      const grsCanvas = document.createElement('canvas');
      grsCanvas.width = 512; grsCanvas.height = 256;
      const grsCtx = grsCanvas.getContext('2d');
      // Draw base texture first
      grsCtx.drawImage(tex.image, 0, 0, 512, 256);
      // Draw the spot
      grsCtx.globalAlpha = 0.6;
      grsCtx.fillStyle = '#cc6040';
      grsCtx.beginPath();
      grsCtx.ellipse(340, 140, 30, 18, 0, 0, Math.PI * 2);
      grsCtx.fill();
      grsCtx.globalAlpha = 0.4;
      grsCtx.fillStyle = '#a04020';
      grsCtx.beginPath();
      grsCtx.ellipse(340, 140, 20, 10, 0, 0, Math.PI * 2);
      grsCtx.fill();
      grsCtx.globalAlpha = 1;
      const grsTex = new THREE.CanvasTexture(grsCanvas);
      const mat = new THREE.MeshPhongMaterial({ map: grsTex, shininess: 8 });
      mesh = new THREE.Mesh(geo, mat);
    } else {
      const mat = new THREE.MeshPhongMaterial({ map: tex, shininess: 8 });
      mesh = new THREE.Mesh(geo, mat);
    }

    mesh.rotation.z = (data.tilt || 0) * Math.PI / 180;
  }

  planetGroup.add(mesh);

  // --- Saturn's rings ---
  if (data.hasRings) {
    const innerR = data.radius * 1.3;
    const outerR = data.radius * 2.4;
    const ringGeo = new THREE.RingGeometry(innerR, outerR, 128);

    // Procedural ring texture with gaps (Cassini division)
    const rc = document.createElement('canvas');
    rc.width = 512; rc.height = 64;
    const rctx = rc.getContext('2d');
    const rg = rctx.createLinearGradient(0, 0, 512, 0);
    rg.addColorStop(0,    'rgba(180,160,120,0.0)');
    rg.addColorStop(0.05, 'rgba(200,180,140,0.5)');
    rg.addColorStop(0.15, 'rgba(220,200,160,0.7)');
    rg.addColorStop(0.28, 'rgba(210,190,150,0.6)');
    rg.addColorStop(0.32, 'rgba(80,60,40,0.1)');   // Cassini division
    rg.addColorStop(0.36, 'rgba(80,60,40,0.1)');
    rg.addColorStop(0.40, 'rgba(200,180,140,0.55)');
    rg.addColorStop(0.55, 'rgba(220,200,160,0.65)');
    rg.addColorStop(0.70, 'rgba(190,170,130,0.5)');
    rg.addColorStop(0.85, 'rgba(170,150,110,0.3)');
    rg.addColorStop(1,    'rgba(160,140,100,0.0)');
    rctx.fillStyle = rg;
    rctx.fillRect(0, 0, 512, 64);

    const ringTex = new THREE.CanvasTexture(rc);
    const ringMat = new THREE.MeshBasicMaterial({
      map: ringTex,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.8,
      depthWrite: false
    });
    const ringMesh = new THREE.Mesh(ringGeo, ringMat);
    ringMesh.rotation.x = -Math.PI / 2 + (data.tilt * Math.PI / 180);
    planetGroup.add(ringMesh);
  }

  scene.add(planetGroup);

  // Stagger initial orbital position
  const startAngle = (index / PLANET_DATA.length) * Math.PI * 2 + Math.random() * 0.5;

  planets.push({
    group: planetGroup,
    mesh: mesh,
    data: data,
    angle: startAngle
  });
});

// ================================================================
// 5. STARFIELD
// ================================================================
const starsGeo = new THREE.BufferGeometry();
const STAR_COUNT = 8000;
const starPos = new Float32Array(STAR_COUNT * 3);
const starColors = new Float32Array(STAR_COUNT * 3);

for (let i = 0; i < STAR_COUNT; i++) {
  const i3 = i * 3;
  starPos[i3]     = (Math.random() - 0.5) * 800;
  starPos[i3 + 1] = (Math.random() - 0.5) * 800;
  starPos[i3 + 2] = (Math.random() - 0.5) * 800;

  // Slight color variation (warm/cool white)
  const warmth = 0.8 + Math.random() * 0.2;
  starColors[i3]     = warmth;
  starColors[i3 + 1] = warmth;
  starColors[i3 + 2] = 0.85 + Math.random() * 0.15;
}
starsGeo.setAttribute('position', new THREE.BufferAttribute(starPos, 3));
starsGeo.setAttribute('color', new THREE.BufferAttribute(starColors, 3));

const starMesh = new THREE.Points(starsGeo, new THREE.PointsMaterial({
  size: 0.4,
  vertexColors: true,
  transparent: true,
  opacity: 0.85
}));
scene.add(starMesh);

// ================================================================
// 6. ANIMATION
// ================================================================
window.addEventListener('resize', () => {
  renderer.setSize(window.innerWidth, window.innerHeight);
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
});

// Mouse parallax
let mouseX = 0, mouseY = 0;
const halfW = window.innerWidth / 2;
const halfH = window.innerHeight / 2;
document.addEventListener('mousemove', (e) => {
  mouseX = (e.clientX - halfW);
  mouseY = (e.clientY - halfH);
});

const clock = new THREE.Clock();

function animate() {
  requestAnimationFrame(animate);
  const t = clock.getElapsedTime();

  // Sun animation
  sunMesh.rotation.y += 0.0005;
  sunMesh.rotation.x += 0.0001;
  const sunPulse = 1 + Math.sin(t * 1.2) * 0.015;
  glowSprite.scale.set(18 * sunPulse, 18 * sunPulse, 1);
  raysSprite.scale.set(22 * sunPulse, 22 * sunPulse, 1);
  raysSprite.material.rotation += 0.00008;
  raysSprite.material.opacity = 0.12 + Math.sin(t * 1.2) * 0.03;

  // Planet orbits & rotation
  planets.forEach(p => {
    p.angle += p.data.orbitSpeed;
    const r = p.data.orbitRadius;

    // Orbit on the XZ plane (flat, like a real solar system)
    p.group.position.x = Math.cos(p.angle) * r;
    p.group.position.z = Math.sin(p.angle) * r;
    p.group.position.y = 0;

    // Self-rotation
    p.mesh.rotation.y += p.data.rotSpeed;

    // Earth's clouds rotate slightly faster
    if (p.data.isEarth && p.mesh.userData.clouds) {
      p.mesh.userData.clouds.rotation.y += 0.0006;
    }

    // Earth's moon
    if (p.group.userData.moon) {
      p.group.userData.moonAngle += 0.015;
      const moonR = p.data.radius * 3;
      const ma = p.group.userData.moonAngle;
      p.group.userData.moon.position.x = Math.cos(ma) * moonR;
      p.group.userData.moon.position.z = Math.sin(ma) * moonR;
      p.group.userData.moon.position.y = Math.sin(ma) * 0.5;
      p.group.userData.moon.rotation.y += 0.01;
    }
  });

  // Slowly rotate starfield
  starMesh.rotation.y -= 0.00015;

  // Camera parallax
  const targetX = (mouseX / halfW) * 4;
  const targetY = -(mouseY / halfH) * 3;
  camera.position.x += (targetX - camera.position.x) * 0.04;
  camera.position.y += ((25 + targetY) - camera.position.y) * 0.04;
  camera.lookAt(0, 0, 0);

  renderer.render(scene, camera);
}

animate();

// Button Interactivity for UI
document.querySelectorAll('.control-panel-btn').forEach(btn => {
  btn.addEventListener('click', (e) => {
    console.log(`Initialized: ${e.target.innerText}`);
  });
});
