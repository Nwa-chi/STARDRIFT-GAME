export type GameSound = 'ready' | 'thrust' | 'collect' | 'gameOver';

type AudioContextConstructor = typeof AudioContext;
type WindowWithWebkitAudio = Window & {
  webkitAudioContext?: AudioContextConstructor;
};

let sharedAudioContext: AudioContext | null = null;

const getAudioContext = () => {
  const AudioContextClass = window.AudioContext
    || (window as WindowWithWebkitAudio).webkitAudioContext;

  if (!AudioContextClass) return null;

  if (!sharedAudioContext || sharedAudioContext.state === 'closed') {
    sharedAudioContext = new AudioContextClass();
  }

  return sharedAudioContext;
};

export async function playGameSound(sound: GameSound) {
  const audio = getAudioContext();
  if (!audio) return false;

  if (audio.state === 'suspended') {
    await audio.resume();
  }

  const now = audio.currentTime;
  const settings: Record<GameSound, Array<{
    type: OscillatorType;
    start: number;
    end: number;
    duration: number;
    volume: number;
    delay?: number;
  }>> = {
    ready: [
      { type: 'sine', start: 440, end: 660, duration: 0.2, volume: 0.12 },
      { type: 'triangle', start: 660, end: 880, duration: 0.24, volume: 0.08, delay: 0.06 },
    ],
    thrust: [
      { type: 'triangle', start: 150, end: 92, duration: 0.2, volume: 0.085 },
    ],
    collect: [
      { type: 'sine', start: 620, end: 1120, duration: 0.22, volume: 0.16 },
      { type: 'triangle', start: 880, end: 1320, duration: 0.18, volume: 0.09, delay: 0.04 },
    ],
    gameOver: [
      { type: 'sawtooth', start: 180, end: 45, duration: 0.6, volume: 0.17 },
      { type: 'triangle', start: 120, end: 38, duration: 0.7, volume: 0.1, delay: 0.05 },
    ],
  };

  for (const config of settings[sound]) {
    const startAt = now + (config.delay ?? 0);
    const oscillator = audio.createOscillator();
    const gain = audio.createGain();

    oscillator.type = config.type;
    oscillator.frequency.setValueAtTime(config.start, startAt);
    oscillator.frequency.exponentialRampToValueAtTime(
      config.end,
      startAt + config.duration
    );
    gain.gain.setValueAtTime(config.volume, startAt);
    gain.gain.exponentialRampToValueAtTime(0.001, startAt + config.duration);

    oscillator.connect(gain);
    gain.connect(audio.destination);
    oscillator.start(startAt);
    oscillator.stop(startAt + config.duration);
  }

  return true;
}
