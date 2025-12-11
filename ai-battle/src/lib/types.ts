export interface Startup {
  id: string;
  name: string;
  description?: string;
}

export interface Vote {
  oderId: string; // email address
  matchId: string;
  startupId: string;
  startupName: string; // Store name for history display
  voterType: 'judge' | 'audience';
  timestamp: number;
}

export interface Voter {
  email: string;
  voterType: 'judge' | 'audience';
  registeredAt: number;
  votes: { [matchId: string]: Vote }; // Track votes per match
}

export type MatchPhase = 
  | 'pending'
  | 'selecting'      // Random selection animation (3 seconds)
  | 'pitch1'         // First startup pitching
  | 'pitch2'         // Second startup pitching
  | 'voting'         // Voting in progress
  | 'completed';     // Match finished

export interface Match {
  id: string;
  startup1: Startup;
  startup2: Startup;
  status: MatchPhase;
  judgeVotes: {
    startup1: number;
    startup2: number;
  };
  audienceVotes: {
    startup1: number;
    startup2: number;
  };
  judgeWeight: number; // 0-100, percentage weight for judge votes
  audienceWeight: number; // 0-100, percentage weight for audience votes
  votingEndTime?: number; // Unix timestamp when voting ends
  votingDuration: number; // Duration in seconds for voting
  pitchDuration: number; // Duration in seconds for each pitch (default 90s = 1.5min)
  firstPitcher?: 'startup1' | 'startup2'; // Which startup pitches first (randomly selected)
  phaseEndTime?: number; // Unix timestamp when current phase ends
  winner?: string; // startup1 or startup2 or tie
  createdAt: number;
  voteCode: string; // Single QR code for all voters
}

export interface EventSettings {
  judgePassword: string; // Password for judges
  audiencePassword: string; // Password for audience
  maxAudienceSignIns: number; // Max number of audience sign-ins allowed
  maxJudgeSignIns: number; // Max number of judge sign-ins allowed
  currentAudienceCount: number; // Current number of audience sign-ins
  currentJudgeCount: number; // Current number of judge sign-ins
  allowedEmailDomains: string[]; // Allowed email domains (.com, .ai, .edu, etc.)
}

export interface VotingSettings {
  judgeWeight: number;
  audienceWeight: number;
  defaultVotingDuration: number; // in seconds
}
