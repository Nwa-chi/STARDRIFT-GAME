interface Props {
  onResume: () => void;
}

export default function PauseOverlay({ onResume }: Props) {
  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center z-20 bg-black/60 backdrop-blur-sm">
      <div className="text-center">
        <p className="text-zinc-400 text-xs tracking-widest uppercase mb-2">Paused</p>
        <h2 className="text-4xl font-bold text-white mb-6">PAUSED</h2>
        <button
          onClick={onResume}
          className="group relative px-10 py-3 rounded-xl bg-white/10 border border-white/20 
                     text-white font-bold text-lg tracking-wider uppercase
                     transition-all duration-150 active:scale-95 hover:scale-105
                     hover:bg-white/20"
        >
          Resume
        </button>
        <p className="text-zinc-600 text-xs mt-4">
          Press ESC or P to resume
        </p>
      </div>
    </div>
  );
}
