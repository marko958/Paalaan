// PAALAAN! 3.0 – jälkikäsittely tietokoneella: bloom valoille, GTAO (ympäristövarjostus) ja vauhdin liike-epäterävyys.
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { GTAOPass } from 'three/addons/postprocessing/GTAOPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';

// Säteittäinen sumennus pakopisteestä: reunat venyvät vauhdissa, ruudun keskiosa (auto) pysyy terävänä.
const SpeedBlur = {
  uniforms: { tDiffuse: { value: null }, uAmount: { value: 0 }, uCenter: { value: new THREE.Vector2(0.5, 0.56) } },
  vertexShader: 'varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
  fragmentShader: `uniform sampler2D tDiffuse; uniform float uAmount; uniform vec2 uCenter; varying vec2 vUv;
    void main() {
      vec2 d = vUv - uCenter; float r = length(d * vec2(1.0, 1.25));
      float k = uAmount * smoothstep(0.24, 0.75, r);
      vec4 c = vec4(0.0);
      for (int i = 0; i < 8; i++) c += texture2D(tDiffuse, vUv - d * k * (float(i) / 8.0));
      gl_FragColor = c / 8.0;
    }`,
};

export class Post {
  constructor(renderer, scene, camera) {
    this.renderer = renderer; this.scene = scene; this.camera = camera; this.composer = null; this.key = '';
  }
  // Q: laatutaso. Palauttaa false, jos jälkikäsittely ei ole käytössä (piirretään suoraan).
  setup(Q, w, h, dpr) {
    const key = [Q.post, Q.bloom, Q.ao, Q.blur, Q.msaa, w, h, dpr].join(':');
    if (key === this.key) return !!this.composer;
    this.key = key;
    if (this.composer) { this.composer.renderTarget1.dispose(); this.composer.renderTarget2.dispose(); this.composer = null; }
    if (!Q.post) return false;
    const rt = new THREE.WebGLRenderTarget(w * dpr, h * dpr, { type: THREE.HalfFloatType, samples: Q.msaa });
    const c = this.composer = new EffectComposer(this.renderer, rt);
    c.setPixelRatio(dpr); c.setSize(w, h);
    c.addPass(new RenderPass(this.scene, this.camera));
    this.ao = null; this.bloom = null; this.blur = null;
    if (Q.ao) { this.ao = new GTAOPass(this.scene, this.camera, w, h); this.ao.updateGtaoMaterial({ radius: 0.6, distanceExponent: 1.2, thickness: 1.2, scale: 1.1, samples: 12 }); this.ao.blendIntensity = 0.85; c.addPass(this.ao); }
    if (Q.bloom) { this.bloom = new UnrealBloomPass(new THREE.Vector2(w, h), 0.32, 0.55, 0.92); c.addPass(this.bloom); }
    if (Q.blur) { this.blur = new ShaderPass(SpeedBlur); c.addPass(this.blur); }
    c.addPass(new OutputPass());
    return true;
  }
  render(speed, night) {
    if (!this.composer) return false;
    if (this.bloom) { this.bloom.strength = 0.26 + night * 0.4; this.bloom.threshold = 0.95 - night * 0.25; }
    if (this.blur) this.blur.uniforms.uAmount.value = Math.min(0.085, Math.max(0, speed - 14) * 0.0022);
    this.composer.render();
    return true;
  }
}
