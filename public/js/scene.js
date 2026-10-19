// Renderer, Himmel, Licht, Schleim und Deko-Wolken.
import * as THREE from 'three';

export function createScene(canvas) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  renderer.outputColorSpace = THREE.SRGBColorSpace;

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 900);
  camera.position.set(0, 6, -10);

  const hemi = new THREE.HemisphereLight('#e8f4ff', '#ffc2e0', 1.4);
  scene.add(hemi);
  const sun = new THREE.DirectionalLight('#fff4e0', 2.2);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  const sc = sun.shadow.camera;
  sc.left = -40; sc.right = 40; sc.top = 40; sc.bottom = -40; sc.near = 1; sc.far = 160;
  sun.shadow.bias = -0.0005;
  sun.shadow.normalBias = 0.03;
  scene.add(sun);
  scene.add(sun.target);

  // Himmel als Farbverlauf
  const skyUniforms = { top: { value: new THREE.Color('#6ec8ff') }, bottom: { value: new THREE.Color('#ffe3f5') } };
  const sky = new THREE.Mesh(
    new THREE.SphereGeometry(500, 32, 16),
    new THREE.ShaderMaterial({
      side: THREE.BackSide, depthWrite: false, uniforms: skyUniforms,
      vertexShader: 'varying vec3 vP; void main(){ vP = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
      fragmentShader: 'uniform vec3 top; uniform vec3 bottom; varying vec3 vP; void main(){ float h = clamp(vP.y*0.5+0.5,0.0,1.0); gl_FragColor = vec4(mix(bottom, top, smoothstep(0.35,0.95,h)),1.0); }',
    }),
  );
  sky.renderOrder = -1;
  scene.add(sky);
  scene.fog = new THREE.Fog('#ffe3f5', 120, 420);

  // Schleim
  const slimeUniforms = { time: { value: 0 }, color: { value: new THREE.Color('#ff6fcf') } };
  const slimeGeo = new THREE.PlaneGeometry(900, 900, 120, 120);
  slimeGeo.rotateX(-Math.PI / 2);
  const slimeMat = new THREE.MeshStandardMaterial({ color: '#ff6fcf', roughness: 0.15, metalness: 0.1, emissive: '#ff6fcf', emissiveIntensity: 0.25 });
  slimeMat.onBeforeCompile = (sh) => {
    sh.uniforms.time = slimeUniforms.time;
    sh.vertexShader = 'uniform float time;\n' + sh.vertexShader.replace(
      '#include <begin_vertex>',
      `#include <begin_vertex>
       transformed.y += sin(position.x*0.15 + time*1.3)*0.35 + cos(position.z*0.12 + time*1.1)*0.35;`,
    );
  };
  const slime = new THREE.Mesh(slimeGeo, slimeMat);
  slime.position.y = -8;
  slime.receiveShadow = true;
  scene.add(slime);

  // Wolken und schwebende Inseln (nur Deko)
  const deco = new THREE.Group();
  const cloudMat = new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 1, emissive: '#ffffff', emissiveIntensity: 0.25 });
  const ball = new THREE.SphereGeometry(1, 14, 10);
  for (let i = 0; i < 26; i++) {
    const c = new THREE.Group();
    const n = 3 + Math.floor(Math.random() * 4);
    for (let k = 0; k < n; k++) {
      const s = new THREE.Mesh(ball, cloudMat);
      const r = 3 + Math.random() * 4;
      s.scale.set(r, r * 0.7, r);
      s.position.set(k * 4 - n * 2 + Math.random() * 2, Math.random() * 2, Math.random() * 3);
      c.add(s);
    }
    const a = Math.random() * Math.PI * 2, d = 140 + Math.random() * 180;
    c.position.set(Math.cos(a) * d, 20 + Math.random() * 60, Math.sin(a) * d + 80);
    c.userData.speed = 0.5 + Math.random();
    deco.add(c);
  }
  const isleCols = ['#ffd1ec', '#c9f1ff', '#fff1b8', '#d9cbff'];
  for (let i = 0; i < 14; i++) {
    const g = new THREE.Group();
    const r = 4 + Math.random() * 8;
    const top = new THREE.Mesh(new THREE.CylinderGeometry(r, r * 0.6, 2, 7), new THREE.MeshStandardMaterial({ color: isleCols[i % 4], roughness: 0.6 }));
    const bot = new THREE.Mesh(new THREE.ConeGeometry(r * 0.6, r * 1.4, 7), new THREE.MeshStandardMaterial({ color: '#b48ad6', roughness: 0.8 }));
    bot.rotation.x = Math.PI;
    bot.position.y = -1 - r * 0.7;
    g.add(top, bot);
    const a = Math.random() * Math.PI * 2, d = 70 + Math.random() * 120;
    g.position.set(Math.cos(a) * d, -4 + Math.random() * 25, Math.sin(a) * d + 90);
    g.userData.bob = Math.random() * 6;
    deco.add(g);
  }
  scene.add(deco);

  function setTheme(meta) {
    skyUniforms.top.value.set(meta.sky?.[0] || '#6ec8ff');
    skyUniforms.bottom.value.set(meta.sky?.[1] || '#ffe3f5');
    scene.fog.color.set(meta.sky?.[1] || '#ffe3f5');
    slimeMat.color.set(meta.slime || '#ff6fcf');
    slimeMat.emissive.set(meta.slime || '#ff6fcf');
    slime.position.y = meta.slimeY ?? -8;
  }

  function onResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  }
  window.addEventListener('resize', onResize);

  function tick(time, focus) {
    slimeUniforms.time.value = time;
    for (const c of deco.children) {
      if (c.userData.speed) { c.position.x += c.userData.speed * 0.01; if (c.position.x > 320) c.position.x = -320; }
      if (c.userData.bob !== undefined) c.position.y += Math.sin(time * 0.5 + c.userData.bob) * 0.005;
    }
    sun.position.set(focus.x + 25, focus.y + 50, focus.z - 20);
    sun.target.position.set(focus.x, focus.y, focus.z);
    sky.position.copy(camera.position);
  }

  return { renderer, scene, camera, setTheme, tick, sun };
}
