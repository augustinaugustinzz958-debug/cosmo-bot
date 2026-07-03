console.log('dashboard 3d script loaded');

// Replace or augment existing rocket texture/material setup:
const textureLoader = new THREE.TextureLoader();

// attempt SVG first, fallback to PNG
const rocketTexturePath = 'assets/rocket/rocket.svg';
const rocketFallback = 'assets/rocket/rocket.png';

function applyRocketTextureToMesh(mesh, renderer) {
	// load SVG (TextureLoader can load SVG as image) with fallback
	textureLoader.load(rocketTexturePath, (tex) => {
		// enable crisp sampling and anisotropy for clarity at oblique angles
		tex.minFilter = THREE.LinearMipMapLinearFilter;
		tex.magFilter = THREE.LinearFilter;
		if (renderer && renderer.capabilities && renderer.capabilities.getMaxAnisotropy) {
			tex.anisotropy = renderer.capabilities.getMaxAnisotropy();
		}
		tex.encoding = THREE.sRGBEncoding;

		// use a PBR material for better lighting; allow transparency from SVG alpha
		const mat = new THREE.MeshStandardMaterial({
			map: tex,
			transparent: true,
			alphaTest: 0.02,
			metalness: 0.1,
			roughness: 0.6,
			side: THREE.DoubleSide
		});
		mesh.material = mat;
	}, undefined, () => {
		// on error, try fallback PNG
		textureLoader.load(rocketFallback, (tex2) => {
			tex2.anisotropy = renderer.capabilities ? renderer.capabilities.getMaxAnisotropy() : 1;
			tex2.encoding = THREE.sRGBEncoding;
			mesh.material = new THREE.MeshStandardMaterial({ map: tex2, transparent:true, alphaTest:0.02 });
		});
	});
}

// add a subtle glow sprite behind the rocket using rocket-glow.png
function addRocketGlow(scene, position, scale = 1) {
	textureLoader.load('assets/rocket/rocket-glow.png', (glowTex) => {
		glowTex.minFilter = THREE.LinearFilter;
		glowTex.magFilter = THREE.LinearFilter;
		const spriteMat = new THREE.SpriteMaterial({
			map: glowTex,
			color: 0xffffff,
			transparent: true,
			opacity: 0.9,
			depthWrite: false,
			blending: THREE.AdditiveBlending
		});
		const sprite = new THREE.Sprite(spriteMat);
		sprite.position.copy(position);
		sprite.scale.set(120 * scale, 120 * scale, 1); // adjust to match rocket size
		scene.add(sprite);
	});
}

// Example usage (where rocketMesh, renderer and scene are defined in existing code):
// applyRocketTextureToMesh(rocketMesh, renderer);
// addRocketGlow(scene, rocketMesh.position, 1.0);