// PAALAAN! 3.0 – sää ja hiukkaset: lumi- ja vesisade kameran ympärillä, pöllyävä lumi, pakokaasun höyry, vian savu ja pöly.
import * as THREE from 'three';
import { canvasTex } from './assets.js';

// Sade ja lumisade: pisteet täyttävät laatikon kameran ympärillä ja kiertävät sen reunojen yli, joten niitä riittää loputtomiin.
export class Weather {
  constructor(scene) {
    this.scene = scene; this.kind = ''; this.count = 0; this.points = null; this.t = 0;
    this.uni = { uTime: { value: 0 }, uCam: { value: new THREE.Vector3() }, uBox: { value: new THREE.Vector3(36, 18, 36) }, uFall: { value: 9 }, uSway: { value: 0 }, uSize: { value: 1 }, uTex: { value: null }, uCol: { value: new THREE.Color(1, 1, 1) }, uAlpha: { value: 0.6 }, uStretch: { value: 1 } };
    this.flake = canvasTex(32, 32, (g, W) => { const gr = g.createRadialGradient(16, 16, 0, 16, 16, 16); gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.5, 'rgba(255,255,255,0.6)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.fillRect(0, 0, W, W); }, { clamp: true });
    this.drop = canvasTex(8, 64, (g, W, H) => { const gr = g.createLinearGradient(0, 0, 0, H); gr.addColorStop(0, 'rgba(255,255,255,0)'); gr.addColorStop(0.7, 'rgba(255,255,255,0.9)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.fillRect(2, 0, 4, H); }, { clamp: true });
    this.mat = new THREE.ShaderMaterial({ uniforms: this.uni, transparent: true, depthWrite: false, fog: false,
      vertexShader: `uniform float uTime, uFall, uSway, uSize, uStretch; uniform vec3 uCam, uBox; varying float vA;
        void main() {
          vec3 p = position * uBox;
          p.y -= uTime * uFall * (0.7 + 0.6 * fract(position.x * 37.0));
          p.x += sin(uTime * 0.9 + position.z * 40.0) * uSway; p.z += cos(uTime * 0.7 + position.x * 31.0) * uSway;
          p = mod(p - uCam, uBox) - uBox * 0.5;
          vec4 mv = viewMatrix * vec4(p + uCam, 1.0);
          gl_Position = projectionMatrix * mv;
          gl_PointSize = -mv.z < 2.5 ? 0.0 : min(110.0, uSize * uStretch * (700.0 / -mv.z)); // aivan kameran edessä olevia ei piirretä (ylipiirto)
          vA = smoothstep(uBox.x * 0.5, uBox.x * 0.3, length(p.xz)) * smoothstep(0.4, 2.0, -mv.z);
        }`,
      fragmentShader: `uniform sampler2D uTex; uniform vec3 uCol; uniform float uAlpha, uStretch; varying float vA;
        void main() { vec2 uv = gl_PointCoord; uv.x = (uv.x - 0.5) * uStretch + 0.5; if (uv.x < 0.0 || uv.x > 1.0) discard;
          float a = texture2D(uTex, uv).a * vA * uAlpha; if (a < 0.01) discard; gl_FragColor = vec4(uCol, a);
          #include <tonemapping_fragment>
          #include <colorspace_fragment>
        }` });
  }
  set(kind, density, night) {
    const n = kind ? Math.round((kind === 'lumi' ? 5200 : 3000) * density) : 0;
    if (kind !== this.kind || n !== this.count) {
      if (this.points) { this.scene.remove(this.points); this.points.geometry.dispose(); this.points = null; }
      this.kind = kind; this.count = n;
      if (n) {
        const pos = new Float32Array(n * 3); for (let i = 0; i < pos.length; i++) pos[i] = Math.random();
        const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
        this.points = new THREE.Points(g, this.mat); this.points.frustumCulled = false; this.points.renderOrder = 5; this.scene.add(this.points);
      }
    }
    const u = this.uni, snow = kind === 'lumi';
    u.uTex.value = snow ? this.flake : this.drop; u.uFall.value = snow ? 1.5 : 11; u.uSway.value = snow ? 0.5 : 0.03; u.uSize.value = snow ? 0.05 : 0.028; u.uStretch.value = snow ? 1 : 26;
    u.uAlpha.value = snow ? 0.9 : 0.5; const b = night > 0.6 ? 0.55 : night > 0 ? 0.75 : 1; u.uCol.value.setRGB(snow ? b : 0.75 * b, snow ? b : 0.8 * b, snow ? b : 0.9 * b);
  }
  update(dt, camera) { this.t += dt; this.uni.uTime.value = this.t; this.uni.uCam.value.copy(camera.position); }
}

// Pöly, höyry ja savu: pieni hiukkasallas, jota päivitetään suorittimella
export class Puffs {
  constructor(scene, max = 220) {
    this.max = max; this.n = 0; this.p = [];
    this.pos = new Float32Array(max * 3); this.aux = new Float32Array(max * 4); // r, g, b, alpha
    this.size = new Float32Array(max);
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(this.pos, 3)); g.setAttribute('aCol', new THREE.BufferAttribute(this.aux, 4)); g.setAttribute('aSize', new THREE.BufferAttribute(this.size, 1));
    const tex = canvasTex(64, 64, (c, W) => { const gr = c.createRadialGradient(32, 32, 0, 32, 32, 32); gr.addColorStop(0, 'rgba(255,255,255,0.9)'); gr.addColorStop(0.6, 'rgba(255,255,255,0.35)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); c.fillStyle = gr; c.fillRect(0, 0, W, W); }, { clamp: true });
    this.mat = new THREE.ShaderMaterial({ uniforms: { uTex: { value: tex } }, transparent: true, depthWrite: false, fog: false,
      vertexShader: `attribute vec4 aCol; attribute float aSize; varying vec4 vC;
        void main() { vC = aCol; vec4 mv = modelViewMatrix * vec4(position, 1.0); vC.a *= smoothstep(2.0, 5.0, -mv.z); gl_Position = projectionMatrix * mv; gl_PointSize = min(260.0, aSize * (420.0 / max(1.0, -mv.z))); }`,
      fragmentShader: `uniform sampler2D uTex; varying vec4 vC;
        void main() { float a = texture2D(uTex, gl_PointCoord).a * vC.a; if (a < 0.01) discard; gl_FragColor = vec4(vC.rgb, a);
          #include <tonemapping_fragment>
          #include <colorspace_fragment>
        }` });
    this.points = new THREE.Points(g, this.mat); this.points.frustumCulled = false; this.points.renderOrder = 4;
    g.setDrawRange(0, 0); scene.add(this.points);
  }
  // col = [r, g, b], a = alku-alfa, life sekunteina, grow = koon kasvu per sekunti
  emit(x, y, z, vx, vy, vz, size, col, a, life, grow) {
    if (this.p.length >= this.max) this.p.shift();
    this.p.push({ x, y, z, vx, vy, vz, size, col, a, life, t: 0, grow });
  }
  shift(dx, dy, dz) { for (const q of this.p) { q.x += dx; q.y += dy; q.z += dz; } }
  update(dt) {
    const P = this.p;
    for (let i = P.length - 1; i >= 0; i--) { const q = P[i]; q.t += dt; if (q.t >= q.life) { P.splice(i, 1); continue; } q.x += q.vx * dt; q.y += q.vy * dt; q.z += q.vz * dt; q.vx *= 1 - dt * 1.5; q.vz *= 1 - dt * 1.5; q.size += q.grow * dt; }
    for (let i = 0; i < P.length; i++) { const q = P[i], k = 1 - q.t / q.life;
      this.pos[i * 3] = q.x; this.pos[i * 3 + 1] = q.y; this.pos[i * 3 + 2] = q.z; this.size[i] = q.size;
      this.aux[i * 4] = q.col[0]; this.aux[i * 4 + 1] = q.col[1]; this.aux[i * 4 + 2] = q.col[2]; this.aux[i * 4 + 3] = q.a * k * Math.min(1, q.t * 8); }
    const g = this.points.geometry; g.attributes.position.needsUpdate = true; g.attributes.aCol.needsUpdate = true; g.attributes.aSize.needsUpdate = true; g.setDrawRange(0, P.length);
  }
}
