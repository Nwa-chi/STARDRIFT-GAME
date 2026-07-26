const STORAGE_KEY = 'stardrift_highscores';
const MAX_SCORES = 10;

export interface Score {
  score: number;
  date: string;
}

export function getHighScores(): Score[] {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return [];
    return JSON.parse(stored) as Score[];
  } catch {
    return [];
  }
}

export function saveHighScore(score: number): boolean {
  const scores = getHighScores();
  const isNew = scores.length < MAX_SCORES || score > (scores[scores.length - 1]?.score ?? 0);
  if (!isNew && scores.length >= MAX_SCORES) return false;

  scores.push({ score, date: new Date().toISOString().slice(0, 10) });
  scores.sort((a, b) => b.score - a.score);
  if (scores.length > MAX_SCORES) scores.length = MAX_SCORES;

  localStorage.setItem(STORAGE_KEY, JSON.stringify(scores));
  return true;
}
