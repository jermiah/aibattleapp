import { database } from './firebase';
import {
  ref,
  set,
  push,
  get,
  update,
  onValue,
  off,
  remove,
  Database,
} from 'firebase/database';
import { Match, Startup, Vote, Voter, EventSettings, VotingSettings } from './types';

const getDb = (): Database => {
  if (!database) {
    throw new Error('Firebase database not initialized. Check your environment variables.');
  }
  return database;
};

// Generate unique codes for QR
export const generateUniqueCode = (): string => {
  return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
};

// Startups
export const addStartup = async (startup: Omit<Startup, 'id'>): Promise<string> => {
  const startupsRef = ref(getDb(), 'startups');
  const newStartupRef = push(startupsRef);
  const id = newStartupRef.key!;
  await set(newStartupRef, { ...startup, id });
  return id;
};

export const addStartups = async (startups: Omit<Startup, 'id'>[]): Promise<void> => {
  const startupsRef = ref(getDb(), 'startups');
  for (const startup of startups) {
    const newStartupRef = push(startupsRef);
    const id = newStartupRef.key!;
    await set(newStartupRef, { ...startup, id });
  }
};

export const getStartups = async (): Promise<Startup[]> => {
  const startupsRef = ref(getDb(), 'startups');
  const snapshot = await get(startupsRef);
  if (!snapshot.exists()) return [];
  const data = snapshot.val();
  return Object.values(data) as Startup[];
};

export const clearStartups = async (): Promise<void> => {
  const startupsRef = ref(getDb(), 'startups');
  await remove(startupsRef);
};

export const subscribeToStartups = (callback: (startups: Startup[]) => void) => {
  const startupsRef = ref(getDb(), 'startups');
  onValue(startupsRef, (snapshot) => {
    if (!snapshot.exists()) {
      callback([]);
      return;
    }
    const data = snapshot.val();
    callback(Object.values(data) as Startup[]);
  });
  return () => off(startupsRef);
};

// Matches
export const createMatch = async (
  startup1: Startup,
  startup2: Startup,
  votingDuration: number = 60,
  pitchDuration: number = 90,
  judgeWeight: number = 70,
  audienceWeight: number = 30
): Promise<string> => {
  const matchesRef = ref(getDb(), 'matches');
  const newMatchRef = push(matchesRef);
  const id = newMatchRef.key!;
  
  const match: Match = {
    id,
    startup1,
    startup2,
    status: 'pending',
    judgeVotes: { startup1: 0, startup2: 0 },
    audienceVotes: { startup1: 0, startup2: 0 },
    judgeWeight,
    audienceWeight,
    votingDuration,
    pitchDuration,
    createdAt: Date.now(),
    voteCode: generateUniqueCode(),
  };
  
  await set(newMatchRef, match);
  return id;
};

// Start the match flow: selecting -> pitch1 -> pitch2 -> voting -> completed
export const startMatch = async (matchId: string): Promise<void> => {
  const matchRef = ref(getDb(), `matches/${matchId}`);
  const snapshot = await get(matchRef);
  if (!snapshot.exists()) throw new Error('Match not found');
  
  // Start with selection phase (3 seconds)
  const selectionEndTime = Date.now() + 3000;
  
  // Randomly select who pitches first
  const firstPitcher = Math.random() < 0.5 ? 'startup1' : 'startup2';
  
  await update(matchRef, {
    status: 'selecting',
    firstPitcher,
    phaseEndTime: selectionEndTime,
  });
};

// Advance to the next phase
export const advancePhase = async (matchId: string): Promise<void> => {
  const matchRef = ref(getDb(), `matches/${matchId}`);
  const snapshot = await get(matchRef);
  if (!snapshot.exists()) throw new Error('Match not found');
  
  const match = snapshot.val() as Match;
  
  switch (match.status) {
    case 'selecting':
      // Move to pitch1
      await update(matchRef, {
        status: 'pitch1',
        phaseEndTime: Date.now() + match.pitchDuration * 1000,
      });
      break;
    case 'pitch1':
      // Move to pitch2
      await update(matchRef, {
        status: 'pitch2',
        phaseEndTime: Date.now() + match.pitchDuration * 1000,
      });
      break;
    case 'pitch2':
      // Move to voting
      const votingEndTime = Date.now() + match.votingDuration * 1000;
      await update(matchRef, {
        status: 'voting',
        phaseEndTime: votingEndTime,
        votingEndTime,
      });
      break;
    case 'voting':
      // End voting and calculate winner
      await endVotingInternal(matchId, match);
      break;
  }
};

const endVotingInternal = async (matchId: string, match: Match): Promise<void> => {
  const matchRef = ref(getDb(), `matches/${matchId}`);
  
  // Calculate winner based on weighted votes
  const startup1Score =
    (match.judgeVotes.startup1 * match.judgeWeight) / 100 +
    (match.audienceVotes.startup1 * match.audienceWeight) / 100;
  const startup2Score =
    (match.judgeVotes.startup2 * match.judgeWeight) / 100 +
    (match.audienceVotes.startup2 * match.audienceWeight) / 100;
  
  let winner: string;
  if (startup1Score > startup2Score) {
    winner = 'startup1';
  } else if (startup2Score > startup1Score) {
    winner = 'startup2';
  } else {
    winner = 'tie';
  }
  
  await update(matchRef, {
    status: 'completed',
    winner,
    phaseEndTime: null,
  });
};

export const getMatch = async (matchId: string): Promise<Match | null> => {
  const matchRef = ref(getDb(), `matches/${matchId}`);
  const snapshot = await get(matchRef);
  if (!snapshot.exists()) return null;
  return snapshot.val() as Match;
};

export const getMatchByCode = async (code: string): Promise<Match | null> => {
  const matchesRef = ref(getDb(), 'matches');
  const snapshot = await get(matchesRef);
  if (!snapshot.exists()) return null;
  
  const matches = snapshot.val();
  for (const matchId in matches) {
    const match = matches[matchId] as Match;
    if (match.voteCode === code) {
      return match;
    }
  }
  return null;
};

export const getMatches = async (): Promise<Match[]> => {
  const matchesRef = ref(getDb(), 'matches');
  const snapshot = await get(matchesRef);
  if (!snapshot.exists()) return [];
  const data = snapshot.val();
  return Object.values(data) as Match[];
};

export const subscribeToMatch = (matchId: string, callback: (match: Match | null) => void) => {
  const matchRef = ref(getDb(), `matches/${matchId}`);
  onValue(matchRef, (snapshot) => {
    if (!snapshot.exists()) {
      callback(null);
      return;
    }
    callback(snapshot.val() as Match);
  });
  return () => off(matchRef);
};

export const subscribeToMatches = (callback: (matches: Match[]) => void) => {
  const matchesRef = ref(getDb(), 'matches');
  onValue(matchesRef, (snapshot) => {
    if (!snapshot.exists()) {
      callback([]);
      return;
    }
    const data = snapshot.val();
    callback(Object.values(data) as Match[]);
  });
  return () => off(matchesRef);
};

export const startVoting = async (matchId: string): Promise<void> => {
  const matchRef = ref(getDb(), `matches/${matchId}`);
  const snapshot = await get(matchRef);
  if (!snapshot.exists()) throw new Error('Match not found');
  
  const match = snapshot.val() as Match;
  const votingEndTime = Date.now() + match.votingDuration * 1000;
  
  await update(matchRef, {
    status: 'voting',
    votingEndTime,
  });
};

export const endVoting = async (matchId: string): Promise<void> => {
  const matchRef = ref(getDb(), `matches/${matchId}`);
  const snapshot = await get(matchRef);
  if (!snapshot.exists()) throw new Error('Match not found');
  
  const match = snapshot.val() as Match;
  
  // Calculate winner based on weighted votes
  const startup1Score =
    (match.judgeVotes.startup1 * match.judgeWeight) / 100 +
    (match.audienceVotes.startup1 * match.audienceWeight) / 100;
  const startup2Score =
    (match.judgeVotes.startup2 * match.judgeWeight) / 100 +
    (match.audienceVotes.startup2 * match.audienceWeight) / 100;
  
  let winner: string | undefined;
  if (startup1Score > startup2Score) {
    winner = 'startup1';
  } else if (startup2Score > startup1Score) {
    winner = 'startup2';
  } else {
    winner = 'tie';
  }
  
  await update(matchRef, {
    status: 'completed',
    winner,
  });
};

export const updateMatchWeights = async (
  matchId: string,
  judgeWeight: number,
  audienceWeight: number
): Promise<void> => {
  const matchRef = ref(getDb(), `matches/${matchId}`);
  await update(matchRef, { judgeWeight, audienceWeight });
};

export const deleteMatch = async (matchId: string): Promise<void> => {
  const matchRef = ref(getDb(), `matches/${matchId}`);
  await remove(matchRef);
  // Also delete associated votes
  const votesRef = ref(getDb(), `votes/${matchId}`);
  await remove(votesRef);
};

// Votes
export const castVote = async (
  matchId: string,
  startupId: string,
  startupName: string,
  voterType: 'judge' | 'audience',
  voterEmail: string
): Promise<boolean> => {
  // Normalize email for consistent key
  const emailKey = voterEmail.replace(/\./g, ',');
  
  // Check if already voted in this match
  const voterVoteRef = ref(getDb(), `votes/${matchId}/${emailKey}`);
  const existingVote = await get(voterVoteRef);
  if (existingVote.exists()) {
    return false; // Already voted
  }
  
  // Get match to verify it's in voting status
  const match = await getMatch(matchId);
  if (!match || match.status !== 'voting') {
    return false;
  }
  
  // Record the vote
  const vote: Vote = {
    oderId: voterEmail,
    matchId,
    startupId,
    startupName,
    voterType,
    timestamp: Date.now(),
  };
  await set(voterVoteRef, vote);
  
  // Also store in voter's vote history
  const voterHistoryRef = ref(getDb(), `voters/${emailKey}/votes/${matchId}`);
  await set(voterHistoryRef, vote);
  
  // Update vote count
  const voteField = startupId === match.startup1.id ? 'startup1' : 'startup2';
  const voteCountRef = ref(
    getDb(),
    `matches/${matchId}/${voterType}Votes/${voteField}`
  );
  const currentCount = await get(voteCountRef);
  await set(voteCountRef, (currentCount.val() || 0) + 1);
  
  return true;
};

export const hasVoted = async (matchId: string, voterEmail: string): Promise<boolean> => {
  const emailKey = voterEmail.replace(/\./g, ',');
  const voterVoteRef = ref(getDb(), `votes/${matchId}/${emailKey}`);
  const snapshot = await get(voterVoteRef);
  return snapshot.exists();
};

// Voter Registration
export const registerVoter = async (
  email: string,
  voterType: 'judge' | 'audience'
): Promise<{ success: boolean; error?: string }> => {
  const emailKey = email.replace(/\./g, ',');
  
  // Check if email already registered
  const voterRef = ref(getDb(), `voters/${emailKey}`);
  const existingVoter = await get(voterRef);
  if (existingVoter.exists()) {
    const voter = existingVoter.val() as Voter;
    // Return existing voter info - they can continue voting
    return { success: true };
  }
  
  // Check event settings for max sign-ins
  const settings = await getEventSettings();
  if (voterType === 'audience' && settings.currentAudienceCount >= settings.maxAudienceSignIns) {
    return { success: false, error: 'Maximum audience sign-ins reached' };
  }
  if (voterType === 'judge' && settings.currentJudgeCount >= settings.maxJudgeSignIns) {
    return { success: false, error: 'Maximum judge sign-ins reached' };
  }
  
  // Register new voter
  const voter: Voter = {
    email,
    voterType,
    registeredAt: Date.now(),
    votes: {},
  };
  await set(voterRef, voter);
  
  // Increment count
  const countField = voterType === 'judge' ? 'currentJudgeCount' : 'currentAudienceCount';
  const settingsRef = ref(getDb(), `eventSettings/${countField}`);
  const currentCount = await get(settingsRef);
  await set(settingsRef, (currentCount.val() || 0) + 1);
  
  return { success: true };
};

export const getVoter = async (email: string): Promise<Voter | null> => {
  const emailKey = email.replace(/\./g, ',');
  const voterRef = ref(getDb(), `voters/${emailKey}`);
  const snapshot = await get(voterRef);
  if (!snapshot.exists()) return null;
  return snapshot.val() as Voter;
};

export const getVoterVoteHistory = async (email: string): Promise<Vote[]> => {
  const emailKey = email.replace(/\./g, ',');
  const votesRef = ref(getDb(), `voters/${emailKey}/votes`);
  const snapshot = await get(votesRef);
  if (!snapshot.exists()) return [];
  return Object.values(snapshot.val()) as Vote[];
};

export const subscribeToVoterVotes = (email: string, callback: (votes: Vote[]) => void) => {
  const emailKey = email.replace(/\./g, ',');
  const votesRef = ref(getDb(), `voters/${emailKey}/votes`);
  onValue(votesRef, (snapshot) => {
    if (!snapshot.exists()) {
      callback([]);
      return;
    }
    callback(Object.values(snapshot.val()) as Vote[]);
  });
  return () => off(votesRef);
};

// Event Settings
export const getEventSettings = async (): Promise<EventSettings> => {
  const settingsRef = ref(getDb(), 'eventSettings');
  const snapshot = await get(settingsRef);
  if (!snapshot.exists()) {
    return {
      judgePassword: 'judge123',
      audiencePassword: 'audience123',
      maxAudienceSignIns: 100,
      maxJudgeSignIns: 10,
      currentAudienceCount: 0,
      currentJudgeCount: 0,
      allowedEmailDomains: ['.com', '.ai', '.edu', '.org', '.net', '.io', '.co'],
    };
  }
  return snapshot.val() as EventSettings;
};

export const updateEventSettings = async (settings: Partial<EventSettings>): Promise<void> => {
  const settingsRef = ref(getDb(), 'eventSettings');
  await update(settingsRef, settings);
};

export const subscribeToEventSettings = (callback: (settings: EventSettings) => void) => {
  const settingsRef = ref(getDb(), 'eventSettings');
  onValue(settingsRef, (snapshot) => {
    if (!snapshot.exists()) {
      callback({
        judgePassword: 'judge123',
        audiencePassword: 'audience123',
        maxAudienceSignIns: 100,
        maxJudgeSignIns: 10,
        currentAudienceCount: 0,
        currentJudgeCount: 0,
        allowedEmailDomains: ['.com', '.ai', '.edu', '.org', '.net', '.io', '.co'],
      });
      return;
    }
    callback(snapshot.val() as EventSettings);
  });
  return () => off(settingsRef);
};

export const resetVoterCounts = async (): Promise<void> => {
  const settingsRef = ref(getDb(), 'eventSettings');
  await update(settingsRef, {
    currentAudienceCount: 0,
    currentJudgeCount: 0,
  });
  // Also clear all voters
  const votersRef = ref(getDb(), 'voters');
  await remove(votersRef);
};

// Active Match (for display panel)
export const setActiveMatch = async (matchId: string | null): Promise<void> => {
  const activeMatchRef = ref(getDb(), 'activeMatch');
  await set(activeMatchRef, matchId);
};

export const getActiveMatch = async (): Promise<string | null> => {
  const activeMatchRef = ref(getDb(), 'activeMatch');
  const snapshot = await get(activeMatchRef);
  return snapshot.val();
};

export const subscribeToActiveMatch = (callback: (matchId: string | null) => void) => {
  const activeMatchRef = ref(getDb(), 'activeMatch');
  onValue(activeMatchRef, (snapshot) => {
    callback(snapshot.val());
  });
  return () => off(activeMatchRef);
};

// Settings
export const getSettings = async (): Promise<VotingSettings> => {
  const settingsRef = ref(getDb(), 'settings');
  const snapshot = await get(settingsRef);
  if (!snapshot.exists()) {
    return {
      judgeWeight: 70,
      audienceWeight: 30,
      defaultVotingDuration: 60,
    };
  }
  return snapshot.val() as VotingSettings;
};

export const updateSettings = async (settings: Partial<VotingSettings>): Promise<void> => {
  const settingsRef = ref(getDb(), 'settings');
  await update(settingsRef, settings);
};
