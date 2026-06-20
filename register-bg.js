(function(){
  // 3D space background for Register page
  // Re-creates the user's reference image in an interactive 3D scene
  
  if(typeof THREE === 'undefined') return console.warn('Three.js not loaded');

  const container = document.getElementById('galaxy-container');
  if(!container) return;

  const width = window.innerWidth;
  const height = window.innerHeight;

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(40, width / height, 0.1, 1000);
  camera.position.set(0, 0, 50);

  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setSize(width, height);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.domElement.style.position = 'fixed';
  renderer.domElement.style.inset = '0';
  renderer.domElement.style.zIndex = '0';
  renderer.domElement.style.pointerEvents = 'none';
  container.appendChild(renderer.domElement);

  // Deep space fog
  scene.fog = new THREE.FogExp2(0x020306, 0.0008);

  // ================================================================
  // LIGHTING (Matches the upper-left sun source from the image)
  // ================================================================
  const sunDirection = new THREE.Vector3(-45, 30, 40).normalize();
  
  // Bright main sunlight from top-left
  const sunLight = new THREE.DirectionalLight(0xffeedd, 3.8);
  sunLight.position.copy(sunDirection).multiplyScalar(150);
  scene.add(sunLight);

  // Ambient space light
  const ambientLight = new THREE.AmbientLight(0x081026, 1.2);
  scene.add(ambientLight);

  const textureLoader = new THREE.TextureLoader();
  textureLoader.crossOrigin = '';
  const MOON_TEX = 'https://raw.githubusercontent.com/mrdoob/three.js/master/examples/textures/planets/moon_1024.jpg';

  // ================================================================
  // BACKGROUND NEBULA (Vibrant blue, purple/violet, and teal)
  // ================================================================
  const nebulaShaderMat = new THREE.ShaderMaterial({
    uniforms: {
      time: { value: 0 }
    },
    vertexShader: `
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      uniform float time;
      varying vec2 vUv;
      
      float hash(vec2 p) {
        return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
      }
      
      float noise(vec2 p) {
        vec2 i = floor(p);
        vec2 f = fract(p);
        f = f * f * (3.0 - 2.0 * f);
        float a = hash(i);
        float b = hash(i + vec2(1.0, 0.0));
        float c = hash(i + vec2(0.0, 1.0));
        float d = hash(i + vec2(1.0, 1.0));
        return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
      }
      
      float fbm(vec2 p) {
        float v = 0.0;
        float a = 0.5;
        for (int i = 0; i < 4; i++) {
          v += a * noise(p);
          p = p * 2.2 + vec2(50.0);
          a *= 0.5;
        }
        return v;
      }
      
      void main() {
        vec2 uv = vUv - vec2(0.5);
        float dist = length(uv);
        
        vec2 p = vUv * 2.6;
        p.x += time * 0.005;
        p.y += sin(time * 0.003) * 0.03;
        
        float f = fbm(p + fbm(p + time * 0.002));
        
        // Deep space palette matching reference image (original softer colors)
        vec3 colorBlue = vec3(0.01, 0.025, 0.12);
        vec3 colorTeal = vec3(0.0, 0.16, 0.22);
        vec3 colorPurple = vec3(0.18, 0.025, 0.24); // Centered purple flaring
        
        vec3 finalColor = mix(colorBlue, colorPurple, f) + colorTeal * smoothstep(0.32, 0.72, f);
        finalColor *= smoothstep(0.9, 0.22, dist);
        
        gl_FragColor = vec4(finalColor, 1.0);
      }
    `,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending
  });

  const nebulaPlane = new THREE.Mesh(new THREE.PlaneGeometry(800, 500), nebulaShaderMat);
  nebulaPlane.position.set(0, 0, -280);
  scene.add(nebulaPlane);

  // ================================================================
  // GPU TWINKLING STARFIELD
  // ================================================================
  const starGeo = new THREE.BufferGeometry();
  const starCount = 2800;
  const starPos = new Float32Array(starCount * 3);
  const randomOffsets = new Float32Array(starCount);

  for (let i = 0; i < starCount; i++) {
    starPos[i * 3] = (Math.random() - 0.5) * 600;
    starPos[i * 3 + 1] = (Math.random() - 0.5) * 400;
    starPos[i * 3 + 2] = -60 - Math.random() * 220;
    randomOffsets[i] = Math.random() * 120.0;
  }

  starGeo.setAttribute('position', new THREE.BufferAttribute(starPos, 3));
  starGeo.setAttribute('randomOffset', new THREE.BufferAttribute(randomOffsets, 1));

  const starShaderMat = new THREE.ShaderMaterial({
    uniforms: {
      time: { value: 0 },
      size: { value: 1.35 }
    },
    vertexShader: `
      uniform float time;
      uniform float size;
      attribute float randomOffset;
      varying float vTwinkle;
      void main() {
        vTwinkle = sin(time * 2.2 + randomOffset) * 0.45 + 0.55;
        vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
        gl_PointSize = size * vTwinkle * (300.0 / -mvPosition.z);
        gl_Position = projectionMatrix * mvPosition;
      }
    `,
    fragmentShader: `
      varying float vTwinkle;
      void main() {
        vec2 uv = gl_PointCoord - vec2(0.5);
        if (length(uv) > 0.5) discard;
        // Introduce blue/white star variation
        vec3 color = mix(vec3(1.0, 1.0, 1.0), vec3(0.35, 0.8, 1.0), step(0.75, fract(vTwinkle * 17.0)));
        gl_FragColor = vec4(color, vTwinkle * 0.85);
      }
    `,
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false
  });

  const starfield = new THREE.Points(starGeo, starShaderMat);
  scene.add(starfield);

  // ================================================================
  // BRIGHT STAR FLARES (Replicates flares from the reference image)
  // ================================================================
  function createStarFlareTexture() {
    const canvas = document.createElement('canvas');
    canvas.width = 64; canvas.height = 64;
    const ctx = canvas.getContext('2d');
    
    // Draw star core glow
    const grad = ctx.createRadialGradient(32, 32, 0, 32, 32, 28);
    grad.addColorStop(0, 'rgba(255, 255, 255, 1)');
    grad.addColorStop(0.18, 'rgba(120, 220, 255, 0.8)');
    grad.addColorStop(0.45, 'rgba(0, 110, 255, 0.25)');
    grad.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(32, 32, 28, 0, Math.PI * 2);
    ctx.fill();
    
    // Flare cross lines
    ctx.fillStyle = 'rgba(255, 255, 255, 0.95)';
    ctx.fillRect(2, 31, 60, 2); // Horizontal flare line
    ctx.fillRect(31, 2, 2, 60); // Vertical flare line

    return new THREE.CanvasTexture(canvas);
  }

  const flareTex = createStarFlareTexture();
  const flareMat = new THREE.SpriteMaterial({
    map: flareTex,
    color: 0xffffff,
    transparent: true,
    blending: THREE.AdditiveBlending
  });

  // Helper to place flares
  function addStarFlare(x, y, z, size) {
    const sprite = new THREE.Sprite(flareMat);
    sprite.position.set(x, y, z);
    sprite.scale.set(size, size, 1);
    scene.add(sprite);
    return sprite;
  }

  // Position specific background bright stars
  const flare2 = addStarFlare(6.0, 8.0, -32, 2.2);   // Nebula flare upper middle
  const flare3 = addStarFlare(15.0, -2.0, -30, 2.6);  // Right side teal nebula flare
  const flare4 = addStarFlare(9.5, 9.0, -31, 1.8);   // Near medium moon

  // ================================================================
  // MATERIALS & TEXTURE LOADERS
  // ================================================================
  const planetMat = new THREE.MeshStandardMaterial({
    color: 0x8ab0f0, // Soft blue-gray tint matching first design
    roughness: 0.82,
    metalness: 0.08,
    bumpScale: 0.22  // Active bump depth for ultra-realistic shading
  });

  const moon2Mat = new THREE.MeshStandardMaterial({
    color: 0xa8adb8, // Upper-right moon
    roughness: 0.85,
    metalness: 0.08,
    bumpScale: 0.15
  });

  const moon3Mat = new THREE.MeshStandardMaterial({
    color: 0x828790, // Small right moon
    roughness: 0.85,
    metalness: 0.08,
    bumpScale: 0.1
  });

  // High-fidelity fallback procedural canvas texture generator (Detailed craters, grain, atmospheric bands)
  function createProceduralTexture() {
    const canvas = document.createElement('canvas');
    canvas.width = 512; canvas.height = 512;
    const ctx = canvas.getContext('2d');
    
    // Base grey-blue rocky planet color
    ctx.fillStyle = '#627a93'; 
    ctx.fillRect(0, 0, 512, 512);
    
    // Grain/noise
    for (let i = 0; i < 6000; i++) {
      const x = Math.random() * 512;
      const y = Math.random() * 512;
      const size = Math.random() * 1.5;
      const val = Math.floor(Math.random() * 26) - 13;
      ctx.fillStyle = `rgba(${120+val}, ${135+val}, ${150+val}, 0.18)`;
      ctx.fillRect(x, y, size, size);
    }

    // Detail Craters with shadows/highlights
    for(let i=0; i<45; i++){
      const x = Math.random() * 512;
      const y = Math.random() * 512;
      const r = 8 + Math.random() * 24;
      
      const grad = ctx.createRadialGradient(x - r*0.2, y - r*0.2, 0, x, y, r);
      grad.addColorStop(0, 'rgba(40, 55, 70, 0.9)');
      grad.addColorStop(0.7, 'rgba(75, 95, 115, 0.45)');
      grad.addColorStop(0.9, 'rgba(165, 190, 215, 0.65)');
      grad.addColorStop(1, 'rgba(0,0,0,0)');
      
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(x,y,r,0,Math.PI*2);
      ctx.fill();
    }

    // Planetary rings shadow/light bands on surface
    for (let i = 0; i < 8; i++) {
      const y = Math.random() * 512;
      const h = 20 + Math.random() * 40;
      const grad = ctx.createLinearGradient(0, y, 0, y + h);
      grad.addColorStop(0, 'rgba(40, 50, 65, 0.0)');
      grad.addColorStop(0.5, 'rgba(40, 50, 65, 0.2)');
      grad.addColorStop(1, 'rgba(40, 50, 65, 0.0)');
      ctx.fillStyle = grad;
      ctx.fillRect(0, y, 512, h);
    }

    return new THREE.CanvasTexture(canvas);
  }

  textureLoader.load(
    MOON_TEX,
    (tex) => {
      planetMat.map = tex; planetMat.bumpMap = tex; planetMat.needsUpdate = true;
      moon2Mat.map = tex; moon2Mat.bumpMap = tex; moon2Mat.needsUpdate = true;
      moon3Mat.map = tex; moon3Mat.bumpMap = tex; moon3Mat.needsUpdate = true;
    },
    undefined,
    () => {
      const tex = createProceduralTexture();
      planetMat.map = tex; planetMat.bumpMap = tex; planetMat.needsUpdate = true;
      moon2Mat.map = tex; moon2Mat.bumpMap = tex; moon2Mat.needsUpdate = true;
      moon3Mat.map = tex; moon3Mat.bumpMap = tex; moon3Mat.needsUpdate = true;
    }
  );

  // ================================================================
  // 3D PLANETS ASSEMBLY
  // ================================================================
  
  // 1. Large Ringed Planet Group
  const planetGroup = new THREE.Group();
  scene.add(planetGroup);

  const planetRadius = 5.6;
  const planetMesh = new THREE.Mesh(new THREE.SphereGeometry(planetRadius, 48, 48), planetMat);
  planetGroup.add(planetMesh);

  // Concentric Planetary Rings (Vibrant purple/indigo gradient matching reference)
  const ringInner = 5.8;
  const ringOuter = 17.5;
  const ringGeo = new THREE.RingGeometry(ringInner, ringOuter, 64);
  const ringMat = new THREE.ShaderMaterial({
    vertexShader: `
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      varying vec2 vUv;
      float hash(float n) { return fract(sin(n) * 43758.5453123); }
      void main() {
        vec2 centerUV = vUv - vec2(0.5);
        float dist = length(centerUV) * 2.0;
        
        if (dist > 1.0 || dist < 0.33) discard;
        
        float radial = (dist - 0.33) / (1.0 - 0.33);
        float lines = sin(radial * 130.0) * 0.45 + 0.55;
        float gap = step(0.18, hash(floor(radial * 60.0)));
        float alpha = lines * gap * smoothstep(0.0, 0.12, radial) * smoothstep(1.0, 0.88, radial) * 0.72;
        vec3 ringColor = mix(vec3(0.5, 0.7, 1.0), vec3(0.7, 0.45, 0.9), radial);
        
        gl_FragColor = vec4(ringColor * 1.6, alpha);
      }
    `,
    transparent: true,
    side: THREE.DoubleSide,
    depthWrite: false
  });
  const ringMesh = new THREE.Mesh(ringGeo, ringMat);
  ringMesh.rotation.set(1.2, 0.2, -0.48);
  planetGroup.add(ringMesh);

  // Atmospheric Scattering Glow Halo (Ultra-realistic blue envelope wrapping the sphere)
  const glowMat = new THREE.ShaderMaterial({
    vertexShader: `
      varying vec3 vNormal;
      varying vec3 vViewPosition;
      void main() {
        vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
        vNormal = normalize(normalMatrix * normal);
        vViewPosition = -mvPosition.xyz;
        gl_Position = projectionMatrix * mvPosition;
      }
    `,
    fragmentShader: `
      varying vec3 vNormal;
      varying vec3 vViewPosition;
      void main() {
        vec3 normal = normalize(vNormal);
        vec3 viewDir = normalize(vViewPosition);
        // Fresnel glow factor (softer and dimmer)
        float fresnel = pow(1.0 - max(dot(normal, viewDir), 0.0), 3.5);
        vec3 glowColor = vec3(0.08, 0.35, 0.65);
        gl_FragColor = vec4(glowColor, fresnel * 0.38);
      }
    `,
    transparent: true,
    blending: THREE.AdditiveBlending,
    side: THREE.BackSide,
    depthWrite: false
  });
  const glowMesh = new THREE.Mesh(new THREE.SphereGeometry(planetRadius * 1.035, 32, 32), glowMat);
  planetGroup.add(glowMesh);

  // Small Satellite (Matches small moon at bottom-left of main planet)
  const satGroup = new THREE.Group();
  planetGroup.add(satGroup);
  const satMesh = new THREE.Mesh(new THREE.SphereGeometry(0.52, 16, 16), moon3Mat);
  satMesh.position.set(-4.5, -2.5, 2.5);
  satGroup.add(satMesh);

  // Add the planet-linked bright flare (Moves with the planet)
  const flare1 = new THREE.Sprite(flareMat);
  flare1.position.set(-3.0, 8.0, -1.0); // Offset next to planet center
  flare1.scale.set(3.2, 3.2, 1.0);
  planetGroup.add(flare1);

  // 2. Medium Moon (Upper Right)
  const moon2Mesh = new THREE.Mesh(new THREE.SphereGeometry(2.2, 32, 32), moon2Mat);
  moon2Mesh.position.set(12.0, 7.5, -30);
  scene.add(moon2Mesh);

  // 3. Small Moon (Far Right)
  const moon3Mesh = new THREE.Mesh(new THREE.SphereGeometry(0.48, 16, 16), moon3Mat);
  moon3Mesh.position.set(16.5, 3.5, -32);
  scene.add(moon3Mesh);

  // ================================================================
  // RESPONSIVE LAYOUT ENGINE (Ensures planet remains visible)
  // ================================================================
  let basePlanetX = -9.0;
  let basePlanetY = -3.0;
  let basePlanetZ = -28;

  function updateLayout() {
    const w = window.innerWidth;
    if (w < 768) {
      // Mobile: Centered behind the glassmorphic card for visual impact
      basePlanetX = 0;
      basePlanetY = 0;
      basePlanetZ = -28;
      planetGroup.scale.set(0.68, 0.68, 0.68);
      
      // Move other elements to fit the viewport better
      moon2Mesh.position.set(7.0, -12.0, -32);
      moon3Mesh.position.set(11.0, -14.0, -34);
    } else if (w < 1024) {
      // Tablet: Mid-left position (slightly further left than login for Register card)
      basePlanetX = -6.5;
      basePlanetY = -2.0;
      basePlanetZ = -28;
      planetGroup.scale.set(0.85, 0.85, 0.85);
      
      moon2Mesh.position.set(9.0, 8.0, -30);
      moon3Mesh.position.set(13.0, 4.0, -32);
    } else {
      // Desktop: Standard position (left side, full scale, offset to -9.0 for Register card width)
      basePlanetX = -9.0;
      basePlanetY = -3.0;
      basePlanetZ = -28;
      planetGroup.scale.set(1.0, 1.0, 1.0);
      
      moon2Mesh.position.set(12.0, 7.5, -30);
      moon3Mesh.position.set(16.5, 3.5, -32);
    }
    
    planetGroup.position.set(basePlanetX, basePlanetY, basePlanetZ);
    camera.aspect = w / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(w, window.innerHeight);
  }

  // Initial call
  updateLayout();

  // ================================================================
  // VOLUMETRIC DUST
  // ================================================================
  const dustGeo = new THREE.BufferGeometry();
  const dustCount = 100;
  const dustPos = new Float32Array(dustCount * 3);
  const dustSpeeds = [];

  for (let i = 0; i < dustCount; i++) {
    dustPos[i * 3] = (Math.random() - 0.5) * 80;
    dustPos[i * 3 + 1] = (Math.random() - 0.5) * 50;
    dustPos[i * 3 + 2] = -10 - Math.random() * 80;
    dustSpeeds.push({
      x: (Math.random() - 0.5) * 0.01,
      y: (Math.random() - 0.5) * 0.01 + 0.005,
      z: (Math.random() - 0.5) * 0.01
    });
  }

  dustGeo.setAttribute('position', new THREE.BufferAttribute(dustPos, 3));
  const dustMat = new THREE.PointsMaterial({
    color: 0x4ca6ff,
    size: 0.35,
    transparent: true,
    opacity: 0.32,
    blending: THREE.AdditiveBlending,
    depthWrite: false
  });
  const dustfield = new THREE.Points(dustGeo, dustMat);
  scene.add(dustfield);

  // ================================================================
  // ANIMATION LOOP
  // ================================================================
  let mouseX = 0, mouseY = 0;
  const halfW = window.innerWidth / 2;
  const halfH = window.innerHeight / 2;

  document.addEventListener('mousemove', (e) => {
    mouseX = e.clientX - halfW;
    mouseY = e.clientY - halfH;
  });

  const clock = new THREE.Clock();

  function animate() {
    requestAnimationFrame(animate);
    const t = clock.getElapsedTime();

    starShaderMat.uniforms.time.value = t;
    nebulaShaderMat.uniforms.time.value = t;

    planetMesh.rotation.y = t * 0.005;
    moon2Mesh.rotation.y = t * 0.003;
    moon3Mesh.rotation.y = t * 0.002;
    satGroup.rotation.y = t * 0.02;

    const positions = dustfield.geometry.attributes.position.array;
    for (let i = 0; i < dustCount; i++) {
      positions[i * 3] += dustSpeeds[i].x;
      positions[i * 3 + 1] += dustSpeeds[i].y;
      positions[i * 3 + 2] += dustSpeeds[i].z;
      
      if (positions[i * 3 + 1] > 25) positions[i * 3 + 1] = -25;
      if (positions[i * 3] > 40) positions[i * 3] = -40;
      if (positions[i * 3] < -40) positions[i * 3] = 40;
    }
    dustfield.geometry.attributes.position.needsUpdate = true;

    // Mouse Parallax
    const targetCamX = (mouseX / halfW) * 2.5;
    const targetCamY = -(mouseY / halfH) * 1.5;

    camera.position.x += (targetCamX - camera.position.x) * 0.035;
    camera.position.y += (targetCamY - camera.position.y) * 0.035;
    camera.lookAt(0, 0, 0);

    // Shifts
    nebulaPlane.position.x = camera.position.x * 0.85;
    nebulaPlane.position.y = camera.position.y * 0.85;

    starfield.position.x = camera.position.x * 0.7;
    starfield.position.y = camera.position.y * 0.7;

    // Dynamic Parallax Shifts
    planetGroup.position.x = basePlanetX + camera.position.x * 0.35;
    planetGroup.position.y = basePlanetY + camera.position.y * 0.35;

    // Moon updates
    if (window.innerWidth < 768) {
      moon2Mesh.position.x = 6.0 + camera.position.x * 0.25;
      moon2Mesh.position.y = -12.0 + camera.position.y * 0.25;
    } else if (window.innerWidth < 1024) {
      moon2Mesh.position.x = 9.0 + camera.position.x * 0.25;
      moon2Mesh.position.y = 8.0 + camera.position.y * 0.25;
    } else {
      moon2Mesh.position.x = 12.0 + camera.position.x * 0.25;
      moon2Mesh.position.y = 7.5 + camera.position.y * 0.25;
    }

    // Sync flares slightly with camera parallax
    flare2.position.x = 6.0 + camera.position.x * 0.3;
    flare2.position.y = 8.0 + camera.position.y * 0.3;
    flare3.position.x = 15.0 + camera.position.x * 0.2;
    flare3.position.y = -2.0 + camera.position.y * 0.2;
    flare4.position.x = 9.5 + camera.position.x * 0.25;
    flare4.position.y = 9.0 + camera.position.y * 0.25;

    renderer.render(scene, camera);
  }

  animate();

  window.addEventListener('resize', updateLayout);

})();
