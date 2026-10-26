/**
 * Web Audio API Synthesizer for Kitchen & KDS Alerts
 * Zero external audio files required. Reliable across browsers and offline.
 */

let audioCtx: AudioContext | null = null;

function getAudioContext(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  try {
    if (!audioCtx) {
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (AudioCtx) {
        audioCtx = new AudioCtx();
      }
    }
    if (audioCtx && audioCtx.state === 'suspended') {
      audioCtx.resume();
    }
    return audioCtx;
  } catch {
    return null;
  }
}

export function playKitchenSound(
  type: 'new_order' | 'order_ready' | 'delay_alert' | 'bump',
  enabled: boolean = true
) {
  if (!enabled) return;
  const ctx = getAudioContext();
  if (!ctx) return;

  try {
    const now = ctx.currentTime;

    if (type === 'new_order') {
      // 2-tone melodic chime: High Attention D5 (587.33Hz) -> A5 (880Hz)
      const osc1 = ctx.createOscillator();
      const gain1 = ctx.createGain();
      osc1.type = 'sine';
      osc1.frequency.setValueAtTime(587.33, now);
      osc1.frequency.setValueAtTime(880, now + 0.12);

      gain1.gain.setValueAtTime(0.22, now);
      gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.45);

      osc1.connect(gain1);
      gain1.connect(ctx.destination);
      osc1.start(now);
      osc1.stop(now + 0.45);
    } else if (type === 'order_ready') {
      // Harmonic celebratory bell chime: E5 (659.25Hz) -> G#5 (830.6Hz) -> B5 (987.77Hz)
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(659.25, now);
      osc.frequency.setValueAtTime(830.61, now + 0.1);
      osc.frequency.setValueAtTime(987.77, now + 0.2);

      gain.gain.setValueAtTime(0.25, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.55);

      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.55);
    } else if (type === 'delay_alert') {
      // Urgent double beep for tickets exceeding SLA (440Hz -> 330Hz)
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'square';
      osc.frequency.setValueAtTime(520, now);
      osc.frequency.setValueAtTime(440, now + 0.15);

      gain.gain.setValueAtTime(0.18, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.4);

      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.4);
    } else if (type === 'bump') {
      // Soft confirmation tick
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(740, now);

      gain.gain.setValueAtTime(0.12, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.18);

      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.18);
    }
  } catch (err) {
    console.warn('Kitchen sound chime playback prevented by browser audio policy:', err);
  }
}
