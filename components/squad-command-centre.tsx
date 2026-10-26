"use client";

import { useMemo } from "react";
import {
  ArrowDownRight,
  ArrowUpRight,
  BadgeCheck,
  CalendarClock,
  Crown,
  Gauge,
  Info,
  RefreshCw,
  Target,
  Users,
  WandSparkles,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { adviseChips, analyseGameweek, recommendTransfers, type ChipAdvice, type PlayerProjection } from "@/lib/fpl-analysis";
import type { CorePayload, SquadPayload } from "@/lib/fpl-types";

type Props = {
  data: CorePayload;
  squad: SquadPayload | null;
  onConnect: () => void;
};

const POSITION_NAMES: Record<number, string> = { 1: "Goalkeeper", 2: "Defenders", 3: "Midfielders", 4: "Forwards" };
const CHIP_ICONS = { wildcard: RefreshCw, freehit: WandSparkles, bboost: Users, "3xc": Crown };

function formatRank(rank?: number) {
  if (!rank) return "—";
  return new Intl.NumberFormat("en-GB", { notation: rank > 999_999 ? "compact" : "standard", maximumFractionDigits: 1 }).format(rank);
}

function formatDeadline(value: string) {
  return new Intl.DateTimeFormat("en-GB", { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZoneName: "short" }).format(new Date(value));
}

function positionRows(players: PlayerProjection[]) {
  return [1, 2, 3, 4].map((position) => ({ position, players: players.filter((item) => item.player.element_type === position) })).filter((row) => row.players.length);
}

export function SquadCommandCentre({ data, squad, onConnect }: Props) {
  const upcomingEvents = useMemo(() => data.events.filter((event) => !event.finished).slice(0, 5), [data.events]);

  if (!squad) {
    return (
      <section className="squad-onboarding">
        <div className="onboarding-copy"><p className="fpl-eyebrow"><span/> YOUR GAMEWEEK. YOUR CALL.</p><h3>Fifteen players.<br/>One better plan.</h3><p>Bring your squad into focus. Find your starting XI, compare transfer options and choose a captain with the reasoning in front of you.</p><Button onClick={onConnect} className="connect-primary">Connect my FPL team <ArrowUpRight size={17}/></Button><span className="connect-reassurance">Just your public team ID. No password needed.</span><div className="onboarding-links"><span><Target size={15}/> Best XI & captain</span><span><RefreshCw size={15}/> Transfer priorities</span><span><CalendarClock size={15}/> Chip timing</span></div></div>
        <div className="tactics-board" aria-label="Illustration of a four four two formation"><div className="tactics-heading"><span>THE TACTICS BOARD</span><span>4—4—2</span></div><div className="pitch-lines" aria-hidden="true"><i className="pitch-circle"/><i className="pitch-box top"/><i className="pitch-box bottom"/></div><div className="formation-dots" aria-hidden="true">{[2,4,4,1].map((count,row)=><div key={row}>{Array.from({length:count},(_,i)=><span key={i} className={row===3?"keeper":""}><svg viewBox="0 0 32 32" fill="none"><path d="m11 5-7 5 4 7 3-2v13h10V15l3 2 4-7-7-5c-2 3-8 3-10 0Z" fill="currentColor"/></svg></span>)}</div>)}</div><div className="pitch-caption"><span><i/> Your team goes here</span><strong>Make it yours ↗</strong></div></div>
      </section>
    );
  }

  if (!upcomingEvents.length) {
    return <section className="rounded-3xl border bg-white p-10 text-center"><CalendarClock className="mx-auto size-10 text-muted-foreground" /><h3 className="mt-4 text-xl font-black">No upcoming gameweek is published</h3><p className="mt-2 text-sm text-muted-foreground">The analysis will resume when FPL publishes the next deadline.</p></section>;
  }

  const nextAnalysis = analyseGameweek(data, squad, upcomingEvents[0]);
  const futureAnalyses = upcomingEvents.map((event) => analyseGameweek(data, squad, event));
  const transfers = recommendTransfers(data, squad, nextAnalysis);
  const chips = adviseChips(squad, nextAnalysis, transfers);
  const activeChip = chips.filter((chip) => chip.verdict === "Use" || chip.verdict === "Consider").toSorted((a, b) => b.score - a.score)[0];
  const fiveWeekProjection = futureAnalyses.reduce((sum, analysis) => sum + analysis.projectedPoints, 0);
  const maxProjection = Math.max(...futureAnalyses.map((analysis) => analysis.projectedPoints), 1);

  return (
    <div className="space-y-5">
      <section className="relative overflow-hidden rounded-[2rem] bg-[#160019] p-5 text-white shadow-[0_24px_80px_rgba(30,0,34,.18)] sm:p-7">
        <div className="absolute -right-24 -top-32 size-80 rounded-full bg-[#00ff87]/15 blur-3xl" />
        <div className="relative flex flex-col justify-between gap-5 lg:flex-row lg:items-end">
          <div>
            <div className="flex flex-wrap items-center gap-2 text-xs font-bold text-white/55"><span className="rounded-full bg-white/10 px-2.5 py-1">Published squad · GW{squad.gameweek}</span><span>{squad.playerName || "FPL manager"}</span>{squad.overallRank ? <span>OR {formatRank(squad.overallRank)}</span> : null}{squad.overallPoints ? <span>{squad.overallPoints} total pts</span> : null}</div>
            <h3 className="mt-3 text-3xl font-black tracking-[-.04em] sm:text-4xl">{squad.entryName || `Team ${squad.entryId}`}</h3>
            <p className="mt-2 flex items-center gap-2 text-sm text-white/60"><CalendarClock className="size-4 text-[#75ffbd]" />GW{nextAnalysis.event.id} deadline: {formatDeadline(nextAnalysis.event.deadline_time)}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <span className="rounded-xl border border-white/10 bg-white/8 px-3 py-2 text-xs"><strong className="text-white">£{(squad.bank / 10).toFixed(1)}m</strong> in bank</span>
            <span className="rounded-xl border border-white/10 bg-white/8 px-3 py-2 text-xs"><strong className="text-white">£{(squad.squadValue / 10).toFixed(1)}m</strong> squad value</span>
            <Button onClick={onConnect} variant="outline" className="border-white/15 bg-white/8 text-white hover:bg-white/15 hover:text-white">Change team</Button>
          </div>
        </div>

        <div className="relative mt-7 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <SummaryCard icon={<Gauge />} label="Projected GW score" value={`${nextAnalysis.projectedPoints}`} detail={`${nextAnalysis.range[0]}–${nextAnalysis.range[1]} likely range`} accent />
          <SummaryCard icon={<Crown />} label="Captain pick" value={nextAnalysis.captain.player.web_name} detail={`${nextAnalysis.captain.points.toFixed(1)} pts · ${nextAnalysis.captain.opponent}`} />
          <SummaryCard icon={<ArrowUpRight />} label="Transfer outlook" value={transfers[0]?.urgency === "Priority" ? "Action needed" : "Mostly stable"} detail={transfers.length ? `${transfers.length} players to review` : "No urgent sales found"} />
          <SummaryCard icon={<WandSparkles />} label="Best chip call" value={activeChip ? `${activeChip.verdict}: ${activeChip.name}` : "Hold all chips"} detail={activeChip ? `${activeChip.score}/100 timing score` : "Stronger weeks should come"} />
        </div>
      </section>

      <section className="grid gap-5 xl:grid-cols-[minmax(0,1.35fr)_minmax(330px,.65fr)]">
        <div className="overflow-hidden rounded-[2rem] border bg-white shadow-[0_16px_55px_rgba(31,0,35,.07)]">
          <div className="flex flex-col justify-between gap-3 border-b p-5 sm:flex-row sm:items-center sm:p-6">
            <div><p className="text-xs font-black uppercase tracking-[.15em] text-[#007a40]">Optimised formation</p><h4 className="mt-1 text-2xl font-black tracking-tight">Best XI for GW{nextAnalysis.event.id}</h4></div>
            <div className="flex gap-2 text-xs"><span className="rounded-full bg-[#e8fff3] px-3 py-1.5 font-bold text-[#007a40]">C = captain</span><span className="rounded-full bg-[#f1edf2] px-3 py-1.5 font-bold text-[#37003c]">VC = vice</span></div>
          </div>
          <div className="p-3 sm:p-5">
            <div className="relative overflow-hidden rounded-[1.5rem] border-4 border-white/35 bg-[linear-gradient(180deg,#149b58,#08773f)] px-2 py-6 shadow-inner sm:px-5">
              <div className="pointer-events-none absolute inset-4 rounded-xl border border-white/30" />
              <div className="pointer-events-none absolute inset-x-4 top-1/2 border-t border-white/25" />
              <div className="pointer-events-none absolute left-1/2 top-1/2 size-24 -translate-x-1/2 -translate-y-1/2 rounded-full border border-white/25" />
              <div className="relative space-y-5 sm:space-y-6">
                {positionRows(nextAnalysis.lineup).map((row) => (
                  <div key={row.position}>
                    <p className="mb-2 text-center text-[10px] font-black uppercase tracking-[.16em] text-white/50">{POSITION_NAMES[row.position]}</p>
                    <div className="flex justify-center gap-1.5 sm:gap-3">{row.players.map((player) => <PitchPlayer key={player.player.id} projection={player} captain={player.player.id === nextAnalysis.captain.player.id} vice={player.player.id === nextAnalysis.viceCaptain.player.id} />)}</div>
                  </div>
                ))}
              </div>
            </div>
            <div className="mt-3 rounded-2xl bg-[#f4f6f8] p-3"><div className="mb-2 flex items-center justify-between"><p className="text-xs font-black uppercase tracking-[.12em] text-muted-foreground">Bench order</p><p className="text-xs font-bold text-[#37003c]">{nextAnalysis.bench.reduce((sum, item) => sum + item.points, 0).toFixed(1)} projected</p></div><div className="grid grid-cols-2 gap-2 sm:grid-cols-4">{nextAnalysis.bench.map((player, index) => <div key={player.player.id} className="rounded-xl border bg-white p-2 text-center"><p className="truncate text-xs font-black">{index + 1}. {player.player.web_name}</p><p className="mt-0.5 text-[11px] text-muted-foreground">{player.opponent} · {player.points.toFixed(1)}</p></div>)}</div></div>
          </div>
        </div>

        <aside className="space-y-5">
          <div className="rounded-[2rem] border bg-white p-5 shadow-[0_16px_55px_rgba(31,0,35,.07)] sm:p-6">
            <div className="flex items-start justify-between"><div><p className="text-xs font-black uppercase tracking-[.15em] text-[#007a40]">Projection curve</p><h4 className="mt-1 text-xl font-black">Next five GWs</h4></div><div className="rounded-xl bg-[#37003c] px-3 py-2 text-right text-white"><p className="text-xl font-black leading-none">{fiveWeekProjection}</p><p className="mt-1 text-[10px] uppercase tracking-wider text-white/55">total est.</p></div></div>
            <div className="mt-6 flex h-40 items-end gap-2">{futureAnalyses.map((analysis) => <div key={analysis.event.id} className="flex h-full flex-1 flex-col justify-end gap-2 text-center"><span className="text-xs font-black">{analysis.projectedPoints}</span><div className="min-h-4 rounded-t-xl bg-[linear-gradient(180deg,#00d973,#37003c)]" style={{ height: `${Math.max(12, analysis.projectedPoints / maxProjection * 112)}px` }} /><span className="text-[11px] font-bold text-muted-foreground">GW{analysis.event.id}</span></div>)}</div>
            <p className="mt-4 text-xs leading-5 text-muted-foreground"><Info className="mr-1 inline size-3.5" />Each bar re-optimises the XI and captain for that gameweek. It does not assume future transfers.</p>
          </div>

          <div className="rounded-[2rem] bg-[#eafff4] p-5 sm:p-6"><div className="flex items-center gap-3"><div className="grid size-10 place-items-center rounded-xl bg-[#00a956] text-white"><BadgeCheck /></div><div><p className="text-xs font-black uppercase tracking-[.12em] text-[#007a40]">Model confidence</p><p className="text-lg font-black text-[#103b29]">Medium · early season</p></div></div><p className="mt-3 text-sm leading-6 text-[#2e6550]">Only {data.events.filter((event) => event.finished).length} gameweeks are complete, so FPL’s expected points carry the most weight. Confidence improves as more form and minutes data arrives.</p></div>
        </aside>
      </section>

      <section className="rounded-[2rem] border bg-white p-5 shadow-[0_16px_55px_rgba(31,0,35,.06)] sm:p-6">
        <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-end"><div><p className="text-xs font-black uppercase tracking-[.15em] text-[#c42d45]">Transfer priorities</p><h4 className="mt-1 text-2xl font-black">Who to sell — and the upgrade</h4><p className="mt-1 text-sm text-muted-foreground">Each replacement is affordable using that player’s price plus your current bank. Treat these as separate options.</p></div><span className="w-fit rounded-full bg-[#f4f6f8] px-3 py-1.5 text-xs font-bold text-muted-foreground">No hit cost included</span></div>
        {transfers.length ? <div className="mt-5 grid gap-4 lg:grid-cols-3">{transfers.map((transfer) => <div key={transfer.outgoing.player.id} className="overflow-hidden rounded-2xl border"><div className={`flex items-center justify-between px-4 py-2 text-xs font-black uppercase tracking-[.12em] ${transfer.urgency === "Priority" ? "bg-rose-50 text-rose-700" : transfer.urgency === "Watch" ? "bg-amber-50 text-amber-700" : "bg-slate-50 text-slate-600"}`}><span>{transfer.urgency}</span><span>{transfer.gain > 0 ? `+${transfer.gain.toFixed(1)} projected` : "Monitor"}</span></div><div className="p-4"><TransferPlayer label="Sell" projection={transfer.outgoing} negative />{transfer.replacement ? <><div className="my-3 flex items-center gap-2 text-xs font-bold text-muted-foreground"><span className="h-px flex-1 bg-border" /><ArrowDownRight className="size-4" />replace with<span className="h-px flex-1 bg-border" /></div><TransferPlayer label="Buy" projection={transfer.replacement} /></> : null}<ul className="mt-4 space-y-1.5 text-xs leading-5 text-muted-foreground">{transfer.reasons.map((reason) => <li key={reason} className="flex gap-2"><span className="mt-2 size-1 shrink-0 rounded-full bg-[#37003c]" />{reason}</li>)}</ul></div></div>)}</div> : <div className="mt-5 rounded-2xl bg-emerald-50 p-6 text-center"><BadgeCheck className="mx-auto size-8 text-emerald-600" /><p className="mt-3 font-black text-emerald-900">No urgent sale found</p><p className="mt-1 text-sm text-emerald-700">Your current squad grades well enough to roll the transfer.</p></div>}
      </section>

      <section className="rounded-[2rem] border bg-white p-5 shadow-[0_16px_55px_rgba(31,0,35,.06)] sm:p-6">
        <div><p className="text-xs font-black uppercase tracking-[.15em] text-[#6c2db5]">Chip planner</p><h4 className="mt-1 text-2xl font-black">Use it now or save it?</h4><p className="mt-1 text-sm text-muted-foreground">The strongest chip can still be a hold. Only one chip can be active in a gameweek.</p></div>
        <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">{chips.map((chip) => <ChipCard key={chip.key} chip={chip} />)}</div>
      </section>

      <section className="rounded-[2rem] bg-[#160019] p-5 text-white sm:p-6"><div className="grid gap-5 lg:grid-cols-[.7fr_1.3fr] lg:items-center"><div><p className="text-xs font-black uppercase tracking-[.15em] text-[#75ffbd]">How the estimate works</p><h4 className="mt-2 text-2xl font-black">A forecast, not a promise.</h4></div><div className="grid gap-3 sm:grid-cols-3"><LogicItem value="55%" label="Official FPL expected points" /><LogicItem value="30%" label="Current form" /><LogicItem value="15%" label="Season points rate" /></div></div><p className="mt-5 border-t border-white/10 pt-4 text-xs leading-5 text-white/55">The model then adjusts for FDR, home advantage, double/blank gameweeks, availability and minutes reliability. Captain points are doubled. The range is deliberately wide because clean sheets, goals, cards and bonus points are volatile.</p></section>
    </div>
  );
}

function SummaryCard({ icon, label, value, detail, accent = false }: { icon: React.ReactNode; label: string; value: string; detail: string; accent?: boolean }) {
  return <div className={`rounded-2xl border p-4 ${accent ? "border-[#00ff87]/35 bg-[#00ff87]/12" : "border-white/10 bg-white/7"}`}><div className={`flex items-center gap-2 text-xs font-bold ${accent ? "text-[#75ffbd]" : "text-white/50"}`}><span className="[&_svg]:size-4">{icon}</span>{label}</div><p className="mt-3 truncate text-xl font-black">{value}</p><p className="mt-1 text-xs text-white/50">{detail}</p></div>;
}

function PitchPlayer({ projection, captain, vice }: { projection: PlayerProjection; captain: boolean; vice: boolean }) {
  const initials = projection.player.web_name.slice(0, 2).toUpperCase();
  return <div className="w-[18%] min-w-0 max-w-24 text-center text-white"><div className="relative mx-auto grid size-9 place-items-center rounded-xl border border-white/30 bg-[#1c0020] text-[10px] font-black shadow-lg sm:size-12 sm:text-xs">{initials}{captain ? <span className="absolute -right-1.5 -top-1.5 grid size-5 place-items-center rounded-full bg-[#00ff87] text-[9px] font-black text-[#160019]">C</span> : vice ? <span className="absolute -right-1.5 -top-1.5 grid size-5 place-items-center rounded-full bg-white text-[8px] font-black text-[#37003c]">VC</span> : null}</div><div className="mt-1.5 rounded-md bg-[#160019]/90 px-1 py-1 shadow"><p className="truncate text-[9px] font-black sm:text-[11px]">{projection.player.web_name}</p><p className="text-[8px] text-[#75ffbd] sm:text-[10px]">{projection.points.toFixed(1)} · {projection.opponent}</p></div></div>;
}

function TransferPlayer({ label, projection, negative = false }: { label: string; projection: PlayerProjection; negative?: boolean }) {
  const TrendIcon = negative ? ArrowDownRight : ArrowUpRight;
  return <div className="flex items-center gap-3"><div className={`grid size-11 shrink-0 place-items-center rounded-xl text-xs font-black ${negative ? "bg-rose-100 text-rose-700" : "bg-emerald-100 text-emerald-700"}`}>{projection.player.web_name.slice(0, 2).toUpperCase()}</div><div className="min-w-0 flex-1"><p className={`text-[10px] font-black uppercase tracking-[.12em] ${negative ? "text-rose-600" : "text-emerald-600"}`}>{label}</p><p className="truncate font-black">{projection.player.web_name}</p><p className="text-xs text-muted-foreground">£{(projection.player.now_cost / 10).toFixed(1)}m · {projection.opponent}</p></div><div className="text-right"><TrendIcon className={`ml-auto size-4 ${negative ? "text-rose-500" : "text-emerald-500"}`} /><p className="mt-1 text-sm font-black">{projection.points.toFixed(1)}</p></div></div>;
}

function ChipCard({ chip }: { chip: ChipAdvice }) {
  const Icon = CHIP_ICONS[chip.key];
  const tone = chip.verdict === "Use" ? "border-emerald-300 bg-emerald-50" : chip.verdict === "Consider" ? "border-amber-300 bg-amber-50" : chip.verdict === "Used" ? "border-slate-200 bg-slate-50 opacity-75" : "border-border bg-white";
  return <div className={`rounded-2xl border p-4 ${tone}`}><div className="flex items-start justify-between gap-3"><div className="grid size-10 place-items-center rounded-xl bg-[#37003c] text-white"><Icon className="size-5" /></div><span className={`rounded-full px-2.5 py-1 text-[10px] font-black uppercase tracking-wider ${chip.verdict === "Use" ? "bg-emerald-600 text-white" : chip.verdict === "Consider" ? "bg-amber-500 text-white" : "bg-slate-200 text-slate-600"}`}>{chip.verdict}</span></div><div className="mt-4 flex items-end justify-between"><h5 className="font-black">{chip.name}</h5><span className="text-xs font-black text-muted-foreground">{chip.score}/100</span></div><div className="mt-2 h-1.5 overflow-hidden rounded-full bg-black/8"><div className="h-full rounded-full bg-[#37003c]" style={{ width: `${Math.max(2, chip.score)}%` }} /></div><p className="mt-3 text-xs leading-5 text-muted-foreground">{chip.why}</p></div>;
}

function LogicItem({ value, label }: { value: string; label: string }) {
  return <div className="rounded-xl border border-white/10 bg-white/7 p-4"><p className="text-2xl font-black text-[#75ffbd]">{value}</p><p className="mt-1 text-xs leading-5 text-white/55">{label}</p></div>;
}
