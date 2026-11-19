// Synthesised sound: every sound is built with WebAudio oscillators and filtered
// noise, so the game ships no audio files at all.
export function createAudio() {
  let ctx = null;
  let master = null;
  let musicTimer = null;
  let engineOsc = null;
  let engineGain = null;
  let sirenOsc = null;
  let sirenGain = null;
  let muted = false;
  let musicOn = false;
  let wavesOn = false;

  function ensure() {
    if (ctx) {
      if (ctx.state === 'suspended') ctx.resume();
      return true;
    }
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return false;
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = 0.5;
      master.connect(ctx.destination);
      return true;
    } catch {
      return false;
    }
  }

  function noiseBuffer(seconds) {
    const buffer = ctx.createBuffer(1, Math.floor(ctx.sampleRate * seconds), ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < data.length; i += 1) data[i] = Math.random() * 2 - 1;
    return buffer;
  }

  // One short oscillator note with a decaying envelope; `slideTo` glides the pitch.
  function tone(freq, dur, type, vol, slideTo, delay = 0) {
    if (!ensure() || muted) return;
    const t = ctx.currentTime + delay;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type || 'square';
    osc.frequency.setValueAtTime(freq, t);
    if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
    gain.gain.setValueAtTime(vol || 0.15, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + dur);
    osc.connect(gain);
    gain.connect(master);
    osc.start(t);
    osc.stop(t + dur + 0.02);
  }

  // One burst of filtered noise with a decaying envelope.
  function noiseHit(dur, vol, filterFreq, delay = 0) {
    if (!ensure() || muted) return;
    const t = ctx.currentTime + delay;
    const src = ctx.createBufferSource();
    src.buffer = noiseBuffer(dur);
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = filterFreq || 1200;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(vol || 0.3, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + dur);
    src.connect(filter);
    filter.connect(gain);
    gain.connect(master);
    src.start(t);
    src.stop(t + dur);
  }

  // A lazy bassline + hats loop, scheduled a bar at a time.
  const BASS = [55, 0, 55, 65.41, 0, 55, 49, 58.27];
  let bar = 0;
  function scheduleBar() {
    if (!ctx || muted || !musicOn) return;
    const step = 0.22;
    const start = ctx.currentTime + 0.05;
    for (let i = 0; i < 8; i += 1) {
      const freq = BASS[(bar * 8 + i) % BASS.length];
      if (freq) {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.value = freq;
        gain.gain.setValueAtTime(0.12, start + i * step);
        gain.gain.exponentialRampToValueAtTime(0.001, start + i * step + step * 0.9);
        osc.connect(gain);
        gain.connect(master);
        osc.start(start + i * step);
        osc.stop(start + i * step + step);
      }
      // Hat tick on the off-beats.
      const hat = ctx.createBufferSource();
      hat.buffer = noiseBuffer(0.03);
      const hp = ctx.createBiquadFilter();
      hp.type = 'highpass';
      hp.frequency.value = 6000;
      const hg = ctx.createGain();
      hg.gain.setValueAtTime(i % 2 ? 0.05 : 0.02, start + i * step);
      hg.gain.exponentialRampToValueAtTime(0.001, start + i * step + 0.03);
      hat.connect(hp);
      hp.connect(hg);
      hg.connect(master);
      hat.start(start + i * step);
    }
    bar += 1;
  }

  return {
    unlock() {
      ensure();
    },
    shoot() {
      noiseHit(0.12, 0.5, 2500);
      tone(180, 0.08, 'sawtooth', 0.12, 60);
    },
    punch() {
      noiseHit(0.08, 0.3, 500);
    },
    hit() {
      tone(140, 0.12, 'sawtooth', 0.2, 70);
    },
    pickup() {
      tone(660, 0.09, 'sine', 0.18);
      tone(990, 0.12, 'sine', 0.18, null, 0.09);
    },
    cash() {
      tone(880, 0.08, 'sine', 0.16);
      tone(1174, 0.08, 'sine', 0.16, null, 0.08);
      tone(1568, 0.16, 'sine', 0.16, null, 0.16);
    },
    mission() {
      tone(523, 0.12, 'triangle', 0.2);
      tone(659, 0.12, 'triangle', 0.2, null, 0.12);
      tone(784, 0.22, 'triangle', 0.22, null, 0.24);
    },
    fail() {
      tone(220, 0.25, 'sawtooth', 0.18, 110);
    },
    click() {
      tone(700, 0.05, 'square', 0.1);
    },
    reload() {
      // Magazine out, magazine in: two short metallic clicks.
      noiseHit(0.05, 0.25, 3000);
      noiseHit(0.06, 0.3, 1800, 0.22);
    },
    startWaves() {
      // Gentle surf: looping noise through a low-pass, swell driven by an LFO.
      if (!ensure() || wavesOn) return;
      wavesOn = true;
      const src = ctx.createBufferSource();
      src.buffer = noiseBuffer(3);
      src.loop = true;
      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = 420;
      const gain = ctx.createGain();
      gain.gain.value = 0.035;
      const lfo = ctx.createOscillator();
      lfo.frequency.value = 0.11;
      const lfoGain = ctx.createGain();
      lfoGain.gain.value = 0.022;
      lfo.connect(lfoGain);
      lfoGain.connect(gain.gain);
      src.connect(filter);
      filter.connect(gain);
      gain.connect(master);
      src.start();
      lfo.start();
    },
    crash() {
      noiseHit(0.25, 0.4, 800);
    },
    engine(on, speed01) {
      if (!ensure() || muted) return;
      if (on && !engineOsc) {
        engineOsc = ctx.createOscillator();
        engineGain = ctx.createGain();
        engineOsc.type = 'sawtooth';
        engineOsc.frequency.value = 60;
        engineGain.gain.value = 0.03;
        const filter = ctx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.value = 500;
        engineOsc.connect(filter);
        filter.connect(engineGain);
        engineGain.connect(master);
        engineOsc.start();
      }
      if (!on && engineOsc) {
        try {
          engineOsc.stop();
        } catch {
          // Already stopped.
        }
        engineOsc = null;
        engineGain = null;
        return;
      }
      if (engineOsc) {
        engineOsc.frequency.value = 55 + (speed01 || 0) * 140;
        engineGain.gain.value = 0.02 + (speed01 || 0) * 0.05;
      }
    },
    siren(on) {
      if (!ensure() || muted) return;
      if (on && !sirenOsc) {
        sirenOsc = ctx.createOscillator();
        sirenGain = ctx.createGain();
        sirenOsc.type = 'sine';
        sirenOsc.frequency.value = 700;
        sirenGain.gain.value = 0.035;
        const lfo = ctx.createOscillator();
        lfo.frequency.value = 0.9;
        const lfoGain = ctx.createGain();
        lfoGain.gain.value = 220;
        lfo.connect(lfoGain);
        lfoGain.connect(sirenOsc.frequency);
        sirenOsc.connect(sirenGain);
        sirenGain.connect(master);
        sirenOsc.start();
        lfo.start();
        sirenOsc._lfo = lfo;
      }
      if (!on && sirenOsc) {
        try {
          sirenOsc._lfo.stop();
          sirenOsc.stop();
        } catch {
          // Already stopped.
        }
        sirenOsc = null;
        sirenGain = null;
      }
    },
    startMusic() {
      if (!ensure() || musicOn) return;
      musicOn = true;
      scheduleBar();
      musicTimer = window.setInterval(scheduleBar, 8 * 0.22 * 1000);
    },
    stopMusic() {
      musicOn = false;
      if (musicTimer) window.clearInterval(musicTimer);
      musicTimer = null;
    },
    toggleMute() {
      muted = !muted;
      if (master) master.gain.value = muted ? 0 : 0.5;
      return muted;
    },
    isMuted() {
      return muted;
    },
  };
}
