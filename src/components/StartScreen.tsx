import { getHighScores } from '../utils/scores';

interface Props {
  onStart: () => void;
}

export default function StartScreen({ onStart }: Props) {
  const highScores = getHighScores();

  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center z-10">
      {/* Decorative rings */}
      <div className="absolute w-72 h-72 md:w-96 md:h-96 rounded-full border border-yellow-500/20 animate-pulse" style={{ animationDuration: '4s' }} />
      <div className="absolute w-56 h-56 md:w-80 md:h-80 rounded-full border border-yellow-500/10" />

      <div className="relative z-10 text-center px-6">
        <h1 className="text-5xl md:text-7xl font-bold tracking-tight mb-2">
          <span className="text-transparent bg-clip-text bg-gradient-to-br from-yellow-300 via-amber-400 to-orange-500">
            STARDRIFT
          </span>
        </h1>
        <p className="text-zinc-400 text-sm md:text-base mb-4 tracking-widest uppercase">
          Dodge · Collect · Survive
        </p>

        <button
          onClick={onStart}
          className="group relative px-10 py-3.5 mb-8 rounded-xl bg-gradient-to-br from-yellow-400 to-orange-500 
                     text-black font-bold text-lg tracking-wider uppercase shadow-lg shadow-yellow-600/30
                     transition-all duration-150 active:scale-95 hover:scale-105
                     hover:shadow-yellow-500/40"
        >
          <span className="relative z-10">Play</span>
          <div className="absolute inset-0 rounded-xl bg-white/20 opacity-0 group-hover:opacity-100 transition-opacity duration-200" />
        </button>

        {/* Controls info */}
        <div className="text-zinc-500 text-xs md:text-sm space-y-1 mb-8">
          <p className="text-zinc-400 font-medium">Controls</p>
          <p>Desktop: WASD / Arrow Keys</p>
          <p>Mobile: Motion Joystick</p>
          <p className="text-zinc-600 mt-2">ESC or P to pause</p>
        </div>

        {/* High Scores */}
        {highScores.length > 0 && (
          <div className="max-w-xs mx-auto">
            <h2 className="text-zinc-400 text-xs tracking-widest uppercase mb-3 font-semibold">High Scores</h2>
            <div className="space-y-1.5">
              {highScores.slice(0, 5).map((s, i) => (
                <div
                  key={i}
                  className="flex items-center justify-between px-4 py-1.5 rounded-lg bg-white/5 border border-white/5"
                >
                  <span className={`text-sm font-mono ${i === 0 ? 'text-yellow-400' : i === 1 ? 'text-zinc-300' : i === 2 ? 'text-amber-600' : 'text-zinc-500'}`}>
                    {i + 1}.
                  </span>
                  <span className={`text-sm font-mono font-bold ${i === 0 ? 'text-yellow-400' : i === 1 ? 'text-zinc-300' : i === 2 ? 'text-amber-600' : 'text-zinc-400'}`}>
                    {s.score.toLocaleString()}
                  </span>
                  <span className="text-xs text-zinc-600 font-mono">{s.date}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
