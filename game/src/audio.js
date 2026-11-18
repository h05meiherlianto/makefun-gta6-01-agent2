// Sound, synthesised only: no audio files, no network. A WebAudio graph
// built on first user gesture (browsers block audio before one): engine hum
// that follows the car's speed, gunshots, sirens, pickup blips and a small
// bass-and-hat music loop that keeps the city humming.

export function createAudio() {
  let context = null;
  let master = null;
  let engineOsc = null;
  let engineGain = null;
  let sirenOsc = null;
  let sirenGain = null;
  let musicTimer = null;
  let musicStep = 0;
  let muted = false;

  function ensure() {
    if (context) return true;
    try {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      context = new AudioContext();
      master = context.createGain();
      master.gain.value = 0.5;
      master.connect(context.destination);
      // Engine: a low sawtooth whose pitch follows speed.
      engineOsc = context.createOscillator();
      engineOsc.type = 'sawtooth';
      engineOsc.frequency.value = 55;
      engineGain = context.createGain();
      engineGain.gain.value = 0;
      const engineFilter = context.createBiquadFilter();
      engineFilter.type = 'lowpass';
      engineFilter.frequency.value = 420;
      engineOsc.connect(engineFilter);
      engineFilter.connect(engineGain);
      engineGain.connect(master);
      engineOsc.start();
      // Siren: a triangle that wails between two notes.
      sirenOsc = context.createOscillator();
      sirenOsc.type = 'triangle';
      sirenOsc.frequency.value = 700;
      sirenGain = context.createGain();
      sirenGain.gain.value = 0;
      sirenOsc.connect(sirenGain);
      sirenGain.connect(master);
      sirenOsc.start();
      startMusic();
      return true;
    } catch {
      return false;
    }
  }

  function resume() {
    if (context && context.state === 'suspended') context.resume();
  }

  function blip(freq, dur, type, volume, slideTo) {
    if (!context || muted) return;
    const osc = context.createOscillator();
    const gain = context.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, context.currentTime);
    if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, context.currentTime + dur);
    gain.gain.setValueAtTime(volume, context.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, context.currentTime + dur);
    osc.connect(gain);
    gain.connect(master);
    osc.start();
    osc.stop(context.currentTime + dur + 0.02);
  }

  function noiseBurst(dur, volume, filterFreq) {
    if (!context || muted) return;
    const len = Math.floor(context.sampleRate * dur);
    const buffer = context.createBuffer(1, len, context.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < len; i += 1) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const source = context.createBufferSource();
    source.buffer = buffer;
    const filter = context.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = filterFreq;
    const gain = context.createGain();
    gain.gain.value = volume;
    source.connect(filter);
    filter.connect(gain);
    gain.connect(master);
    source.start();
  }

  // A slow neon-night bassline: root notes walk Am–F–C–G, with a hat tick.
  const BASS = [55, 43.65, 65.41, 49];
  function startMusic() {
    if (musicTimer !== null) return;
    musicTimer = window.setInterval(() => {
      if (muted || !context) return;
      const bar = Math.floor(musicStep / 8) % 4;
      const beat = musicStep % 8;
      if (beat % 2 === 0) blip(BASS[bar], 0.32, 'triangle', 0.16);
      if (beat % 4 === 2) blip(BASS[bar] * 1.5, 0.2, 'sine', 0.1);
      if (beat % 2 === 1) noiseBurst(0.03, 0.05, 6000);
      musicStep += 1;
    }, 210);
  }

  return {
    /** Call from any user gesture; safe to call repeatedly. */
    unlock() {
      if (ensure()) resume();
    },
    setEngine(speedRatio, driving) {
      if (!context || muted) return;
      engineOsc.frequency.setTargetAtTime(50 + speedRatio * 140, context.currentTime, 0.08);
      engineGain.gain.setTargetAtTime(driving ? 0.05 + speedRatio * 0.05 : 0.015, context.currentTime, 0.1);
    },
    setSiren(on, time) {
      if (!context || muted) return;
      sirenGain.gain.setTargetAtTime(on ? 0.035 : 0, context.currentTime, 0.2);
      if (on) sirenOsc.frequency.setTargetAtTime(650 + 250 * Math.sin(time * 2.4), context.currentTime, 0.05);
    },
    gunshot() { noiseBurst(0.12, 0.5, 1800); blip(160, 0.1, 'square', 0.2, 60); },
    enemyShot() { noiseBurst(0.1, 0.25, 1200); },
    crash() { noiseBurst(0.25, 0.5, 500); blip(70, 0.25, 'sine', 0.35, 35); },
    explosion() { noiseBurst(0.7, 0.7, 300); blip(50, 0.6, 'sine', 0.4, 28); },
    pickup() { blip(660, 0.09, 'sine', 0.25); window.setTimeout(() => blip(990, 0.14, 'sine', 0.25), 70); },
    cash() { blip(880, 0.08, 'square', 0.18); window.setTimeout(() => blip(1174, 0.12, 'square', 0.18), 80); },
    mission() { blip(523, 0.12, 'triangle', 0.25); window.setTimeout(() => blip(784, 0.2, 'triangle', 0.25), 120); },
    fail() { blip(220, 0.3, 'sawtooth', 0.2, 110); },
    horn() { blip(370, 0.18, 'square', 0.15); },
    toggleMute() {
      muted = !muted;
      if (master) master.gain.value = muted ? 0 : 0.5;
      return muted;
    },
  };
}
