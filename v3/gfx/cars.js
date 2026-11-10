// PAALAAN! 3.0 – autot (vaiheen 1 paikanpitäjä; oikeat mallit tulevat vaiheessa 3)
import * as THREE from 'three';
export function buildCar(spec) {
  const g = new THREE.Group();
  const m = new THREE.MeshPhysicalMaterial({ color: spec.c || '#888', metalness: 0.6, roughness: 0.4, clearcoat: 1, clearcoatRoughness: 0.05 });
  const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.62, 3.0, 6, 14), m);
  body.rotation.x = Math.PI / 2; body.scale.set(1.45, 1, 1); body.position.y = 0.75; body.castShadow = true;
  g.add(body);
  return { group: g, update() {} };
}
