"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { ArrowDownRight, ArrowRight, ArrowUpRight, BarChart3, BrainCircuit, CalendarDays, Check, ChevronRight, CircleAlert, Clock3, Filter, Info, LoaderCircle, RefreshCw, Search, Shield, Sparkles, Target, TrendingUp, UserRound, Users, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Combobox, ComboboxContent, ComboboxEmpty, ComboboxInput, ComboboxItem, ComboboxList } from "@/components/ui/combobox";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CommandDashboard } from "@/components/command-dashboard";
import { TransferWorkspace } from "@/components/transfer-workspace";
import { planningEvents } from "@/lib/transfer-planner";
import { IntelligenceHub } from "@/components/intelligence-hub";
import type { CorePayload, FplEvent, FplFixture, FplPlayer, FplTeam, PlayerSummaryPayload, SquadPayload } from "@/lib/fpl-types";

type FilterMode = "all" | "squad" | "selected";
type PlayerOption = { value: string; label: string; player: FplPlayer };

const FDR_LABELS: Record<number, string> = { 1: "Very easy", 2: "Easy", 3: "Balanced", 4: "Hard", 5: "Very hard" };
const scoreColor = (score: number) => score >= 70 ? "#2156e8" : score >= 48 ? "#e6a700" : "#d1273f";
const positionOrder = ["GKP", "DEF", "MID", "FWD"];

function formatPrice(value: number) { return `£${(value / 10).toFixed(1)}m`; }
function formatDate(value: string) { return new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }).format(new Date(value)); }
function getUpcomingEvents(events: FplEvent[]) { return events.filter((event) => !event.finished && Date.parse(event.deadline_time) > Date.now()).slice(0, 5); }

function getTeamFixtures(teamId: number, eventId: number, fixtures: FplFixture[], teamsById: Map<number, FplTeam>) {
  return fixtures.filter((fixture) => fixture.event === eventId && (fixture.team_h === teamId || fixture.team_a === teamId)).map((fixture) => {
    const home = fixture.team_h === teamId;
    const opponentId = home ? fixture.team_a : fixture.team_h;
    return { opponent: teamsById.get(opponentId)?.short_name ?? "TBC", home, difficulty: home ? fixture.team_h_difficulty : fixture.team_a_difficulty };
  });
}

function averageFixtureDifficulty(player: FplPlayer, events: FplEvent[], fixtures: FplFixture[], teamsById: Map<number, FplTeam>) {
  const values = events.flatMap((event) => getTeamFixtures(player.team, event.id, fixtures, teamsById).map((fixture) => fixture.difficulty));
  return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 3;
}

function buildRecommendation(player: FplPlayer, avgFdr: number, exactForm?: number) {
  const form = Number.isFinite(exactForm) ? exactForm! : Number(player.form) || 0;
  const price = player.now_cost / 10;
  const ppg = Number(player.points_per_game) || 0;
  const availability = player.chance_of_playing_next_round ?? (player.status === "a" ? 100 : 50);
  const ownership = Number(player.selected_by_percent) || 0;
  const parts = [
    { label: "Form", value: Math.min(35, (form / 8) * 35), max: 35, detail: `${form.toFixed(1)} points per GW across the latest sample` },
    { label: "Fixtures", value: Math.max(0, ((5 - avgFdr) / 4) * 25), max: 25, detail: `${avgFdr.toFixed(1)} average FDR over the next five` },
    { label: "Value", value: Math.min(20, ((ppg / Math.max(price, 3.5)) / 0.9) * 20), max: 20, detail: `${ppg.toFixed(1)} points per game at ${formatPrice(player.now_cost)}` },
    { label: "Availability", value: (availability / 100) * 10, max: 10, detail: `${availability}% chance of playing next round` },
    { label: "Price momentum", value: player.cost_change_event > 0 ? 5 : player.cost_change_event < 0 ? 0 : 2.5, max: 5, detail: player.cost_change_event > 0 ? "Price rose this gameweek" : player.cost_change_event < 0 ? "Price fell this gameweek" : "Price is flat this gameweek" },
    { label: "Ownership safety", value: Math.min(5, (ownership / 35) * 5), max: 5, detail: `${ownership.toFixed(1)}% owned; this measures rank exposure, not talent` },
  ];
  let score = Math.round(parts.reduce((sum, part) => sum + part.value, 0));
  if (availability < 50) score = Math.min(score, 45);
  const verdict = score >= 70 ? "Good buy" : score >= 48 ? "Hold" : "Consider selling";
  return { form, score, verdict, parts };
}

function LoadingScreen() {
  return <div className="loading-workspace" role="status" aria-label="Loading FPL data"><div className="loading-brand">FPL / COMMAND</div><p>Preparing your gameweek workspace…</p><div className="skeleton skeleton-heading"/><div className="summary-grid">{[1,2,3,4].map(n=><div key={n} className="skeleton skeleton-card"/>)}</div><div className="skeleton skeleton-board"/></div>;
}

function ErrorScreen({ message, retry }: { message: string; retry: () => void }) {
  return <div className="mx-auto grid min-h-[65vh] max-w-md place-items-center px-6 text-center"><div className="rounded-2xl border bg-white p-8 shadow-sm"><CircleAlert className="mx-auto size-9 text-destructive" /><h2 className="mt-4 text-xl font-bold">FPL data didn’t load</h2><p className="mt-2 text-sm leading-6 text-muted-foreground">{message}</p><Button onClick={retry} className="mt-5 bg-[#2156e8] hover:bg-[#173fae]"><RefreshCw /> Try again</Button></div></div>;
}

export function FplAssistant() {
  const [data, setData] = useState<CorePayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [tab, setTab] = useState("squad");
  const [filterMode, setFilterMode] = useState<FilterMode>("all");
  const [selectedTeamIds, setSelectedTeamIds] = useState<number[]>([]);
  const [positionFilter, setPositionFilter] = useState("ALL");
  const [playerOption, setPlayerOption] = useState<PlayerOption | null>(null);
  const [summaryState, setSummaryState] = useState<{ playerId: number; payload: PlayerSummaryPayload | null } | null>(null);
  const [squad, setSquad] = useState<SquadPayload | null>(null);
  const [teamDialogOpen, setTeamDialogOpen] = useState(false);
  const [entryId, setEntryId] = useState("");
  const [entryError, setEntryError] = useState("");
  const [entryLoading, setEntryLoading] = useState(false);

  const loadCore = useCallback(async () => {
    setLoading(true); setError("");
    try {
      const response = await fetch("/api/fpl/core", { headers: { Accept: "application/json" } });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "The official FPL service did not respond.");
      setData(payload as CorePayload);
      if(squad) { const res=await fetch(`/api/fpl/squad/${squad.entryId}`); const refreshed=await res.json(); if(res.ok) { setSquad(refreshed); setEntryError(""); } else setEntryError("Squad refresh failed. Showing your previous published squad."); }
    } catch (loadError) { setError(loadError instanceof Error ? loadError.message : "Could not load FPL data."); }
    finally { setLoading(false); }
  }, [squad]);

  useEffect(() => {
    let active = true;
    fetch("/api/fpl/core", { headers: { Accept: "application/json" } })
      .then(async (response) => {
        const payload = await response.json();
        if (!response.ok) throw new Error(payload.error || "The official FPL service did not respond.");
        if (active) setData(payload as CorePayload);
      })
      .catch((loadError) => { if (active) setError(loadError instanceof Error ? loadError.message : "Could not load FPL data."); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);
  useEffect(() => {
    const timer = window.setTimeout(() => {
      let saved: string | null = null;
      try { saved = window.localStorage.getItem("fpl-entry-id"); } catch { return; }
      if (!saved) return;
      setEntryId(saved);
      fetch(`/api/fpl/squad/${saved}`)
        .then(async (response) => {
          const payload = await response.json();
          if (!response.ok) throw new Error(payload.error || "Squad not found");
          setSquad(payload as SquadPayload);
          setFilterMode("squad");
          setTab("squad");
        })
        .catch(() => setEntryError("Your saved squad could not be refreshed."));
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  const teamsById = useMemo(() => new Map((data?.teams ?? []).map((team) => [team.id, team])), [data]);
  const upcomingEvents = useMemo(() => getUpcomingEvents(data?.events ?? []), [data]);
  const options = useMemo<PlayerOption[]>(() => {
    if (!data) return [];
    return data.players.filter((player) => positionFilter === "ALL" || data.positions[String(player.element_type)] === positionFilter).sort((a, b) => b.total_points - a.total_points).map((player) => ({ value: String(player.id), label: `${player.web_name} · ${teamsById.get(player.team)?.short_name ?? "—"} · ${data.positions[String(player.element_type)] ?? "—"}`, player }));
  }, [data, positionFilter, teamsById]);

  const activePlayerOption = playerOption ?? options[0] ?? null;
  const selectedPlayerId = activePlayerOption?.player.id;
  useEffect(() => {
    if (!selectedPlayerId) return;
    let active = true;
    fetch(`/api/fpl/player/${selectedPlayerId}`).then(async (response) => { const payload = await response.json(); if (!response.ok) throw new Error(payload.error || "Player history unavailable"); if (active) setSummaryState({ playerId: selectedPlayerId, payload: payload as PlayerSummaryPayload }); }).catch(() => { if (active) setSummaryState({ playerId: selectedPlayerId, payload: null }); });
    return () => { active = false; };
  }, [selectedPlayerId]);

  const connectSquad = async () => {
    if (!/^\d+$/.test(entryId)) { setEntryError("Enter the number shown in your FPL Points page URL."); return; }
    setEntryLoading(true); setEntryError("");
    try {
      const response = await fetch(`/api/fpl/squad/${entryId}`); const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "Squad not found");
      const nextSquad = payload as SquadPayload; setSquad(nextSquad); setFilterMode("squad"); setTab("squad"); try { window.localStorage.setItem("fpl-entry-id", entryId); } catch { /* Squad remains usable without storage. */ } setTeamDialogOpen(false);
    } catch (connectError) { setEntryError(connectError instanceof Error ? connectError.message : "Could not load that squad."); }
    finally { setEntryLoading(false); }
  };

  if (loading) return <LoadingScreen />;
  if (error || !data) return <ErrorScreen message={error || "The response was incomplete."} retry={loadCore} />;

  const selectedPlayer = activePlayerOption?.player ?? data.players[0];
  const filteredTeams = data.teams.filter((team) => filterMode === "squad" ? squad?.teamIds.includes(team.id) : filterMode === "selected" ? selectedTeamIds.includes(team.id) : true);
  const summary = summaryState?.playerId === selectedPlayer.id ? summaryState.payload : null;
  const summaryLoading = summaryState?.playerId !== selectedPlayer.id;
  const exactLastFive = summary?.history.slice(-5) ?? [];
  const exactForm = exactLastFive.length ? exactLastFive.reduce((sum, row) => sum + row.total_points, 0) / exactLastFive.length : undefined;
  const avgFdr = averageFixtureDifficulty(selectedPlayer, upcomingEvents, data.fixtures, teamsById);
  const recommendation = buildRecommendation(selectedPlayer, avgFdr, exactForm);
  const selectedFixtures = upcomingEvents.flatMap((event) => getTeamFixtures(selectedPlayer.team, event.id, data.fixtures, teamsById).map((fixture) => ({ ...fixture, event })));
  const trend = selectedPlayer.cost_change_event > 0 ? "rising" : selectedPlayer.cost_change_event < 0 ? "falling" : "stable";

  return (
    <div className="app-shell">
      <a className="skip-link" href="#main-content">Skip to content</a>
      <aside className="app-sidebar">
        <div className="app-brand"><span className="brand-mark"><TrendingUp size={23}/></span><div><h1>FPL / COMMAND</h1><span>Squad intelligence</span></div></div>
        <p className="nav-caption">WORKSPACE</p>
        <nav aria-label="Main tools">
          <SidebarButton active={tab==="squad"} onClick={()=>setTab("squad")} icon={<UserRound/>} label="Gameweek" detail="Your next decisions"/>
          <SidebarButton active={tab==="planner"} onClick={()=>setTab("planner")} icon={<ArrowRight/>} label="Transfers & planner" detail="Compare, draft, save"/>
          <SidebarButton active={tab==="fixtures"} onClick={()=>setTab("fixtures")} icon={<CalendarDays/>} label="Fixtures" detail="The next five weeks"/>
          <SidebarButton active={tab==="transfer"} onClick={()=>setTab("transfer")} icon={<Target/>} label="Player explorer" detail="Value and form"/>
          <SidebarButton active={tab==="intel"} onClick={()=>setTab("intel")} icon={<BrainCircuit/>} label="Insights & review" detail="Market, rivals, season"/>
        </nav>
        <div className="sidebar-team"><span className="nav-caption">YOUR TEAM</span><strong>{squad?.entryName||"No squad connected"}</strong><Button variant="outline" onClick={()=>setTeamDialogOpen(true)}>{squad?"Change team":"Connect team"}<ArrowRight/></Button></div>
        <p className="sidebar-foot">Independent FPL companion</p>
      </aside>
      <div className="app-body">
        <header className="app-topbar"><div className="mobile-wordmark">FPL / COMMAND</div><div className="feed-status">Official FPL data {data.meta.stale&&<span className="stale-label">Cached snapshot</span>}</div><div className="topbar-actions"><span>Updated {formatDate(data.meta.fetchedAt)}</span><Button variant="outline" size="sm" onClick={loadCore} aria-label="Refresh FPL data"><RefreshCw size={16}/><span>Refresh</span></Button><Button size="sm" onClick={()=>setTeamDialogOpen(true)}><UserRound size={16}/>{squad?"My team":"Connect"}</Button></div></header>
        <main id="main-content" className="app-main">
          <div className="page-heading"><div><p className="eyebrow">FPL COMMAND CENTRE</p><h2>{{squad:"Gameweek overview",planner:"Transfers & planner",fixtures:"Fixture calendar",transfer:"Player explorer",intel:"Insights & review"}[tab]}</h2></div><span className="data-tag">{planningEvents(data)[0]?`GW${planningEvents(data)[0].id} upcoming`:"Season overview"}</span></div>
          {entryError&&!teamDialogOpen&&<p role="alert" className="notice error-notice">{entryError} <button onClick={()=>setTeamDialogOpen(true)}>Reconnect team</button></p>}
          <Tabs value={tab} onValueChange={setTab} className="gap-5">
            <TabsList className="mobile-tabs" aria-label="Workspace navigation">{[["squad","Gameweek"],["planner","Planner"],["fixtures","Fixtures"],["transfer","Players"],["intel","Insights"]].map(([key,label])=><TabsTrigger key={key} value={key}>{label}</TabsTrigger>)}</TabsList>
            <TabsContent value="squad"><CommandDashboard data={data} squad={squad} onConnect={()=>setTeamDialogOpen(true)} onPlan={()=>setTab("planner")}/></TabsContent>
            <TabsContent value="planner" forceMount hidden={tab!=="planner"}><TransferWorkspace data={data} squad={squad} onConnect={()=>setTeamDialogOpen(true)}/></TabsContent>

          <TabsContent value="fixtures">
            <section className="overflow-hidden rounded-2xl border bg-white shadow-none">
              <div className="flex flex-col gap-4 border-b p-5 sm:p-6 lg:flex-row lg:items-center lg:justify-between"><div><p className="text-xs font-semibold uppercase tracking-[.16em] text-[#2156e8]">Next five gameweeks</p><h3 className="mt-1 text-2xl font-bold tracking-tight">Fixture difficulty at a glance</h3><p className="mt-1 text-sm text-muted-foreground">Home fixtures are marked H. Double gameweeks stack both opponents in one cell.</p></div><div className="flex flex-wrap items-center gap-2"><div className="flex rounded-xl bg-[#f1f3f5] p-1"><button onClick={() => setFilterMode("all")} className={`rounded-lg px-3 py-2 text-sm font-bold transition ${filterMode === "all" ? "bg-white text-[#2156e8] shadow-sm" : "text-muted-foreground"}`}>All teams</button><button onClick={() => squad ? setFilterMode("squad") : setTeamDialogOpen(true)} className={`rounded-lg px-3 py-2 text-sm font-bold transition ${filterMode === "squad" ? "bg-white text-[#2156e8] shadow-sm" : "text-muted-foreground"}`}><Users className="mr-1 inline size-4" />My squad</button><button onClick={() => setFilterMode("selected")} className={`rounded-lg px-3 py-2 text-sm font-bold transition ${filterMode === "selected" ? "bg-white text-[#2156e8] shadow-sm" : "text-muted-foreground"}`}><Filter className="mr-1 inline size-4" />Pick teams</button></div></div></div>
              {filterMode === "selected" && <div className="flex gap-2 overflow-x-auto border-b bg-[#fafbfc] px-5 py-3 scrollbar-none">{data.teams.map((team) => { const active = selectedTeamIds.includes(team.id); return <button key={team.id} onClick={() => setSelectedTeamIds((current) => active ? current.filter((id) => id !== team.id) : [...current, team.id])} className={`min-w-max rounded-full border px-3 py-1.5 text-xs font-bold transition ${active ? "border-[#2156e8] bg-[#2156e8] text-white" : "bg-white text-muted-foreground hover:border-[#2156e8]/40"}`}>{team.short_name}</button>; })}</div>}
              <div className="overflow-x-auto"><table className="w-full min-w-[760px] border-collapse text-left"><thead><tr className="bg-[#fafbfc] text-xs font-semibold uppercase tracking-[.1em] text-muted-foreground"><th className="sticky left-0 z-10 min-w-44 border-b bg-[#fafbfc] px-5 py-4">Team</th>{upcomingEvents.map((event) => <th key={event.id} className="min-w-28 border-b px-3 py-4 text-center">GW {event.id}</th>)}</tr></thead><tbody>{filteredTeams.map((team) => <tr key={team.id} className="group border-b last:border-b-0 hover:bg-[#fafbfc]"><th className="sticky left-0 z-10 bg-white px-5 py-3 group-hover:bg-[#fafbfc]"><div className="flex items-center gap-3"><span className="grid size-9 place-items-center rounded-xl bg-[#2156e8] text-xs font-bold text-white">{team.short_name}</span><span className="text-sm font-semibold">{team.name}</span></div></th>{upcomingEvents.map((event) => { const cellFixtures = getTeamFixtures(team.id, event.id, data.fixtures, teamsById); return <td key={event.id} className="px-2 py-2.5"><div className="flex flex-col gap-1.5">{cellFixtures.length ? cellFixtures.map((fixture, index) => <div key={`${fixture.opponent}-${index}`} title={`${FDR_LABELS[fixture.difficulty]} fixture`} className={`fdr-${fixture.difficulty} mx-auto flex min-h-12 w-full max-w-28 items-center justify-between rounded-xl px-3 text-sm font-bold`}><span>{fixture.opponent} <small className="font-semibold opacity-70">({fixture.home ? "H" : "A"})</small></span><span className="rounded-md bg-black/10 px-1.5 py-0.5 text-xs">{fixture.difficulty}</span></div>) : <div className="mx-auto grid min-h-12 w-full max-w-28 place-items-center rounded-xl border border-dashed text-sm text-muted-foreground">—</div>}</div></td>; })}</tr>)}</tbody></table></div>
              {!filteredTeams.length && <div className="px-6 py-12 text-center"><Shield className="mx-auto size-8 text-muted-foreground" /><p className="mt-3 font-bold">No teams selected</p><p className="mt-1 text-sm text-muted-foreground">Choose at least one club above, or return to all teams.</p></div>}
              <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-t bg-[#fafbfc] px-5 py-3 text-xs text-muted-foreground"><span className="font-bold text-foreground">FDR key</span>{[1, 2, 3, 4, 5].map((value) => <span key={value} className="flex items-center gap-1.5"><i className={`fdr-${value} size-3 rounded-sm`} />{value} {FDR_LABELS[value]}</span>)}</div>
            </section>
          </TabsContent>

          <TabsContent value="transfer">
            <section className="grid gap-5 xl:grid-cols-[minmax(0,1.55fr)_minmax(330px,.75fr)]">
              <div className="overflow-hidden rounded-2xl border bg-white shadow-none">
                <div className="border-b p-5 sm:p-6"><p className="text-xs font-semibold uppercase tracking-[.16em] text-[#2156e8]">Player decision card</p><div className="mt-3 grid gap-3 sm:grid-cols-[1fr_130px]"><Combobox items={options} value={activePlayerOption} onValueChange={(value) => setPlayerOption(value as PlayerOption | null)} itemToStringValue={(item) => item.label}><ComboboxInput className="h-11 w-full rounded-xl bg-white" placeholder="Search any FPL player…" showClear={false}><Search className="mr-1 size-4 text-muted-foreground" /></ComboboxInput><ComboboxContent className="w-[min(92vw,520px)]"><ComboboxEmpty>No player found.</ComboboxEmpty><ComboboxList>{(option: PlayerOption) => <ComboboxItem key={option.value} value={option}>{option.label}</ComboboxItem>}</ComboboxList></ComboboxContent></Combobox><Select value={positionFilter} onValueChange={(value) => { setPositionFilter(value); setPlayerOption(null); }}><SelectTrigger className="h-11 w-full rounded-xl"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="ALL">All positions</SelectItem>{positionOrder.map((position) => <SelectItem key={position} value={position}>{position}</SelectItem>)}</SelectContent></Select></div></div>
                <div className="p-5 sm:p-6">
                  <div className="flex flex-col gap-5 border-b pb-6 sm:flex-row sm:items-center sm:justify-between"><div className="flex items-center gap-4"><div className="grid size-16 place-items-center rounded-2xl bg-[#2156e8] text-base font-bold text-white shadow-lg shadow-none/15">{teamsById.get(selectedPlayer.team)?.short_name}</div><div><div className="flex flex-wrap items-center gap-2"><h3 className="text-2xl font-bold tracking-tight">{selectedPlayer.first_name} {selectedPlayer.second_name}</h3><span className="rounded-full bg-[#eef1f4] px-2.5 py-1 text-xs font-semibold">{data.positions[String(selectedPlayer.element_type)]}</span></div><p className="mt-1 text-sm text-muted-foreground">{teamsById.get(selectedPlayer.team)?.name} · {selectedPlayer.minutes.toLocaleString()} minutes</p>{selectedPlayer.news && <p className="mt-2 max-w-xl text-sm font-medium text-amber-700"><CircleAlert className="mr-1 inline size-4" />{selectedPlayer.news}</p>}</div></div><div className={`w-fit rounded-2xl px-4 py-3 ${recommendation.verdict === "Good buy" ? "bg-emerald-50 text-emerald-800" : recommendation.verdict === "Hold" ? "bg-amber-50 text-amber-800" : "bg-rose-50 text-rose-800"}`}><p className="text-xs font-bold uppercase tracking-[.15em] opacity-70">Verdict</p><p className="mt-0.5 text-lg font-bold">{recommendation.verdict}</p></div></div>
                  <div className="mt-6 grid grid-cols-2 gap-3 lg:grid-cols-4"><Metric label="Price" value={formatPrice(selectedPlayer.now_cost)} sub={`${selectedPlayer.cost_change_start >= 0 ? "+" : ""}£${(selectedPlayer.cost_change_start / 10).toFixed(1)}m this season`} icon={trend === "rising" ? <ArrowUpRight /> : trend === "falling" ? <ArrowDownRight /> : <ArrowRight />} tone={trend === "rising" ? "good" : trend === "falling" ? "bad" : "neutral"} /><Metric label="Last 5 form" value={summaryLoading ? "…" : recommendation.form.toFixed(1)} sub={exactLastFive.length ? `${exactLastFive.reduce((sum, row) => sum + row.total_points, 0)} points total` : "FPL rolling form"} icon={<BarChart3 />} /><Metric label="Ownership" value={`${Number(selectedPlayer.selected_by_percent).toFixed(1)}%`} sub="Rank exposure" icon={<Users />} /><Metric label="Next 5 FDR" value={avgFdr.toFixed(1)} sub={avgFdr < 2.6 ? "Friendly run" : avgFdr > 3.4 ? "Tough run" : "Mixed run"} icon={<CalendarDays />} tone={avgFdr < 2.6 ? "good" : avgFdr > 3.4 ? "bad" : "neutral"} /></div>
                  <div className="mt-6 grid gap-5 lg:grid-cols-[1fr_1.15fr]"><div className="rounded-2xl border bg-[#fafbfc] p-4"><div className="flex items-center justify-between"><h4 className="font-bold">Latest points</h4><span className="text-xs text-muted-foreground">GW score</span></div>{summaryLoading ? <div className="mt-5 flex h-24 items-center justify-center"><LoaderCircle className="size-5 animate-spin text-[#2156e8]" /></div> : exactLastFive.length ? <div className="mt-5 flex h-24 items-end gap-2">{exactLastFive.map((row) => { const max = Math.max(12, ...exactLastFive.map((item) => item.total_points)); return <div key={row.round} className="flex h-full flex-1 flex-col justify-end gap-1 text-center"><span className="text-xs font-bold">{row.total_points}</span><div className="mx-auto w-full max-w-10 rounded-t-lg bg-[#2156e8]" style={{ height: `${Math.max(8, (row.total_points / max) * 64)}px` }} /><span className="text-xs text-muted-foreground">GW{row.round}</span></div>; })}</div> : <p className="mt-5 text-sm text-muted-foreground">Detailed gameweek history is temporarily unavailable. The verdict is using official rolling form.</p>}</div><div className="rounded-2xl border bg-[#fafbfc] p-4"><div className="flex items-center justify-between"><h4 className="font-bold">Upcoming run</h4><span className="text-xs text-muted-foreground">Lower FDR is easier</span></div><div className="mt-4 grid grid-cols-5 gap-2">{selectedFixtures.slice(0, 5).map((fixture, index) => <div key={`${fixture.event.id}-${index}`} className="text-center"><div className={`fdr-${fixture.difficulty} grid min-h-16 place-items-center rounded-xl px-1`}><div><p className="text-sm font-bold">{fixture.opponent}</p><p className="text-xs font-bold opacity-70">GW{fixture.event.id} · {fixture.home ? "H" : "A"}</p></div></div></div>)}</div></div></div>
                </div>
              </div>
              <aside className="rounded-2xl bg-[#172338] p-5 text-white shadow-none sm:p-6"><div className="flex items-center gap-4 border-b border-white/10 pb-5"><div className="grid size-20 shrink-0 place-items-center rounded-full text-center" style={{ background: `conic-gradient(${scoreColor(recommendation.score)} ${recommendation.score * 3.6}deg, rgba(255,255,255,.12) 0)` }}><div className="grid size-16 place-items-center rounded-full bg-[#172338]"><div><p className="text-2xl font-bold leading-none">{recommendation.score}</p><p className="mt-1 text-xs font-bold uppercase tracking-wider text-white/70">score</p></div></div></div><div><p className="text-xs font-semibold uppercase tracking-[.16em] text-[#b9ceff]">Why this verdict</p><h3 className="mt-1 text-xl font-bold">Six visible inputs. No mystery.</h3></div></div><div className="mt-5 space-y-4">{recommendation.parts.map((part) => <div key={part.label}><div className="flex items-end justify-between gap-3"><div><p className="text-sm font-semibold">{part.label}</p><p className="mt-0.5 text-xs leading-5 text-white/70">{part.detail}</p></div><span className="text-sm font-bold text-[#b9ceff]">{Math.round(part.value)}/{part.max}</span></div><div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/10"><div className="h-full rounded-full bg-[#b9ceff]" style={{ width: `${Math.max(2, (part.value / part.max) * 100)}%` }} /></div></div>)}</div><div className="mt-6 rounded-2xl border border-white/10 bg-white/5 p-4 text-xs leading-5 text-white/65"><Info className="mr-1.5 inline size-4 text-[#b9ceff]" />Score bands: 70+ Good buy, 48–69 Hold, below 48 Consider selling. Availability below 50% caps the score at 45. Ownership measures rank risk, not player quality.</div></aside>
            </section>
          </TabsContent>

          <TabsContent value="intel">
            <IntelligenceHub data={data} squad={squad} onConnect={() => setTeamDialogOpen(true)} />
          </TabsContent>
        </Tabs>

        <footer className="mt-7 flex flex-col justify-between gap-3 border-t py-5 text-xs leading-5 text-muted-foreground sm:flex-row sm:items-center"><p>This app is unofficial and is not affiliated with the Premier League. Suggestions are decision support, not guarantees.</p><a href="https://fantasy.premierleague.com/" target="_blank" rel="noreferrer" className="flex items-center gap-1 font-bold text-[#2156e8] hover:underline">Open official FPL <ChevronRight className="size-3.5" /></a></footer>
      </main>
      </div>

      <Dialog open={teamDialogOpen} onOpenChange={setTeamDialogOpen}><DialogContent className="overflow-hidden rounded-2xl border-0 p-0 sm:max-w-md"><div className="bg-[#172338] px-6 py-6 text-white"><DialogHeader><DialogTitle className="text-xl font-bold">Connect your public FPL squad</DialogTitle><DialogDescription className="text-white/75">Each visitor can use their own team ID. It stays in this browser and is never used for sign-in.</DialogDescription></DialogHeader></div><div className="p-6"><label htmlFor="entry-id" className="text-sm font-semibold">FPL team ID</label><Input id="entry-id" inputMode="numeric" value={entryId} onChange={(event) => setEntryId(event.target.value.replace(/\D/g, ""))} onKeyDown={(event) => { if (event.key === "Enter") void connectSquad(); }} placeholder="e.g. 1234567" className="mt-2 h-11 rounded-xl" />{entryError && <p role="alert" className="mt-2 text-sm font-medium text-destructive"><CircleAlert className="mr-1 inline size-4" />{entryError}</p>}<div className="mt-4 rounded-2xl bg-[#f3f5f7] p-4 text-xs leading-5 text-muted-foreground">Find it in your FPL browser URL: <span className="font-mono font-bold text-foreground">/entry/1234567/event/...</span>. Only squads from a published gameweek can be read.</div><Button onClick={() => void connectSquad()} disabled={entryLoading} className="mt-5 h-11 w-full rounded-xl bg-[#2156e8] font-semibold text-white hover:bg-[#173fae]">{entryLoading ? <LoaderCircle className="animate-spin" /> : <Shield />} {entryLoading ? "Loading squad…" : "Connect squad"}</Button>{squad && <button onClick={() => { setSquad(null); setFilterMode("all"); setEntryId(""); try { window.localStorage.removeItem("fpl-entry-id"); } catch { /* Storage unavailable. */ } setTeamDialogOpen(false); }} className="mt-3 flex w-full items-center justify-center gap-1 text-sm font-bold text-muted-foreground hover:text-destructive"><X className="size-4" />Disconnect this squad</button>}</div></DialogContent></Dialog>
    </div>
  );
}

function Metric({ label, value, sub, icon, tone = "neutral" }: { label: string; value: string; sub: string; icon: React.ReactNode; tone?: "good" | "bad" | "neutral" }) {
  return <div className="rounded-2xl border bg-[#fafbfc] p-4"><div className={`flex items-center gap-2 text-xs font-semibold uppercase tracking-[.1em] ${tone === "good" ? "text-emerald-700" : tone === "bad" ? "text-rose-700" : "text-muted-foreground"}`}><span className="[&_svg]:size-4">{icon}</span>{label}</div><p className="mt-2 text-2xl font-bold tracking-tight">{value}</p><p className="mt-1 text-xs text-muted-foreground">{sub}</p></div>;
}

function SidebarButton({ active, onClick, icon, label, detail }: { active: boolean; onClick: () => void; icon: React.ReactNode; label: string; detail: string }) {
  return <button aria-current={active?"page":undefined} onClick={onClick} className={`flex w-full items-center gap-3 rounded-2xl px-3 py-3 text-left transition ${active ? "bg-[#b9ceff] text-[#111827] shadow-none" : "text-white/70 hover:bg-white/8 hover:text-white"}`}><span className={`grid size-9 place-items-center rounded-xl [&_svg]:size-4.5 ${active ? "bg-[#111827]/10" : "bg-white/8"}`}>{icon}</span><span><span className="block text-sm font-bold">{label}</span><span className={`mt-0.5 block text-xs ${active ? "text-[#111827]/60" : "text-white/70"}`}>{detail}</span></span></button>;
}
