// PAALAAN! 3.0 – resurssit: tekstuurit ja taivaat ladataan vain omasta assets-kansiosta (ks. assets/LISENSSIT.md).
import * as THREE from 'three';
import { RGBELoader } from 'three/addons/loaders/RGBELoader.js';

const BASE = new URL('../assets/', import.meta.url).href;
const loader = new THREE.TextureLoader();
const cache = new Map();
let small = false, aniso = 4, pending = 0;
export let manifest = null;

export async function loadManifest() {
  const r = await fetch(BASE + 'manifest.json');
  if (!r.ok) throw new Error('manifest ' + r.status);
  manifest = await r.json();
  return manifest;
}
export const busy = () => pending > 0;
export const avgColor = name => new THREE.Color().fromArray(manifest.tex[name].avg);

function src(key) { return BASE + key + (small ? '_s' : '') + '.webp'; }
function fill(t, key) {
  pending++;
  const size = small;
  loader.load(src(key), img => {
    pending--;
    if (size !== small) return fill(t, key); // laatutaso vaihtui kesken latauksen
    t.image = img.image; t.needsUpdate = true;
  }, undefined, () => { pending--; console.warn('tekstuuri puuttuu: ' + key); });
}
// name = manifestin nimi (esim. 'asfaltti'), map = 'diff' | 'nor' | 'rough'
export function tex(name, map = 'diff', rep = 1) {
  const id = name + ':' + map + ':' + rep;
  if (cache.has(id)) return cache.get(id).t;
  const key = manifest.tex[name][map];
  const t = new THREE.Texture();
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(rep, rep);
  t.anisotropy = aniso;
  t.colorSpace = map === 'diff' ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  cache.set(id, { t, key });
  fill(t, key);
  return t;
}
// puhelimen laatutasolla puolta pienemmät tekstuurit
export function setTextureQuality(isSmall, anisotropy) {
  aniso = anisotropy;
  for (const { t } of cache.values()) { if (t.anisotropy !== aniso) { t.anisotropy = aniso; t.needsUpdate = true; } }
  if (isSmall === small) return;
  small = isSmall;
  for (const { t, key } of cache.values()) fill(t, key);
  for (const s of skies.values()) if (s.bg) fillSky(s);
}

// ---------- taivaat ----------
const skies = new Map();
let pmrem = null;
export function initSky(renderer) { pmrem = new THREE.PMREMGenerator(renderer); pmrem.compileEquirectangularShader(); }
function fillSky(s) {
  pending++;
  loader.load(BASE + s.info.img + (small ? '_s' : '') + '.webp', img => { pending--; s.bg.image = img.image; s.bg.needsUpdate = true; s.bgReady = true; }, undefined, () => { pending--; });
}
// palauttaa { info, bg, env, ready }; lataus käynnistyy ensimmäisellä kutsulla
export function sky(name, envScale = 1) {
  let s = skies.get(name);
  if (s) return s;
  s = { name, info: manifest.sky[name], bg: new THREE.Texture(), env: null, bgReady: false, get ready() { return this.bgReady && !!this.env; } };
  s.bg.wrapS = THREE.RepeatWrapping; s.bg.wrapT = THREE.ClampToEdgeWrapping;
  s.bg.colorSpace = THREE.NoColorSpace; // gamma puretaan varjostimessa (kuva on pakattu alueelle 0..M)
  s.bg.minFilter = THREE.LinearFilter; s.bg.generateMipmaps = false;
  skies.set(name, s);
  fillSky(s);
  pending++;
  new RGBELoader().setDataType(THREE.FloatType).load(BASE + s.info.env, hdr => {
    pending--;
    hdr.mapping = THREE.EquirectangularReflectionMapping;
    // ympäristövalon voimakkuus leivotaan karttaan (three r160:ssa ei ole scene.environmentIntensity-asetusta)
    const d = hdr.image.data; for (let i = 0; i < d.length; i++) d[i] *= envScale;
    s.env = pmrem.fromEquirectangular(hdr).texture;
    hdr.dispose();
  }, undefined, () => { pending--; });
  return s;
}

// ---------- koodissa piirretyt tekstuurit ----------
export function canvasTex(w, h, draw, opt = {}) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = opt.data ? THREE.NoColorSpace : THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = opt.clamp ? THREE.ClampToEdgeWrapping : THREE.RepeatWrapping;
  t.anisotropy = opt.aniso || 4;
  return t;
}
// toistettava satunnaisluku (mulberry32)
export function rng(seed) {
  let a = seed >>> 0;
  return () => { a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), a | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
export const hash = n => { n = (n ^ 61) ^ (n >>> 16); n = n + (n << 3); n = n ^ (n >>> 4); n = Math.imul(n, 0x27d4eb2d); n = n ^ (n >>> 15); return (n >>> 0) / 4294967296; };
export const hash2 = (a, b) => hash(Math.imul(a | 0, 73856093) ^ Math.imul(b | 0, 19349663));
