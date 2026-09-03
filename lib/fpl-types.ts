export type FplTeam = {
  id: number;
  name: string;
  short_name: string;
  code?: number;
};

export type FplEvent = {
  id: number;
  name: string;
  deadline_time: string;
  finished?: boolean;
  is_current?: boolean;
  is_next?: boolean;
  is_previous?: boolean;
};

export type FplPlayer = {
  id: number;
  first_name: string;
  second_name: string;
  web_name: string;
  team: number;
  element_type: number;
  now_cost: number;
  cost_change_event: number;
  cost_change_start: number;
  selected_by_percent: string;
  form: string;
  ep_next?: string;
  ep_this?: string;
  points_per_game: string;
  total_points: number;
  event_points?: number;
  minutes: number;
  chance_of_playing_next_round: number | null;
  status: string;
  news: string;
  starts?: number;
  expected_goal_involvements?: string;
  transfers_in_event?: number;
  transfers_out_event?: number;
  transfers_in?: number;
  transfers_out?: number;
  penalties_order?: number | null;
  penalties_text?: string;
  corners_and_indirect_freekicks_order?: number | null;
  corners_and_indirect_freekicks_text?: string;
  direct_freekicks_order?: number | null;
  direct_freekicks_text?: string;
  goals_scored?: number;
  assists?: number;
  clean_sheets?: number;
  bonus?: number;
  ict_index?: string;
};

export type FplFixture = {
  id: number;
  event: number | null;
  team_h: number;
  team_a: number;
  team_h_difficulty: number;
  team_a_difficulty: number;
  kickoff_time: string | null;
  finished?: boolean;
  team_h_score?: number | null;
  team_a_score?: number | null;
};

export type FplHistoryRow = {
  round: number;
  opponent_team: number;
  total_points: number;
  minutes: number;
  was_home: boolean;
  value: number;
  kickoff_time?: string;
  fixture?: number;
};

export type SeasonHistoryRow = {
  event: number;
  points: number;
  total_points: number;
  rank?: number;
  overall_rank?: number;
  bank: number;
  value: number;
  event_transfers: number;
  event_transfers_cost: number;
  points_on_bench: number;
};

export type ClassicLeague = {
  id: number;
  name: string;
  short_name?: string | null;
  created?: string;
  league_type?: string;
  rank?: number | null;
};

export type CorePayload = {
  teams: FplTeam[];
  players: FplPlayer[];
  events: FplEvent[];
  fixtures: FplFixture[];
  positions: Record<string, string>;
  totalPlayers: number;
  meta: {
    source: string;
    fetchedAt: string;
    nextRefreshAt: string;
    stale: boolean;
  };
};

export type PlayerSummaryPayload = {
  history: FplHistoryRow[];
  meta: CorePayload["meta"];
};

export type SquadPayload = {
  entryId: number;
  gameweek: number;
  playerIds: number[];
  teamIds: number[];
  entryName?: string;
  playerName?: string;
  picks: Array<{
    element: number;
    position: number;
    multiplier: number;
    isCaptain: boolean;
    isViceCaptain: boolean;
  }>;
  bank: number;
  squadValue: number;
  lastGameweekPoints: number;
  overallPoints?: number;
  overallRank?: number;
  usedChips: Array<{ name: string; event: number }>;
  history: SeasonHistoryRow[];
  leagues: ClassicLeague[];
};

export type LivePlayer = {
  id: number;
  stats: {
    total_points: number;
    minutes: number;
    goals_scored?: number;
    assists?: number;
    clean_sheets?: number;
    bonus?: number;
  };
};

export type EventLivePayload = {
  event: number;
  players: LivePlayer[];
  meta: CorePayload["meta"];
};

export type MiniLeagueStanding = {
  id: number;
  entry: number;
  entryName: string;
  playerName: string;
  rank: number;
  lastRank: number;
  total: number;
};

export type MiniLeaguePayload = {
  league: { id: number; name: string; created?: string };
  standings: MiniLeagueStanding[];
  hasNext: boolean;
  page: number;
};
