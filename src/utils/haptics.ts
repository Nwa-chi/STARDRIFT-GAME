export type HapticEvent = 'move' | 'collect' | 'collision';

const patterns: Record<HapticEvent, number | number[]> = {
  move: 12,
  collect: [30, 25, 45],
  collision: [90, 45, 140],
};

export function playHaptic(event: HapticEvent) {
  if (typeof navigator === 'undefined' || typeof navigator.vibrate !== 'function') {
    return false;
  }

  return navigator.vibrate(patterns[event]);
}
