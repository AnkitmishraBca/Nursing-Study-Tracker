let ctx: AudioContext | null = null;
let sirenTimer: ReturnType<typeof setInterval> | null = null;
let sirenGain: GainNode | null = null;
let sirenOsc: OscillatorNode | null = null;
let high = false;

function context(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctor) return null;
  ctx ??= new Ctor();
  if (ctx.state === 'suspended') void ctx.resume();
  return ctx;
}

function tone(frequency: number, duration: number, volume = 0.14, type: OscillatorType = 'sine') {
  const audio = context();
  if (!audio) return;
  const osc = audio.createOscillator();
  const gain = audio.createGain();
  osc.type = type;
  osc.frequency.value = frequency;
  gain.gain.setValueAtTime(0.0001, audio.currentTime);
  gain.gain.exponentialRampToValueAtTime(volume, audio.currentTime + 0.02);
  gain.gain.exponentialRampToValueAtTime(0.0001, audio.currentTime + duration);
  osc.connect(gain).connect(audio.destination);
  osc.start();
  osc.stop(audio.currentTime + duration + 0.02);
}

export function playChime() {
  tone(880, 0.16, 0.12);
  window.setTimeout(() => tone(1174, 0.22, 0.12), 160);
  if ('vibrate' in navigator) navigator.vibrate([80, 60, 80]);
}

export function startSiren() {
  if (sirenTimer) return;
  const audio = context();
  if (!audio) return;
  const osc = audio.createOscillator();
  const gain = audio.createGain();
  osc.type = 'sawtooth';
  osc.frequency.value = 740;
  gain.gain.value = 0.11;
  osc.connect(gain).connect(audio.destination);
  osc.start();
  sirenOsc = osc;
  sirenGain = gain;
  high = true;
  sirenTimer = setInterval(() => {
    high = !high;
    if (osc && audio) osc.frequency.setTargetAtTime(high ? 1040 : 680, audio.currentTime, 0.03);
    if ('vibrate' in navigator) navigator.vibrate([200, 100, 200]);
  }, 650);
}

export function stopSiren() {
  if (sirenTimer) clearInterval(sirenTimer);
  sirenTimer = null;
  if (sirenOsc) {
    try {
      sirenOsc.stop();
    } catch {
      /* already stopped */
    }
  }
  sirenGain?.disconnect();
  sirenOsc = null;
  sirenGain = null;
  if ('vibrate' in navigator) navigator.vibrate(0);
}
