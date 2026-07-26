import { useEffect, useState } from 'react';
import { getHighScores, saveHighScore } from '../utils/scores';

interface Props {
  score: number;
  onRestart: () => void;
  newHighScore: boolean;
}

export default function GameOver({ score, onRestart, newHighScore }: Props) {
  const [highScores, setHighScores] = useState(getHighScores());
  const [showScores, setShowScores] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (newHighScore && score > 0) {
      saveHighScore(score);
      setHighScores(getHighScores());
      setSaved(true);
    }
  }, [newHighScore, score]);

  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center z-20 bg-black/70 backdrop-blur-sm">
      <div className="relative text-center px-6 max-w-sm">
        {/* Score display */}
        <div className="mb-6">
          <p className="text-zinc-500 text-xs tracking-widest uppercase mb-2">Game Over</p>
          <div className="text-6xl md:text-7xl font-bold text-white font-mono tabular-nums">
            {score.toLocaleString()}
          </div>
          {newHighScore && saved && (
            <div className="mt-2 inline-block px-4 py-1 bg-gradient-to-r from-yellow-400 to-orange-500 rounded-full">
              <span className="text-black text-xs font-bold tracking-wider uppercase">New High Score!</span>
            </div>
          )}
        </div>

        <button
          onClick={onRestart}
          className="group relative px-10 py-3.5 mb-6 rounded-xl bg-gradient-to-br from-yellow-400 to-orange-500 
                     text-black font-bold text-lg tracking-wider uppercase shadow-lg shadow-yellow-600/30
                     transition-all duration-150 active:scale-95 hover:scale-105
                     hover:shadow-yellow-500/40 w-full"
        >
          Play Again
          <div className="absolute inset-0 rounded-xl bg-white/20 opacity-0 group-hover:opacity-100 transition-opacity duration-200" />
        </button>

        {/* High Scores toggle */}
        <button
          onClick={() => setShowScores(!showScores)}
          className="text-zinc-500 hover:text-zinc-300 text-xs tracking-widest uppercase transition-colors mb-4"
        >
          {showScores ? 'Hide Scores' : 'High Scores'}
        </button>

        {showScores && (
          <div className="space-y-1.5 mt-4">
            {highScores.slice(0, 10).map((s, i) => (
              <div
                key={i}
                className={`flex items-center justify-between px-4 py-1.5 rounded-lg 
                  ${i === 0 ? 'bg-yellow-500/10 border border-yellow-500/20' : 'bg-white/5 border border-white/5'}`}
              >
                <span className={`text-sm font-mono w-6 ${i === 0 ? 'text-yellow-400' : i === 1 ? 'text-zinc-300' : i === 2 ? 'text-amber-600' : 'text-zinc-500'}`}>
                  {i + 1}.
                </span>
                <span className={`text-sm font-mono font-bold flex-1 text-left ml-2 ${i === 0 ? 'text-yellow-400' : i === 1 ? 'text-zinc-300' : i === 2 ? 'text-amber-600' : 'text-zinc-400'}`}>
                  {s.score.toLocaleString()}
                </span>
                <span className="text-xs text-zinc-600 font-mono">{s.date}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
