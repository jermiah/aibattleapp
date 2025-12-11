'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/lib/auth';
import { useRouter } from 'next/navigation';
import {
  subscribeToStartups,
  subscribeToMatches,
  addStartups,
  clearStartups,
  createMatch,
  startMatch,
  advancePhase,
  deleteMatch,
  updateMatchWeights,
  setActiveMatch,
  getActiveMatch,
  getEventSettings,
  updateEventSettings,
  subscribeToEventSettings,
  resetVoterCounts,
} from '@/lib/database';
import { parseFile } from '@/lib/excel';
import { Match, Startup, EventSettings } from '@/lib/types';
import { QRCodeSVG } from 'qrcode.react';
import {
  LogOut,
  Upload,
  Plus,
  Play,
  Square,
  Trash2,
  Settings,
  Monitor,
  Users,
  Gavel,
  Trophy,
  RefreshCw,
  Key,
  QrCode,
} from 'lucide-react';

export default function AdminPage() {
  const { user, loading, signIn, signOut } = useAuth();
  const router = useRouter();
  
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [authError, setAuthError] = useState('');
  const [authLoading, setAuthLoading] = useState(false);
  
  const [startups, setStartups] = useState<Startup[]>([]);
  const [matches, setMatches] = useState<Match[]>([]);
  const [activeMatchId, setActiveMatchId] = useState<string | null>(null);
  
  const [selectedStartup1, setSelectedStartup1] = useState('');
  const [selectedStartup2, setSelectedStartup2] = useState('');
  const [votingDuration, setVotingDuration] = useState(60);
  const [pitchDuration, setPitchDuration] = useState(90);
  const [judgeWeight, setJudgeWeight] = useState(70);
  
  const [showQRModal, setShowQRModal] = useState(false);
  const [selectedMatch, setSelectedMatch] = useState<Match | null>(null);
  
  const [uploading, setUploading] = useState(false);
  
  // Event settings
  const [eventSettings, setEventSettings] = useState<EventSettings | null>(null);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [settingsForm, setSettingsForm] = useState({
    judgePassword: '',
    audiencePassword: '',
    maxJudgeSignIns: 10,
    maxAudienceSignIns: 100,
  });

  useEffect(() => {
    if (!loading && !user) return;
    
    const unsubStartups = subscribeToStartups(setStartups);
    const unsubMatches = subscribeToMatches(setMatches);
    const unsubSettings = subscribeToEventSettings((settings) => {
      setEventSettings(settings);
      setSettingsForm({
        judgePassword: settings.judgePassword || '',
        audiencePassword: settings.audiencePassword || '',
        maxJudgeSignIns: settings.maxJudgeSignIns || 10,
        maxAudienceSignIns: settings.maxAudienceSignIns || 100,
      });
    });
    
    getActiveMatch().then(setActiveMatchId);
    
    return () => {
      unsubStartups();
      unsubMatches();
      unsubSettings();
    };
  }, [user, loading]);

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError('');
    setAuthLoading(true);
    try {
      await signIn(email, password);
    } catch (error: any) {
      setAuthError(error.message || 'Failed to sign in');
    } finally {
      setAuthLoading(false);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    setUploading(true);
    try {
      const parsedStartups = await parseFile(file);
      console.log('Parsed startups count:', parsedStartups.length);
      console.log('Parsed startups:', parsedStartups);
      
      if (parsedStartups.length === 0) {
        alert('No startups found in the file. Make sure your Excel has data with a header row (e.g., "Name" column).');
        return;
      }
      
      await addStartups(parsedStartups);
      alert(`Successfully uploaded ${parsedStartups.length} startups!`);
    } catch (error: any) {
      console.error('Upload error:', error);
      alert(`Failed to upload: ${error.message || 'Unknown error'}`);
    } finally {
      setUploading(false);
      e.target.value = '';
    }
  };

  const handleClearStartups = async () => {
    if (confirm('Are you sure you want to clear all startups?')) {
      await clearStartups();
    }
  };

  const handleCreateMatch = async () => {
    if (!selectedStartup1 || !selectedStartup2) {
      alert('Please select both startups');
      return;
    }
    if (selectedStartup1 === selectedStartup2) {
      alert('Please select different startups');
      return;
    }
    
    const startup1 = startups.find(s => s.id === selectedStartup1);
    const startup2 = startups.find(s => s.id === selectedStartup2);
    
    if (!startup1 || !startup2) return;
    
    await createMatch(startup1, startup2, votingDuration, pitchDuration, judgeWeight, 100 - judgeWeight);
    setSelectedStartup1('');
    setSelectedStartup2('');
  };

  const handleStartMatch = async (matchId: string) => {
    await startMatch(matchId);
    await setActiveMatch(matchId);
    setActiveMatchId(matchId);
  };

  const handleAdvancePhase = async (matchId: string) => {
    await advancePhase(matchId);
  };

  const handleDeleteMatch = async (matchId: string) => {
    if (confirm('Are you sure you want to delete this match?')) {
      await deleteMatch(matchId);
      if (activeMatchId === matchId) {
        await setActiveMatch(null);
        setActiveMatchId(null);
      }
    }
  };

  const handleSetActiveMatch = async (matchId: string) => {
    await setActiveMatch(matchId);
    setActiveMatchId(matchId);
  };

  const showQRCodes = (match: Match) => {
    setSelectedMatch(match);
    setShowQRModal(true);
  };

  const getBaseUrl = () => {
    if (typeof window !== 'undefined') {
      return window.location.origin;
    }
    return '';
  };

  const getWinnerName = (match: Match) => {
    if (!match.winner) return null;
    if (match.winner === 'tie') return 'Tie';
    return match.winner === 'startup1' ? match.startup1.name : match.startup2.name;
  };

  const calculateScore = (match: Match, startup: 'startup1' | 'startup2') => {
    const judgeVotes = match.judgeVotes[startup];
    const audienceVotes = match.audienceVotes[startup];
    return (judgeVotes * match.judgeWeight / 100) + (audienceVotes * match.audienceWeight / 100);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <RefreshCw className="w-8 h-8 text-purple-400 animate-spin" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-purple-900 to-gray-900 flex items-center justify-center p-4">
        <div className="bg-gray-800/50 backdrop-blur-sm border border-gray-700 rounded-2xl p-8 w-full max-w-md">
          <h1 className="text-3xl font-bold text-white mb-6 text-center">Admin Login</h1>
          
          <form onSubmit={handleSignIn} className="space-y-4">
            <div>
              <label className="block text-gray-300 mb-2">Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full bg-gray-700 border border-gray-600 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-purple-500"
                required
              />
            </div>
            <div>
              <label className="block text-gray-300 mb-2">Password</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-gray-700 border border-gray-600 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-purple-500"
                required
              />
            </div>
            
            {authError && (
              <p className="text-red-400 text-sm">{authError}</p>
            )}
            
            <button
              type="submit"
              disabled={authLoading}
              className="w-full bg-purple-600 hover:bg-purple-700 text-white font-semibold py-3 rounded-lg transition-colors disabled:opacity-50"
            >
              {authLoading ? 'Signing in...' : 'Sign In'}
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      {/* Header */}
      <header className="bg-gray-800 border-b border-gray-700 px-6 py-4">
        <div className="flex items-center justify-between max-w-7xl mx-auto">
          <h1 className="text-2xl font-bold text-purple-400">Admin Panel</h1>
          <div className="flex items-center gap-4">
            <span className="text-gray-400">{user.email}</span>
            <button
              onClick={signOut}
              className="flex items-center gap-2 bg-gray-700 hover:bg-gray-600 px-4 py-2 rounded-lg transition-colors"
            >
              <LogOut className="w-4 h-4" />
              Sign Out
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto p-6 space-y-8">
        {/* Event Settings */}
        <section className="bg-gray-800/50 border border-gray-700 rounded-xl p-6">
          <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
            <Key className="w-5 h-5 text-purple-400" />
            Event Settings
          </h2>
          
          {eventSettings && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
              <div>
                <label className="block text-gray-400 mb-2 text-sm">Judge Password</label>
                <input
                  type="text"
                  value={settingsForm.judgePassword}
                  onChange={(e) => setSettingsForm({ ...settingsForm, judgePassword: e.target.value })}
                  className="w-full bg-gray-700 border border-gray-600 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-purple-500"
                />
              </div>
              <div>
                <label className="block text-gray-400 mb-2 text-sm">Audience Password</label>
                <input
                  type="text"
                  value={settingsForm.audiencePassword}
                  onChange={(e) => setSettingsForm({ ...settingsForm, audiencePassword: e.target.value })}
                  className="w-full bg-gray-700 border border-gray-600 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-purple-500"
                />
              </div>
              <div>
                <label className="block text-gray-400 mb-2 text-sm">Max Judges</label>
                <input
                  type="number"
                  value={settingsForm.maxJudgeSignIns}
                  onChange={(e) => setSettingsForm({ ...settingsForm, maxJudgeSignIns: Number(e.target.value) })}
                  min={1}
                  className="w-full bg-gray-700 border border-gray-600 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-purple-500"
                />
              </div>
              <div>
                <label className="block text-gray-400 mb-2 text-sm">Max Audience</label>
                <input
                  type="number"
                  value={settingsForm.maxAudienceSignIns}
                  onChange={(e) => setSettingsForm({ ...settingsForm, maxAudienceSignIns: Number(e.target.value) })}
                  min={1}
                  className="w-full bg-gray-700 border border-gray-600 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-purple-500"
                />
              </div>
            </div>
          )}
          
          <div className="flex flex-wrap gap-4 items-center">
            <button
              onClick={() => updateEventSettings(settingsForm)}
              className="flex items-center gap-2 bg-purple-600 hover:bg-purple-700 px-4 py-2 rounded-lg transition-colors"
            >
              <Settings className="w-4 h-4" />
              Save Settings
            </button>
            
            <button
              onClick={() => {
                if (confirm('Reset all voter registrations? This will allow everyone to sign up again.')) {
                  resetVoterCounts();
                }
              }}
              className="flex items-center gap-2 bg-orange-600 hover:bg-orange-700 px-4 py-2 rounded-lg transition-colors"
            >
              <RefreshCw className="w-4 h-4" />
              Reset Voters
            </button>
            
            {eventSettings && (
              <div className="flex gap-4 text-sm text-gray-400">
                <span>Judges: {eventSettings.currentJudgeCount}/{eventSettings.maxJudgeSignIns}</span>
                <span>Audience: {eventSettings.currentAudienceCount}/{eventSettings.maxAudienceSignIns}</span>
              </div>
            )}
          </div>
        </section>

        {/* Startup Management */}
        <section className="bg-gray-800/50 border border-gray-700 rounded-xl p-6">
          <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
            <Users className="w-5 h-5 text-purple-400" />
            Startup Management
          </h2>
          
          <div className="flex flex-wrap gap-4 mb-4">
            <label className="flex items-center gap-2 bg-purple-600 hover:bg-purple-700 px-4 py-2 rounded-lg cursor-pointer transition-colors">
              <Upload className="w-4 h-4" />
              {uploading ? 'Uploading...' : 'Upload CSV'}
              <input
                type="file"
                accept=".csv,.txt"
                onChange={handleFileUpload}
                className="hidden"
                disabled={uploading}
              />
            </label>
            
            <button
              onClick={handleClearStartups}
              className="flex items-center gap-2 bg-red-600 hover:bg-red-700 px-4 py-2 rounded-lg transition-colors"
            >
              <Trash2 className="w-4 h-4" />
              Clear All
            </button>
          </div>
          
          <div className="bg-gray-900/50 rounded-lg p-4">
            <p className="text-gray-400 mb-2">
              {startups.length} startups loaded
            </p>
            <div className="flex flex-wrap gap-2">
              {startups.slice(0, 20).map((startup) => (
                <span
                  key={startup.id}
                  className="bg-gray-700 px-3 py-1 rounded-full text-sm"
                >
                  {startup.name}
                </span>
              ))}
              {startups.length > 20 && (
                <span className="text-gray-500 text-sm">
                  +{startups.length - 20} more
                </span>
              )}
            </div>
          </div>
        </section>

        {/* Create Match */}
        <section className="bg-gray-800/50 border border-gray-700 rounded-xl p-6">
          <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
            <Plus className="w-5 h-5 text-purple-400" />
            Create Match
          </h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
            <div>
              <label className="block text-gray-400 mb-2 text-sm">Startup 1</label>
              <select
                value={selectedStartup1}
                onChange={(e) => setSelectedStartup1(e.target.value)}
                className="w-full bg-gray-700 border border-gray-600 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-purple-500"
              >
                <option value="">Select startup...</option>
                {startups.map((startup) => (
                  <option key={startup.id} value={startup.id}>
                    {startup.name}
                  </option>
                ))}
              </select>
            </div>
            
            <div>
              <label className="block text-gray-400 mb-2 text-sm">Startup 2</label>
              <select
                value={selectedStartup2}
                onChange={(e) => setSelectedStartup2(e.target.value)}
                className="w-full bg-gray-700 border border-gray-600 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-purple-500"
              >
                <option value="">Select startup...</option>
                {startups.map((startup) => (
                  <option key={startup.id} value={startup.id}>
                    {startup.name}
                  </option>
                ))}
              </select>
            </div>
            
            <div>
              <label className="block text-gray-400 mb-2 text-sm">Pitch Duration (sec)</label>
              <input
                type="number"
                value={pitchDuration}
                onChange={(e) => setPitchDuration(Number(e.target.value))}
                min={30}
                max={300}
                className="w-full bg-gray-700 border border-gray-600 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-purple-500"
              />
            </div>
            
            <div>
              <label className="block text-gray-400 mb-2 text-sm">Voting Duration (sec)</label>
              <input
                type="number"
                value={votingDuration}
                onChange={(e) => setVotingDuration(Number(e.target.value))}
                min={10}
                max={300}
                className="w-full bg-gray-700 border border-gray-600 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-purple-500"
              />
            </div>
            
            <div>
              <label className="block text-gray-400 mb-2 text-sm">Judge Weight: {judgeWeight}%</label>
              <input
                type="range"
                value={judgeWeight}
                onChange={(e) => setJudgeWeight(Number(e.target.value))}
                min={0}
                max={100}
                className="w-full"
              />
              <p className="text-xs text-gray-500">Audience: {100 - judgeWeight}%</p>
            </div>
          </div>
          
          <button
            onClick={handleCreateMatch}
            disabled={!selectedStartup1 || !selectedStartup2}
            className="flex items-center gap-2 bg-purple-600 hover:bg-purple-700 px-6 py-2 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Plus className="w-4 h-4" />
            Create Match
          </button>
        </section>

        {/* Matches List */}
        <section className="bg-gray-800/50 border border-gray-700 rounded-xl p-6">
          <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
            <Trophy className="w-5 h-5 text-purple-400" />
            Matches ({matches.length})
          </h2>
          
          <div className="space-y-4">
            {matches.length === 0 ? (
              <p className="text-gray-500 text-center py-8">No matches created yet</p>
            ) : (
              matches.map((match) => (
                <div
                  key={match.id}
                  className={`bg-gray-900/50 border rounded-xl p-4 ${
                    activeMatchId === match.id ? 'border-purple-500' : 'border-gray-700'
                  }`}
                >
                  <div className="flex flex-wrap items-center justify-between gap-4">
                    <div className="flex-1 min-w-[200px]">
                      <div className="flex items-center gap-2 mb-2">
                        <span className={`px-2 py-1 rounded text-xs font-medium ${
                          match.status === 'pending' ? 'bg-yellow-600' :
                          match.status === 'selecting' ? 'bg-purple-600' :
                          match.status === 'pitch1' ? 'bg-green-600' :
                          match.status === 'pitch2' ? 'bg-green-600' :
                          match.status === 'voting' ? 'bg-blue-600' :
                          match.status === 'completed' ? 'bg-gray-600' :
                          'bg-gray-600'
                        }`}>
                          {match.status.toUpperCase()}
                        </span>
                        {activeMatchId === match.id && (
                          <span className="px-2 py-1 rounded text-xs font-medium bg-purple-600">
                            ACTIVE ON DISPLAY
                          </span>
                        )}
                      </div>
                      
                      <div className="text-lg font-semibold">
                        {match.startup1.name} <span className="text-gray-500">vs</span> {match.startup2.name}
                      </div>
                      
                      {match.status !== 'pending' && (
                        <div className="mt-2 grid grid-cols-2 gap-4 text-sm">
                          <div>
                            <p className="text-gray-400">{match.startup1.name}</p>
                            <p className="flex items-center gap-2">
                              <Gavel className="w-3 h-3" /> {match.judgeVotes.startup1}
                              <Users className="w-3 h-3 ml-2" /> {match.audienceVotes.startup1}
                              <span className="text-purple-400 ml-2">
                                Score: {calculateScore(match, 'startup1').toFixed(1)}
                              </span>
                            </p>
                          </div>
                          <div>
                            <p className="text-gray-400">{match.startup2.name}</p>
                            <p className="flex items-center gap-2">
                              <Gavel className="w-3 h-3" /> {match.judgeVotes.startup2}
                              <Users className="w-3 h-3 ml-2" /> {match.audienceVotes.startup2}
                              <span className="text-purple-400 ml-2">
                                Score: {calculateScore(match, 'startup2').toFixed(1)}
                              </span>
                            </p>
                          </div>
                        </div>
                      )}
                      
                      {match.winner && (
                        <p className="mt-2 text-green-400 font-semibold">
                          Winner: {getWinnerName(match)}
                        </p>
                      )}
                    </div>
                    
                    <div className="flex flex-wrap gap-2">
                      {match.status === 'pending' && (
                        <button
                          onClick={() => handleStartMatch(match.id)}
                          className="flex items-center gap-2 bg-green-600 hover:bg-green-700 px-4 py-2 rounded-lg transition-colors"
                        >
                          <Play className="w-4 h-4" />
                          Start Match
                        </button>
                      )}
                      
                      {(match.status === 'pitch1' || match.status === 'pitch2' || match.status === 'voting') && (
                        <button
                          onClick={() => handleAdvancePhase(match.id)}
                          className="flex items-center gap-2 bg-orange-600 hover:bg-orange-700 px-4 py-2 rounded-lg transition-colors"
                        >
                          <Square className="w-4 h-4" />
                          Skip Phase
                        </button>
                      )}
                      
                      <button
                        onClick={() => showQRCodes(match)}
                        className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 px-4 py-2 rounded-lg transition-colors"
                      >
                        QR Codes
                      </button>
                      
                      {activeMatchId !== match.id && (
                        <button
                          onClick={() => handleSetActiveMatch(match.id)}
                          className="flex items-center gap-2 bg-purple-600 hover:bg-purple-700 px-4 py-2 rounded-lg transition-colors"
                        >
                          <Monitor className="w-4 h-4" />
                          Set Active
                        </button>
                      )}
                      
                      <button
                        onClick={() => handleDeleteMatch(match.id)}
                        className="flex items-center gap-2 bg-gray-700 hover:bg-red-600 px-4 py-2 rounded-lg transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </section>
      </main>

      {/* QR Code Modal */}
      {showQRModal && selectedMatch && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center p-4 z-50">
          <div className="bg-gray-800 rounded-2xl p-8 max-w-2xl w-full">
            <h2 className="text-2xl font-bold text-center mb-6">
              Voting QR Code
            </h2>
            <p className="text-center text-gray-400 mb-4">
              {selectedMatch.startup1.name} vs {selectedMatch.startup2.name}
            </p>
            
            <div className="text-center">
              <div className="bg-white p-6 rounded-xl inline-block">
                <QRCodeSVG
                  value={`${getBaseUrl()}/vote/${selectedMatch.voteCode}`}
                  size={250}
                />
              </div>
              <p className="mt-4 text-gray-400 text-sm break-all">
                {getBaseUrl()}/vote/{selectedMatch.voteCode}
              </p>
            </div>
            
            {eventSettings && (
              <div className="mt-6 bg-gray-900/50 rounded-lg p-4">
                <h3 className="text-lg font-semibold mb-3 text-center">Passwords for Participants</h3>
                <div className="grid grid-cols-2 gap-4 text-center">
                  <div>
                    <p className="text-purple-400 text-sm flex items-center justify-center gap-1">
                      <Gavel className="w-4 h-4" /> Judge Password
                    </p>
                    <p className="text-white font-mono text-lg">{eventSettings.judgePassword}</p>
                  </div>
                  <div>
                    <p className="text-blue-400 text-sm flex items-center justify-center gap-1">
                      <Users className="w-4 h-4" /> Audience Password
                    </p>
                    <p className="text-white font-mono text-lg">{eventSettings.audiencePassword}</p>
                  </div>
                </div>
              </div>
            )}
            
            <div className="mt-6 text-center">
              <button
                onClick={() => setShowQRModal(false)}
                className="bg-gray-700 hover:bg-gray-600 px-8 py-3 rounded-lg transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
