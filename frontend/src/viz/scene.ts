import * as THREE from "three";

export function createViz(canvas: HTMLCanvasElement) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  const scene = new THREE.Scene();

  const camera = new THREE.PerspectiveCamera(60, 1, 0.1, 100);
  camera.position.set(0, 1.2, 3.2);

  const light = new THREE.DirectionalLight(0xffffff, 1.2);
  light.position.set(2, 2, 2);
  scene.add(light);
  scene.add(new THREE.AmbientLight(0xffffff, 0.25));

  const geo = new THREE.IcosahedronGeometry(1, 5);
  const mat = new THREE.MeshStandardMaterial({ metalness: 0.25, roughness: 0.25 });
  const orb = new THREE.Mesh(geo, mat);
  scene.add(orb);

  const clock = new THREE.Clock();

  function resize() {
    const w = canvas.clientWidth;
    const h = canvas.clientHeight;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }

  function render(energy: { bass: number; mids: number; highs: number }) {
    resize();
    const t = clock.getElapsedTime();

    const e = (energy.bass + energy.mids + energy.highs) / 3;
    orb.rotation.y = t * (0.35 + e * 1.2);
    orb.rotation.x = t * (0.18 + energy.highs * 0.9);

    const pulse = 1 + energy.bass * 0.35 + energy.mids * 0.15;
    orb.scale.setScalar(pulse);

    renderer.render(scene, camera);
  }

  return { render };
}
