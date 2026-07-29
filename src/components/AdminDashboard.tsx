import { useState, useEffect, useCallback } from 'react';
import { signOut } from '@firebase/auth';
import { ref, get, set, update, remove } from '@firebase/database';
import { auth, database } from '../utils/firebase';
import { getHighScores } from '../utils/scores';
import Game from './Game';

interface PlayerScore {
  score: number;
  date: string;
}

interface LeaderboardEntry {
  id: string;
  playerName: string;
  score: number;
  date: string;
  metadata?: string;
}

interface GameConfig {
  asteroidMinSpeed: number;
  asteroidMaxSpeed: number;
  starSpawnInterval: number;
  playerSpeed: number;
  difficultyScale: number;
}

type AdminTab = 'scores' | 'config' | 'analytics' | 'preview';

interface Props {
  initialTab?: AdminTab;
}

const DEFAULT_CONFIG: GameConfig = {
  asteroidMinSpeed: 150,
  asteroidMaxSpeed: 400,
  starSpawnInterval: 1.5,
  playerSpeed: 380,
  difficultyScale: 80,
};

export default function AdminDashboard({ initialTab = 'scores' }: Props) {
  const [userEmail, setUserEmail] = useState('');
  const [activeTab, setActiveTab] = useState<AdminTab>(initialTab);
  const [localScores, setLocalScores] = useState<PlayerScore[]>([]);
  const [publicScores, setPublicScores] = useState<LeaderboardEntry[]>([]);
  const [config, setConfig] = useState<GameConfig>(DEFAULT_CONFIG);
  const [configDirty, setConfigDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [messageType, setMessageType] = useState<'success' | 'error'>('success');
  const [newEntry, setNewEntry] = useState({ playerName: '', score: '' });
  const [previewScore, setPreviewScore] = useState(0);
  const [previewGameOver, setPreviewGameOver] = useState(false);
  const [previewRun, setPreviewRun] = useState(0);
  const [previewOpen, setPreviewOpen] = useState(false);

  useEffect(() => {
    setUserEmail(auth.currentUser?.email || '');
    setLocalScores(getHighScores());

    // Load public leaderboard from Firebase
    loadPublicScores();
    loadConfig();
  }, []);

  const showMessage = useCallback((msg: string, type: 'success' | 'error') => {
    setMessage(msg);
    setMessageType(type);
    setTimeout(() => setMessage(''), 3000);
  }, []);

  const loadPublicScores = async () => {
    try {
      const scoresRef = ref(database, 'leaderboard');
      const snap = await get(scoresRef);
      if (snap.exists()) {
        const data = snap.val();
        const entries: LeaderboardEntry[] = Object.entries(data).map(([id, val]: [string, any]) => ({
          id,
          playerName: val.playerName || 'Unknown',
          score: val.score || 0,
          date: val.date || '',
          metadata: val.metadata,
        }));
        entries.sort((a, b) => b.score - a.score);
        setPublicScores(entries);
      }
    } catch (err) {
      console.log('Firebase not configured yet, using local scores');
    }
  };

  const loadConfig = async () => {
    try {
      const configRef = ref(database, 'config');
      const snap = await get(configRef);
      if (snap.exists()) {
        setConfig({ ...DEFAULT_CONFIG, ...snap.val() });
      }
    } catch {
      // Use defaults
    }
  };

  const saveConfig = async () => {
    setSaving(true);
    try {
      const configRef = ref(database, 'config');
      await set(configRef, config);
      setConfigDirty(false);
      showMessage('Configuration saved successfully!', 'success');
    } catch (err) {
      showMessage('Failed to save configuration. Is Firebase configured?', 'error');
    }
    setSaving(false);
  };

  const addPublicScore = async () => {
    const scoreVal = parseInt(newEntry.score);
    if (!newEntry.playerName || isNaN(scoreVal) || scoreVal <= 0) {
      showMessage('Please enter a valid name and score.', 'error');
      return;
    }

    try {
      const newId = `entry_${Date.now()}`;
      const updates = {
        [`leaderboard/${newId}`]: {
          playerName: newEntry.playerName,
          score: scoreVal,
          date: new Date().toISOString().slice(0, 10),
          metadata: 'Added via admin panel',
        },
      };
      await update(ref(database), updates);
      showMessage(`Score added for ${newEntry.playerName}!`, 'success');
      setNewEntry({ playerName: '', score: '' });
      loadPublicScores();
    } catch (err) {
      showMessage('Failed to add score. Is Firebase configured?', 'error');
    }
  };

  const deleteScore = async (id: string) => {
    try {
      await remove(ref(database, `leaderboard/${id}`));
      showMessage('Score deleted.', 'success');
      loadPublicScores();
    } catch {
      showMessage('Failed to delete.', 'error');
    }
  };

  const clearLocalScores = () => {
    localStorage.removeItem('stardrift_highscores');
    setLocalScores([]);
    showMessage('Local scores cleared.', 'success');
  };

  const handleLogout = async () => {
    await signOut(auth);
    window.location.reload();
  };

  const restartPreview = () => {
    setPreviewScore(0);
    setPreviewGameOver(false);
    setPreviewRun((run) => run + 1);
  };

  const launchPreview = () => {
    restartPreview();
    setPreviewOpen(true);
  };

  return (
    <div className="min-h-screen bg-black text-white">
      {/* Header */}
      <header className="border-b border-zinc-800 bg-zinc-900/50 backdrop-blur-sm sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-transparent bg-clip-text bg-gradient-to-br from-yellow-300 to-orange-500 font-bold text-lg">
              STARDRIFT
            </span>
            <span className="text-zinc-600 text-xs bg-zinc-800 px-2 py-0.5 rounded">Admin</span>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-zinc-400 text-xs">{userEmail}</span>
            <button
              onClick={handleLogout}
              className="text-xs text-zinc-500 hover:text-zinc-300 transition-colors"
            >
              Sign Out
            </button>
          </div>
        </div>
      </header>

      {/* Toast message */}
      {message && (
        <div className={`fixed top-4 right-4 z-50 px-4 py-2 rounded-lg text-sm font-medium shadow-lg transition-all ${
          messageType === 'success' 
            ? 'bg-green-500/20 border border-green-500/30 text-green-400' 
            : 'bg-red-500/20 border border-red-500/30 text-red-400'
        }`}>
          {message}
        </div>
      )}

      <div className="max-w-6xl mx-auto px-4 py-6">
        {/* Tabs */}
        <div className="flex gap-1 mb-6 bg-zinc-900 rounded-lg p-1 border border-zinc-800 w-fit">
          {(['scores', 'config', 'analytics', 'preview'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-4 py-2 rounded-md text-xs font-medium transition-all capitalize ${
                activeTab === tab
                  ? 'bg-yellow-400/10 text-yellow-400 border border-yellow-400/20'
                  : 'text-zinc-500 hover:text-zinc-300'
              }`}
            >
              {tab}
            </button>
          ))}
        </div>

        {/* Tab: Scores */}
        {activeTab === 'scores' && (
          <div className="space-y-8">
            {/* Public Leaderboard */}
            <div>
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-sm font-semibold text-zinc-300">Public Leaderboard</h2>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-zinc-500">{publicScores.length} entries</span>
                  <button
                    onClick={loadPublicScores}
                    className="text-xs text-yellow-500 hover:text-yellow-400 transition-colors"
                  >
                    Refresh
                  </button>
                </div>
              </div>

              {/* Add new score */}
              <div className="flex gap-2 mb-4 p-3 bg-zinc-900/50 rounded-lg border border-zinc-800">
                <input
                  type="text"
                  placeholder="Player name"
                  value={newEntry.playerName}
                  onChange={(e) => setNewEntry({ ...newEntry, playerName: e.target.value })}
                  className="flex-1 px-3 py-1.5 bg-zinc-900 border border-zinc-800 rounded text-xs text-white placeholder-zinc-600 focus:outline-none focus:border-yellow-500/30"
                />
                <input
                  type="number"
                  placeholder="Score"
                  value={newEntry.score}
                  onChange={(e) => setNewEntry({ ...newEntry, score: e.target.value })}
                  className="w-24 px-3 py-1.5 bg-zinc-900 border border-zinc-800 rounded text-xs text-white placeholder-zinc-600 focus:outline-none focus:border-yellow-500/30"
                />
                <button
                  onClick={addPublicScore}
                  className="px-3 py-1.5 bg-yellow-500/20 border border-yellow-500/30 rounded text-xs text-yellow-400 hover:bg-yellow-500/30 transition-colors whitespace-nowrap"
                >
                  Add Score
                </button>
              </div>

              {/* Score table */}
              <div className="bg-zinc-900/30 border border-zinc-800 rounded-lg overflow-hidden">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-zinc-800 bg-zinc-900/50">
                      <th className="text-left py-2.5 px-4 text-zinc-500 font-medium">#</th>
                      <th className="text-left py-2.5 px-4 text-zinc-500 font-medium">Player</th>
                      <th className="text-right py-2.5 px-4 text-zinc-500 font-medium">Score</th>
                      <th className="text-right py-2.5 px-4 text-zinc-500 font-medium">Date</th>
                      <th className="text-right py-2.5 px-4 text-zinc-500 font-medium">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {publicScores.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="text-center py-8 text-zinc-600">
                          No public scores yet. Firebase database not configured.
                        </td>
                      </tr>
                    ) : (
                      publicScores.slice(0, 50).map((entry, i) => (
                        <tr key={entry.id} className="border-b border-zinc-800/50 hover:bg-zinc-800/20">
                          <td className="py-2 px-4 text-zinc-500 font-mono">{i + 1}</td>
                          <td className="py-2 px-4">
                            <span className={`font-medium ${i === 0 ? 'text-yellow-400' : i === 1 ? 'text-zinc-300' : i === 2 ? 'text-amber-600' : 'text-zinc-400'}`}>
                              {entry.playerName}
                            </span>
                          </td>
                          <td className="py-2 px-4 text-right font-mono text-zinc-300">{entry.score.toLocaleString()}</td>
                          <td className="py-2 px-4 text-right text-zinc-600">{entry.date}</td>
                          <td className="py-2 px-4 text-right">
                            <button
                              onClick={() => deleteScore(entry.id)}
                              className="text-red-500/50 hover:text-red-400 transition-colors"
                            >
                              ✕
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Local Scores */}
            <div>
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-sm font-semibold text-zinc-300">Local Device Scores</h2>
                <button
                  onClick={clearLocalScores}
                  className="text-xs text-red-500/50 hover:text-red-400 transition-colors"
                >
                  Clear All
                </button>
              </div>
              <div className="bg-zinc-900/30 border border-zinc-800 rounded-lg overflow-hidden">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-zinc-800 bg-zinc-900/50">
                      <th className="text-left py-2.5 px-4 text-zinc-500 font-medium">#</th>
                      <th className="text-right py-2.5 px-4 text-zinc-500 font-medium">Score</th>
                      <th className="text-right py-2.5 px-4 text-zinc-500 font-medium">Date</th>
                    </tr>
                  </thead>
                  <tbody>
                    {localScores.length === 0 ? (
                      <tr>
                        <td colSpan={3} className="text-center py-8 text-zinc-600">No local scores yet.</td>
                      </tr>
                    ) : (
                      localScores.map((s, i) => (
                        <tr key={i} className="border-b border-zinc-800/50">
                          <td className="py-2 px-4 text-zinc-500 font-mono">{i + 1}</td>
                          <td className="py-2 px-4 text-right font-mono text-zinc-300">{s.score.toLocaleString()}</td>
                          <td className="py-2 px-4 text-right text-zinc-600">{s.date}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* Tab: Config */}
        {activeTab === 'config' && (
          <div>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-semibold text-zinc-300">Game Configuration</h2>
              <button
                onClick={saveConfig}
                disabled={saving}
                className={`px-4 py-1.5 rounded text-xs font-medium transition-all ${
                  configDirty
                    ? 'bg-yellow-500/20 border border-yellow-500/30 text-yellow-400 hover:bg-yellow-500/30'
                    : 'bg-zinc-800 text-zinc-600 cursor-not-allowed'
                }`}
              >
                {saving ? 'Saving...' : configDirty ? 'Save Changes' : 'Saved'}
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {Object.entries(config).map(([key, val]) => (
                <div key={key} className="bg-zinc-900/30 border border-zinc-800 rounded-lg p-4">
                  <label className="block text-xs text-zinc-500 mb-1.5 capitalize">
                    {key.replace(/([A-Z])/g, ' $1').trim()}
                  </label>
                  <input
                    type="number"
                    value={val}
                    onChange={(e) => {
                      setConfig({ ...config, [key]: parseFloat(e.target.value) || 0 });
                      setConfigDirty(true);
                    }}
                    className="w-full px-3 py-1.5 bg-zinc-900 border border-zinc-800 rounded text-sm text-white focus:outline-none focus:border-yellow-500/30"
                  />
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Tab: Analytics */}
        {activeTab === 'analytics' && (
          <div>
            <h2 className="text-sm font-semibold text-zinc-300 mb-4">Analytics Overview</h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
              {[
                { label: 'Total Public Scores', value: publicScores.length, color: 'text-yellow-400' },
                { label: 'Top Score (Public)', value: publicScores[0]?.score?.toLocaleString() || 'N/A', color: 'text-green-400' },
                { label: 'Local Scores Stored', value: localScores.length, color: 'text-blue-400' },
                { label: 'Unique Players', value: new Set(publicScores.map(s => s.playerName)).size, color: 'text-purple-400' },
              ].map((stat) => (
                <div key={stat.label} className="bg-zinc-900/30 border border-zinc-800 rounded-lg p-4">
                  <p className="text-xs text-zinc-500 mb-1">{stat.label}</p>
                  <p className={`text-2xl font-bold font-mono ${stat.color}`}>{stat.value}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Tab: Owner-only gameplay preview */}
        {activeTab === 'preview' && (
          <div className="overflow-hidden rounded-2xl border border-zinc-800 bg-gradient-to-br from-zinc-900/80 via-black to-indigo-950/30 shadow-2xl shadow-black/40">
            <div className="relative px-5 py-8 sm:px-8 sm:py-10">
              <div className="pointer-events-none absolute -right-20 -top-24 h-64 w-64 rounded-full bg-indigo-500/10 blur-3xl" />
              <div className="pointer-events-none absolute -bottom-24 left-16 h-56 w-56 rounded-full bg-orange-500/10 blur-3xl" />

              <div className="relative max-w-2xl">
                <div className="mb-4 flex flex-wrap items-center gap-2">
                  <span className="rounded-full border border-green-400/25 bg-green-400/10 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.16em] text-green-300">
                    Owner Preview
                  </span>
                  <span className="rounded-full border border-yellow-400/25 bg-yellow-400/10 px-3 py-1 text-[10px] font-medium text-yellow-300">
                    Version 1.0.1
                  </span>
                </div>

                <h2 className="mb-3 text-2xl font-black tracking-tight text-white sm:text-4xl">
                  Test the next STARDRIFT controls
                </h2>
                <p className="max-w-xl text-sm leading-6 text-zinc-400">
                  Launch a private, full-screen gameplay session with the new analog joystick,
                  star collection, score tracking, asteroid dodging, and arcade sound effects.
                </p>

                <button
                  type="button"
                  onClick={launchPreview}
                  className="mt-7 inline-flex min-h-14 w-full items-center justify-center gap-3 rounded-xl
                             border border-yellow-200/60 bg-gradient-to-r from-yellow-300 via-orange-400 to-orange-500
                             px-6 py-3 text-sm font-black uppercase tracking-[0.12em] text-black shadow-lg
                             shadow-orange-500/20 transition-transform active:scale-[0.97] sm:w-auto"
                >
                  <span aria-hidden="true" className="text-lg">▶</span>
                  Launch Interactive Preview
                </button>

                <p className="mt-3 text-[11px] text-zinc-600">
                  Private to the signed-in owner. The public game remains unchanged.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-2 border-t border-zinc-800/80 bg-black/30 sm:grid-cols-4">
              {[
                ['360°', 'Analog movement'],
                ['★', 'Eat the stars'],
                ['3', 'Sound effects'],
                ['PRIVATE', 'Owner access'],
              ].map(([value, label]) => (
                <div key={label} className="border-b border-r border-zinc-800/70 px-4 py-4 last:border-r-0 sm:border-b-0">
                  <p className="font-mono text-sm font-bold text-yellow-300">{value}</p>
                  <p className="mt-1 text-[10px] uppercase tracking-wider text-zinc-600">{label}</p>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {previewOpen && (
        <div
          className="fixed inset-0 z-[100] overflow-hidden bg-black"
          role="dialog"
          aria-modal="true"
          aria-label="Interactive gameplay preview"
        >
          <Game
            key={previewRun}
            enhancedControls
            onGameOver={(finalScore) => {
              setPreviewScore(finalScore);
              setPreviewGameOver(true);
            }}
            onPause={() => {}}
            setScore={setPreviewScore}
          />

          <div
            className="pointer-events-none absolute inset-x-0 top-0 z-[60] flex items-center justify-between
                       bg-gradient-to-b from-black/90 via-black/55 to-transparent px-3 pb-12 pt-3 sm:px-5"
            style={{ paddingTop: 'calc(env(safe-area-inset-top) + 12px)' }}
          >
            <div>
              <div className="flex items-center gap-2">
                <span className="text-sm font-black tracking-wider text-yellow-300">STARDRIFT</span>
                <span className="rounded bg-white/10 px-2 py-0.5 text-[9px] uppercase tracking-wider text-zinc-300">
                  Preview
                </span>
              </div>
              <p className="mt-1 font-mono text-[10px] text-zinc-500">Score {previewScore}</p>
            </div>

            <div className="pointer-events-auto flex items-center gap-2">
              <button
                type="button"
                onClick={restartPreview}
                className="min-h-11 rounded-full border border-white/15 bg-black/55 px-4 text-[11px] font-bold
                           uppercase tracking-wider text-white backdrop-blur-md active:scale-95"
              >
                Restart
              </button>
              <button
                type="button"
                onClick={() => setPreviewOpen(false)}
                aria-label="Close interactive preview"
                className="flex h-11 w-11 items-center justify-center rounded-full border border-white/15
                           bg-black/55 text-xl text-white backdrop-blur-md active:scale-95"
              >
                ×
              </button>
            </div>
          </div>

          {previewGameOver && (
            <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/75 px-6 backdrop-blur-sm">
              <div className="w-full max-w-xs rounded-2xl border border-zinc-700 bg-zinc-950/95 p-7 text-center shadow-2xl">
                <p className="mb-2 text-[10px] font-bold uppercase tracking-[0.28em] text-orange-400">Preview complete</p>
                <p className="text-sm text-zinc-500">Final score</p>
                <p className="mb-6 mt-1 font-mono text-5xl font-black text-yellow-300">{previewScore}</p>
                <button
                  type="button"
                  onClick={restartPreview}
                  className="min-h-12 w-full rounded-xl bg-yellow-400 text-xs font-black uppercase tracking-wider text-black active:scale-[0.98]"
                >
                  Play Again
                </button>
                <button
                  type="button"
                  onClick={() => setPreviewOpen(false)}
                  className="mt-3 min-h-11 w-full rounded-xl border border-zinc-800 text-xs font-bold text-zinc-400"
                >
                  Return to Admin
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
