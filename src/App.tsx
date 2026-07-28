import { useState, useCallback, useEffect } from 'react';
import Game from './components/Game';
import StartScreen from './components/StartScreen';
import GameOver from './components/GameOver';
import PauseOverlay from './components/PauseOverlay';
import AdminLogin from './components/AdminLogin';
import AdminDashboard from './components/AdminDashboard';
import { getHighScores } from './utils/scores';
import { onAuthStateChanged, signOut } from '@firebase/auth';
import { auth } from './utils/firebase';
import { isOwner } from './utils/owner';

type GameState = 'start' | 'playing' | 'paused' | 'gameover' | 'admin-login' | 'admin';

const isLocalAdminPreview = () => (
  (window.location.hostname === '127.0.0.1' || window.location.hostname === 'localhost')
  && window.location.hash === '#admin-preview'
);

export default function App() {
  const [gameState, setGameState] = useState<GameState>(() => (
    isLocalAdminPreview() ? 'admin' : 'start'
  ));
  const [score, setScore] = useState(0);
  const [newHighScore, setNewHighScore] = useState(false);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (isLocalAdminPreview()) {
        setGameState('admin');
        return;
      }

      const ownerSignedIn = isOwner(user);

      if (user && !ownerSignedIn) {
        void signOut(auth);
      }

      if (window.location.hash === '#admin') {
        setGameState(ownerSignedIn ? 'admin' : 'admin-login');
      }
    });

    return unsubscribe;
  }, []);

  const handleStart = useCallback(() => {
    setScore(0);
    setNewHighScore(false);
    setGameState('playing');
  }, []);

  const handleGameOver = useCallback((finalScore: number) => {
    setScore(finalScore);
    const scores = getHighScores();
    const isNew = scores.length < 10 || finalScore > (scores[scores.length - 1]?.score ?? 0);
    if (isNew && finalScore > 0) {
      setNewHighScore(true);
    }
    setGameState('gameover');
  }, []);

  const handlePause = useCallback(() => {
    setGameState('paused');
  }, []);

  const handleResume = useCallback(() => {
    setGameState('playing');
  }, []);

  const handleRestart = useCallback(() => {
    setScore(0);
    setNewHighScore(false);
    setGameState('playing');
  }, []);

  const handleAdminLogin = useCallback(() => {
    setGameState('admin');
  }, []);

  const handleBackToGame = useCallback(() => {
    window.location.hash = '';
    setGameState('start');
  }, []);

  return (
    <div className="relative w-full h-full min-h-[100dvh] overflow-hidden bg-black select-none" style={{ paddingTop: 'env(safe-area-inset-top)', paddingBottom: 'env(safe-area-inset-bottom)' }}>
      {/* Starfield background layer (only when not in admin) */}
      {gameState !== 'admin' && gameState !== 'admin-login' && (
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          {Array.from({ length: 100 }).map((_, i) => (
            <div
              key={i}
              className="absolute rounded-full bg-white"
              style={{
                width: Math.random() * 2 + 1 + 'px',
                height: Math.random() * 2 + 1 + 'px',
                left: Math.random() * 100 + '%',
                top: Math.random() * 100 + '%',
                opacity: Math.random() * 0.7 + 0.3,
                animation: `twinkle ${Math.random() * 3 + 2}s ease-in-out ${Math.random() * 5}s infinite`,
              }}
            />
          ))}
        </div>
      )}

      {gameState === 'start' && (
        <StartScreen onStart={handleStart} />
      )}

      {gameState === 'playing' && (
        <Game onGameOver={handleGameOver} onPause={handlePause} setScore={setScore} />
      )}

      {gameState === 'paused' && (
        <>
          <Game onGameOver={handleGameOver} onPause={handlePause} setScore={setScore} paused />
          <PauseOverlay onResume={handleResume} />
        </>
      )}

      {gameState === 'gameover' && (
        <GameOver score={score} onRestart={handleRestart} newHighScore={newHighScore} />
      )}

      {gameState === 'admin-login' && (
        <AdminLogin onLogin={handleAdminLogin} />
      )}

      {gameState === 'admin' && (
        <AdminDashboard initialTab={isLocalAdminPreview() ? 'preview' : 'scores'} />
      )}

      {/* Public policy link for app-store compliance */}
      {gameState === 'start' && (
        <a
          href="/privacy.html"
          target="_blank"
          rel="noreferrer"
          className="absolute bottom-4 left-4 text-zinc-600 hover:text-zinc-400 text-[10px] transition-colors z-10"
        >
          Privacy
        </a>
      )}

      {/* Back to game from admin */}
      {gameState === 'admin' && (
        <button
          onClick={handleBackToGame}
          className="fixed bottom-4 right-4 text-zinc-600 hover:text-zinc-400 text-xs transition-colors z-50"
        >
          Back to Game
        </button>
      )}
    </div>
  );
}
