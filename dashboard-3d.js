(function(){
  // Cinematic 3D Space Command Center background using Three.js
  // Renders:
  // 1. Earth in the left-middle background with twilight GLSL shaders and atmospheric halo.
  // 2. Moon in the right background orbiting Earth slowly, with crater textures.
  // 3. Small communications/observatory satellites orbiting Earth.
  // 4. Spacecraft scaled down by 40%, orbiting Earth dynamically with bank angles, engine flame flicker, and camera target alignment.
  // 5. GPU twinkling stars with random offsets.
  // 6. Slowly drifting procedural nebula gas clouds in deep background.
  // 7. Volumetric floating cosmic dust particles.
  // 8. Dynamic shooting stars streaking periodically.
  // 9. Sun sprite with flares creating synchronized lighting directions.
  
  if(typeof THREE === 'undefined') return console.warn('Three.js not loaded');

  const container = document.getElementById('galaxy-container');
  const width = window.innerWidth;
  const height = window.innerHeight;

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(38, width / height, 0.1, 5000);
  camera.position.set(0, 4, 38);

  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(width, height);
  renderer.domElement.style.position = 'fixed';
  renderer.domElement.style.inset = '0';
  renderer.domElement.style.zIndex = '0';
  renderer.domElement.style.pointerEvents = 'none';
  container.appendChild(renderer.domElement);

  // Space fog
  scene.fog = new THREE.FogExp2(0x020306, 0.0006);

  // ================================================================
  // UTILITY: PROCEDURAL RADIAL GRADIENT GLOW TEXTURE generator
  // ================================================================
  function createGlowTexture(colorStr) {
    const canvas = document.createElement('canvas');
    canvas.width = 128;
    canvas.height = 128;
    const ctx = canvas.getContext('2d');
    const grad = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
    grad.addColorStop(0, colorStr);
    grad.addColorStop(0.25, colorStr);
    grad.addColorStop(0.55, 'rgba(255, 176, 59, 0.12)');
    grad.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 128, 128);
    return new THREE.CanvasTexture(canvas);
  }

  // ================================================================
  // LIGHTING & THE SUN
  // ================================================================
  const sunDirection = new THREE.Vector3(-60, 32, 50).normalize();
  const earthshineDirection = new THREE.Vector3(20, -32, -20).normalize();

  // Sunlight
  const sunLight = new THREE.DirectionalLight(0xffeedd, 3.8);
  sunLight.position.copy(sunDirection).multiplyScalar(150);
  scene.add(sunLight);

  // Earthshine
  const earthshineLight = new THREE.DirectionalLight(0x4ca6ff, 1.4);
  earthshineLight.position.copy(earthshineDirection).multiplyScalar(150);
  scene.add(earthshineLight);

  const ambientLight = new THREE.AmbientLight(0x060812, 1.1);
  scene.add(ambientLight);

  // Glowing Sun Sprite
  const sunGlowTex = createGlowTexture('rgba(255, 246, 225, 1.0)');
  const sunSpriteMat = new THREE.SpriteMaterial({
    map: sunGlowTex,
    blending: THREE.AdditiveBlending,
    transparent: true,
    opacity: 0.95
  });
  const sunSprite = new THREE.Sprite(sunSpriteMat);
  sunSprite.position.copy(sunDirection).multiplyScalar(140);
  sunSprite.scale.set(38, 38, 1);
  scene.add(sunSprite);

  // Sun Flare overlay sparkles
  const sunRayTex = createGlowTexture('rgba(255, 200, 100, 0.35)');
  const sunRaySpriteMat = new THREE.SpriteMaterial({
    map: sunRayTex,
    blending: THREE.AdditiveBlending,
    transparent: true,
    opacity: 0.6
  });
  const sunRay1 = new THREE.Sprite(sunRaySpriteMat);
  sunRay1.position.copy(sunDirection).multiplyScalar(120);
  sunRay1.scale.set(65, 8, 1);
  sunRay1.rotation = 0.45;
  scene.add(sunRay1);

  const sunRay2 = new THREE.Sprite(sunRaySpriteMat);
  sunRay2.position.copy(sunDirection).multiplyScalar(120);
  sunRay2.scale.set(65, 8, 1);
  sunRay2.rotation = -0.65;
  scene.add(sunRay2);

  // ================================================================
  // EARTH-MOON SYSTEM (LEFT-MIDDLE)
  // ================================================================
  const earthGroup = new THREE.Group();
  earthGroup.position.set(-16, 2.5, -60);
  scene.add(earthGroup);

  const textureLoader = new THREE.TextureLoader();
  textureLoader.crossOrigin = '';

  const EARTH_TEX = 'https://raw.githubusercontent.com/mrdoob/three.js/master/examples/textures/planets/earth_atmos_2048.jpg';
  const EARTH_NORM = 'https://raw.githubusercontent.com/mrdoob/three.js/master/examples/textures/planets/earth_normal_2048.jpg';
  const EARTH_SPEC = 'https://raw.githubusercontent.com/mrdoob/three.js/master/examples/textures/planets/earth_specular_2048.jpg';
  const CLOUDS_TEX = 'https://raw.githubusercontent.com/mrdoob/three.js/master/examples/textures/planets/earth_clouds_1024.png';
  const MOON_TEX = 'https://raw.githubusercontent.com/mrdoob/three.js/master/examples/textures/planets/moon_1024.jpg';

  const earthRadius = 9.5;

  // Custom Photorealistic Earth Shader
  const earthShaderMaterial = new THREE.ShaderMaterial({
    uniforms: {
      map: { value: textureLoader.load(EARTH_TEX) },
      normalMap: { value: textureLoader.load(EARTH_NORM) },
      specularMap: { value: textureLoader.load(EARTH_SPEC) },
      sunDir: { value: sunDirection },
      time: { value: 0 }
    },
    vertexShader: `
      varying vec2 vUv;
      varying vec3 vNormal;
      varying vec3 vViewPosition;
      void main() {
        vUv = uv;
        vNormal = normalize(normalMatrix * normal);
        vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
        vViewPosition = -mvPosition.xyz;
        gl_Position = projectionMatrix * mvPosition;
      }
    `,
    fragmentShader: `
      uniform sampler2D map;
      uniform sampler2D normalMap;
      uniform sampler2D specularMap;
      uniform vec3 sunDir;
      uniform float time;
      
      varying vec2 vUv;
      varying vec3 vNormal;
      varying vec3 vViewPosition;

      float hash(vec2 p) {
        return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453123);
      }

      void main() {
        vec4 texColor = texture2D(map, vUv);
        float specMask = texture2D(specularMap, vUv).r;
        float isLand = 1.0 - specMask;

        vec3 normalDetail = texture2D(normalMap, vUv).rgb * 2.0 - 1.0;
        vec3 N = normalize(vNormal + normalDetail * 0.08);
        vec3 V = normalize(vViewPosition);

        float dotSun = dot(N, sunDir);
        float daySide = smoothstep(-0.15, 0.15, dotSun);

        // Sunset twilight orange ring
        float twilight = smoothstep(0.25, 0.0, abs(dotSun));
        vec3 twilightColor = vec3(1.0, 0.38, 0.08) * twilight * isLand * 0.9;

        // Procedural night-side city lights
        float block1 = step(0.92, hash(floor(vUv * 500.0)));
        float block2 = step(0.85, hash(floor(vUv * 96.0) + 13.5));
        float lights = block1 * block2;
        float shimmer = sin(time * 2.0 + hash(floor(vUv * 96.0)) * 10.0) * 0.15 + 0.85;
        float nightLit = smoothstep(0.0, -0.4, dotSun);
        vec3 nightLights = vec3(1.0, 0.82, 0.48) * lights * isLand * nightLit * 3.2 * shimmer;

        // Specular ocean reflections
        vec3 L = normalize(sunDir);
        vec3 R = reflect(-L, N);
        float specHighlight = pow(max(dot(R, V), 0.0), 32.0) * specMask;
        vec3 specGlow = vec3(0.75, 0.92, 1.0) * specHighlight * daySide * 1.8;

        // Day color
        vec3 dayColor = texColor.rgb * (daySide * 1.45 + 0.05);

        vec3 finalColor = mix(nightLights, dayColor + specGlow, daySide) + twilightColor;

        // Atmospheric Fresnel Edge Haze
        float fresnel = pow(1.0 - max(dot(normalize(vNormal), V), 0.0), 3.5);
        vec3 atmosphere = vec3(0.38, 0.70, 1.0) * fresnel * smoothstep(-0.25, 0.35, dotSun) * 0.95;

        gl_FragColor = vec4(finalColor + atmosphere, 1.0);
      }
    `
  });

  const earthGeo = new THREE.SphereGeometry(earthRadius, 64, 64);
  const earthMesh = new THREE.Mesh(earthGeo, earthShaderMaterial);
  earthGroup.add(earthMesh);

  // Clouds Layer
  const cloudGeo = new THREE.SphereGeometry(earthRadius + 0.18, 64, 64);
  const cloudMat = new THREE.MeshPhongMaterial({
    map: textureLoader.load(CLOUDS_TEX),
    transparent: true,
    opacity: 0.4,
    blending: THREE.AdditiveBlending,
    depthWrite: false
  });
  const cloudsMesh = new THREE.Mesh(cloudGeo, cloudMat);
  earthGroup.add(cloudsMesh);

  // Atmospheric scattering halo
  const atmosMaterial = new THREE.ShaderMaterial({
    uniforms: {
      sunDir: { value: sunDirection }
    },
    vertexShader: `
      varying vec3 vNormal;
      void main() {
        vNormal = normalize(normalMatrix * normal);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      uniform vec3 sunDir;
      varying vec3 vNormal;
      void main() {
        float edge = pow(0.72 - dot(vNormal, vec3(0, 0, 1.0)), 3.0);
        float sunLit = smoothstep(-0.25, 0.35, dot(vNormal, sunDir));
        gl_FragColor = vec4(0.38, 0.68, 1.0, 1.0) * edge * sunLit;
      }
    `,
    transparent: true,
    blending: THREE.AdditiveBlending,
    side: THREE.BackSide,
    depthWrite: false
  });
  const atmosMesh = new THREE.Mesh(
    new THREE.SphereGeometry(earthRadius + 0.5, 64, 64),
    atmosMaterial
  );
  earthGroup.add(atmosMesh);

  // ================================================================
  // THE MOON (ORBITING EARTH)
  // ================================================================
  const moonGroup = new THREE.Group();
  earthGroup.add(moonGroup);

  const moonRadius = 2.4;
  const moonGeo = new THREE.SphereGeometry(moonRadius, 32, 32);
  const moonMat = new THREE.MeshStandardMaterial({
    roughness: 0.92,
    metalness: 0.08
  });

  textureLoader.load(
    MOON_TEX,
    (tex) => { moonMat.map = tex; moonMat.needsUpdate = true; },
    undefined,
    () => {
      // Procedural craters mapping fallback
      const canvas = document.createElement('canvas');
      canvas.width = 256; canvas.height = 256;
      const ctx = canvas.getContext('2d');
      ctx.fillStyle = '#686b72'; ctx.fillRect(0,0,256,256);
      for(let i=0; i<35; i++){
        const x = Math.random()*256;
        const y = Math.random()*256;
        const r = 4 + Math.random()*12;
        const grad = ctx.createRadialGradient(x,y,0, x,y,r);
        grad.addColorStop(0, '#383a3f'); grad.addColorStop(0.7, '#54575c'); grad.addColorStop(1, '#787a7f');
        ctx.fillStyle = grad; ctx.beginPath(); ctx.arc(x,y,r,0,Math.PI*2); ctx.fill();
      }
      moonMat.map = new THREE.CanvasTexture(canvas);
      moonMat.needsUpdate = true;
    }
  );
  const moonMesh = new THREE.Mesh(moonGeo, moonMat);
  moonMesh.position.set(24.0, 0, 0); // distance from Earth
  moonGroup.add(moonMesh);

  // ================================================================
  // SATELLITE FEEDS (inclined and polar)
  // ================================================================
  const sat1Group = new THREE.Group();
  earthGroup.add(sat1Group);
  
  const satMat = new THREE.MeshStandardMaterial({ color: 0xabbcc8, metalness: 0.9, roughness: 0.15 });
  const solarPanelMat = new THREE.MeshBasicMaterial({ color: 0x0080ff, side: THREE.DoubleSide });

  const sat1Body = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 0.35, 8), satMat);
  const panel1 = new THREE.Mesh(new THREE.PlaneGeometry(0.75, 0.22), solarPanelMat);
  panel1.position.x = 0.5;
  const panel2 = new THREE.Mesh(new THREE.PlaneGeometry(0.75, 0.22), solarPanelMat);
  panel2.position.x = -0.5;
  const sat1 = new THREE.Group();
  sat1.add(sat1Body); sat1.add(panel1); sat1.add(panel2);
  sat1.position.set(13.8, 0, 0);
  sat1Group.add(sat1);

  const sat2Group = new THREE.Group();
  earthGroup.add(sat2Group);

  const sat2Body = new THREE.Mesh(new THREE.SphereGeometry(0.12, 8, 8), satMat);
  const sat2Dish = new THREE.Mesh(new THREE.ConeGeometry(0.18, 0.12, 8), satMat);
  sat2Dish.rotation.x = Math.PI / 2;
  sat2Dish.position.z = 0.15;
  const sat2 = new THREE.Group();
  sat2.add(sat2Body); sat2.add(sat2Dish);
  sat2.position.set(16.5, 0, 0);
  sat2Group.add(sat2);

  // ================================================================
  // BACKGROUND NEBULA PLANE
  // ================================================================
  const nebulaGroup = new THREE.Group();
  scene.add(nebulaGroup);

  const nebulaShaderMat = new THREE.ShaderMaterial({
    uniforms: { time: { value: 0 } },
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
          p = p * 2.2 + vec2(42.0);
          a *= 0.5;
        }
        return v;
      }
      
      void main() {
        vec2 uv = vUv - vec2(0.5);
        float dist = length(uv);
        
        vec2 p = vUv * 2.8;
        p.x += time * 0.007;
        p.y += sin(time * 0.004) * 0.04;
        
        float f = fbm(p + fbm(p + time * 0.002));
        
        vec3 colorBlue = vec3(0.01, 0.02, 0.08);
        vec3 colorPurple = vec3(0.03, 0.01, 0.05);
        vec3 colorOrange = vec3(0.05, 0.025, 0.01);
        
        vec3 finalColor = mix(colorBlue, colorPurple, f) + colorOrange * smoothstep(0.35, 0.75, f);
        finalColor *= smoothstep(0.85, 0.25, dist);
        
        gl_FragColor = vec4(finalColor, 1.0);
      }
    `,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending
  });

  const nebulaPlane = new THREE.Mesh(new THREE.PlaneGeometry(800, 500), nebulaShaderMat);
  nebulaPlane.position.set(0, 0, -320);
  nebulaGroup.add(nebulaPlane);

  // ================================================================
  // GPU TWINKLING STARFIELD
  // ================================================================
  const starGeo = new THREE.BufferGeometry();
  const starCount = 4200;
  const starPos = new Float32Array(starCount * 3);
  const randomOffsets = new Float32Array(starCount);

  for (let i = 0; i < starCount; i++) {
    starPos[i * 3] = (Math.random() - 0.5) * 650;
    starPos[i * 3 + 1] = (Math.random() - 0.5) * 420;
    starPos[i * 3 + 2] = -90 - Math.random() * 210;
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
      uniform float size;
      uniform float time;
      attribute float randomOffset;
      varying float vTwinkle;
      void main() {
        vTwinkle = sin(time * 2.3 + randomOffset) * 0.4 + 0.6;
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
        vec3 color = vec3(0.92, 0.96, 1.0);
        gl_FragColor = vec4(color, vTwinkle * 0.8);
      }
    `,
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false
  });

  const starfield = new THREE.Points(starGeo, starShaderMat);
  scene.add(starfield);

  // ================================================================
  // VOLUMETRIC COSMIC DUST
  // ================================================================
  const dustGeo = new THREE.BufferGeometry();
  const dustCount = 180;
  const dustPos = new Float32Array(dustCount * 3);
  const dustSpeeds = [];

  for (let i = 0; i < dustCount; i++) {
    dustPos[i * 3] = (Math.random() - 0.5) * 75;
    dustPos[i * 3 + 1] = (Math.random() - 0.5) * 45;
    dustPos[i * 3 + 2] = -15 - Math.random() * 85;
    dustSpeeds.push({
      x: (Math.random() - 0.5) * 0.015,
      y: (Math.random() - 0.5) * 0.012 + 0.008,
      z: (Math.random() - 0.5) * 0.015
    });
  }

  dustGeo.setAttribute('position', new THREE.BufferAttribute(dustPos, 3));
  const dustMat = new THREE.PointsMaterial({
    color: 0x4ca6ff,
    size: 0.4,
    transparent: true,
    opacity: 0.38,
    blending: THREE.AdditiveBlending,
    depthWrite: false
  });
  const dustfield = new THREE.Points(dustGeo, dustMat);
  scene.add(dustfield);

  // ================================================================
  // PERIODIC SHOOTING STARS
  // ================================================================
  const lineGeo = new THREE.BufferGeometry();
  const linePos = new Float32Array([0,0,0, 0,0,0]);
  lineGeo.setAttribute('position', new THREE.BufferAttribute(linePos, 3));
  const lineMat = new THREE.LineBasicMaterial({
    color: 0xffffff,
    transparent: true,
    opacity: 0,
    blending: THREE.AdditiveBlending
  });
  const shootingStar = new THREE.Line(lineGeo, lineMat);
  scene.add(shootingStar);

  let starActive = false;
  let starTimer = 0;
  let starStart = new THREE.Vector3();
  let starEnd = new THREE.Vector3();
  let starProgress = 0;

  function triggerShootingStar() {
    starActive = true;
    starProgress = 0;
    starStart.set(
      (Math.random() - 0.5) * 160,
      15 + Math.random() * 15,
      -120
    );
    starEnd.copy(starStart).add(new THREE.Vector3(-45, -35, 25));
  }

  // ================================================================
  // SPACECRAFT SHADER (PROCEDURAL TILES)
  // ================================================================
  const shuttleMaterial = new THREE.ShaderMaterial({
    uniforms: {
      sunDir: { value: sunDirection },
      earthshineDir: { value: earthshineDirection }
    },
    vertexShader: `
      varying vec3 vNormal;
      varying vec3 vLocalNormal;
      varying vec3 vViewPosition;
      varying vec2 vUv;
      void main() {
        vNormal = normalize(normalMatrix * normal);
        vLocalNormal = normalize(normal);
        vUv = uv;
        vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
        vViewPosition = -mvPosition.xyz;
        gl_Position = projectionMatrix * mvPosition;
      }
    `,
    fragmentShader: `
      varying vec3 vNormal;
      varying vec3 vLocalNormal;
      varying vec3 vViewPosition;
      varying vec2 vUv;
      uniform vec3 sunDir;
      uniform vec3 earthshineDir;

      float hash(vec2 p) {
        return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
      }

      void main() {
        vec2 grid = fract(vUv * 85.0);
        float lineX = smoothstep(0.0, 0.06, grid.x) * smoothstep(1.0, 0.94, grid.x);
        float lineY = smoothstep(0.0, 0.06, grid.y) * smoothstep(1.0, 0.94, grid.y);
        float isLine = 1.0 - (lineX * lineY);

        vec2 tileId = floor(vUv * 85.0);
        float rand = hash(tileId);

        float isBelly = smoothstep(0.12, -0.15, vLocalNormal.y);

        vec3 baseColor;
        if (isBelly > 0.5) {
          baseColor = mix(vec3(0.08, 0.09, 0.11), vec3(0.13, 0.14, 0.17), rand);
        } else {
          baseColor = mix(vec3(0.86, 0.87, 0.91), vec3(0.95, 0.96, 0.98), rand);
        }

        vec3 tileColor = mix(baseColor, vec3(0.04, 0.04, 0.05), isLine * 0.75);

        vec3 N = normalize(vNormal);
        vec3 V = normalize(vViewPosition);

        vec3 L1 = normalize(sunDir);
        float diff1 = max(dot(N, L1), 0.0);
        vec3 R1 = reflect(-L1, N);
        float spec1 = pow(max(dot(R1, V), 0.0), isBelly > 0.5 ? 8.0 : 32.0);
        vec3 specularLight = vec3(1.0, 0.95, 0.88) * spec1 * (isBelly > 0.5 ? 0.05 : 0.45);

        vec3 L2 = normalize(earthshineDir);
        float diff2 = max(dot(N, L2), 0.0);

        vec3 ambient = vec3(0.04, 0.06, 0.09) * tileColor;
        vec3 diffuseSun = vec3(1.0, 0.96, 0.90) * diff1 * tileColor * 3.3;
        vec3 diffuseEarth = vec3(0.3, 0.65, 1.0) * diff2 * tileColor * 1.6;

        vec3 finalColor = ambient + diffuseSun + diffuseEarth + specularLight;

        gl_FragColor = vec4(finalColor, 1.0);
      }
    `,
    side: THREE.DoubleSide
  });

  // ================================================================
  // SPACECRAFT ASSEMBLY (ORBITING AROUND EARTH)
  // ================================================================
  const shuttleGroup = new THREE.Group();
  shuttleGroup.scale.setScalar(0.38); // Reduced size by 40% (original base was 1.0, previous tweak 0.6, now 0.38)
  scene.add(shuttleGroup);

  const fuselageLength = 22;
  const fuselageGeo = new THREE.CylinderGeometry(2.5, 2.5, fuselageLength, 32);
  const fuselage = new THREE.Mesh(fuselageGeo, shuttleMaterial);
  fuselage.rotation.x = Math.PI / 2;
  shuttleGroup.add(fuselage);

  const noseGeo = new THREE.ConeGeometry(2.5, 6, 32);
  const nose = new THREE.Mesh(noseGeo, shuttleMaterial);
  nose.rotation.x = Math.PI / 2;
  nose.position.z = fuselageLength / 2 + 3;
  shuttleGroup.add(nose);

  const glassMat = new THREE.MeshStandardMaterial({ color: 0x050608, roughness: 0.12, metalness: 0.96 });
  const shieldGeo = new THREE.SphereGeometry(2.52, 32, 16, 0, Math.PI * 2, 0, Math.PI / 3);
  const shield = new THREE.Mesh(shieldGeo, glassMat);
  shield.position.set(0, 0.4, fuselageLength / 2 + 1.2);
  shield.rotation.x = -Math.PI / 5;
  shuttleGroup.add(shield);

  // Delta Wings
  const wingShape = new THREE.Shape();
  wingShape.moveTo(0, 4); wingShape.lineTo(13, -8); wingShape.lineTo(12.5, -11); wingShape.lineTo(0, -9);
  const extrudeSettings = { depth: 0.35, bevelEnabled: true, bevelSegments: 2, steps: 1, bevelSize: 0.08, bevelThickness: 0.08 };
  const wingGeo = new THREE.ExtrudeGeometry(wingShape, extrudeSettings);

  const wingR = new THREE.Mesh(wingGeo, shuttleMaterial);
  wingR.rotation.x = Math.PI / 2;
  wingR.position.set(0, -1.0, 0);
  shuttleGroup.add(wingR);

  const wingLGroup = new THREE.Group();
  wingLGroup.scale.x = -1;
  const wingL = new THREE.Mesh(wingGeo, shuttleMaterial);
  wingL.rotation.x = Math.PI / 2;
  wingL.position.set(0, -1.0, 0);
  wingLGroup.add(wingL);
  shuttleGroup.add(wingLGroup);

  const finShape = new THREE.Shape();
  finShape.moveTo(0, 0); finShape.lineTo(-5, 8.5); finShape.lineTo(-6.8, 8.5); finShape.lineTo(-6.0, 0);
  const finGeo = new THREE.ExtrudeGeometry(finShape, { ...extrudeSettings, depth: 0.3 });
  const fin = new THREE.Mesh(finGeo, shuttleMaterial);
  fin.position.set(0.15, 2.5, -6);
  shuttleGroup.add(fin);

  // Engines
  const nozzleMat = new THREE.MeshStandardMaterial({ color: 0x1f2126, roughness: 0.7, metalness: 0.6 });
  const nozzleGeo = new THREE.CylinderGeometry(0.7, 1.2, 2.2, 16);
  const enginesGroup = new THREE.Group();
  enginesGroup.position.z = -fuselageLength / 2;
  shuttleGroup.add(enginesGroup);

  const nozzle1 = new THREE.Mesh(nozzleGeo, nozzleMat);
  nozzle1.rotation.x = Math.PI / 2; nozzle1.position.set(0, 1.2, -1.1); enginesGroup.add(nozzle1);
  const nozzle2 = new THREE.Mesh(nozzleGeo, nozzleMat);
  nozzle2.rotation.x = Math.PI / 2; nozzle2.position.set(-1.4, -0.9, -1.1); enginesGroup.add(nozzle2);
  const nozzle3 = new THREE.Mesh(nozzleGeo, nozzleMat);
  nozzle3.rotation.x = Math.PI / 2; nozzle3.position.set(1.4, -0.9, -1.1); enginesGroup.add(nozzle3);

  // Exhaust cones
  const thrustMat = new THREE.ShaderMaterial({
    uniforms: { time: { value: 0 } },
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
      void main() {
        float glow = 1.0 - vUv.y;
        float flicker = sin(time * 28.0) * 0.18 + 0.82;
        vec3 color = mix(vec3(0.96, 0.32, 0.05), vec3(1.0, 0.95, 0.58), glow * glow);
        gl_FragColor = vec4(color * flicker * 2.2, glow * 0.95);
      }
    `,
    transparent: true,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
    depthWrite: false
  });

  const thrustGeo = new THREE.ConeGeometry(1.05, 5.8, 16, 1, true);

  const thrust1 = new THREE.Mesh(thrustGeo, thrustMat);
  thrust1.rotation.x = -Math.PI / 2; thrust1.position.set(0, 1.2, -3.8); enginesGroup.add(thrust1);
  const thrust2 = new THREE.Mesh(thrustGeo, thrustMat);
  thrust2.rotation.x = -Math.PI / 2; thrust2.position.set(-1.4, -0.9, -3.8); enginesGroup.add(thrust2);
  const thrust3 = new THREE.Mesh(thrustGeo, thrustMat);
  thrust3.rotation.x = -Math.PI / 2; thrust3.position.set(1.4, -0.9, -3.8); enginesGroup.add(thrust3);

  const engineGlowLight = new THREE.PointLight(0xff6a10, 4.5, 30);
  engineGlowLight.position.set(0, 0, -fuselageLength / 2 - 2);
  shuttleGroup.add(engineGlowLight);

  // ================================================================
  // BLOOM POST-PROCESSING
  // ================================================================
  let composer = null;
  if(THREE.EffectComposer && THREE.UnrealBloomPass) {
    try {
      composer = new THREE.EffectComposer(renderer);
      const renderPass = new THREE.RenderPass(scene, camera);
      composer.addPass(renderPass);
      
      const bloomPass = new THREE.UnrealBloomPass(
        new THREE.Vector2(window.innerWidth, window.innerHeight),
        1.1, 0.45, 0.8
      );
      bloomPass.threshold = 0.05;
      bloomPass.strength = 1.35;
      bloomPass.radius = 0.5;
      composer.addPass(bloomPass);
    } catch(e) {
      console.warn('Three.js UnrealBloomPass disabled. Falling back to default WebGL rendering.', e);
      composer = null;
    }
  }

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

    const delta = clock.getDelta();
    const t = clock.getElapsedTime();

    // 1. Time updates for shaders
    thrustMat.uniforms.time.value = t;
    earthShaderMaterial.uniforms.time.value = t;
    starShaderMat.uniforms.time.value = t;
    nebulaShaderMat.uniforms.time.value = t;

    // 2. Engine light pulses and flame scale flickers
    engineGlowLight.intensity = 4.0 + Math.sin(t * 24.0) * 0.6;
    const fScale = 1.0 + Math.sin(t * 32.0) * 0.06;
    thrust1.scale.z = fScale;
    thrust2.scale.z = fScale;
    thrust3.scale.z = fScale;

    // 3. Earth, Clouds, and Moon orbital rotations
    earthMesh.rotation.y = t * 0.0035;
    cloudsMesh.rotation.y = t * 0.0046;
    moonMesh.rotation.y = t * 0.002;
    
    // Moon orbits Earth (relative to earthGroup)
    moonGroup.rotation.y = t * 0.05;

    // Satellites orbit Earth
    sat1Group.rotation.y = t * 0.15;
    sat1Group.rotation.z = 0.3; // inclined orbit
    sat2Group.rotation.x = t * 0.22; // polar orbit
    sat2Group.rotation.y = 0.5;

    // 4. Volumetric cosmic dust drift
    const positions = dustfield.geometry.attributes.position.array;
    for (let i = 0; i < dustCount; i++) {
      positions[i * 3] += dustSpeeds[i].x;
      positions[i * 3 + 1] += dustSpeeds[i].y;
      positions[i * 3 + 2] += dustSpeeds[i].z;
      
      // Wrap bounding limits
      if (positions[i * 3 + 1] > 25) positions[i * 3 + 1] = -25;
      if (positions[i * 3] > 40) positions[i * 3] = -40;
      if (positions[i * 3] < -40) positions[i * 3] = 40;
    }
    dustfield.geometry.attributes.position.needsUpdate = true;

    // 5. Shooting Star engine
    if (!starActive) {
      starTimer += delta;
      if (starTimer > 15.0) {
        if (Math.random() < 0.32) {
          triggerShootingStar();
          starTimer = 0;
        }
      }
    } else {
      starProgress += delta * 1.6;
      if (starProgress >= 1.0) {
        starActive = false;
        lineMat.opacity = 0;
      } else {
        const currentHead = new THREE.Vector3().lerpVectors(starStart, starEnd, starProgress);
        const currentTail = new THREE.Vector3().lerpVectors(starStart, starEnd, Math.max(0, starProgress - 0.16));
        const posArray = shootingStar.geometry.attributes.position.array;
        posArray[0] = currentTail.x; posArray[1] = currentTail.y; posArray[2] = currentTail.z;
        posArray[3] = currentHead.x; posArray[4] = currentHead.y; posArray[5] = currentHead.z;
        shootingStar.geometry.attributes.position.needsUpdate = true;
        lineMat.opacity = Math.sin(starProgress * Math.PI) * 0.95;
      }
    }

    // 6. Spaceship orbital flying around Earth (Positioned between Earth and Moon)
    const shipOrbitRadius = 14.5;
    const shipAngle = t * 0.08;
    const shipHeightTilt = Math.sin(shipAngle) * 3.5;
    
    // Position vector relative to Earth Group
    const shipLocalPos = new THREE.Vector3(
      shipOrbitRadius * Math.cos(shipAngle),
      shipHeightTilt,
      shipOrbitRadius * Math.sin(shipAngle)
    );
    // Convert relative offset to scene world space
    const shipWorldPos = shipLocalPos.clone().applyMatrix4(earthGroup.matrixWorld);

    // LookAt Target computation (next frame position)
    const nextShipAngle = shipAngle + 0.015;
    const nextShipHeightTilt = Math.sin(nextShipAngle) * 3.5;
    const nextShipLocalPos = new THREE.Vector3(
      shipOrbitRadius * Math.cos(nextShipAngle),
      nextShipHeightTilt,
      shipOrbitRadius * Math.sin(nextShipAngle)
    );
    const nextShipWorldPos = nextShipLocalPos.clone().applyMatrix4(earthGroup.matrixWorld);

    // Hover floating micro-bobbing
    const hoverOffset = Math.sin(t * 1.6) * 0.12;
    shipWorldPos.y += hoverOffset;
    nextShipWorldPos.y += Math.sin((t + 0.015) * 1.6) * 0.12;

    shuttleGroup.position.copy(shipWorldPos);
    shuttleGroup.lookAt(nextShipWorldPos);

    // Dynamic bank (roll) in turns
    shuttleGroup.rotateZ(0.25 + Math.sin(t * 0.8) * 0.04);

    // 7. Dynamic Camera Parallax
    const targetCamX = (mouseX / halfW) * 3.8;
    const targetCamY = -(mouseY / halfH) * 2.2;

    camera.position.x += (targetCamX - camera.position.x) * 0.035;
    camera.position.y += ((4 + targetCamY) - camera.position.y) * 0.035;
    camera.lookAt(0, 1, 0);

    // Shift background elements to multiply parallax depth layers
    nebulaGroup.position.x = camera.position.x * 0.85;
    nebulaGroup.position.y = camera.position.y * 0.85;
    
    starfield.position.x = camera.position.x * 0.72;
    starfield.position.y = camera.position.y * 0.72;
    
    earthGroup.position.x = -16 + camera.position.x * 0.35;
    earthGroup.position.y = 2.5 + camera.position.y * 0.35;

    // Apply additional mouse parallax translation to the shuttle
    shuttleGroup.position.x += camera.position.x * 0.15;
    shuttleGroup.position.y += camera.position.y * 0.15;

    // Render pass
    if (composer) {
      composer.render();
    } else {
      renderer.render(scene, camera);
    }
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
    
    if (composer) {
      composer.setSize(w, h);
    }
  });

})();
