'use client';
import { useEffect, useState } from 'react';
import { ArrowLeft, Maximize, Radio, Trophy } from 'lucide-react';
import { Emblem } from './competition';
import { validSessionCode } from '@/lib/competition';
import { BuzzOrder, Leaderboard, QuestionTimer } from './live-session';
import SessionCode from './session-code';
import type { Game } from '@/lib/competition';

export default function AudienceDisplay() {
  const [code, setCode] = useState(''), [input, setInput] = useState(''), [game, setGame] = useState<Game | null>(null);
  const [error, setError] = useState(''), [connected, setConnected] = useState(false);
  useEffect(() => { const room = (new URLSearchParams(location.search).get('session') || new URLSearchParams(location.search).get('room'))?.toUpperCase() || ''; if (validSessionCode(room)) { setInput(room); setCode(room); } }, []);
  useEffect(() => {
    if (!code) return;
    let live = true, timer: ReturnType<typeof setTimeout>;
    const controller = new AbortController();
    async function poll() {
      try {
        const response = await fetch('/api/game', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({action:'state',code}), signal:AbortSignal.any([controller.signal, AbortSignal.timeout(12000)]) });
        const data = await response.json() as Game & { error?: string };
        if (!response.ok) throw new Error(data.error || 'Could not connect to this competition.');
        if (live) { setGame(data); setConnected(true); setError(''); }
      } catch (e) { if (live) { setConnected(false); setError((e as Error).name === 'TimeoutError' || (e as Error).name === 'TypeError' ? 'Connection interrupted. Reconnecting…' : (e as Error).message); } }
      if (live) timer = setTimeout(poll, document.hidden ? 5000 : 2000);
    }
    void poll(); return () => { live = false; clearTimeout(timer); controller.abort(); };
  }, [code]);
  async function fullscreen() { try { if (document.fullscreenElement) await document.exitFullscreen(); else await document.documentElement.requestFullscreen(); } catch { setError('Fullscreen is unavailable in this browser. You can use the browser’s fullscreen controls.'); } }
  const winner = game?.buzzes[0], team = game?.teams.find(t => t.id === winner?.team);
  const standings = game ? [...game.teams].sort((a,b) => b.score-a.score || a.sort-b.sort) : [];
  return <main className="audience-screen">
    <header className="audience-header"><a href="/" className="audience-back"><ArrowLeft size={16}/>Portal</a><div className="audience-brand"><Emblem logo={game?.schoolLogo} name="Penny International College" kind="school"/><div><span>PENNY INTERNATIONAL COLLEGE</span><h1>{game?.title || 'Competition display'}</h1></div>{game?.competitionLogo && <Emblem logo={game.competitionLogo} name="Competition" kind="competition"/>}</div><div className="audience-tools">{game && <span>SESSION <b>{code}</b></span>}<button aria-label="Toggle fullscreen" title="Toggle fullscreen" onClick={fullscreen}><Maximize size={20}/></button></div></header>
    {!game ? <section className="display-entry"><span className="eyebrow">PROJECTOR & AUDIENCE SCREEN</span><h2>Display sign in</h2><p>Enter the host’s session code to show live results.</p><form onSubmit={e => { e.preventDefault(); setGame(null); setConnected(false); setError(''); setCode(input); history.replaceState(null,'','/display?session='+input); }}><SessionCode value={input} onChange={setInput} onComplete={value=>{setGame(null);setConnected(false);setError('');setCode(value);history.replaceState(null,'','/display?session='+value);}}/><button className="button primary" disabled={!validSessionCode(input)}>{code && !error ? 'Connecting…' : 'Open competition display'}</button></form><p className="display-error" role="status">{error}</p><small>This screen does not take a student place or control the competition.</small></section> : <>
      <div className="audience-round"><QuestionTimer game={game}/><span>ROUND {String(game.competitionRound).padStart(2,'0')} · QUESTION {String(game.question).padStart(2,'0')}</span><span className={connected ? `display-connection ${game.armed?'':'closed'}` : 'display-connection reconnecting'}><i/>{connected ? game.armed ? 'Buzzers open' : 'Buzzers closed' : 'Reconnecting · results may be out of date'}</span></div>
      {error && <div className="display-error" role="status">{error}</div>}
      <div className="audience-progress-stage" key={`${game.phase==='scores'?'scores':'buzzes'}-${game.round}-${game.competitionRound}`}>{game.phase==='scores'?<Leaderboard game={game} audience/>:<BuzzOrder game={game} audience/>}</div>
      <footer className="audience-footer"><span>PIC Competition Software</span><button onClick={()=>{setCode('');setGame(null);setError('');setConnected(false);history.replaceState(null,'','/display');}}>Change session</button></footer>
    </>}
  </main>;
}
