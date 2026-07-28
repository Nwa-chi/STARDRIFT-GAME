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
          <div>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between mb-5">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <h2 className="text-sm font-semibold text-zinc-300">Gameplay Preview</h2>
                  <span className="rounded-full border border-yellow-400/25 bg-yellow-400/10 px-2 py-0.5 text-[10px] font-medium text-yellow-300">
                    Version 1.0.1
                  </span>
                </div>
                <p className="text-xs text-zinc-500">
                  Owner-only test area. These controls are not published to players.
                </p>
              </div>
              <button
                type="button"
                onClick={restartPreview}
                className="w-fit rounded-md border border-yellow-500/30 bg-yellow-500/15 px-4 py-2 text-xs font-medium text-yellow-300 transition-colors hover:bg-yellow-500/25"
              >
                Restart Preview
              </button>
            </div>

            <div className="grid gap-5 lg:grid-cols-[minmax(0,390px)_1fr]">
              <div className="relative mx-auto aspect-[9/16] w-full max-w-[390px] overflow-hidden rounded-[2rem] border-4 border-zinc-700 bg-black shadow-2xl shadow-black lg:mx-0">
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

                {previewGameOver && (
                  <div className="absolute inset-0 z-30 flex items-center justify-center bg-black/70 backdrop-blur-sm">
                    <div className="text-center">
                      <p className="mb-1 text-xs uppercase tracking-[0.25em] text-zinc-500">Preview score</p>
                      <p className="mb-5 font-mono text-4xl font-bold text-yellow-300">{previewScore}</p>
                      <button
                        type="button"
                        onClick={restartPreview}
                        className="rounded-full border border-yellow-300/40 bg-yellow-400 px-5 py-2 text-xs font-black uppercase tracking-wider text-black"
                      >
                        Try Again
                      </button>
                    </div>
                  </div>
                )}
              </div>

              <div className="h-fit rounded-xl border border-zinc-800 bg-zinc-900/30 p-5">
                <h3 className="mb-4 text-sm font-semibold text-zinc-300">What to test</h3>
                <div className="space-y-3 text-xs text-zinc-500">
                  <p><span className="text-indigo-300">Joystick:</span> drag the bottom-left control to move in every direction.</p>
                  <p><span className="text-orange-300">Fire:</span> press or hold the bottom-right button to shoot.</p>
                  <p><span className="text-yellow-300">Sound:</span> listen for shooting, star collection, asteroid destruction, and game-over effects.</p>
                  <p><span className="text-zinc-300">Desktop:</span> WASD or arrow keys move; Space shoots.</p>
                </div>
                <div className="mt-5 rounded-lg border border-green-500/20 bg-green-500/5 p-3">
                  <p className="text-xs text-green-400">Current preview score: <span className="font-mono font-bold">{previewScore}</span></p>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
