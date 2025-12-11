'use client';

import { useState, useEffect, useCallback } from 'react';
import { subscribeToActiveMatch, subscribeToMatch, advancePhase } from '@/lib/database';
import { Match } from '@/lib/types';
import { Trophy, Swords, Clock, Users, Gavel, Zap, Mic, Shuffle, QrCode } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import Image from 'next/image';

export default function DisplayPage() {
  const [activeMatchId, setActiveMatchId] = useState<string | null>(null);
  const [match, setMatch] = useState<Match | null>(null);
  const [timeLeft, setTimeLeft] = useState<number | null>(null);
  const [selectionDisplay, setSelectionDisplay] = useState<string>('');
  const [showSelectedPitcher, setShowSelectedPitcher] = useState(false);

  useEffect(() => {
    const unsubActive = subscribeToActiveMatch((matchId) => {
      setActiveMatchId(matchId);
    });
    
    return () => unsubActive();
  }, []);

  useEffect(() => {
    if (!activeMatchId) {
      setMatch(null);
      return;
    }
    
    const unsubMatch = subscribeToMatch(activeMatchId, (updatedMatch) => {
      setMatch(updatedMatch);
    });
    
    return () => unsubMatch();
  }, [activeMatchId]);

  // Random selection animation
  useEffect(() => {
    if (!match || match.status !== 'selecting') {
      setShowSelectedPitcher(false);
      return;
    }

    const names = [match.startup1.name, match.startup2.name];
    let animationInterval: NodeJS.Timeout;
    let currentIndex = 0;

    // Animate through names rapidly
    animationInterval = setInterval(() => {
      currentIndex = (currentIndex + 1) % 2;
      setSelectionDisplay(names[currentIndex]);
    }, 100);

    // After 2.5 seconds, show the selected pitcher
    const selectionTimeout = setTimeout(() => {
      clearInterval(animationInterval);
      const selectedName = match.firstPitcher === 'startup1' ? match.startup1.name : match.startup2.name;
      setSelectionDisplay(selectedName);
      setShowSelectedPitcher(true);

      // After showing for 0.5 seconds, advance to pitch1
      setTimeout(() => {
        advancePhase(match.id);
      }, 500);
    }, 2500);

    return () => {
      clearInterval(animationInterval);
      clearTimeout(selectionTimeout);
    };
  }, [match?.status, match?.id, match?.firstPitcher, match?.startup1.name, match?.startup2.name]);

  // Phase timer - tracks phaseEndTime for all timed phases
  useEffect(() => {
    if (!match?.phaseEndTime) {
      setTimeLeft(null);
      return;
    }
    
    const updateTimer = () => {
      const remaining = Math.max(0, Math.floor((match.phaseEndTime! - Date.now()) / 1000));
      setTimeLeft(remaining);

      // Auto-advance when timer reaches 0
      if (remaining === 0 && match.status !== 'selecting' && match.status !== 'completed') {
        advancePhase(match.id);
      }
    };
    
    updateTimer();
    const interval = setInterval(updateTimer, 1000);
    
    return () => clearInterval(interval);
  }, [match?.phaseEndTime, match?.status, match?.id]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const getCurrentPitcher = () => {
    if (!match) return null;
    if (match.status === 'pitch1') {
      return match.firstPitcher === 'startup1' ? match.startup1 : match.startup2;
    }
    if (match.status === 'pitch2') {
      return match.firstPitcher === 'startup1' ? match.startup2 : match.startup1;
    }
    return null;
  };

  const getNextPitcher = () => {
    if (!match) return null;
    if (match.status === 'pitch1') {
      return match.firstPitcher === 'startup1' ? match.startup2 : match.startup1;
    }
    return null;
  };

  const calculateScore = (startup: 'startup1' | 'startup2') => {
    if (!match) return 0;
    const judgeVotes = match.judgeVotes[startup];
    const audienceVotes = match.audienceVotes[startup];
    return (judgeVotes * match.judgeWeight / 100) + (audienceVotes * match.audienceWeight / 100);
  };

  const getTotalVotes = (startup: 'startup1' | 'startup2') => {
    if (!match) return 0;
    return match.judgeVotes[startup] + match.audienceVotes[startup];
  };

  const getVotePercentage = (startup: 'startup1' | 'startup2') => {
    if (!match) return 50;
    const total = getTotalVotes('startup1') + getTotalVotes('startup2');
    if (total === 0) return 50;
    return (getTotalVotes(startup) / total) * 100;
  };

  const getWinnerName = () => {
    if (!match?.winner) return null;
    if (match.winner === 'tie') return 'TIE';
    return match.winner === 'startup1' ? match.startup1.name : match.startup2.name;
  };

  const getBaseUrl = () => {
    if (typeof window !== 'undefined') {
      return window.location.origin;
    }
    return '';
  };

  if (!match) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-purple-900 to-gray-900 relative">
        {/* Logos - Top corners */}
        <div className="absolute top-6 left-6 z-10">
          <Image
            src="/backboard.jpg"
            alt="Backboard"
            width={180}
            height={120}
            className="object-contain rounded-lg"
          />
        </div>
        <div className="absolute top-6 right-6 z-10">
          <Image
            src="/Wordmark-Vertical-White.png"
            alt="AI Collective"
            width={180}
            height={120}
            className="object-contain"
          />
        </div>

        {/* Content */}
        <div className="min-h-screen flex flex-col items-center justify-center">
          <Swords className="w-32 h-32 text-purple-400 mb-8 animate-pulse" />
          <h1 className="text-6xl font-bold text-white mb-4">AI Battle Royale</h1>
          <p className="text-2xl text-gray-400">Waiting for match to begin...</p>
        </div>
      </div>
    );
  }

  if (match.status === 'pending') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-purple-900 to-gray-900 relative">
        {/* Logos - Top corners */}
        <div className="absolute top-6 left-6 z-10">
          <Image
            src="/backboard.jpg"
            alt="Backboard"
            width={180}
            height={120}
            className="object-contain rounded-lg"
          />
        </div>
        <div className="absolute top-6 right-6 z-10">
          <Image
            src="/Wordmark-Vertical-White.png"
            alt="AI Collective"
            width={180}
            height={120}
            className="object-contain"
          />
        </div>

        {/* QR Code - Fixed position in corner */}
        <div className="absolute bottom-8 right-8 bg-white p-4 rounded-2xl shadow-2xl z-10">
          <QRCodeSVG
            value={`${getBaseUrl()}/vote/${match.voteCode}`}
            size={150}
          />
          <p className="text-center text-gray-800 font-bold mt-2 text-sm">Scan to Join</p>
        </div>

        {/* Content */}
        <div className="min-h-screen flex flex-col items-center justify-center p-8">
          <Swords className="w-24 h-24 text-purple-400 mx-auto mb-8" />
          <h1 className="text-5xl font-bold text-white mb-8">Next Battle</h1>
          
          <div className="flex items-center justify-center gap-8 text-4xl font-bold">
            <div className="bg-purple-600/30 border-2 border-purple-500 rounded-2xl px-12 py-8">
              <span className="text-white">{match.startup1.name}</span>
            </div>
            
            <span className="text-gray-300 text-6xl">VS</span>
            
            <div className="bg-blue-600/30 border-2 border-blue-500 rounded-2xl px-12 py-8">
              <span className="text-white">{match.startup2.name}</span>
            </div>
          </div>
          
          <p className="text-2xl text-gray-300 mt-12">
            <Clock className="w-8 h-8 inline mr-2" />
            Waiting to start...
          </p>
        </div>
      </div>
    );
  }

  // Random selection animation phase
  if (match.status === 'selecting') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-purple-900 to-gray-900 relative">
        {/* Logos - Top corners */}
        <div className="absolute top-6 left-6 z-10">
          <Image
            src="/backboard.jpg"
            alt="Backboard"
            width={180}
            height={120}
            className="object-contain rounded-lg"
          />
        </div>
        <div className="absolute top-6 right-6 z-10">
          <Image
            src="/Wordmark-Vertical-White.png"
            alt="AI Collective"
            width={180}
            height={120}
            className="object-contain"
          />
        </div>

        {/* Content */}
        <div className="min-h-screen flex flex-col items-center justify-center p-8">
          <Shuffle className={`w-24 h-24 text-yellow-400 mx-auto mb-8 ${!showSelectedPitcher ? 'animate-spin' : ''}`} />
          <h1 className="text-4xl font-bold text-gray-300 mb-4">
            {showSelectedPitcher ? 'Pitching First:' : 'Selecting First Pitcher...'}
          </h1>
          
          <div className={`text-7xl font-bold transition-all duration-300 ${
            showSelectedPitcher 
              ? 'text-transparent bg-clip-text bg-gradient-to-r from-yellow-400 to-orange-500 scale-110' 
              : 'text-white'
          }`}>
            {selectionDisplay}
          </div>
          
          {!showSelectedPitcher && (
            <div className="mt-8 flex justify-center gap-4">
              <div className="w-4 h-4 bg-purple-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
              <div className="w-4 h-4 bg-purple-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
              <div className="w-4 h-4 bg-purple-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
            </div>
          )}
        </div>
      </div>
    );
  }

  // Pitch phases
  if (match.status === 'pitch1' || match.status === 'pitch2') {
    const currentPitcher = getCurrentPitcher();
    const nextPitcher = getNextPitcher();
    const pitchNumber = match.status === 'pitch1' ? 1 : 2;
    
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-purple-900 to-gray-900 relative">
        {/* Logos - Top corners */}
        <div className="absolute top-6 left-6 z-10">
          <Image
            src="/backboard.jpg"
            alt="Backboard"
            width={180}
            height={120}
            className="object-contain rounded-lg"
          />
        </div>
        <div className="absolute top-6 right-6 z-10">
          <Image
            src="/Wordmark-Vertical-White.png"
            alt="AI Collective"
            width={180}
            height={120}
            className="object-contain"
          />
        </div>

        {/* QR Code - Fixed position in corner */}
        <div className="absolute bottom-8 right-8 bg-white p-4 rounded-2xl shadow-2xl z-10">
          <QRCodeSVG
            value={`${getBaseUrl()}/vote/${match.voteCode}`}
            size={150}
          />
          <p className="text-center text-gray-800 font-bold mt-2 text-sm">Scan to Join</p>
        </div>

        {/* Content */}
        <div className="min-h-screen flex flex-col p-8">
          {/* Header */}
          <div className="text-center mb-8">
            <div className="flex items-center justify-center gap-4 mb-4">
              <Mic className="w-12 h-12 text-green-400 animate-pulse" />
              <h1 className="text-4xl font-bold text-white">PITCH {pitchNumber} OF 2</h1>
              <Mic className="w-12 h-12 text-green-400 animate-pulse" />
            </div>
            
            {/* Timer */}
            {timeLeft !== null && (
              <div className={`text-8xl font-bold ${timeLeft <= 10 ? 'text-red-500 animate-pulse' : 'text-white'}`}>
                {formatTime(timeLeft)}
              </div>
            )}
          </div>

          {/* Current Pitcher */}
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center">
              <p className="text-2xl text-gray-300 mb-4">Now Pitching</p>
              <div className="bg-gradient-to-r from-green-600/30 to-emerald-600/30 border-4 border-green-500 rounded-3xl px-16 py-12">
                <h2 className="text-6xl font-bold text-white">{currentPitcher?.name}</h2>
              </div>
              
              {nextPitcher && (
                <p className="text-xl text-gray-400 mt-8">
                  Up Next: <span className="text-gray-200">{nextPitcher.name}</span>
                </p>
              )}
              
              {match.status === 'pitch2' && (
                <p className="text-xl text-gray-400 mt-8">
                  Voting starts after this pitch
                </p>
              )}
            </div>
          </div>

          {/* Match info footer */}
          <div className="text-center text-gray-400">
            <p>{match.startup1.name} vs {match.startup2.name}</p>
          </div>
        </div>
      </div>
    );
  }

  if (match.status === 'completed') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-purple-900 to-gray-900 relative">
        {/* Logos - Top corners */}
        <div className="absolute top-6 left-6 z-10">
          <Image
            src="/backboard.jpg"
            alt="Backboard"
            width={180}
            height={120}
            className="object-contain rounded-lg"
          />
        </div>
        <div className="absolute top-6 right-6 z-10">
          <Image
            src="/Wordmark-Vertical-White.png"
            alt="AI Collective"
            width={180}
            height={120}
            className="object-contain"
          />
        </div>

        {/* Content */}
        <div className="min-h-screen flex flex-col items-center justify-center p-8">
          <div className="text-center w-full max-w-6xl">
            <Trophy className="w-32 h-32 text-yellow-400 mx-auto mb-6 animate-bounce" />
            <h1 className="text-5xl font-bold text-white mb-4">
              {match.winner === 'tie' ? 'It\'s a Tie!' : 'Winner!'}
            </h1>
            
            {match.winner !== 'tie' && (
              <h2 className="text-7xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-yellow-400 to-orange-500 mb-12">
                {getWinnerName()}
              </h2>
            )}
            
            <div className="grid grid-cols-2 gap-8 mt-8">
              <div className={`rounded-2xl p-8 ${match.winner === 'startup1' ? 'bg-green-600/30 border-2 border-green-500' : 'bg-gray-800/50 border border-gray-700'}`}>
                <h3 className="text-3xl font-bold text-white mb-4">{match.startup1.name}</h3>
                <div className="text-6xl font-bold text-white mb-4">
                  {calculateScore('startup1').toFixed(1)}
                </div>
                <div className="flex justify-center gap-8 text-xl text-gray-300">
                  <span className="flex items-center gap-2">
                    <Gavel className="w-6 h-6 text-purple-400" />
                    {match.judgeVotes.startup1}
                  </span>
                  <span className="flex items-center gap-2">
                    <Users className="w-6 h-6 text-blue-400" />
                    {match.audienceVotes.startup1}
                  </span>
                </div>
              </div>
              
              <div className={`rounded-2xl p-8 ${match.winner === 'startup2' ? 'bg-green-600/30 border-2 border-green-500' : 'bg-gray-800/50 border border-gray-700'}`}>
                <h3 className="text-3xl font-bold text-white mb-4">{match.startup2.name}</h3>
                <div className="text-6xl font-bold text-white mb-4">
                  {calculateScore('startup2').toFixed(1)}
                </div>
                <div className="flex justify-center gap-8 text-xl text-gray-300">
                  <span className="flex items-center gap-2">
                    <Gavel className="w-6 h-6 text-purple-400" />
                    {match.judgeVotes.startup2}
                  </span>
                  <span className="flex items-center gap-2">
                    <Users className="w-6 h-6 text-blue-400" />
                    {match.audienceVotes.startup2}
                  </span>
                </div>
              </div>
            </div>
            
            <div className="mt-8 text-gray-300">
              <p>Judge Weight: {match.judgeWeight}% | Audience Weight: {match.audienceWeight}%</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Voting in progress
  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-purple-900 to-gray-900 relative">
      {/* Logos - Top corners */}
      <div className="absolute top-6 left-6 z-10">
        <Image
          src="/backboard.jpg"
          alt="Backboard"
          width={180}
          height={120}
          className="object-contain rounded-lg"
        />
      </div>
      <div className="absolute top-6 right-6 z-10">
        <Image
          src="/Wordmark-Vertical-White.png"
          alt="AI Collective"
          width={180}
          height={120}
          className="object-contain"
        />
      </div>

      {/* QR Code - Fixed position in corner */}
      <div className="absolute bottom-8 right-8 bg-white p-4 rounded-2xl shadow-2xl z-10">
        <QRCodeSVG
          value={`${getBaseUrl()}/vote/${match.voteCode}`}
          size={150}
        />
        <p className="text-center text-gray-800 font-bold mt-2 text-sm">Scan to Vote</p>
      </div>

      {/* Content */}
      <div className="min-h-screen flex flex-col p-8">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="flex items-center justify-center gap-4 mb-4">
            <Zap className="w-12 h-12 text-yellow-400 animate-pulse" />
            <h1 className="text-4xl font-bold text-white">LIVE VOTING</h1>
            <Zap className="w-12 h-12 text-yellow-400 animate-pulse" />
          </div>
          
          {/* Timer */}
          {timeLeft !== null && (
            <div className={`text-8xl font-bold ${timeLeft <= 10 ? 'text-red-500 animate-pulse' : 'text-white'}`}>
              {formatTime(timeLeft)}
            </div>
          )}
        </div>

        {/* Battle Display */}
        <div className="flex-1 flex items-center justify-center">
          <div className="w-full max-w-6xl">
            <div className="grid grid-cols-2 gap-8">
              {/* Startup 1 */}
              <div className="bg-purple-600/20 border-2 border-purple-500 rounded-3xl p-8 text-center">
                <h2 className="text-4xl font-bold text-white mb-6">{match.startup1.name}</h2>
                
                <div className="text-7xl font-bold text-purple-400 mb-4">
                  {calculateScore('startup1').toFixed(1)}
                </div>
                
                <div className="flex justify-center gap-8 text-2xl text-gray-300 mb-6">
                  <span className="flex items-center gap-2">
                    <Gavel className="w-8 h-8 text-purple-400" />
                    {match.judgeVotes.startup1}
                  </span>
                  <span className="flex items-center gap-2">
                    <Users className="w-8 h-8 text-blue-400" />
                    {match.audienceVotes.startup1}
                  </span>
                </div>
                
                <div className="text-xl text-gray-300">
                  Total: {getTotalVotes('startup1')} votes
                </div>
              </div>

              {/* Startup 2 */}
              <div className="bg-blue-600/20 border-2 border-blue-500 rounded-3xl p-8 text-center">
                <h2 className="text-4xl font-bold text-white mb-6">{match.startup2.name}</h2>
                
                <div className="text-7xl font-bold text-blue-400 mb-4">
                  {calculateScore('startup2').toFixed(1)}
                </div>
                
                <div className="flex justify-center gap-8 text-2xl text-gray-300 mb-6">
                  <span className="flex items-center gap-2">
                    <Gavel className="w-8 h-8 text-purple-400" />
                    {match.judgeVotes.startup2}
                  </span>
                  <span className="flex items-center gap-2">
                    <Users className="w-8 h-8 text-blue-400" />
                    {match.audienceVotes.startup2}
                  </span>
                </div>
                
                <div className="text-xl text-gray-300">
                  Total: {getTotalVotes('startup2')} votes
                </div>
              </div>
            </div>

            {/* Vote Progress Bar */}
            <div className="mt-8">
              <div className="h-8 bg-gray-800 rounded-full overflow-hidden flex">
                <div
                  className="bg-gradient-to-r from-purple-600 to-purple-400 transition-all duration-500"
                  style={{ width: `${getVotePercentage('startup1')}%` }}
                />
                <div
                  className="bg-gradient-to-r from-blue-400 to-blue-600 transition-all duration-500"
                  style={{ width: `${getVotePercentage('startup2')}%` }}
                />
              </div>
              <div className="flex justify-between mt-2 text-xl text-gray-300">
                <span>{getVotePercentage('startup1').toFixed(0)}%</span>
                <span>{getVotePercentage('startup2').toFixed(0)}%</span>
              </div>
            </div>

            {/* Weight Info */}
            <div className="mt-6 text-center text-gray-400">
              <p className="flex items-center justify-center gap-4">
                <span className="flex items-center gap-2">
                  <Gavel className="w-5 h-5 text-purple-400" />
                  Judge Weight: {match.judgeWeight}%
                </span>
                <span>|</span>
                <span className="flex items-center gap-2">
                  <Users className="w-5 h-5 text-blue-400" />
                  Audience Weight: {match.audienceWeight}%
                </span>
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
