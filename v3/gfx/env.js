// PAALAAN! 3.0 – taivas, aurinko, ympäristövalo ja sumu. Vuorokaudenaika seuraa kuukautta kuten 2.0:n season().
import * as THREE from 'three';
import { sky as loadSky } from './assets.js';

// taivaskohtaiset valotukset: sun = suoran valon voimakkuus, env = ympäristövalon kerroin, bg = taustan valotus
const SKY = {
  kesa:   { sun: 3.4, env: 1.15, bg: 1.0, fog: 0.00055, sunCol: [1.0, 0.95, 0.86] },
  pilvi:  { sun: 0.35, env: 0.62, bg: 0.62, fog: 0.0016, sunCol: [1.0, 0.97, 0.94] },
  hamara: { sun: 0.55, env: 0.42, bg: 0.50, fog: 0.0012, sunCol: [1.0, 0.62, 0.45] },
  yo:     { sun: 0.30, env: 0.40, bg: 0.30, fog: 0.0014, sunCol: [0.62, 0.74, 1.0] },
  talvi:  { sun: 1.5, env: 0.95, bg: 0.95, fog: 0.0010, sunCol: [1.0, 0.93, 0.82] },
};
const ROT = 2.2; // taivaan kierto: aurinko sivulle ja hieman eteen, jotta varjot piirtyvät tielle

export class Env {
  constructor(scene, camera) {
    this.scene = scene; this.camera = camera;
    this.name = ''; this.cur = null; this.want = null;
    this.fogColor = new THREE.Color(0.6, 0.65, 0.75);
    scene.fog = new THREE.FogExp2(this.fogColor.getHex(), 0.001);
    this.sun = new THREE.DirectionalLight(0xffffff, 3);
    this.sun.castShadow = true;
    this.sun.shadow.bias = -0.0004; this.sun.shadow.normalBias = 0.05;
    scene.add(this.sun, this.sun.target);
    this.sunDir = new THREE.Vector3(0.4, 0.8, 0.4);
    this.night = 0; // 0 = päivä, 1 = kaamos
    this.uni = {
      tSky: { value: null }, uM: { value: 1 }, uRows: { value: 0.5625 }, uExp: { value: 1 }, uRot: { value: ROT },
      uFog: { value: new THREE.Color() }, uSun: { value: new THREE.Vector3() }, uSunCol: { value: new THREE.Color(1, 1, 1) }, uGlow: { value: 0 },
    };
    const mat = new THREE.ShaderMaterial({
      uniforms: this.uni, side: THREE.BackSide, depthWrite: false, depthTest: false, fog: false,
      vertexShader: `varying vec3 vDir;
        void main() { vDir = position; vec4 p = projectionMatrix * vec4(mat3(viewMatrix) * position, 1.0); gl_Position = p.xyww; }`,
      fragmentShader: `uniform sampler2D tSky; uniform float uM, uRows, uExp, uRot, uGlow; uniform vec3 uFog, uSun, uSunCol; varying vec3 vDir;
        void main() {
          vec3 d = normalize(vDir);
          float el = asin(clamp(d.y, -1.0, 1.0)), az = atan(d.x, -d.z) + uRot;
          vec2 uv = vec2(az / 6.28318530718 + 0.5, 1.0 - clamp((1.5707963 - el) / 3.14159265 / uRows, 0.0, 1.0));
          vec3 c = pow(texture2D(tSky, uv).rgb, vec3(2.2)) * uM * uExp;
          float s = max(dot(d, uSun), 0.0);
          c += uSunCol * uGlow * (pow(s, 900.0) * 40.0 + pow(s, 60.0) * 0.35);
          c = mix(uFog, c, smoothstep(-0.01, 0.085, d.y));
          gl_FragColor = vec4(c, 1.0);
          #include <tonemapping_fragment>
          #include <colorspace_fragment>
        }`,
    });
    this.dome = new THREE.Mesh(new THREE.SphereGeometry(1, 40, 20), mat);
    this.dome.frustumCulled = false; this.dome.renderOrder = -10;
    scene.add(this.dome);
  }
  // sea = season(), wx = weather(); palauttaa taivaan nimen
  pick(sea, wx, foggy) {
    if (sea.dark > 0.6) return 'yo';
    if (sea.dark > 0) return 'hamara';
    if (wx.kind || foggy) return 'pilvi';
    return sea.snow ? 'talvi' : 'kesa';
  }
  set(name) {
    if (name === this.name) return;
    this.name = name; this.want = loadSky(name, SKY[name].env);
  }
  ready() { return !!this.cur || (this.want && this.want.ready); }
  setShadow(size, range) {
    const s = this.sun;
    s.castShadow = size > 0;
    if (!size) return;
    if (s.shadow.mapSize.x !== size) { s.shadow.mapSize.set(size, size); if (s.shadow.map) { s.shadow.map.dispose(); s.shadow.map = null; } }
    const c = s.shadow.camera; c.left = -range; c.right = range; c.top = range; c.bottom = -range; c.near = 10; c.far = 400; c.updateProjectionMatrix();
    this.range = range; this.size = size;
  }
  // fogMul = sään vaikutus sumuun; focus = pelaajan auto
  update(focus, fogMul) {
    if (this.want && this.want.ready && this.cur !== this.want) {
      const s = this.cur = this.want, P = SKY[s.name], I = s.info;
      this.scene.environment = s.env;
      this.uni.tSky.value = s.bg; this.uni.uM.value = I.M; this.uni.uRows.value = I.rows; this.uni.uExp.value = P.bg;
      const az = I.sunAz - ROT, el = Math.max(0.16, I.sunEl);
      this.sunDir.set(Math.sin(az) * Math.cos(el), Math.sin(el), -Math.cos(az) * Math.cos(el));
      this.uni.uSun.value.set(Math.sin(az) * Math.cos(I.sunEl), Math.sin(I.sunEl), -Math.cos(az) * Math.cos(I.sunEl));
      this.uni.uSunCol.value.setRGB(...P.sunCol); this.uni.uGlow.value = s.name === 'kesa' ? 1 : 0;
      this.sun.color.setRGB(...P.sunCol); this.sun.intensity = P.sun;
      this.fogColor.setRGB(I.horizon[0] * P.bg, I.horizon[1] * P.bg, I.horizon[2] * P.bg);
      this.night = s.name === 'yo' ? 1 : s.name === 'hamara' ? 0.45 : 0;
      this.baseFog = P.fog;
    }
    if (!this.cur) return;
    this.scene.fog.color.copy(this.fogColor); this.uni.uFog.value.copy(this.fogColor);
    this.scene.fog.density = this.baseFog * fogMul;
    // varjokartta seuraa autoa; kohde pyöristetään tekselin tarkkuuteen, jotta varjon reuna ei väreile
    const t = this.sun.target.position;
    if (this.size) { const q = (this.range * 2) / this.size * 4; t.set(Math.round(focus.x / q) * q, Math.round(focus.y / q) * q, Math.round(focus.z / q) * q); }
    else t.copy(focus);
    this.sun.position.copy(t).addScaledVector(this.sunDir, 180);
    this.dome.position.copy(this.camera.position);
    this.dome.scale.setScalar(this.camera.far * 0.9);
  }
}
