'use client';
import { useEffect, useRef, useState } from 'react';
import { ArrowLeft, ArrowRight, Check, LoaderCircle, Radio, Users } from 'lucide-react';
import type { Game } from '@/lib/competition';
import { Emblem } from './competition';

type Action = (action:string, data?:Record<string,any>)=>Promise<void>;
export function BuzzModeControl({ game, busy, action }: { game:Game; busy:boolean; action:Action }) {
  const multiple=game.multipleBuzzes!==0;
  return <fieldset className="buzz-mode-control" disabled={busy || !!game.roundLocked || !!game.armed}><legend>Buzz-in mode</legend><div>{[{value:true,title:'Multiple responses',detail:'Record everyone in server order.'},{value:false,title:'First response only',detail:'Close automatically after the first buzz.'}].map(option=><label className={multiple===option.value ? 'chosen' : ''} key={String(option.value)}><input type="radio" name="buzz-mode" checked={multiple===option.value} onChange={()=>void action('buzz_mode',{multiple:option.value})}/><span><strong>{option.title}</strong><small>{option.detail}</small></span></label>)}</div>{!!game.roundLocked && <small>Locked for this entire round. Start a new round to change it.</small>}</fieldset>;
}
export default function HostSetup({game,code,busy,online,copied,copy,action,saveRoster,complete}: {game:Game|null;code:string;busy:boolean;online:boolean;copied:string;copy:(justCode?:boolean)=>Promise<void>;action:Action;saveRoster:(rosters:{team:string;names:string[]}[])=>Promise<boolean>;complete:()=>void}) {
  const [step,setStep]=useState(1),[names,setNames]=useState<Record<string,string[]>>({});
  const rosterCode=useRef(''), dirty=useRef(new Set<string>());
  useEffect(()=>{
    if(!game) return;
    if(rosterCode.current!==game.code){rosterCode.current=game.code;dirty.current.clear();}
    setNames(current=>{
      const next=Object.fromEntries(game.teams.map(team=>[team.id,[1,2,3,4].map(seat=>dirty.current.has(team.id+':'+seat) ? current[team.id]?.[seat-1] || '' : game.players.find(player=>player.team===team.id&&player.seat===seat)?.name || '')]));
      return JSON.stringify(current)===JSON.stringify(next) ? current : next;
    });
  },[game]);
  useEffect(()=>{window.scrollTo(0,0);},[step]);
  const included=game?.teams.filter(team=>team.enabled) || [];
  const steps=['Choose classes','Share code','Ready to host'];
  async function next(){
    setStep(current=>Math.min(3,current+1));
  }
  return <main className="host-setup"><header className="setup-heading"><div><span className="eyebrow">HOST SETUP</span><h1>Set the stage.</h1><p>Prepare your competition, one step at a time.</p></div><div className="setup-code"><span>SESSION CODE</span><button onClick={()=>copy(true)} title="Tap to copy session code" aria-label={`Copy session code ${code}`}>{code}</button><small role="status">{copied==='code' ? 'Copied' : 'Tap to copy'}</small></div></header>
    <ol className="setup-steps" aria-label="Session setup progress">{steps.map((label,index)=><li className={step===index+1 ? 'current' : step>index+1 ? 'done' : ''} key={label}><button disabled={busy || index+1>step} aria-current={step===index+1 ? 'step' : undefined} onClick={()=>setStep(index+1)}><b>{step>index+1 ? <Check size={15}/> : index+1}</b><span>{label}</span></button></li>)}</ol>
    <section className="panel setup-panel">{step===2 ? <div className="setup-share"><h2>Ask students to open Contestant login and enter this code.</h2><button className="stage-room-code" onClick={()=>copy(true)} title="Tap to copy session code" aria-label="Copy session code">{code}</button><span className="copy-feedback" role="status">{copied==='code' ? 'Session code copied' : 'Tap the code to copy'}</span><button className="text-button" onClick={()=>copy(false)}>{copied==='link' ? 'Invite link copied' : 'Copy contestant invite link'}</button><LiveArrivals game={game}/><div className="setup-tip"><Users size={19}/><span>Students can join while you finish setup. Each class has four places.</span></div></div> : !game ? <div className="empty-message"><LoaderCircle className="spin" size={24}/>Loading session…</div> : step===1 ? <><h2>Include or omit each class.</h2><p className="setup-description">You can change participation later.</p><div className="setup-class-grid">{game.teams.map(team=><button key={team.id} className={team.enabled ? 'included' : ''} aria-pressed={!!team.enabled} disabled={busy || !online} onClick={()=>void action('team',{team:team.id,enabled:!team.enabled})}><Emblem logo={team.logo} name={team.name}/><span className="setup-class-copy"><strong>{team.name}</strong><small>{team.enabled ? 'Included · 4 students' : 'Omitted'}</small></span><i>{!!team.enabled && <Check size={14}/>}</i></button>)}</div>{!included.length && <p className="setup-validation">Include at least one class to continue.</p>}</> : <div className="setup-ready"><span className="setup-ready-icon"><Check size={30}/></span><h2>Everything is in place.</h2><p>Your next stop is the live session. Open the buzzers when the question is ready.</p><div className="setup-summary"><div><span>Classes included</span><strong>{included.length} / 6</strong></div><div><span>Students signed in</span><strong>{game.players.filter(p=>p.joined).length}</strong></div><div><span>Buzz-in mode</span><strong>{game.multipleBuzzes!==0 ? 'Multiple responses' : 'First response only'}</strong></div></div><p className="setup-footnote">The first response turns green. Later responses turn grey. Server arrival determines the order.</p></div>}</section>
    <footer className="setup-footer"><button className="button secondary" disabled={step===1 || busy} onClick={()=>setStep(current=>Math.max(1,current-1))}><ArrowLeft size={16}/>Back</button><span>Step {step} of 3</span>{step===3 ? <button className="button primary" disabled={!game || busy || !online} onClick={complete}>Enter session<ArrowRight size={17}/></button> : <button className="button primary" disabled={busy || !online || (!game || !included.length)} onClick={()=>void next()}>{busy ? <LoaderCircle className="spin" size={17}/> : null}Continue<ArrowRight size={17}/></button>}</footer>
  </main>;
}

export function LiveArrivals({game}:{game:Game|null}){return <section className="live-arrivals"><header><h3>Contestants joining</h3><span role="status">{game?game.players.filter(p=>p.joined).length:0} signed in</span></header><div>{game?.teams.map(team=>{const joined=game.players.filter(p=>p.team===team.id&&p.joined);return <article key={team.id} className={`${joined.length?'has-arrived':''} ${team.enabled?'':'arrival-omitted'}`}><div><Emblem name={team.name} size="tiny"/><strong>{team.name}</strong><span>{team.enabled?joined.length+'/4':'Omitted'}</span></div><ul>{joined.map(p=><li key={p.id}><Check size={12}/>{p.name||'Student '+p.seat}</li>)}</ul>{!joined.length&&<small>{team.enabled?'Waiting for contestants':'Not participating'}</small>}</article>;})}</div></section>;}
