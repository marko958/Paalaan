// PAALAAN! 3.0 – äänet (kopio 2.0:n alpha 30:stä, vain tallennusavain on eri). SID-henkisiä piippauksia WebAudiolla: kanttiaaltoa, sahaa ja kohinaa.
// Ääni käynnistyy vasta ensimmäisestä napautuksesta tai näppäimestä (selaimet vaativat sen). Asetus muistetaan selaimessa.
'use strict';

const Snd = (() => {
  const KEY = 'paalaan3.snd';
  let on = true;
  try { on = localStorage.getItem(KEY) !== '0'; } catch (e) {}
  let ac = null, master = null, eng = null;

  function ctx() {
    if (ac) return ac;
    const A = window.AudioContext || window.webkitAudioContext;
    if (!A) return null;
    try { ac = new A(); } catch (e) { return null; }
    master = ac.createGain(); master.gain.value = 0.5; master.connect(ac.destination);
    return ac;
  }
  const wake = () => { if (!on) return; const a = ctx(); if (a && a.state === 'suspended') a.resume().catch(() => {}); };
  if (typeof document !== 'undefined') { document.addEventListener('pointerdown', wake, true); document.addEventListener('keydown', wake, true); }

  // yksi nuotti: aaltomuoto, taajuus (tai [alku, loppu]), kesto, voimakkuus, viive
  function tone(type, f, dur, vol, delay) {
    const a = ac; if (!a || !on) return;
    const t = a.currentTime + (delay || 0), o = a.createOscillator(), gn = a.createGain();
    o.type = type;
    if (Array.isArray(f)) { o.frequency.setValueAtTime(f[0], t); o.frequency.exponentialRampToValueAtTime(Math.max(20, f[1]), t + dur); }
    else o.frequency.setValueAtTime(f, t);
    gn.gain.setValueAtTime(0.0001, t); gn.gain.exponentialRampToValueAtTime(vol, t + 0.008); gn.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(gn); gn.connect(master); o.start(t); o.stop(t + dur + 0.02);
  }
  function noise(dur, vol, cut, delay) {
    const a = ac; if (!a || !on) return;
    const t = a.currentTime + (delay || 0), n = Math.floor(a.sampleRate * dur), b = a.createBuffer(1, n, a.sampleRate), d = b.getChannelData(0);
    for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / n);
    const s = a.createBufferSource(), fl = a.createBiquadFilter(), gn = a.createGain();
    s.buffer = b; fl.type = 'lowpass'; fl.frequency.value = cut || 1800; gn.gain.value = vol;
    s.connect(fl); fl.connect(gn); gn.connect(master); s.start(t);
  }

  const FX = {
    click: () => tone('square', 1400, 0.025, 0.04),
    cash:  () => { tone('square', 1046, 0.07, 0.07); tone('square', 1568, 0.16, 0.07, 0.07); },          // kassakone
    coin:  () => { tone('square', 988, 0.06, 0.06); tone('square', 1319, 0.14, 0.06, 0.06); },
    plus:  () => tone('triangle', [600, 900], 0.1, 0.08),
    minus: () => tone('triangle', [500, 260], 0.16, 0.08),
    quick: () => { tone('square', 880, 0.05, 0.06); tone('square', 880, 0.05, 0.06, 0.09); },
    deer:  () => { tone('square', 1760, 0.06, 0.06); tone('square', 1760, 0.06, 0.06, 0.1); tone('square', 1760, 0.06, 0.06, 0.2); }, // peuravaroitus
    flash: () => { tone('sawtooth', [2400, 300], 0.25, 0.06); noise(0.08, 0.15, 6000); },               // nopeuskamera
    thump: () => { tone('square', [140, 50], 0.18, 0.18); noise(0.12, 0.25, 600); },                     // kuoppa
    crash: () => { noise(0.6, 0.5, 2200); tone('sawtooth', [300, 40], 0.5, 0.15); },
    ice:   () => tone('sine', [1200, 2400], 0.3, 0.04),
    win:   () => [523, 659, 784, 1046, 784, 1046].forEach((f, i) => tone('square', f, 0.14, 0.07, i * 0.12)),
    jail:  () => { [392, 349, 311, 262].forEach((f, i) => tone('square', f, 0.3, 0.08, i * 0.28)); noise(0.3, 0.4, 900, 1.2); }, // sellin ovi
  };
  function play(k) { if (!on || !FX[k]) return; if (!ctx()) return; FX[k](); }

  // moottorin ääni: polttomoottori saha + alipäästö, sähköauto hiljainen vingahdus
  function engine(kmh, ev, running) {
    if (!on || !ac || !running) { if (eng) { eng.g.gain.setTargetAtTime(0, ac.currentTime, 0.05); } return; }
    if (!eng) {
      const o = ac.createOscillator(), f = ac.createBiquadFilter(), g = ac.createGain();
      f.type = 'lowpass'; f.frequency.value = 500; g.gain.value = 0;
      o.connect(f); f.connect(g); g.connect(master); o.start();
      eng = { o, f, g, ev: null };
    }
    const t = ac.currentTime;
    if (eng.ev !== ev) { eng.ev = ev; eng.o.type = ev ? 'sine' : 'sawtooth'; }
    // polttomoottorilla "vaihteet": kierrokset nousevat ja putoavat 40 km/h:n välein
    const rpm = ev ? 180 + kmh * 5 : 38 + (kmh % 40) * 1.6 + Math.min(kmh, 160) * 0.35;
    eng.o.frequency.setTargetAtTime(rpm, t, 0.08);
    eng.f.frequency.setTargetAtTime(ev ? 2000 : 300 + kmh * 3, t, 0.1);
    eng.g.gain.setTargetAtTime(ev ? (kmh > 2 ? 0.012 : 0) : 0.035, t, 0.1);
  }

  function toggle() {
    on = !on;
    try { localStorage.setItem(KEY, on ? '1' : '0'); } catch (e) {}
    if (on) { wake(); play('plus'); } else if (eng && ac) eng.g.gain.setTargetAtTime(0, ac.currentTime, 0.02);
    return on;
  }
  return { play, engine, toggle, get on() { return on; } };
})();
