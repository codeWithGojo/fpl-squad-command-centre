import type { CorePayload, FplEvent, FplFixture, FplPlayer, FplTeam, LivePlayer, SquadPayload } from "@/lib/fpl-types";

export type PlayerProjection = {
  player: FplPlayer;
  points: number;
  fdr: number;
  opponent: string;
  home: boolean;
  fixtureCount: number;
  availability: number;
  minutesReliability: number;
  explanation: string[];
};

export type TransferSuggestion = {
  outgoing: PlayerProjection;
  replacement?: PlayerProjection;
  gain: number;
  urgency: "Priority" | "Watch" | "Luxury";
  reasons: string[];
};

export type ChipAdvice = {
  key: "wildcard" | "freehit" | "bboost" | "3xc";
  name: string;
  verdict: "Use" | "Consider" | "Hold" | "Used";
  score: number;
  why: string;
  usedIn?: number;
};

export type GameweekAnalysis = {
  event: FplEvent;
  projections: PlayerProjection[];
  lineup: PlayerProjection[];
  bench: PlayerProjection[];
  captain: PlayerProjection;
  viceCaptain: PlayerProjection;
  projectedPoints: number;
  range: [number, number];
};

export type PriceSignal = {
  player: FplPlayer;
  direction: "Rise" | "Fall" | "Stable";
  confidence: number;
  netTransfers: number;
  ownershipMomentum: number;
  why: string;
};

export type DifferentialPick = PlayerProjection & {
  ownership: number;
  differentialScore: number;
};

export type FixtureSwing = {
  team: FplTeam;
  averageFdr: number;
  homeGames: number;
  blanks: number;
  fixtures: Array<{ event: number; opponent: string; home: boolean; fdr: number }>;
};

export type ChipTiming = {
  key: ChipAdvice["key"];
  name: string;
  bestEvent: number;
  score: number;
  verdict: ChipAdvice["verdict"];
  why: string;
};

const FORMATIONS = [
  [3, 5, 2], [3, 4, 3], [4, 5, 1], [4, 4, 2],
  [4, 3, 3], [5, 4, 1], [5, 3, 2], [5, 2, 3],
] as const;

function number(value: string | number | undefined, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function fixtureForPlayer(player: Pick<FplPlayer, "team">, event: FplEvent, fixtures: FplFixture[], teamsById: Map<number, FplTeam>) {
  return fixtures.filter((fixture) => fixture.event === event.id && (fixture.team_h === player.team || fixture.team_a === player.team)).map((fixture) => {
    const home = fixture.team_h === player.team;
    const opponentId = home ? fixture.team_a : fixture.team_h;
    return {
      fdr: home ? fixture.team_h_difficulty : fixture.team_a_difficulty,
      opponent: teamsById.get(opponentId)?.short_name ?? "TBC",
      home,
    };
  });
}

export function projectPlayer(player: FplPlayer, event: FplEvent, data: CorePayload): PlayerProjection {
  const teamsById = new Map(data.teams.map((team) => [team.id, team]));
  const playerFixtures = fixtureForPlayer(player, event, data.fixtures, teamsById);
  const fixtureCount = playerFixtures.length;
  const fdr = fixtureCount ? playerFixtures.reduce((sum, fixture) => sum + fixture.fdr, 0) / fixtureCount : 5;
  const homeRatio = fixtureCount ? playerFixtures.filter((fixture) => fixture.home).length / fixtureCount : 0;
  const nextEvent = data.events.find(item => item.is_next) ?? data.events.find(item => !item.finished && Date.parse(item.deadline_time) > Date.now());
  const useOfficial = event.id === nextEvent?.id && player.ep_next !== undefined && player.ep_next !== null;
  const officialExpected = number(player.ep_next, number(player.form));
  const form = number(player.form);
  const seasonRate = number(player.points_per_game);
  const finishedGameweeks = Math.max(1, data.events.filter((item) => item.finished).length);
  const minutesReliability = clamp(player.minutes / (finishedGameweeks * 82), 0.35, 1);
  const availability = player.chance_of_playing_next_round ?? (player.status === "a" ? 100 : 50);

  if (!fixtureCount) {
    return {
      player, points: 0, fdr, opponent: "Blank", home: false, fixtureCount: 0,
      availability, minutesReliability,
      explanation: ["No scheduled fixture in this gameweek", `${availability}% availability signal`],
    };
  }

  const base = useOfficial ? officialExpected * 0.55 + form * 0.3 + seasonRate * 0.15 : form * 0.65 + seasonRate * 0.35;
  const fixtureModifier = (3 - fdr) * 0.42;
  const homeModifier = homeRatio * 0.25;
  const reliabilityFactor = 0.72 + minutesReliability * 0.28;
  const availabilityFactor = availability / 100;
  const doubleMultiplier = fixtureCount > 1 ? 1.68 : 1;
  const points = clamp((base + fixtureModifier + homeModifier) * reliabilityFactor * availabilityFactor * doubleMultiplier, 0, 22);
  const opponent = playerFixtures.map((fixture) => `${fixture.opponent} ${fixture.home ? "H" : "A"}`).join(" + ");

  return {
    player,
    points: Math.round(points * 10) / 10,
    fdr,
    opponent,
    home: homeRatio >= 0.5,
    fixtureCount,
    availability,
    minutesReliability,
    explanation: [
      useOfficial ? `FPL expected points ${officialExpected.toFixed(1)} (55% weight)` : "Future GW estimate: official ep_next is not reused",
      `Form ${form.toFixed(1)} (${useOfficial ? 30 : 65}%) and season rate ${seasonRate.toFixed(1)} (${useOfficial ? 15 : 35}%)`,
      `FDR ${fdr.toFixed(1)}${homeRatio ? ` with ${Math.round(homeRatio * 100)}% at home` : " away"}`,
      `${availability}% availability and ${Math.round(minutesReliability * 100)}% minutes reliability`,
    ],
  };
}

export function chooseBestLineup(projections: PlayerProjection[]) {
  const groups = new Map<number, PlayerProjection[]>();
  for (const projection of projections) {
    const current = groups.get(projection.player.element_type) ?? [];
    current.push(projection);
    groups.set(projection.player.element_type, current);
  }
  for (const group of groups.values()) group.sort((a, b) => b.points - a.points);

  let best: PlayerProjection[] = [];
  let bestScore = -1;
  for (const [defenders, midfielders, forwards] of FORMATIONS) {
    const lineup = [
      ...(groups.get(1)?.slice(0, 1) ?? []),
      ...(groups.get(2)?.slice(0, defenders) ?? []),
      ...(groups.get(3)?.slice(0, midfielders) ?? []),
      ...(groups.get(4)?.slice(0, forwards) ?? []),
    ];
    if (lineup.length !== 11) continue;
    const score = lineup.reduce((sum, item) => sum + item.points, 0);
    if (score > bestScore) { best = lineup; bestScore = score; }
  }
  return best.length ? best : projections.toSorted((a, b) => b.points - a.points).slice(0, 11);
}

export function predictPriceChanges(data: CorePayload) {
  const estimatedManagers = Math.max(data.totalPlayers, 1);
  return data.players.map<PriceSignal>((player) => {
    const transfersIn = player.transfers_in_event ?? 0;
    const transfersOut = player.transfers_out_event ?? 0;
    const netTransfers = transfersIn - transfersOut;
    const estimatedOwners = Math.max(estimatedManagers * (number(player.selected_by_percent) / 100), 20_000);
    const ownershipMomentum = netTransfers / estimatedOwners * 100;
    const availabilityPenalty = player.status === "a" ? 0 : 18;
    const raw = Math.abs(ownershipMomentum) * 18 + Math.min(28, Math.abs(netTransfers) / 4_000) + Math.abs(player.cost_change_event) * 18 - availabilityPenalty;
    const confidence = Math.round(clamp(raw, 8, 94));
    const rising = netTransfers > 25_000 && ownershipMomentum > 0.8 && player.status === "a";
    const falling = netTransfers < -18_000 && ownershipMomentum < -0.7;
    const direction = rising ? "Rise" : falling ? "Fall" : "Stable";
    return {
      player,
      direction,
      confidence: direction === "Stable" ? Math.min(confidence, 58) : confidence,
      netTransfers,
      ownershipMomentum,
      why: direction === "Rise"
        ? `${netTransfers.toLocaleString()} net transfers in; ${ownershipMomentum.toFixed(1)}% of estimated owners.`
        : direction === "Fall"
          ? `${Math.abs(netTransfers).toLocaleString()} net transfers out; ${Math.abs(ownershipMomentum).toFixed(1)}% of estimated owners.`
          : "Transfer pressure has not crossed this model’s rise/fall signal.",
    };
  }).toSorted((a, b) => {
    const directionWeight = (item: PriceSignal) => item.direction === "Stable" ? 0 : 1;
    return directionWeight(b) - directionWeight(a) || b.confidence - a.confidence;
  });
}

export function findDifferentials(data: CorePayload, event: FplEvent, ownershipLimit = 10) {
  return data.players
    .filter((player) => number(player.selected_by_percent) <= ownershipLimit && player.status === "a" && player.minutes > 0)
    .map<DifferentialPick>((player) => {
      const projection = projectPlayer(player, event, data);
      const ownership = number(player.selected_by_percent);
      const differentialScore = Math.round((projection.points * 10 + number(player.form) * 4 + (ownershipLimit - ownership) * 1.2) * 10) / 10;
      return { ...projection, ownership, differentialScore };
    })
    .filter((player) => player.points >= 3.2)
    .toSorted((a, b) => b.differentialScore - a.differentialScore);
}

export function getFixtureSwings(data: CorePayload, events: FplEvent[]): FixtureSwing[] {
  const teamsById = new Map(data.teams.map((team) => [team.id, team]));
  return data.teams.map((team) => {
    const run = events.flatMap((event) => fixtureForPlayer({ team: team.id }, event, data.fixtures, teamsById).map((fixture) => ({
      event: event.id,
      opponent: fixture.opponent,
      home: fixture.home,
      fdr: fixture.fdr,
    })));
    const blanks = events.filter((event) => !run.some((fixture) => fixture.event === event.id)).length;
    return {
      team,
      averageFdr: run.length ? run.reduce((sum, fixture) => sum + fixture.fdr, 0) / run.length : 5,
      homeGames: run.filter((fixture) => fixture.home).length,
      blanks,
      fixtures: run,
    };
  }).toSorted((a, b) => a.averageFdr - b.averageFdr || b.homeGames - a.homeGames);
}

export function planChipTiming(data: CorePayload, squad: SquadPayload, events: FplEvent[]): ChipTiming[] {
  const analyses = events.map((event) => analyseGameweek(data, squad, event));
  const used = new Map(squad.usedChips.map((chip) => [chip.name, chip.event]));
  const scoreFor = (key: ChipAdvice["key"], analysis: GameweekAnalysis) => {
    const bench = analysis.bench.reduce((sum, player) => sum + player.points, 0);
    const blanks = analysis.projections.filter((player) => player.fixtureCount === 0 || player.availability < 60).length;
    const doubles = analysis.projections.filter((player) => player.fixtureCount > 1).length;
    if (key === "bboost") return clamp(Math.round(bench * 6 + doubles * 5 - blanks * 10), 0, 100);
    if (key === "3xc") return clamp(Math.round(analysis.captain.points * 8 + (analysis.captain.fixtureCount > 1 ? 22 : 0) - analysis.captain.fdr * 2), 0, 100);
    if (key === "freehit") return clamp(blanks * 14 + doubles * 5, 0, 100);
    const weak = analysis.projections.filter((player) => player.points < 3.2 || player.availability < 60).length;
    return clamp(weak * 13 + blanks * 7, 0, 100);
  };
  const chips: Array<{ key: ChipAdvice["key"]; name: string }> = [
    { key: "wildcard", name: "Wildcard" }, { key: "freehit", name: "Free Hit" },
    { key: "bboost", name: "Bench Boost" }, { key: "3xc", name: "Triple Captain" },
  ];
  return chips.map((chip) => {
    const ranked = analyses.map((analysis) => ({ analysis, score: scoreFor(chip.key, analysis) })).toSorted((a, b) => b.score - a.score);
    const best = ranked[0];
    const usedIn = used.get(chip.key);
    const verdict: ChipAdvice["verdict"] = usedIn ? "Used" : best.score >= 80 ? "Use" : best.score >= 62 ? "Consider" : "Hold";
    const why = usedIn ? `Already used in GW${usedIn}.` : chip.key === "3xc"
      ? `${best.analysis.captain.player.web_name} projects ${best.analysis.captain.points.toFixed(1)} points in GW${best.analysis.event.id}.`
      : chip.key === "bboost"
        ? `Bench projects ${best.analysis.bench.reduce((sum, player) => sum + player.points, 0).toFixed(1)} points in GW${best.analysis.event.id}.`
        : `${best.analysis.projections.filter((player) => player.fixtureCount === 0 || player.availability < 60).length} blank or availability risks in GW${best.analysis.event.id}.`;
    return { key: chip.key, name: chip.name, bestEvent: best.analysis.event.id, score: usedIn ? 0 : best.score, verdict, why };
  });
}

export function buildTeamOfWeek(data: CorePayload, event: FplEvent, livePlayers: LivePlayer[]) {
  const stats = new Map(livePlayers.map((player) => [player.id, player.stats]));
  const candidates = data.players.map<PlayerProjection>((player) => {
    const total = stats.get(player.id)?.total_points ?? 0;
    return { player, points: total, fdr: 3, opponent: `GW${event.id}`, home: false, fixtureCount: 1, availability: 100, minutesReliability: 1, explanation: [`${total} official points in GW${event.id}`] };
  });
  return chooseBestLineup(candidates);
}

export function getSetPieceLabel(player: FplPlayer) {
  const roles: string[] = [];
  if (player.penalties_order === 1) roles.push("First-choice penalties");
  else if (player.penalties_order && player.penalties_order <= 3) roles.push(`Penalty order ${player.penalties_order}`);
  if (player.direct_freekicks_order === 1) roles.push("First-choice direct free-kicks");
  else if (player.direct_freekicks_order && player.direct_freekicks_order <= 3) roles.push(`Direct free-kick order ${player.direct_freekicks_order}`);
  if (player.corners_and_indirect_freekicks_order === 1) roles.push("First-choice corners");
  else if (player.corners_and_indirect_freekicks_order && player.corners_and_indirect_freekicks_order <= 3) roles.push(`Corner order ${player.corners_and_indirect_freekicks_order}`);
  return roles;
}

export function analyseGameweek(data: CorePayload, squad: SquadPayload, event: FplEvent): GameweekAnalysis {
  const squadIds = new Set(squad.playerIds);
  const projections = data.players.filter((player) => squadIds.has(player.id)).map((player) => projectPlayer(player, event, data));
  const lineup = chooseBestLineup(projections);
  const lineupIds = new Set(lineup.map((item) => item.player.id));
  const bench = projections.filter((item) => !lineupIds.has(item.player.id)).toSorted((a, b) => b.points - a.points);
  const captainCandidates = lineup.toSorted((a, b) => b.points - a.points);
  const captain = captainCandidates[0] ?? projections[0];
  const viceCaptain = captainCandidates[1] ?? captain;
  const projectedPoints = lineup.reduce((sum, item) => sum + item.points, 0) + (captain?.points ?? 0);
  return {
    event,
    projections,
    lineup,
    bench,
    captain,
    viceCaptain,
    projectedPoints: Math.round(projectedPoints),
    range: [Math.max(0, Math.round(projectedPoints * 0.77 - 2)), Math.round(projectedPoints * 1.26 + 3)],
  };
}

export function recommendTransfers(data: CorePayload, squad: SquadPayload, analysis: GameweekAnalysis): TransferSuggestion[] {
  const squadIds = new Set(squad.playerIds);
  const teamCounts = new Map<number, number>();
  for (const projection of analysis.projections) teamCounts.set(projection.player.team, (teamCounts.get(projection.player.team) ?? 0) + 1);

  const rankedOutgoing = analysis.projections.map((projection) => {
    const priceFall = projection.player.cost_change_event < 0 ? 1 : 0;
    const hardRun = projection.fdr >= 4 ? 1.4 : 0;
    const injury = projection.availability < 75 ? 4 : 0;
    const blank = projection.fixtureCount === 0 ? 4 : 0;
    const score = (4.6 - projection.points) * 1.7 + priceFall + hardRun + injury + blank;
    return { projection, score };
  }).toSorted((a, b) => b.score - a.score);

  const suggestions: TransferSuggestion[] = [];
  for (const item of rankedOutgoing) {
    if (suggestions.length === 3) break;
    const outgoing = item.projection;
    const budget = outgoing.player.now_cost + squad.bank;
    const replacements = data.players
      .filter((candidate) => !squadIds.has(candidate.id) && candidate.element_type === outgoing.player.element_type && candidate.now_cost <= budget && candidate.status === "a")
      .filter((candidate) => (teamCounts.get(candidate.team) ?? 0) - (candidate.team === outgoing.player.team ? 1 : 0) < 3)
      .map((candidate) => projectPlayer(candidate, analysis.event, data))
      .toSorted((a, b) => b.points - a.points);
    const replacement = replacements[0];
    const gain = replacement ? Math.round((replacement.points - outgoing.points) * 10) / 10 : 0;
    const forced = outgoing.availability < 60 || outgoing.fixtureCount === 0;
    if (!forced && item.score < 1.5 && gain < 0.8) continue;
    const reasons = [
      outgoing.availability < 75 ? `Only ${outgoing.availability}% availability` : `${outgoing.points.toFixed(1)} projected points`,
      outgoing.fixtureCount === 0 ? "Blank gameweek" : `Faces ${outgoing.opponent} at FDR ${outgoing.fdr.toFixed(1)}`,
      outgoing.player.cost_change_event < 0 ? "Price has fallen this gameweek" : "No immediate price-drop pressure",
    ];
    suggestions.push({ outgoing, replacement, gain, urgency: forced || gain >= 2 ? "Priority" : gain >= 1 ? "Watch" : "Luxury", reasons });
  }
  return suggestions;
}

export function adviseChips(squad: SquadPayload, analysis: GameweekAnalysis, transfers: TransferSuggestion[]): ChipAdvice[] {
  const used = new Map(squad.usedChips.map((chip) => [chip.name, chip.event]));
  const benchPoints = analysis.bench.reduce((sum, player) => sum + player.points, 0);
  const unavailablePlayers = analysis.projections.filter((player) => player.availability < 60 || player.fixtureCount === 0).length;
  const structuralProblems = analysis.projections.filter((player) => player.points < 3.2 || player.availability < 60 || player.fixtureCount === 0).length;
  const prioritySales = transfers.filter((transfer) => transfer.urgency === "Priority").length;
  const captain = analysis.captain;

  const raw: ChipAdvice[] = [
    {
      key: "wildcard", name: "Wildcard",
      verdict: structuralProblems >= 6 || unavailablePlayers >= 5 ? "Use" : structuralProblems >= 4 || prioritySales >= 3 ? "Consider" : "Hold",
      score: Math.min(100, structuralProblems * 13 + prioritySales * 7 + unavailablePlayers * 7),
      why: structuralProblems >= 4 ? `${structuralProblems} players project below 3.2 points or carry a major availability/fixture problem.` : "The squad does not have enough structural problems to justify a full reset.",
    },
    {
      key: "freehit", name: "Free Hit",
      verdict: unavailablePlayers >= 7 ? "Use" : unavailablePlayers >= 5 ? "Consider" : "Hold",
      score: Math.min(100, unavailablePlayers * 14),
      why: unavailablePlayers >= 5 ? `${unavailablePlayers} players have no fixture or a major availability risk this week.` : "Enough of the squad has a playable fixture; save it for a major blank gameweek.",
    },
    {
      key: "bboost", name: "Bench Boost",
      verdict: benchPoints >= 15 && unavailablePlayers === 0 ? "Use" : benchPoints >= 11 && unavailablePlayers <= 1 ? "Consider" : "Hold",
      score: Math.min(100, Math.round(benchPoints * 6.4) - unavailablePlayers * 12),
      why: benchPoints >= 11 ? `Your bench projects for ${benchPoints.toFixed(1)} points.` : `The bench projects for only ${benchPoints.toFixed(1)} points; the upside is limited.`,
    },
    {
      key: "3xc", name: "Triple Captain",
      verdict: captain.fixtureCount > 1 && captain.points >= 9 ? "Use" : captain.points >= 8.5 && captain.fdr <= 2 ? "Consider" : "Hold",
      score: Math.min(100, Math.round(captain.points * 9 + (captain.fixtureCount > 1 ? 18 : 0) - captain.fdr * 3)),
      why: captain.fixtureCount > 1 ? `${captain.player.web_name} has a double gameweek and projects ${captain.points.toFixed(1)} points before the chip.` : `${captain.player.web_name} projects ${captain.points.toFixed(1)} against ${captain.opponent}; wait for a stronger or double fixture if possible.`,
    },
  ];

  return raw.map((chip) => {
    const usedIn = used.get(chip.key);
    if (!usedIn) return chip;
    if (chip.key === "wildcard") return { ...chip, usedIn, why: `A Wildcard was recorded in GW${usedIn}. Check the official game for any later Wildcard window.`, verdict: "Used" };
    return { ...chip, usedIn, why: `${chip.name} was already used in GW${usedIn}.`, verdict: "Used", score: 0 };
  });
}
