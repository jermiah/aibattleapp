'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import {
  getMatchByCode,
  castVote,
  hasVoted,
  subscribeToMatch,
  subscribeToMatches,
  registerVoter,
  getVoter,
  getEventSettings,
  subscribeToVoterVotes,
} from '@/lib/database';
import { Match, Vote, Voter, EventSettings } from '@/lib/types';
import { CheckCircle, XCircle, Clock, Trophy, Gavel, Users, RefreshCw, Mail, Key, History, Mic } from 'lucide-react';

export default function VotePage() {
  const params = useParams();
  const code = params.code as string;

  // Auth state
  const [isSignedIn, setIsSignedIn] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [voterType, setVoterType] = useState<'judge' | 'audience' | null>(null);
  const [authError, setAuthError] = useState('');
  const [authLoading, setAuthLoading] = useState(false);
  const [eventSettings, setEventSettings] = useState<EventSettings | null>(null);

  // Match state
  const [matches, setMatches] = useState<Match[]>([]);
  const [activeMatch, setActiveMatch] = useState<Match | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [timeLeft, setTimeLeft] = useState<number | null>(null);

  // Voting state
  const [voting, setVoting] = useState(false);
  const [voteHistory, setVoteHistory] = useState<Vote[]>([]);
  const [hasVotedCurrentMatch, setHasVotedCurrentMatch] = useState(false);

  // Check for existing session on mount
  useEffect(() => {
    const savedEmail = localStorage.getItem('voterEmail');
    const savedType = localStorage.getItem('voterType') as 'judge' | 'audience' | null;

    if (savedEmail && savedType) {
      // Verify the voter still exists
      getVoter(savedEmail).then((voter) => {
        if (voter) {
          setEmail(savedEmail);
          setVoterType(savedType);
          setIsSignedIn(true);
        } else {
          // Clear invalid session
          localStorage.removeItem('voterEmail');
          localStorage.removeItem('voterType');
        }
      });
    }

    // Load event settings
    getEventSettings().then(setEventSettings);
  }, []);

  // Subscribe to matches when signed in
  useEffect(() => {
    if (!isSignedIn) {
      setLoading(false);
      return;
    }

    const unsubMatches = subscribeToMatches((allMatches) => {
      setMatches(allMatches);
      // Find active match (one that's not completed, preferring voting > pitch > selecting > pending)
      const active = allMatches.find(m => m.status === 'voting') ||
        allMatches.find(m => m.status === 'pitch2') ||
        allMatches.find(m => m.status === 'pitch1') ||
        allMatches.find(m => m.status === 'selecting') ||
        allMatches.find(m => m.status === 'pending');
      setActiveMatch(active || null);
      setLoading(false);
    });

    return () => unsubMatches();
  }, [isSignedIn]);

  // Subscribe to vote history when signed in
  useEffect(() => {
    if (!isSignedIn || !email) return;

    const unsubVotes = subscribeToVoterVotes(email, (votes) => {
      setVoteHistory(votes);
    });

    return () => unsubVotes();
  }, [isSignedIn, email]);

  // Check if already voted for current match
  useEffect(() => {
    if (!activeMatch || !email) {
      setHasVotedCurrentMatch(false);
      return;
    }

    hasVoted(activeMatch.id, email).then(setHasVotedCurrentMatch);
  }, [activeMatch?.id, email, voteHistory]);

  // Timer for current phase
  useEffect(() => {
    if (!activeMatch?.phaseEndTime) {
      setTimeLeft(null);
      return;
    }

    const updateTimer = () => {
      const remaining = Math.max(0, Math.floor((activeMatch.phaseEndTime! - Date.now()) / 1000));
      setTimeLeft(remaining);
    };

    updateTimer();
    const interval = setInterval(updateTimer, 1000);

    return () => clearInterval(interval);
  }, [activeMatch?.phaseEndTime]);

  const validateEmail = (email: string): boolean => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) return false;

    // Check for allowed domains
    const allowedDomains = eventSettings?.allowedEmailDomains || ['.com', '.ai', '.edu', '.org', '.net', '.io', '.co'];
    const domain = email.substring(email.lastIndexOf('.'));
    return allowedDomains.some(d => email.toLowerCase().endsWith(d));
  };

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError('');
    setAuthLoading(true);

    try {
      // Validate email format
      if (!validateEmail(email)) {
        setAuthError('Please enter a valid email with a common domain (.com, .ai, .edu, etc.)');
        setAuthLoading(false);
        return;
      }

      // Check password and determine voter type
      if (!eventSettings) {
        setAuthError('Unable to load event settings. Please try again.');
        setAuthLoading(false);
        return;
      }

      let type: 'judge' | 'audience' | null = null;
      if (password === eventSettings.judgePassword) {
        type = 'judge';
      } else if (password === eventSettings.audiencePassword) {
        type = 'audience';
      } else {
        setAuthError('Invalid password. Please use the correct judge or audience password.');
        setAuthLoading(false);
        return;
      }

      // Check if email already registered with different type
      const existingVoter = await getVoter(email);
      if (existingVoter && existingVoter.voterType !== type) {
        setAuthError(`This email is already registered as ${existingVoter.voterType}. Please use a different email.`);
        setAuthLoading(false);
        return;
      }

      // Register voter
      const result = await registerVoter(email, type);
      if (!result.success) {
        setAuthError(result.error || 'Registration failed. Please try again.');
        setAuthLoading(false);
        return;
      }

      // Save session
      localStorage.setItem('voterEmail', email);
      localStorage.setItem('voterType', type);
      setVoterType(type);
      setIsSignedIn(true);

    } catch (err: any) {
      console.error('Sign in error:', err);
      setAuthError(`Sign in failed: ${err.message || 'Please try again.'}`);
    } finally {
      setAuthLoading(false);
    }
  };

  const handleVote = async (startupId: string, startupName: string) => {
    if (hasVotedCurrentMatch || voting || !activeMatch || activeMatch.status !== 'voting' || !voterType) return;

    if (!email) {
      setError('Please sign in to vote.');
      return;
    }

    setVoting(true);
    setError('');
    try {
      const success = await castVote(activeMatch.id, startupId, startupName, voterType, email);
      if (success) {
        setHasVotedCurrentMatch(true);
      } else {
        setError('Failed to cast vote. You may have already voted.');
      }
    } catch (err: any) {
      console.error('Vote error:', err);
      setError(`Failed to cast vote: ${err.message || 'Unknown error'}`);
    } finally {
      setVoting(false);
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const getWinnerName = (match: Match) => {
    if (!match.winner) return null;
    if (match.winner === 'tie') return 'Tie';
    return match.winner === 'startup1' ? match.startup1.name : match.startup2.name;
  };

  const getCurrentVoteForMatch = (matchId: string): Vote | undefined => {
    return voteHistory.find(v => v.matchId === matchId);
  };

  // Sign-in screen
  if (!isSignedIn) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-purple-900 to-gray-900 flex flex-col items-center justify-center p-4">
        <div className="w-full max-w-md">
          <div className="text-center mb-8">
            <h1 className="text-4xl font-bold text-white mb-2">AI Battle Royale</h1>
            <p className="text-gray-400">Sign in to vote</p>
          </div>

          <form onSubmit={handleSignIn} className="bg-gray-800/50 backdrop-blur-sm border border-gray-700 rounded-2xl p-6 space-y-4">
            <div>
              <label className="block text-gray-400 mb-2 text-sm">Email Address</label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value.toLowerCase())}
                  placeholder="your@email.com"
                  required
                  className="w-full bg-gray-700 border border-gray-600 rounded-lg pl-10 pr-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-purple-500"
                />
              </div>
              <p className="text-xs text-gray-500 mt-1">Use a valid email (.com, .ai, .edu, etc.)</p>
            </div>

            <div>
              <label className="block text-gray-400 mb-2 text-sm">Password</label>
              <div className="relative">
                <Key className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter judge or audience password"
                  required
                  className="w-full bg-gray-700 border border-gray-600 rounded-lg pl-10 pr-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-purple-500"
                />
              </div>
              <p className="text-xs text-gray-500 mt-1">Ask the organizer for the password</p>
            </div>

            {authError && (
              <div className="bg-red-500/20 border border-red-500 rounded-lg p-3 text-center">
                <p className="text-red-400 text-sm">{authError}</p>
              </div>
            )}

            <button
              type="submit"
              disabled={authLoading}
              className="w-full bg-purple-600 hover:bg-purple-700 text-white font-bold py-3 px-6 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {authLoading ? 'Signing in...' : 'Sign In to Vote'}
            </button>
          </form>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-purple-900 to-gray-900 flex items-center justify-center">
        <RefreshCw className="w-12 h-12 text-purple-400 animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-purple-900 to-gray-900 flex flex-col p-4">
      {/* Header */}
      <div className="text-center mb-6">
        <div className="flex items-center justify-center gap-2 mb-2">
          {voterType === 'judge' ? (
            <Gavel className="w-6 h-6 text-purple-400" />
          ) : (
            <Users className="w-6 h-6 text-blue-400" />
          )}
          <span className={`text-sm font-semibold ${voterType === 'judge' ? 'text-purple-400' : 'text-blue-400'}`}>
            {voterType === 'judge' ? 'Judge' : 'Audience'}
          </span>
        </div>
        <h1 className="text-2xl font-bold text-white">AI Battle Royale</h1>
        <p className="text-gray-500 text-sm">{email}</p>
      </div>

      <div className="flex-1 flex flex-col max-w-lg mx-auto w-full">
        {/* Current Match Section */}
        {activeMatch ? (
          <div className="mb-6">
            <h2 className="text-lg font-semibold text-white mb-3 flex items-center gap-2">
              <span className={`w-2 h-2 rounded-full ${activeMatch.status === 'voting' ? 'bg-green-500 animate-pulse' : 'bg-yellow-500'}`} />
              Current Match
            </h2>

            {/* Waiting phases */}
            {(activeMatch.status === 'pending' || activeMatch.status === 'selecting' || activeMatch.status === 'pitch1' || activeMatch.status === 'pitch2') && (
              <div className="bg-gray-800/50 backdrop-blur-sm border border-gray-700 rounded-2xl p-6 text-center">
                {activeMatch.status === 'pending' && (
                  <>
                    <Clock className="w-12 h-12 text-yellow-500 mx-auto mb-3" />
                    <h3 className="text-xl font-bold text-white mb-2">Waiting to Start</h3>
                  </>
                )}
                {activeMatch.status === 'selecting' && (
                  <>
                    <RefreshCw className="w-12 h-12 text-purple-400 mx-auto mb-3 animate-spin" />
                    <h3 className="text-xl font-bold text-white mb-2">Selecting First Pitcher...</h3>
                  </>
                )}
                {(activeMatch.status === 'pitch1' || activeMatch.status === 'pitch2') && (
                  <>
                    <Mic className="w-12 h-12 text-green-400 mx-auto mb-3" />
                    <h3 className="text-xl font-bold text-white mb-2">
                      Pitch {activeMatch.status === 'pitch1' ? '1' : '2'} in Progress
                    </h3>
                    {timeLeft !== null && (
                      <p className={`text-3xl font-bold ${timeLeft <= 10 ? 'text-red-500' : 'text-white'}`}>
                        {formatTime(timeLeft)}
                      </p>
                    )}
                  </>
                )}
                <div className="mt-4 text-gray-400">
                  <span className="text-white">{activeMatch.startup1.name}</span>
                  <span className="mx-2 text-gray-500">vs</span>
                  <span className="text-white">{activeMatch.startup2.name}</span>
                </div>
                <p className="text-gray-500 text-sm mt-2">Voting will start after pitches</p>
              </div>
            )}

            {/* Voting phase */}
            {activeMatch.status === 'voting' && !hasVotedCurrentMatch && (
              <div className="space-y-4">
                {timeLeft !== null && (
                  <div className="bg-gray-800/50 backdrop-blur-sm border border-gray-700 rounded-xl p-4 text-center">
                    <p className="text-gray-400 text-sm">Time Remaining</p>
                    <p className={`text-4xl font-bold ${timeLeft <= 10 ? 'text-red-500 animate-pulse' : 'text-white'}`}>
                      {formatTime(timeLeft)}
                    </p>
                  </div>
                )}

                <div className="space-y-4">
                  <p className="text-center text-gray-300">Choose your winner:</p>

                  <button
                    onClick={() => handleVote(activeMatch.startup1.id, activeMatch.startup1.name)}
                    disabled={voting}
                    className="w-full bg-gradient-to-r from-purple-600 to-purple-700 hover:from-purple-700 hover:to-purple-800 text-white font-bold py-5 px-6 rounded-2xl text-lg transition-all transform hover:scale-[1.02] disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {activeMatch.startup1.name}
                  </button>

                  <div className="text-center text-gray-500 font-semibold">VS</div>

                  <button
                    onClick={() => handleVote(activeMatch.startup2.id, activeMatch.startup2.name)}
                    disabled={voting}
                    className="w-full bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white font-bold py-5 px-6 rounded-2xl text-lg transition-all transform hover:scale-[1.02] disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {activeMatch.startup2.name}
                  </button>
                </div>
              </div>
            )}

            {/* Already voted */}
            {activeMatch.status === 'voting' && hasVotedCurrentMatch && (
              <div className="bg-gray-800/50 backdrop-blur-sm border border-green-500 rounded-2xl p-6 text-center">
                <CheckCircle className="w-12 h-12 text-green-500 mx-auto mb-3" />
                <h3 className="text-xl font-bold text-white mb-2">Vote Submitted!</h3>
                <p className="text-gray-400">
                  You voted for <span className="text-green-400 font-semibold">
                    {getCurrentVoteForMatch(activeMatch.id)?.startupName}
                  </span>
                </p>
                {timeLeft !== null && (
                  <div className="mt-4">
                    <p className="text-gray-500 text-sm">Results in</p>
                    <p className={`text-2xl font-bold ${timeLeft <= 10 ? 'text-red-500' : 'text-white'}`}>
                      {formatTime(timeLeft)}
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>
        ) : (
          <div className="bg-gray-800/50 backdrop-blur-sm border border-gray-700 rounded-2xl p-6 text-center mb-6">
            <Clock className="w-12 h-12 text-gray-500 mx-auto mb-3" />
            <h3 className="text-xl font-bold text-white mb-2">No Active Match</h3>
            <p className="text-gray-400">Waiting for the next match to begin...</p>
          </div>
        )}

        {/* Vote History */}
        {voteHistory.length > 0 && (
          <div className="mt-auto">
            <h2 className="text-lg font-semibold text-white mb-3 flex items-center gap-2">
              <History className="w-5 h-5 text-gray-400" />
              Your Vote History
            </h2>
            <div className="space-y-2">
              {voteHistory.map((vote, index) => {
                const match = matches.find(m => m.id === vote.matchId);
                return (
                  <div key={index} className="bg-gray-800/30 border border-gray-700 rounded-lg p-3 flex justify-between items-center">
                    <div>
                      <p className="text-white text-sm font-medium">{vote.startupName}</p>
                      {match && (
                        <p className="text-gray-500 text-xs">
                          {match.startup1.name} vs {match.startup2.name}
                          {match.winner && (
                            <span className={`ml-2 ${(match.winner === 'startup1' && vote.startupId === match.startup1.id) ||
                              (match.winner === 'startup2' && vote.startupId === match.startup2.id)
                              ? 'text-green-400' : 'text-red-400'
                              }`}>
                              {(match.winner === 'startup1' && vote.startupId === match.startup1.id) ||
                                (match.winner === 'startup2' && vote.startupId === match.startup2.id)
                                ? '✓ Won' : '✗ Lost'}
                            </span>
                          )}
                        </p>
                      )}
                    </div>
                    <CheckCircle className="w-5 h-5 text-green-500" />
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {error && (
          <div className="mt-4 bg-red-500/20 border border-red-500 rounded-lg p-3 text-center">
            <p className="text-red-400 text-sm">{error}</p>
          </div>
        )}
      </div>
    </div>
  );
}
