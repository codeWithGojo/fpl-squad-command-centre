import { analyseGameweek, projectPlayer } from "./fpl-analysis";
import type { CorePayload, FplEvent, FplPlayer, SquadPayload } from "./fpl-types";

export type Strategy = "safe" | "balanced" | "aggressive";
export type Move = { event: number; out: number; in: number; sellPrice: number };
export function planningEvents(data: CorePayload) {
  return data.events.filter(e => !e.finished && Date.parse(e.deadline_time) > Date.now()).slice(0, 6);
}
export function withPlayers(squad: SquadPayload, players: FplPlayer[], bank: number): SquadPayload {
  return { ...squad, playerIds: players.map(p => p.id), teamIds: [...new Set(players.map(p => p.team))], bank };
}
export function validateSquad(players: FplPlayer[], bank: number) {
  if (players.length !== 15 || new Set(players.map(p => p.id)).size !== 15) return "A squad needs 15 different players.";
  if (!Number.isInteger(bank) || bank < 0) return "Enter a valid budget for this plan.";
  for (const [position, count] of [[1, 2], [2, 5], [3, 5], [4, 3]]) {
    if (players.filter(p => p.element_type === position).length !== count) return "Keep 2 goalkeepers, 5 defenders, 5 midfielders and 3 forwards.";
  }
  if (players.some(p => players.filter(q => q.team === p.team).length > 3)) return "Maximum three players per club.";
  return "";
}
export function evaluatePlan(data: CorePayload, squad: SquadPayload, events: FplEvent[], moves: Move[], freeTransfers: number, initialBank = squad.bank) {
  let players = data.players.filter(p => squad.playerIds.includes(p.id));
  let bank = initialBank;
  let free = freeTransfers;
  const rows: Array<{ event: number; points: number; baseline: number; hit: number; bank: number; free: number; players: FplPlayer[] }> = [];
  if (!Number.isInteger(freeTransfers) || freeTransfers < 0 || freeTransfers > 5 || !Number.isInteger(initialBank) || initialBank < 0) return { rows, error: "Enter valid free transfers and bank." };
  if (moves.some(m => !m || !events.some(e => e.id === m.event) || !Number.isInteger(m.out) || !Number.isInteger(m.in))) return { rows, error: "A saved move has an invalid player or gameweek." };
  for (const event of events) {
    const weekly = moves.filter(m => m.event === event.id);
    for (const move of weekly) {
      const outgoing = players.find(p => p.id === move.out);
      const incoming = data.players.find(p => p.id === move.in);
      if (!outgoing || !incoming || outgoing.element_type !== incoming.element_type || players.some(p => p.id === incoming.id) || !Number.isInteger(move.sellPrice) || move.sellPrice < 0 || move.sellPrice > outgoing.now_cost) return { rows, error: "A saved move is no longer valid. Check players and selling prices." };
      bank += move.sellPrice - incoming.now_cost;
      players = players.map(p => p.id === move.out ? incoming : p);
    }
    const error = validateSquad(players, bank);
    if (error) return { rows, error: `GW${event.id}: ${error}` };
    const hit = Math.max(0, weekly.length - free) * 4;
    free = Math.min(5, Math.max(0, free - weekly.length) + 1);
    rows.push({ event: event.id, points: analyseGameweek(data, withPlayers(squad, players, bank), event).projectedPoints - hit, baseline: analyseGameweek(data, squad, event).projectedPoints, hit, bank, free, players: [...players] });
  }
  return { rows, error: "" };
}
export function rankTransferOptions(data: CorePayload, squad: SquadPayload, events: FplEvent[], free: number, strategy: Strategy, bank: number) {
  if (!events.length) return [];
  const owned = data.players.filter(p => squad.playerIds.includes(p.id));
  const score = new Map(data.players.map(p => [p.id, events.reduce((sum, e) => sum + projectPlayer(p, e, data).points, 0)]));
  const candidates = owned.flatMap(out => data.players.filter(p => p.element_type === out.element_type && !squad.playerIds.includes(p.id) && p.now_cost <= out.now_cost + bank && p.status === "a" && owned.filter(q => q.team === p.team && q.id !== out.id).length < 3).toSorted((a,b) => (score.get(b.id) ?? 0) - (score.get(a.id) ?? 0)).slice(0, 3).map(incoming => ({out, incoming})));
  return candidates.map(({out, incoming}) => {
    const move = {event: events[0].id, out: out.id, in: incoming.id, sellPrice: out.now_cost};
    const result = evaluatePlan(data, squad, events, [move], free, bank);
    const gain = result.rows.reduce((sum,r) => sum + r.points - r.baseline, 0);
    const projection = projectPlayer(incoming, events[0], data);
    const preference = strategy === "safe" ? projection.minutesReliability * 2 : strategy === "aggressive" ? Math.max(0, 10 - Number(incoming.selected_by_percent)) / 10 : 0;
    return {out, incoming, move, gain, nextGain: result.rows[0] ? result.rows[0].points - result.rows[0].baseline : 0, hit: result.rows[0]?.hit ?? 0, projection, rank: gain + preference};
  }).filter(r => r.gain > 0).toSorted((a,b) => b.rank - a.rank).slice(0, 6);
}

// A bounded greedy draft: legal and affordable, not a claimed global optimum.
export function buildDraft(data: CorePayload, events: FplEvent[], budget: number, strategy: Strategy) {
  if (!Number.isInteger(budget) || budget < 0 || !events.length) return {players: [], error: "Enter a valid budget and forecast horizon."};
  const pool = data.players.filter(p => p.status === "a" && p.now_cost > 0);
  const scores = new Map(pool.map(p => [p.id, events.reduce((sum,e) => sum + projectPlayer(p,e,data).points,0) + (strategy === "safe" ? Math.min(2,p.minutes/450) : strategy === "aggressive" ? Math.max(0,10-Number(p.selected_by_percent))/10 : 0)]));
  let players: FplPlayer[] = [];
  for (const [position,count] of [[1,2],[2,5],[3,5],[4,3]]) {
    for(let i=0;i<count;i++) {
      const candidate = pool.filter(p => p.element_type === position && !players.some(q=>q.id===p.id) && players.filter(q=>q.team===p.team).length<3).toSorted((a,b)=>a.now_cost-b.now_cost || (scores.get(b.id)??0)-(scores.get(a.id)??0))[0];
      if (!candidate) return {players: [], error: "Not enough available players to create a legal draft."};
      players.push(candidate);
    }
  }
  let remaining = budget - players.reduce((s,p)=>s+p.now_cost,0);
  if (remaining<0) return {players:[], error:"This draft search could not find a squad within your budget."};
  for(let pass=0;pass<80;pass++) {
    let best: {index:number; player:FplPlayer; cost:number; priority:number} | undefined;
    players.forEach((out,index)=>pool.forEach(p=>{
      const cost=p.now_cost-out.now_cost;
      const gain=(scores.get(p.id)??0)-(scores.get(out.id)??0);
      if(gain<=0.01 || cost>remaining || p.element_type!==out.element_type || players.some(q=>q.id===p.id) || players.filter(q=>q.team===p.team&&q.id!==out.id).length>=3) return;
      const priority=gain/Math.max(2,cost);
      if(!best||priority>best.priority) best={index,player:p,cost,priority};
    }));
    if(!best) break;
    const upgrade = best as {index:number; player:FplPlayer; cost:number; priority:number};
    players=players.map((p,i)=>i===upgrade.index?upgrade.player:p);
    remaining-=upgrade.cost;
  }
  return {players,error:validateSquad(players,remaining)};
}
