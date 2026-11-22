// All sound is synthesised with WebAudio — no audio files. A soft ambient pad
// runs under the game; footsteps, alerts, pickups and doors are short blips.

export function createAudio() {
  let context = null;
  let master = null;
  let padNodes = null;
  let muted = false;

  function ensure() {
    if (context) {
      if (context.state === 'suspended') void context.resume();
      return true;
    }
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) return false;
    context = new AudioContext();
    master = context.createGain();
    master.gain.value = muted ? 0 : 0.5;
    master.connect(context.destination);
    return true;
  }

  /** A short oscillator tone with an exponential decay. */
  function tone(frequency, duration, type, volume, when = 0, slideTo = null) {
    if (!ensure()) return;
    const start = context.currentTime + when;
    const osc = context.createOscillator();
    const gain = context.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(frequency, start);
    if (slideTo !== null) osc.frequency.exponentialRampToValueAtTime(slideTo, start + duration);
    gain.gain.setValueAtTime(0, start);
    gain.gain.linearRampToValueAtTime(volume, start + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
    osc.connect(gain);
    gain.connect(master);
    osc.start(start);
    osc.stop(start + duration + 0.05);
  }

  /** A short burst of filtered noise (footsteps, pebble clinks). */
  function noiseBurst(duration, volume, frequency) {
    if (!ensure()) return;
    const start = context.currentTime;
    const length = Math.max(1, Math.floor(context.sampleRate * duration));
    const buffer = context.createBuffer(1, length, context.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < length; i += 1) data[i] = (Math.random() * 2 - 1) * (1 - i / length);
    const source = context.createBufferSource();
    source.buffer = buffer;
    const filter = context.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = frequency;
    const gain = context.createGain();
    gain.gain.value = volume;
    source.connect(filter);
    filter.connect(gain);
    gain.connect(master);
    source.start(start);
  }

  return {
    /** Unlock audio on the first user gesture; safe to call any time. */
    unlock() {
      ensure();
    },
    get muted() {
      return muted;
    },
    toggleMute() {
      muted = !muted;
      if (master) master.gain.value = muted ? 0 : 0.5;
      return muted;
    },
    /** A quiet two-note pad that loops while the game runs. */
    startAmbient() {
      if (!ensure() || padNodes) return;
      const gain = context.createGain();
      gain.gain.value = 0.045;
      gain.connect(master);
      const notes = [110, 164.81, 220];
      const oscillators = notes.map((frequency) => {
        const osc = context.createOscillator();
        osc.type = 'sine';
        osc.frequency.value = frequency;
        osc.connect(gain);
        osc.start();
        return osc;
      });
      const lfo = context.createOscillator();
      const lfoGain = context.createGain();
      lfo.frequency.value = 0.07;
      lfoGain.gain.value = 0.02;
      lfo.connect(lfoGain);
      lfoGain.connect(gain.gain);
      lfo.start();
      padNodes = { gain, oscillators, lfo };
    },
    stopAmbient() {
      if (!padNodes) return;
      for (const osc of padNodes.oscillators) osc.stop();
      padNodes.lfo.stop();
      padNodes.gain.disconnect();
      padNodes = null;
    },
    footstep(running) {
      noiseBurst(0.07, running ? 0.22 : 0.1, running ? 900 : 500);
    },
    pebble() {
      noiseBurst(0.09, 0.3, 2400);
      tone(1900, 0.08, 'triangle', 0.12, 0.02, 1200);
    },
    pickup() {
      tone(660, 0.12, 'sine', 0.22);
      tone(880, 0.16, 'sine', 0.22, 0.09);
      tone(1320, 0.22, 'sine', 0.18, 0.18);
    },
    gem() {
      tone(523, 0.14, 'sine', 0.24);
      tone(659, 0.14, 'sine', 0.24, 0.1);
      tone(784, 0.14, 'sine', 0.24, 0.2);
      tone(1047, 0.3, 'sine', 0.26, 0.3);
    },
    suspicious() {
      tone(440, 0.16, 'square', 0.1, 0, 392);
    },
    alert() {
      tone(233, 0.22, 'sawtooth', 0.2, 0, 311);
      tone(311, 0.3, 'sawtooth', 0.2, 0.16, 233);
    },
    caught() {
      tone(196, 0.5, 'sawtooth', 0.24, 0, 98);
      tone(98, 0.7, 'sawtooth', 0.22, 0.3, 65);
    },
    door() {
      tone(180, 0.5, 'sawtooth', 0.08, 0, 320);
      tone(1200, 0.12, 'triangle', 0.1, 0.4);
    },
    win() {
      const notes = [523, 659, 784, 1047, 1319];
      notes.forEach((frequency, index) => tone(frequency, 0.3, 'sine', 0.22, index * 0.13));
    },
  };
}
