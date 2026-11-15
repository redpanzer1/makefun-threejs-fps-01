// Every sound is synthesized with WebAudio: no audio files, no network.
// A gunshot is a noise burst through a lowpass plus a short square thump; the
// rest are small blips and clicks scheduled on the same clock. The context is
// created on the first user gesture, so autoplay rules never block it.
export function createAudio() {
  let ctx = null;
  let master = null;
  let noiseBuf = null;

  function ensure() {
    if (!ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = 0.42;
      master.connect(ctx.destination);
      const len = Math.floor(ctx.sampleRate * 0.5);
      noiseBuf = ctx.createBuffer(1, len, ctx.sampleRate);
      const data = noiseBuf.getChannelData(0);
      for (let i = 0; i < len; i += 1) data[i] = Math.random() * 2 - 1;
    }
    if (ctx.state === 'suspended') void ctx.resume();
    return ctx;
  }

  function tone(freq, dur, type, gain, slideTo, when = 0) {
    const ac = ensure();
    if (!ac) return;
    const t0 = ac.currentTime + when;
    const osc = ac.createOscillator();
    const g = ac.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t0);
    if (slideTo) osc.frequency.exponentialRampToValueAtTime(Math.max(1, slideTo), t0 + dur);
    g.gain.setValueAtTime(gain, t0);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    osc.connect(g);
    g.connect(master);
    osc.start(t0);
    osc.stop(t0 + dur + 0.02);
  }

  function noise(dur, cutoff, gain, when = 0) {
    const ac = ensure();
    if (!ac) return;
    const t0 = ac.currentTime + when;
    const src = ac.createBufferSource();
    src.buffer = noiseBuf;
    src.loop = true;
    const filter = ac.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(cutoff, t0);
    filter.frequency.exponentialRampToValueAtTime(Math.max(40, cutoff * 0.25), t0 + dur);
    const g = ac.createGain();
    g.gain.setValueAtTime(gain, t0);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    src.connect(filter);
    filter.connect(g);
    g.connect(master);
    src.start(t0);
    src.stop(t0 + dur + 0.02);
  }

  // gainAt scales a distant sound down; nothing plays past 60 m.
  function distant(distance) {
    return Math.max(0, 1 - distance / 60);
  }

  return {
    unlock() {
      ensure();
    },
    shot(kind, distance = 0) {
      const g = kind === 'sniper' ? 0.9 : kind === 'smg' ? 0.5 : 0.65;
      const vol = g * (distance === 0 ? 1 : 0.35 + 0.65 * distant(distance));
      if (vol <= 0.01) return;
      noise(kind === 'sniper' ? 0.28 : 0.14, kind === 'sniper' ? 2400 : 3200, vol);
      tone(kind === 'sniper' ? 160 : 110, 0.12, 'square', vol * 0.5, 45);
    },
    dryClick() {
      tone(1800, 0.03, 'square', 0.18);
    },
    reload() {
      tone(900, 0.04, 'square', 0.2);
      tone(650, 0.05, 'square', 0.22, undefined, 0.45);
      tone(1200, 0.04, 'square', 0.25, undefined, 1.55);
    },
    swap() {
      tone(700, 0.05, 'square', 0.18);
    },
    hit(head) {
      tone(head ? 2400 : 1700, 0.06, 'sine', 0.35);
    },
    kill() {
      tone(660, 0.09, 'sine', 0.32);
      tone(990, 0.14, 'sine', 0.32, undefined, 0.08);
    },
    hurt() {
      tone(140, 0.18, 'sawtooth', 0.3, 70);
    },
    explosion(distance = 0) {
      const vol = 0.9 * (distance === 0 ? 1 : 0.3 + 0.7 * distant(distance));
      noise(0.9, 900, vol);
      tone(90, 0.7, 'sine', vol * 0.9, 30);
    },
    beep(high) {
      tone(high ? 1320 : 880, 0.09, 'sine', 0.3);
    },
    plant() {
      tone(520, 0.1, 'sine', 0.3);
      tone(780, 0.16, 'sine', 0.3, undefined, 0.12);
    },
    defuse() {
      tone(1040, 0.08, 'sine', 0.25);
      tone(1040, 0.08, 'sine', 0.25, undefined, 0.16);
    },
    roundWin() {
      [523, 659, 784].forEach((f, i) => tone(f, 0.22, 'triangle', 0.3, undefined, i * 0.12));
    },
    roundLose() {
      tone(330, 0.3, 'triangle', 0.3);
      tone(220, 0.45, 'triangle', 0.3, undefined, 0.18);
    },
    buy() {
      tone(1320, 0.07, 'sine', 0.25);
      tone(1760, 0.1, 'sine', 0.25, undefined, 0.06);
    },
    denied() {
      tone(220, 0.12, 'square', 0.2);
    },
    step(run) {
      noise(0.05, 700, run ? 0.1 : 0.06);
    },
    throwWhoosh() {
      noise(0.25, 1800, 0.2);
    },
  };
}
