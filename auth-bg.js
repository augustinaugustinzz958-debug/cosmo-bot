(function(){
  // Shared 3D Deep Space background for Login and Register pages
  // Re-creates the user's reference image in an interactive 3D scene:
  // 1. Vibrant violet, deep blue, and neon teal/cyan drifting nebula background.
  // 2. Large cratered planet in the lower left, tinted blue-teal, with rotating texture.
  // 3. Realistic detailed 3D ring system tilted from bottom-left to top-right with concentric gaps.
  // 4. Medium-sized cratered moon in the upper right background.
  // 5. Smaller moons floating in space (one near the planet, one to the far right).
  // 6. twinking GPU starfields and drifting cosmic dust.
  // 7. Interactive camera mouse parallax.

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
  
  const sunLight = new THREE.DirectionalLight(0xffeedd, 3.8);
  sunLight.position.copy(sunDirection).multiplyScalar(150);
  scene.add(sunLight);

  // Ambient fill to replicate the nebula blue glow
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
        
        // Deep space palette matching reference image
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
  const starCount = 3000;
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
        vec3 color = vec3(0.9, 0.95, 1.0);
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
  // MATERIALS & TEXTURE LOADERS
  // ================================================================
  const planetMat = new THREE.MeshStandardMaterial({
    color: 0x8ab0f0, // Blue-gray/teal tint matching the image planet
    roughness: 0.82,
    metalness: 0.08
  });

  const moon2Mat = new THREE.MeshStandardMaterial({
    color: 0x9095a0, // Upper-right moon
    roughness: 0.9,
    metalness: 0.05
  });

  const moon3Mat = new THREE.MeshStandardMaterial({
    color: 0x6a6f75, // Small right moon
    roughness: 0.9,
    metalness: 0.05
  });

  textureLoader.load(
    MOON_TEX,
    (tex) => {
      planetMat.map = tex; planetMat.needsUpdate = true;
      moon2Mat.map = tex; moon2Mat.needsUpdate = true;
      moon3Mat.map = tex; moon3Mat.needsUpdate = true;
    },
    undefined,
    () => {
      // Fallback: create procedural crater texture canvas if offline
      const canvas = document.createElement('canvas');
      canvas.width = 256; canvas.height = 256;
      const ctx = canvas.getContext('2d');
      ctx.fillStyle = '#6a6c70'; ctx.fillRect(0,0,256,256);
      for(let i=0; i<30; i++){
        const x = Math.random()*256;
        const y = Math.random()*256;
        const r = 5 + Math.random()*15;
        const grad = ctx.createRadialGradient(x,y,0, x,y,r);
        grad.addColorStop(0, '#3a3b3d'); grad.addColorStop(0.8, '#56585c'); grad.addColorStop(1, '#787a7f');
        ctx.fillStyle = grad; ctx.beginPath(); ctx.arc(x,y,r,0,Math.PI*2); ctx.fill();
      }
      const tex = new THREE.CanvasTexture(canvas);
      planetMat.map = tex; planetMat.needsUpdate = true;
      moon2Mat.map = tex; moon2Mat.needsUpdate = true;
      moon3Mat.map = tex; moon3Mat.needsUpdate = true;
    }
  );

  // ================================================================
  // 3D PLANETS ASSEMBLY
  // ================================================================
  
  // 1. Large Ringed Planet (Lower Left)
  const planetGroup = new THREE.Group();
  planetGroup.position.set(-8.5, -4.5, -28);
  scene.add(planetGroup);

  const planetRadius = 5.6; // Increased size to match reference image (takes up ~25% of height)
  const planetMesh = new THREE.Mesh(new THREE.SphereGeometry(planetRadius, 48, 48), planetMat);
  planetGroup.add(planetMesh);

  // Concentric Planetary Rings
  const ringInner = 7.2;
  const ringOuter = 17.5; // Made rings much wider to stretch across the left screen space
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
        
        // Discard pixels outside concentric radius
        if (dist > 1.0 || dist < 0.41) discard; // ringInner / ringOuter ratio: 7.2 / 17.5 = 0.411
        
        float radial = (dist - 0.41) / (1.0 - 0.41);
        
        // Concentric band lines
        float lines = sin(radial * 130.0) * 0.45 + 0.55;
        float gap = step(0.18, hash(floor(radial * 60.0)));
        
        // Fades at boundaries
        float alpha = lines * gap * smoothstep(0.0, 0.12, radial) * smoothstep(1.0, 0.88, radial) * 0.72;
        
        // Colors shift from blue-cyan to soft violet
        vec3 ringColor = mix(vec3(0.32, 0.65, 1.0), vec3(0.68, 0.45, 0.95), radial);
        
        gl_FragColor = vec4(ringColor * 1.5, alpha);
      }
    `,
    transparent: true,
    side: THREE.DoubleSide,
    depthWrite: false
  });
  const ringMesh = new THREE.Mesh(ringGeo, ringMat);
  // Adjusted tilt: tilted downwards from top-left to bottom-right (z-rotation is negative)
  ringMesh.rotation.set(1.2, 0.2, -0.48);
  planetGroup.add(ringMesh);

  // Small Satellite orbiting the large planet (positioned at the bottom-left)
  const satGroup = new THREE.Group();
  planetGroup.add(satGroup);
  const satMesh = new THREE.Mesh(new THREE.SphereGeometry(0.52, 16, 16), moon3Mat);
  satMesh.position.set(-4.5, -2.5, 2.5); // Bottom-left relative offset
  satGroup.add(satMesh);

  // 2. Medium Moon (Upper Right)
  const moon2Mesh = new THREE.Mesh(new THREE.SphereGeometry(2.2, 32, 32), moon2Mat);
  moon2Mesh.position.set(12.0, 7.5, -30);
  scene.add(moon2Mesh);

  // 3. Small Moon (Far Right)
  const moon3Mesh = new THREE.Mesh(new THREE.SphereGeometry(0.48, 16, 16), moon3Mat);
  moon3Mesh.position.set(16.5, 3.5, -32);
  scene.add(moon3Mesh);

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
  // MOUSE PARALLAX & ANIMATION LOOP
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

    // 1. Shaders updates
    starShaderMat.uniforms.time.value = t;
    nebulaShaderMat.uniforms.time.value = t;

    // 2. Planets self rotations
    planetMesh.rotation.y = t * 0.005;
    moon2Mesh.rotation.y = t * 0.003;
    moon3Mesh.rotation.y = t * 0.002;

    // 3. Moon satellite orbit
    satGroup.rotation.y = t * 0.02;

    // 4. Volumetric dust float
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

    // 5. Camera mouse parallax
    const targetCamX = (mouseX / halfW) * 2.5;
    const targetCamY = -(mouseY / halfH) * 1.5;

    camera.position.x += (targetCamX - camera.position.x) * 0.035;
    camera.position.y += (targetCamY - camera.position.y) * 0.035;
    camera.lookAt(0, 0, 0);

    // Dynamic depth parallax shifts
    nebulaPlane.position.x = camera.position.x * 0.85;
    nebulaPlane.position.y = camera.position.y * 0.85;

    starfield.position.x = camera.position.x * 0.7;
    starfield.position.y = camera.position.y * 0.7;

    planetGroup.position.x = -8.5 + camera.position.x * 0.35;
    planetGroup.position.y = -4.5 + camera.position.y * 0.35;

    moon2Mesh.position.x = 12.0 + camera.position.x * 0.25;
    moon2Mesh.position.y = 7.5 + camera.position.y * 0.25;

    renderer.render(scene, camera);
  }

  animate();

  // ================================================================
  // RESPONSIVE RESIZE
  // ================================================================
  window.addEventListener('resize', () => {
    const w = window.innerWidth;
    const h = window.innerHeight;
    
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    renderer.setSize(w, h);
  });

})();
