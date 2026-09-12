"use client";
import { useMemo, useState } from "react";
import { ArrowRight, Bookmark, Check, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { analyseGameweek } from "@/lib/fpl-analysis";
import { buildDraft, evaluatePlan, planningEvents, rankTransferOptions, withPlayers, type Move, type Strategy } from "@/lib/transfer-planner";
import type { CorePayload, SquadPayload } from "@/lib/fpl-types";

export function TransferWorkspace({data,squad,onConnect}:{data:CorePayload;squad:SquadPayload|null;onConnect:()=>void}) {
  if(!squad) return <section className="work-panel connect-panel"><p className="eyebrow">Your next move</p><h3>Plan with your actual squad.</h3><p>Connect your public team ID to compare transfers and build a six-week plan.</p><Button onClick={onConnect}>Connect squad <ArrowRight /></Button></section>;
  return <Workspace key={squad.entryId} data={data} squad={squad}/>;
}
function Workspace({data,squad}:{data:CorePayload;squad:SquadPayload}) {
  const events=useMemo(()=>planningEvents(data),[data]);
  const [horizon,setHorizon]=useState(5);
  const [free,setFree]=useState(1);
  const [bank,setBank]=useState(squad.bank);
  const [strategy,setStrategy]=useState<Strategy>("balanced");
  const [moves,setMoves]=useState<Move[]>([]);
  const [eventId,setEventId]=useState(events[0]?.id??0);
  const [outId,setOutId]=useState("");
  const [inId,setInId]=useState("");
  const [sell,setSell]=useState("");
  const [message,setMessage]=useState("");
  const [budget,setBudget]=useState(1000);
  const [chip,setChip]=useState("wildcard");
  const [draft,setDraft]=useState<ReturnType<typeof buildDraft>|null>(null);
  const selectedEvents=useMemo(()=>events.slice(0,horizon),[events,horizon]);
  const options=useMemo(()=>rankTransferOptions(data,squad,selectedEvents,free,strategy,bank),[data,squad,selectedEvents,free,strategy,bank]);
  const result=useMemo(()=>evaluatePlan(data,squad,events,moves,free,bank),[data,squad,events,moves,free,bank]);
  const priorEvents=events.filter(e=>e.id<=eventId);
  const prior=evaluatePlan(data,squad,priorEvents,moves.filter(m=>m.event<=eventId),free,bank);
  const players=prior.rows.at(-1)?.players??data.players.filter(p=>squad.playerIds.includes(p.id));
  const outgoing=players.find(p=>p.id===Number(outId))??players[0];
  const candidates=data.players.filter(p=>p.element_type===outgoing?.element_type&&!players.some(q=>q.id===p.id)).toSorted((a,b)=>Number(b.form)-Number(a.form));
  const incoming=candidates.find(p=>p.id===Number(inId))??candidates[0];
  const sellPrice=sell===""?outgoing?.now_cost??0:Math.round(Number(sell)*10);
  const addMove=(move:Move)=>{
    const next=[...moves,move];
    const checked=evaluatePlan(data,squad,events,next,free,bank);
    if(checked.error){setMessage(checked.error);return;}
    setMoves(next);setMessage("Transfer added to your plan. Nothing has changed in official FPL.");setSell("");setOutId("");setInId("");
  };
  const save=()=>{try{localStorage.setItem(`fpl-plan-${squad.entryId}`,JSON.stringify({moves,free,bank,strategy,firstEvent:events[0]?.id}));setMessage("Plan saved on this device.");}catch{setMessage("Your browser could not save the plan.");}};
  const restore=()=>{try{const raw=localStorage.getItem(`fpl-plan-${squad.entryId}`);if(!raw){setMessage("No saved plan for this team on this device.");return;}const p=JSON.parse(raw);if(p.firstEvent!==events[0]?.id)throw Error("The deadline has changed. Rebuild the saved plan using your refreshed squad.");if(!Array.isArray(p.moves)||!Number.isInteger(p.free)||p.free<0||p.free>5||!Number.isInteger(p.bank)||p.bank<0||!["safe","balanced","aggressive"].includes(p.strategy))throw Error("Saved plan is invalid.");const check=evaluatePlan(data,squad,events,p.moves,p.free,p.bank);if(check.error)throw Error(check.error);setMoves(p.moves);setFree(p.free);setBank(p.bank);setStrategy(p.strategy);setMessage("Saved plan restored. Recheck selling prices before making transfers.");}catch(e){setMessage(e instanceof Error?e.message:"Could not restore plan.");}};
  if(!events.length)return <section className="work-panel">No future deadline is published. Planning resumes when fixtures are available.</section>;
  const totalGain=result.rows.reduce((s,r)=>s+r.points-r.baseline,0);
  const draftEvents=chip==="freehit"?events.slice(0,1):selectedEvents;
  const draftAnalysis=draft?.players.length?draftEvents.map(e=>analyseGameweek(data,withPlayers(squad,draft.players,0),e)):[];
  return <div className="workspace-stack">
    <section className="work-panel"><div className="section-heading"><div><p className="eyebrow">Set your constraints</p><h3>Transfer workspace</h3></div><span className="data-tag">GW{events[0].id}–{events.at(-1)?.id}</span></div>
      <div className="control-grid"><label>Free transfers<Input type="number" min={0} max={5} value={free} onChange={e=>setFree(Math.min(5,Math.max(0,Math.floor(Number(e.target.value)))))} /></label><label>Money in bank (£m)<Input type="number" min={0} step="0.1" value={bank/10} onChange={e=>setBank(Math.max(0,Math.round(Number(e.target.value)*10)))} /></label><label>Forecast horizon<select value={horizon} onChange={e=>setHorizon(Number(e.target.value))}>{[1,3,5,6].map(n=><option key={n} value={n}>{n} gameweek{n>1?"s":""}</option>)}</select></label><label>Strategy<select value={strategy} onChange={e=>setStrategy(e.target.value as Strategy)}><option value="safe">Safe · minutes first</option><option value="balanced">Balanced · points first</option><option value="aggressive">Aggressive · low ownership</option></select></label></div>
      <p className="helper-text">Confirm free transfers and bank in official FPL. Comparisons initially use current market prices; enter your actual selling price in the planner. Strategy changes ranking preference, not expected points.</p>
    </section>
    <section className="work-panel"><div className="section-heading"><div><p className="eyebrow">Roll or move?</p><h3>Compare the return</h3></div><span className="data-tag">Hits included</span></div><div className="table-scroll"><table className="data-table"><thead><tr><th>Independent option</th><th>Hit</th><th>Next GW gain</th><th>{selectedEvents.length}-GW gain</th><th>Minutes signal</th><th>Action</th></tr></thead><tbody><tr><td><strong>Roll transfer</strong><small>Keep your current squad</small></td><td>0</td><td>0</td><td>0</td><td>—</td><td>Baseline</td></tr>{options.map(o=><tr key={`${o.out.id}-${o.incoming.id}`}><td><strong>{o.out.web_name} → {o.incoming.web_name}</strong><small>£{(o.incoming.now_cost/10).toFixed(1)}m · {o.projection.opponent}</small></td><td>{o.hit?`−${o.hit}`:0}</td><td>{o.nextGain>0?"+":""}{o.nextGain}</td><td className="positive">+{o.gain}</td><td>{Math.round(o.projection.minutesReliability*100)}%<small>Reliability, not start probability</small></td><td><Button size="sm" variant="outline" onClick={()=>{setEventId(events[0].id);setOutId(String(o.out.id));setInId(String(o.incoming.id));setSell("");setMessage("Move selected below. Confirm the selling price, then add it.");}}>Review</Button></td></tr>)}</tbody></table></div>{!options.length&&<p className="helper-text">No positive net-gain option was found among the screened candidates. Rolling is the baseline.</p>}</section>
    <section className="work-panel"><div className="section-heading"><div><p className="eyebrow">Six-week planner</p><h3>Your transfer sequence</h3></div><div className="button-row"><Button variant="outline" onClick={restore}>Load saved</Button><Button onClick={save}><Bookmark/>Save plan</Button></div></div>
      <div className="control-grid"><label>Gameweek<select value={eventId} onChange={e=>{setEventId(Number(e.target.value));setOutId("");setInId("");setSell("");}}>{events.map(e=><option key={e.id} value={e.id}>GW{e.id}</option>)}</select></label><label>Sell<select value={outgoing?.id??""} onChange={e=>{setOutId(e.target.value);setInId("");setSell("");}}>{players.map(p=><option key={p.id} value={p.id}>{p.web_name}</option>)}</select></label><label>Actual selling price (£m)<Input type="number" min={0} step="0.1" value={sell===""?(outgoing?.now_cost??0)/10:sell} onChange={e=>setSell(e.target.value)} /></label><label>Buy<select value={incoming?.id??""} onChange={e=>setInId(e.target.value)}>{candidates.map(p=><option key={p.id} value={p.id}>{p.web_name} · £{(p.now_cost/10).toFixed(1)}m</option>)}</select></label></div>
      <Button className="mt-4" disabled={!outgoing||!incoming} onClick={()=>outgoing&&incoming&&addMove({event:eventId,out:outgoing.id,in:incoming.id,sellPrice})}>Add transfer <ArrowRight/></Button>
      {message&&<p role="status" className="notice">{message}</p>}{result.error&&<p role="alert" className="notice error-notice">{result.error}</p>}
      <div className="plan-weeks">{events.map(e=>{const row=result.rows.find(r=>r.event===e.id);return <article className="plan-week" key={e.id}><h4>GW{e.id}</h4>{moves.filter(m=>m.event===e.id).map((m)=><div className="planned-move" key={`${m.event}-${m.out}-${m.in}`}><span>{data.players.find(p=>p.id===m.out)?.web_name}<ArrowRight size={14}/><strong>{data.players.find(p=>p.id===m.in)?.web_name}</strong></span><button aria-label="Remove transfer" onClick={()=>setMoves(moves.filter(x=>x!==m))}><Trash2 size={16}/></button></div>)}{!moves.some(m=>m.event===e.id)&&<p className="helper-text">Roll transfer</p>}<p className="plan-points">{row?.points??"—"}<span>net xP</span></p><small>Hit {row?.hit??"—"} · Bank £{row?(row.bank/10).toFixed(1):"—"}m</small><small>{row?.free??"—"} FT for next GW</small></article>;})}</div>
      <div className="plan-summary"><strong>{totalGain>0?"+":""}{totalGain} projected points vs rolling</strong><span>{result.rows.reduce((s,r)=>s+r.hit,0)} points spent on hits</span></div><p className="helper-text">Plans stay on this device. Future prices are held constant, free transfers roll up to five, and each week re-optimises the XI and captain. Chip drafts are separate and are not applied to this sequence.</p>
    </section>
    <section className="work-panel"><div className="section-heading"><div><p className="eyebrow">Build from scratch</p><h3>Wildcard & Free Hit drafts</h3></div><span className="data-tag">15 players · 3 per club</span></div><div className="control-grid"><label>Chip<select value={chip} onChange={e=>{setChip(e.target.value);setDraft(null);}}><option value="wildcard">Wildcard · longer-term</option><option value="freehit">Free Hit · next GW only</option></select></label><label>Available squad budget (£m)<Input type="number" min={0} step="0.1" value={budget/10} onChange={e=>{setBudget(Math.max(0,Math.round(Number(e.target.value)*10)));setDraft(null);}} /></label><div className="self-end"><Button onClick={()=>setDraft(buildDraft(data,draftEvents,budget,strategy))}>Generate draft <ArrowRight/></Button></div></div><p className="helper-text">Enter your actual selling-value budget. Drafts use the selected strategy and a budget-constrained heuristic, not a proven optimal solution. Check chip availability in official FPL.</p>{draft?.error&&<p role="alert" className="notice error-notice">{draft.error}</p>}{draft&&draft.players.length>0&&<><div className="plan-summary"><strong><Check className="inline size-4"/> Legal squad · £{(draft.players.reduce((s,p)=>s+p.now_cost,0)/10).toFixed(1)}m</strong><span>{draftAnalysis.reduce((s,a)=>s+a.projectedPoints,0)} xP across {draftEvents.length} GW</span></div><div className="draft-grid">{[1,2,3,4].map(pos=><div key={pos}><h4>{data.positions[String(pos)]}</h4>{draft.players.filter(p=>p.element_type===pos).map(p=><div className="draft-player" key={p.id}><span>{p.web_name}<small>{data.teams.find(t=>t.id===p.team)?.short_name}</small></span><strong>£{(p.now_cost/10).toFixed(1)}m</strong></div>)}</div>)}</div><p className="helper-text">Best formation: {draftAnalysis[0]?.lineup.filter(p=>p.player.element_type===2).length}–{draftAnalysis[0]?.lineup.filter(p=>p.player.element_type===3).length}–{draftAnalysis[0]?.lineup.filter(p=>p.player.element_type===4).length}. Captain: {draftAnalysis[0]?.captain?.player.web_name}. Original squad: {draftEvents.reduce((s,e)=>s+analyseGameweek(data,squad,e).projectedPoints,0)} xP over the same period.</p></>}</section>
  </div>;
}
