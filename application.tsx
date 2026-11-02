'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ArrowRight, Share2, Trash2, Pause, Play, Check, ChevronRight, Download, Flag, Info, Link2, LoaderCircle, LockKeyhole, LogOut, Minus, Monitor, Podium, Plus, Radio, RefreshCw, Settings, ShieldCheck, Trophy, UserRound, Users, Volume2, VolumeX, X } from 'lucide-react';
import { Emblem, JoinClass } from './competition';
import { BrandingView, ClassTable, HelpContent, PortalHeader, QueueTable, Sidebar, Status, StudentsView, Topbar, type PortalUser, type View } from './workspace';
import HostSetup, { BuzzModeControl } from './host-setup';
import LiveSession, { Leaderboard, QuestionHeading, QuestionTimer } from './live-session';
import SessionCode from './session-code';
import MemoryCarousel from './memory-carousel';
import { validSessionCode } from '@/lib/competition';
import type { Game, Session } from '@/lib/competition';
type RoomSummary = { code: string; title: string; round: number; competitionRound: number; question: number; armed: number; created: number };
type ApiError = Error & { status?: number };
const storageKey = 'firstbuzz';
function readSession(): Session | null {
  try { const item = sessionStorage.getItem(storageKey); if (!item) return null; const s = JSON.parse(item); return typeof s.code === 'string' && (s.secret || (s.id && s.token)) ? s : null; } catch { return null; }
}
export default function CompetitionApplication({ user, signInUrl, signOutUrl }: { user: PortalUser; signInUrl: string; signOutUrl: string }) {
  const [loaded, setLoaded] = useState(false), [session, setSession] = useState<Session | null>(null);
  const [game, setGame] = useState<Game | null>(null), [joinGame, setJoinGame] = useState<Game | null>(null);
  const [mode, setMode] = useState<'host' | 'join' | 'display'>('host'), [view, setView] = useState<View>('live');
  const [title, setTitle] = useState('PIC Inter-Class Competition'), [roomCode, setRoomCode] = useState('');
  const [busy, setBusy] = useState(false), [online, setOnline] = useState(true), [error, setError] = useState(''), [sound, setSound] = useState(true), [copied, setCopied] = useState(''), [leaveOpen, setLeaveOpen] = useState(false);
  const mutating = useRef(false), generation = useRef(0), pollSequence = useRef(0), audio = useRef<AudioContext | null>(null), previousWinner = useRef<number | null>(null);
  const host = !!session?.secret;
  const [deleteTarget,setDeleteTarget]=useState<RoomSummary|null>(null);
  const [codeStage, setCodeStage] = useState(true);
  const [hostWorkspace, setHostWorkspace] = useState(false), [portalVisible, setPortalVisible] = useState(false), [mobile, setMobile] = useState(false), [helpOpen, setHelpOpen] = useState(false);
  const [roomList, setRoomList] = useState<RoomSummary[]>([]), [roomsLoading, setRoomsLoading] = useState(false);
  const [motionPaused, setMotionPaused] = useState(false);
  const homepage = useRef<HTMLElement | null>(null);
  const shell = !portalVisible && (host || hostWorkspace) && !session?.id;
  useEffect(() => {
    const page = homepage.current;
    if (!page || !('IntersectionObserver' in window)) return;
    const preference = window.matchMedia('(prefers-reduced-motion: reduce)');
    let observer: IntersectionObserver | undefined;
    const elements = Array.from(page.querySelectorAll<HTMLElement>('.portal-photo, .competition-strip, .closing-invite'));
    function configure() {
      observer?.disconnect();
      delete page!.dataset.motion;
      elements.forEach(element => element.classList.remove('motion-reveal', 'motion-visible'));
      if (preference.matches) return;
      observer = new IntersectionObserver(entries => {
        entries.forEach(entry => {
          if (entry.isIntersecting) { entry.target.classList.add('motion-visible'); observer?.unobserve(entry.target); }
        });
      }, { threshold: 0.08, rootMargin: '0px 0px 45px 0px' });
      elements.forEach(element => { element.classList.add('motion-reveal'); observer!.observe(element); });
      page!.dataset.motion = 'ready';
    }
    configure();
    preference.addEventListener('change', configure);
    return () => { observer?.disconnect(); preference.removeEventListener('change', configure); delete page.dataset.motion; };
  }, [loaded, shell, session?.id, portalVisible, joinGame?.code]);
  const api = useCallback(async <T = Game,>(action: string, body: Record<string, any> = {}): Promise<T> => {
    const response = await fetch('/api/game', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...session, action, ...body }), signal: AbortSignal.timeout(12000) });
    const data = await response.json() as Record<string, any>;
    if (!response.ok) { const e: ApiError = new Error(data.error || 'Could not complete the request.'); e.status = response.status; throw e; }
    return data as T;
  }, [session]);
  useEffect(() => {
    const saved = readSession(); const c = (new URLSearchParams(location.search).get('session') || new URLSearchParams(location.search).get('room'));
    if (saved && (!c || saved.code === c.toUpperCase())) { setSession(saved); if(saved.secret) setCodeStage(sessionStorage.getItem('pic-setup-'+saved.code)!=='complete'); }
    if (c) { setRoomCode(c.toUpperCase()); setMode('join'); }
    if ((saved?.secret && (!c || saved.code === c.toUpperCase())) || new URLSearchParams(location.search).get('host') === '1') setHostWorkspace(true);
    if (new URLSearchParams(location.search).get('host') === '1' && !saved?.secret) setView('home');
    setMobile(window.matchMedia('(min-width:761px)').matches);
    setLoaded(true);
  }, []);
  useEffect(() => {
    if (!session) return;
    let live = true, timer: ReturnType<typeof setTimeout>;
    const poll = async () => {
      if (!mutating.current) {
        const version = generation.current, sequence = ++pollSequence.current;
        try {
          const state = await api('state');
          if (live && version === generation.current && sequence === pollSequence.current) { setGame(state); setOnline(true); setError(current => current.includes('Reconnecting') || current.includes('Failed to fetch') ? '' : current); }
        } catch (e) {
          if (live && version === generation.current) { setOnline(false); setError((e as Error).name === 'TimeoutError' ? 'Connection is taking too long. Reconnecting…' : (e as Error).message); }
        }
      }
      if (live) timer = setTimeout(poll, document.hidden ? 5000 : 2000);
    };
    poll(); return () => { live = false; clearTimeout(timer); };
  }, [api, session]);
  useEffect(() => {
    if (!joinGame || session) return;
    let live = true; const code = joinGame.code;
    const timer = setInterval(async () => { try { const result = await api('state', { code }); if (live) setJoinGame(result); } catch {} }, 2500);
    return () => { live = false; clearInterval(timer); };
  }, [joinGame?.code, session, api]);
  function save(next: Session, setup = true) { setCodeStage(!!next.secret && setup); generation.current++; setGame(null); setPortalVisible(false); setSession(next); sessionStorage.setItem(storageKey, JSON.stringify(next)); setError(''); setOnline(true); setJoinGame(null); }
  const buzzerBuffers=useRef<Record<string,AudioBuffer>>({});
  function beep(first=true) {
    if(!sound)return;
    try{if(!audio.current)audio.current=new AudioContext();const ctx=audio.current;void ctx.resume();const file=first?'game-first':'game-later';
      async function play(){const buffer=buzzerBuffers.current[file]||(buzzerBuffers.current[file]=await ctx.decodeAudioData(await (await fetch('/sounds/'+file+'.wav')).arrayBuffer()));const source=ctx.createBufferSource();source.buffer=buffer;source.connect(ctx.destination);source.start();}void play().catch(()=>{});
    }catch{}
  }
  const winner = game?.buzzes[0], myStudent = game?.players.find(p => p.id === session?.id), myTeam = game?.teams.find(t => t.id === myStudent?.team);
  const myBuzzIndex = game?.buzzes.findIndex(b => b.player === session?.id) ?? -1;
  const notFirst = myBuzzIndex > 0 || (!!winner && game?.multipleBuzzes === 0 && myBuzzIndex < 0);
  const ready = !!game?.armed && myBuzzIndex === -1 && !!myTeam?.enabled && online && !busy;
  useEffect(()=>{if(!host||!game)return;const last=game.buzzes.at(-1)?.id||0;if(previousWinner.current!==null&&last>previousWinner.current){const newBuzzes=game.buzzes.filter(b=>b.id>previousWinner.current!);newBuzzes.forEach((b,i)=>setTimeout(()=>beep(b.id===game.buzzes[0]?.id),i*220));}previousWinner.current=last;},[game?.buzzes.length,game?.round,host]);
  const refresh = useCallback(async () => {
    const version = ++generation.current; const result = await api('state');
    if (version === generation.current) { setGame(result); setOnline(true); }
  }, [api]);
  async function action(name: string, data: Record<string, any> = {}) {
    if (mutating.current) return;
    mutating.current = true; generation.current++; setBusy(true); setError('');
    try {
      if ((name === 'arm'||name==='buzz') && sound) { try { if(!audio.current)audio.current = new AudioContext();void audio.current.resume(); } catch {} }
      const state = await api(name, data); setGame(state); setOnline(true);
      if (name === 'buzz') {const position=state.buzzes.findIndex(b=>b.player===session?.id);if(position>=0)beep(position===0);}
    } catch (e) { setError((e as Error).message); if ((e as Error).name === 'TimeoutError' || (e as Error).name === 'TypeError') setOnline(false); }
    finally { mutating.current = false; setBusy(false); }
  }
  useEffect(() => {
    const key = (event: KeyboardEvent) => {
      if (event.code === 'Space' && !event.repeat && !host && ready && session && game && !['INPUT','TEXTAREA','SELECT','BUTTON'].includes((event.target as HTMLElement)?.tagName)) { event.preventDefault(); void action('buzz', { round: game.round }); }
    }; window.addEventListener('keydown', key); return () => window.removeEventListener('keydown', key);
  }, [host, ready, session, game?.round, api]);
  async function enter() {
    if (mutating.current) return; mutating.current = true; setBusy(true); setError('');
    try {
      const result = await api<Session>('create', { title }); save(result); setView('students'); setHostWorkspace(true); setPortalVisible(false);
    } catch (e) { setError((e as Error).message); } finally { setBusy(false); mutating.current = false; }
  }
  async function join(team: string, seat: number, name: string) {
    if (mutating.current || !joinGame) return; mutating.current = true; setBusy(true); setError('');
    try { const result = await api<{ id: string; token: string }>('join', { code: joinGame.code, team, seat, name }); save({ code: joinGame.code, id: result.id, token: result.token }); }
    catch (e) { setError((e as Error).message); } finally { setBusy(false); mutating.current = false; }
  }
  async function copyInvite(justCode = false) {
    if (!session) return;
    try { await navigator.clipboard.writeText(justCode ? session.code : location.origin + '/?session=' + session.code); setCopied(justCode ? 'code' : 'link'); setTimeout(() => setCopied(''), 2200); }
    catch { setError('Your session code is ' + session.code + '. Contestants can enter it on the home screen.'); }
  }
  function leave() {
    generation.current++; sessionStorage.removeItem(storageKey); setSession(null); setGame(null); setError(''); setOnline(true); setLeaveOpen(false); setView('home'); setHostWorkspace(!!user);
  }
  const winnerTeam = game?.teams.find(t => t.id === winner?.team);
  const navigate = (next: View) => { setView(next); setMobile(false); setPortalVisible(false); };
  const refreshRooms = useCallback(async () => {
    if (!user) return;
    setRoomsLoading(true);
    try { const result = await api<{ rooms: RoomSummary[] }>('rooms'); setRoomList(result.rooms); }
    catch (e) { setError((e as Error).message); }
    finally { setRoomsLoading(false); }
  }, [api, user?.email]);
  useEffect(() => { if (shell && user && view === 'home') void refreshRooms(); }, [shell, session?.code, refreshRooms, view]);
  async function resume(code: string) {
    if (mutating.current) return; mutating.current = true; setBusy(true); setError('');
    try { save(await api<Session>('resume', { code }), false); setPortalVisible(false); setView('live'); }
    catch (e) { setError((e as Error).message); }
    finally { mutating.current = false; setBusy(false); }
  }
  async function deleteSession() {
    if(!deleteTarget||mutating.current)return;
    const target=deleteTarget;mutating.current=true;generation.current++;setBusy(true);setError('');
    try{await api('delete_session',{code:target.code,confirm:true});setRoomList(current=>current.filter(item=>item.code!==target.code));setDeleteTarget(null);if(session?.code===target.code){sessionStorage.removeItem('pic-setup-'+target.code);leave();setPortalVisible(false);setHostWorkspace(true);setView('home');}}
    catch(e){setError((e as Error).message);}finally{mutating.current=false;setBusy(false);}
  }
  async function saveSetupRoster(rosters:{team:string;names:string[]}[]) {
    if(mutating.current) return false;
    mutating.current=true;generation.current++;setBusy(true);setError('');
    try {let state=game;for(const roster of rosters) state=await api('roster',roster);setGame(state);setOnline(true);return true;}
    catch(e){setError((e as Error).message);return false;}
    finally{mutating.current=false;setBusy(false);}
  }
  function exportScores() {
    if (!game) return;
    const rows = [['Class','Points','Participation','Registered students'], ...game.teams.filter(t=>t.enabled).sort((a,b) => b.score-a.score || a.sort-b.sort).map(t => [t.name, String(t.score), !t.enabled ? 'Omitted' : game.players.some(p => p.team === t.id && p.joined) ? 'Active' : 'Awaiting sign-in', String(game.players.filter(p => p.team === t.id && p.joined).length)])];
    rows.push([],['Student','Class','Average response (seconds)']);
    for(const p of game.players.filter(p=>p.name&&game.teams.some(t=>t.id===p.team&&t.enabled)))rows.push([p.name,game.teams.find(t=>t.id===p.team)!.name,p.averageMs==null?'':(p.averageMs/1000).toFixed(2)]);
    const csv = rows.map(row => row.map(value => '"'+value.replaceAll('"','""')+'"').join(',')).join('\r\n');
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    const link = document.createElement('a'); link.href = url; link.download = `PIC-${game.code}-scores.csv`; link.click(); URL.revokeObjectURL(url);
  }
  const titleFor: Record<View, string> = { home: 'Home', live: 'Live session', classes: 'Classes', students: 'Students', scoreboard: 'Scoreboard', branding: 'Branding', settings: 'Settings', help: 'Help & competition rules' };
  const portalHeader = <PortalHeader game={game || joinGame} home={() => { setPortalVisible(true); setJoinGame(null); }} help={() => setHelpOpen(true)} />;
  const errorToast = error && <div className="error-toast" role="alert"><span>{error}</span><button className="icon-button" aria-label="Dismiss message" onClick={() => setError('')}><X size={18} /></button></div>;
  const noRoom = <section className="panel no-room"><Radio size={32} strokeWidth={1.5} /><h2>Choose a competition session</h2><p>Open a current session or create a new one from Home.</p><button className="button primary" onClick={() => navigate('home')}>Go to Home<ArrowRight size={16} /></button></section>;
  async function joinByCode(code:string) {
    if(mutating.current || !validSessionCode(code)) return;
    setMode('join');mutating.current=true;setBusy(true);setError('');
    try {setJoinGame(await api('state',{code}));} catch(e){setError((e as Error).message);} finally {setBusy(false);mutating.current=false;}
  }
  const roomChooser = <><div className="account-home-heading"><div><h2>{user ? 'Your competitions' : 'Host workspace'}</h2><p>Sessions are available for 24 hours after they are created.</p></div>{user && <button className="button secondary small" disabled={roomsLoading} onClick={refreshRooms}><RefreshCw size={15} className={roomsLoading ? 'spin' : ''} />Refresh</button>}</div>{!user ? <section className="panel account-signin"><LockKeyhole size={28} /><h3>Sign in to host a competition</h3><p>Your sessions and host controls are linked to your account.</p><a className="button primary" href={signInUrl} target="_top">Host sign in<ArrowRight size={16} /></a></section> : <><section className="panel new-room-panel"><div><h3>Create a competition</h3><p>All six classes and their four student places will be ready to set up.</p></div><form onSubmit={e => { e.preventDefault(); setMode('host'); void enter(); }}><label className="form-label">Competition name<input required maxLength={80} value={title} onChange={e => setTitle(e.target.value)} disabled={busy} /></label><button className="button primary" disabled={busy}>{busy ? <LoaderCircle className="spin" size={16} /> : <Plus size={17} />}Create session</button></form></section><section className="panel rooms-panel"><div className="panel-title"><h2>Current sessions</h2><span>{roomList.length} available</span></div>{roomsLoading && !roomList.length ? <div className="empty-message"><LoaderCircle className="spin" size={22} />Loading your competitions…</div> : !roomList.length ? <div className="empty-message"><p>You have no current sessions. Create one above to get started.</p></div> : roomList.map(room => <div className="room-row" key={room.code}><span className="room-row-icon"><Radio size={22} /></span><div><h3>{room.title}</h3><span>{room.code} <i>·</i> Round {room.competitionRound} · Question {room.question} <i>·</i> {room.armed ? 'Buzzers open' : 'Buzzers closed'}</span></div><button className="button secondary small" disabled={busy} onClick={() => resume(room.code)}>Open session<ArrowRight size={15} /></button><button className="button secondary small delete-session-button" disabled={busy} onClick={()=>setDeleteTarget(room)} aria-label={`Delete session ${room.code}`}><Trash2 size={15}/>Delete</button></div>)}</section></>}</>;
  return <>
    {!loaded ? <div className="loading-screen"><LoaderCircle className="spin" size={27} /><p>Opening PIC Competition Software…</p></div>  : shell && codeStage && session?.secret ? <>{portalHeader}<HostSetup game={game} code={session.code} busy={busy} online={online} copied={copied} copy={copyInvite} action={action} saveRoster={saveSetupRoster} complete={()=>{sessionStorage.setItem('pic-setup-'+session.code,'complete');setCodeStage(false);setView('live');window.scrollTo(0,0);}}/></> : shell ? <div className={`software-shell ${mobile ? '' : 'sidebar-collapsed'}`}><Sidebar view={view} navigate={navigate} user={user} game={game} mobile={mobile} close={() => setMobile(false)} signInUrl={signInUrl} signOutUrl={signOutUrl} exit={() => { setPortalVisible(true); setMobile(false); }} /><div className={`workspace ${view === 'live' ? 'competition-workspace' : ''}`}><Topbar game={game} connected={online} menuOpen={mobile} openMenu={() => setMobile(current=>!current)} copy={() => copyInvite(true)} copied={copied === 'code'} /><main className="workspace-content"><div className="page-title"><div><h1>{titleFor[view]}</h1>{view === 'live' && game && <QuestionHeading game={game}/>}</div><div className="page-actions">{view === 'live' && game && <button className="icon-button" aria-label={sound ? 'Mute buzzer sound' : 'Enable buzzer sound'} onClick={() => setSound(!sound)}>{sound ? <Volume2 size={20} /> : <VolumeX size={20} />}</button>}{game && <button className="icon-button" title={copied==='link'?'Invite link copied':'Invite contestants'} aria-label={copied==='link'?'Invite link copied':'Invite contestants'} onClick={()=>copyInvite()}>{copied==='link'?<Check size={19}/>:<Share2 size={19}/>}</button>}{view === 'live' && game && <button className="button secondary small" onClick={()=>setCodeStage(true)}>Session setup</button>}{view === 'live' && game && <a className="button secondary small" href={'/display?session=' + game.code} target="_blank" rel="noopener noreferrer" aria-label="Open audience display" title="Open audience display"><Monitor size={19}/></a>}{view === 'scoreboard' && game && <button className="button secondary small" onClick={exportScores}><Download size={15} />Export scores</button>}</div></div>
      {view === 'home' ? <>{game && <section className="panel current-room"><div><span className="eyebrow">CURRENT COMPETITION</span><h2>{game.title}</h2><p><b>{game.code}</b> <span>·</span> {game.teams.filter(t => t.enabled && game.players.some(p => p.team === t.id && p.joined)).length} active classes <span>·</span> {game.players.filter(p => p.team && p.joined).length} registered students <span>·</span> Round {game.competitionRound} · Question {game.question}</p></div><button className="button primary" onClick={() => navigate('live')}>Open live session<ArrowRight size={17} /></button></section>}{roomChooser}</> : view === 'help' ? <section className="panel help-panel"><HelpContent /></section> : view === 'settings' ? <div className="settings-stack"><section className="panel settings-panel"><h2>Host account</h2><div><span>Signed in as</span><strong>{user?.displayName || 'Existing host session'}</strong></div>{user && <div><span>Email address</span><strong>{user.email}</strong></div>}<p>{user ? 'Sign-in and account recovery are managed securely through your host account.' : 'Sign in to link this session to your account and reopen it from another session.'}</p><a className="button secondary" target="_top" href={user ? signOutUrl : signInUrl}>{user ? 'Sign out' : 'Host sign in'}<LogOut size={16} /></a></section><section className="panel settings-panel"><h2>Sound</h2><div><span>Play a tone when a buzz is received</span><button className={`toggle ${sound ? 'on' : ''}`} role="switch" aria-checked={sound} aria-label="Buzzer sound" onClick={() => setSound(!sound)}><span /></button></div><p>This setting applies to this screen.</p></section>{game && <section className="panel settings-panel"><h2>Session access</h2><div><span>Session code</span><button className="room-copy" onClick={() => copyInvite(true)}><b>{game.code}</b></button></div><p>Contestants need this session code and access to the site. Each student place accepts one registered device.</p><button className="button secondary" onClick={() => copyInvite()}><Link2 size={16} />Copy contestant invite</button></section>}</div> : !game || !session ? (session ? <div className="loading-screen inline-loading"><LoaderCircle className="spin" size={28} /><p>Connecting to your session…</p><button className="text-button" onClick={leave}>Choose another session</button></div> : noRoom) : view === 'students' ? <StudentsView game={game} session={session} busy={busy} action={action} refresh={refresh} /> : view === 'branding' ? <BrandingView game={game} session={session} refresh={refresh} /> : view === 'scoreboard' ? <Leaderboard game={game}/> : view === 'classes' ? <ClassTable game={game} busy={busy} action={action}/> : <LiveSession game={game} busy={busy || !online} action={action}/>}
    </main></div></div> : session?.id && !portalVisible ? <>{portalHeader}<main className="contestant-page">{!game ? <div className="loading-screen"><LoaderCircle className="spin" size={26} /><p>Connecting to the competition…</p><button className="text-button" onClick={leave}>Return to portal</button></div> : !myTeam ? <section className="panel no-room"><Users size={30} /><h2>Choose your class team</h2><p>This session now uses four student places per class.</p><button className="button primary" onClick={() => { leave(); setJoinGame(game); setMode('join'); }}>Join a class<ArrowRight size={16} /></button></section> : <><div className="page-title"><div><h1>{game.title}</h1><span className="round-label">Round {String(game.competitionRound).padStart(2,'0')} · Question {game.question}</span></div><Status active={online} label={online ? 'Connected' : 'Reconnecting'} /></div><div className="contestant-live-grid"><section className="panel contestant-buzzer-panel"><div className="contestant-countdown"><QuestionTimer game={game}/></div><div className="contestant-identity"><Emblem logo={myTeam.logo} name={myTeam.name} /><div><h2>{myTeam.name}</h2><span>{myStudent?.name}</span></div><small>STUDENT {myStudent?.seat} / 4</small></div><Status active={!!game.armed && !!myTeam.enabled} label={!myTeam.enabled ? 'Class omitted' : game.armed ? 'Buzzers open' : 'Buzzers closed'} />{!myTeam.enabled && <p className="omitted-message">Your class is omitted. Please wait for the host.</p>}<button className={`competition-buzzer ${ready ? 'ready' : ''} ${myBuzzIndex === 0 ? 'first' : notFirst ? 'not-first' : ''}`} disabled={!ready} aria-label={myBuzzIndex >= 0 ? myBuzzIndex === 0 ? 'First to buzz' : `Buzzed in position ${myBuzzIndex + 1}` : notFirst ? 'Another student buzzed first' : ready ? 'Buzz for your class' : 'Buzzer unavailable'} onPointerDown={event => { if (ready && event.button === 0) { event.preventDefault(); void action('buzz', { round: game.round }); } }} onClick={() => { if (ready) void action('buzz', { round: game.round }); }}><Radio size={43} strokeWidth={1.6} /><strong className={ready ? 'tap-answer-label' : undefined}>{busy ? '…' : myBuzzIndex >= 0 ? myBuzzIndex === 0 ? 'FIRST' : `#${myBuzzIndex + 1}` : !myTeam.enabled ? 'PAUSED' : notFirst ? 'NOT FIRST' : game.armed ? 'Tap to answer' : 'WAIT'}</strong></button><h3>{myBuzzIndex >= 0 ? myBuzzIndex === 0 ? `${myTeam.name} is first!` : 'Your response is recorded.' : !myTeam.enabled ? 'Class participation paused' : notFirst ? 'Another student buzzed first.' : game.armed ? 'Tap to answer for your class.' : 'Wait for the host’s signal.'}</h3><p>{myBuzzIndex >= 0 ? `Position ${myBuzzIndex + 1}. Wait for the next question.` : ready ? <>You can also press <kbd>Space</kbd>.</> : 'Keep this tab open during the competition.'}</p></section><QueueTable game={game} mine={session.id} /></div><ClassTable game={game} busy={busy} action={action} controls={false} ranked /><div className="contestant-footer"><button className="text-button" onClick={() => setLeaveOpen(true)}><LogOut size={15} />Leave competition</button><span>Session {game.code} · Penny International College</span></div></>}</main></> : <>{portalHeader}{joinGame ? <main className="registration-page"><JoinClass game={joinGame} busy={busy} onJoin={join} onBack={() => { setJoinGame(null); setError(''); }} /></main> : <main className="portal-main" ref={homepage} data-paused={motionPaused}><section className="competition-intro"><span className="eyebrow">PENNY INTERNATIONAL COLLEGE COMPETITION PORTAL</span><h1>Great minds.<br /><span>Your next moment.</span></h1><p>Lorem ipsum dolor sit amet, consectetur adipiscing elit.</p><div className="intro-actions"><button className="button primary" onClick={() => { setMode('join'); document.getElementById('competition-access')?.scrollIntoView({ behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' }); }}>Join a competition<ArrowRight size={18} /></button><button className="button secondary" onClick={() => { setMode('host'); document.getElementById('competition-access')?.scrollIntoView({ behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' }); }}>Host a competition</button></div><button className="homepage-motion-toggle" aria-pressed={motionPaused} onClick={() => setMotionPaused(!motionPaused)}>{motionPaused ? <Play size={16} aria-hidden="true"/> : <Pause size={16} aria-hidden="true"/>}<span>{motionPaused?'Play motion':'Pause motion'}</span></button></section><section className="portal-photo"><img src="/images/pic-delegation-enhanced.webp" alt="Penny International College students and a teacher at a competition event" fetchPriority="high" /><div><span>THE PIC SPIRIT</span><h2>Penny International College at Dacurate Debate 2025</h2></div></section><div className="competition-strip"><span><b>06</b> class teams</span><span><b>04</b> students per team</span><span><b>01</b> first to buzz</span></div><section className="portal-access" id="competition-access"><div className="access-heading"><span className="eyebrow">TAKE YOUR PLACE</span><h2>Get started with the competition</h2><p>Choose your role.</p></div><div className="role-tabs" role="tablist" aria-label="Sign-in role"><button id="host-signin-tab" role="tab" aria-selected={mode === 'host'} aria-controls="host-signin-panel" onClick={() => { setMode('host'); setError(''); }}><UserRound size={19} aria-hidden="true"/><span>Host login</span></button><button id="contestant-signin-tab" role="tab" aria-selected={mode === 'join'} aria-controls="contestant-signin-panel" onClick={() => { setMode('join'); setError(''); }}><Podium size={19} aria-hidden="true"/><span>Contestant login</span></button><button id="display-signin-tab" role="tab" aria-selected={mode === 'display'} aria-controls="display-signin-panel" onClick={() => { setMode('display'); setError(''); }}><Monitor size={19} aria-hidden="true"/><span>Display login</span></button></div>{mode === 'host' ? <div className="host-signin" id="host-signin-panel" role="tabpanel" aria-labelledby="host-signin-tab"><span className="eyebrow">HOST ACCESS</span><h2>Welcome back</h2><p>Sign in to manage your competition.</p>{user ? <><label className="form-label">Host account<input readOnly value={user.email} aria-label="Signed-in host email address" /></label><p className="signed-in-note"><ShieldCheck size={15} />You’re securely signed in.</p><button className="button primary portal-signin" onClick={() => { setHostWorkspace(true); setPortalVisible(false); setView(session?.secret ? 'live' : 'home'); }}>Open host workspace<ArrowRight size={17} /></button></> : <><p className="signin-explanation">Use your host email and password for secure access. Your competitions stay linked to your account.</p><a className="button primary portal-signin" href={signInUrl} target="_top">Host sign in<ArrowRight size={18} /></a></>}{session?.secret && !user && <button className="text-button resume-session" onClick={() => { setPortalVisible(false); setHostWorkspace(true); setView('live'); }}>Return to current host session<ArrowRight size={15} /></button>}</div> : mode === 'display' ? <div className="display-signin" id="display-signin-panel" role="tabpanel" aria-labelledby="display-signin-tab"><span className="eyebrow">PROJECTOR & AUDIENCE SCREEN</span><h2>Display sign-in</h2><p>Show the first buzz, responding student and class standings on a separate screen.</p><form onSubmit={event=>{event.preventDefault();window.location.assign('/display?session='+roomCode);}}><SessionCode value={roomCode} onChange={setRoomCode} onComplete={code=>window.location.assign('/display?session='+code)} label="Display session code"/><button className="button primary portal-signin" disabled={!validSessionCode(roomCode)}>Open competition display<ArrowRight size={17}/></button></form><p className="display-access-note">Read-only access. No student place is required.</p></div> : <div className="contestant-entry" id="contestant-signin-panel" role="tabpanel" aria-labelledby="contestant-signin-tab"><h2>Contestant sign-in</h2><p>Enter the session code from your host.</p><form onSubmit={event=>{event.preventDefault();void joinByCode(roomCode);}}><SessionCode value={roomCode} onChange={setRoomCode} onComplete={joinByCode} disabled={busy} hideHint/><button className="button secondary join-competition" disabled={busy || !validSessionCode(roomCode)}>{busy?'Finding competition…':'Join competition'}</button></form>{session?.id && <button className="text-button" onClick={() => setPortalVisible(false)}>Return to your student place<ArrowRight size={15} /></button>}</div>}</section><MemoryCarousel paused={motionPaused}/><section className="closing-invite"><Trophy className="closing-trophy" size={54} strokeWidth={1.6} aria-hidden="true"/><h2>Who will be first?</h2><p>Ask your host for a code and join a session.</p><button className="button primary" onClick={() => { setMode('join'); document.getElementById('competition-access')?.scrollIntoView({ behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' }); }}>Join a session<ArrowRight size={18}/></button></section></main>}<footer className="portal-footer"><Emblem name="Penny International College" kind="school" /><div className="footer-school"><strong>Penny International College</strong><span>PIC Competition Software</span></div><div className="footer-actions"><button onClick={()=>{setMode('join');setPortalVisible(true);document.getElementById('competition-access')?.scrollIntoView({behavior:'smooth'});}}>Join a session</button><button onClick={()=>setHelpOpen(true)}><Info size={15} aria-hidden="true"/>Help & rules</button><a href="#" aria-label="Back to top">Back to top ↑</a></div></footer></>}
    {deleteTarget&&<div className="modal-backdrop"><section className="leave-dialog" role="dialog" aria-modal="true" aria-labelledby="delete-session-title" onKeyDown={event=>{if(event.key==='Escape'&&!busy)setDeleteTarget(null);}}><h2 id="delete-session-title">Delete this session?</h2><p><strong>{deleteTarget.title} · {deleteTarget.code}</strong></p><p>This removes the session from your list. Its results will no longer be accessible, and contestants and display screens will lose access.</p><div><button className="button secondary" autoFocus disabled={busy} onClick={()=>setDeleteTarget(null)}>Cancel</button><button className="button danger-button" disabled={busy} onClick={()=>void deleteSession()}><Trash2 size={16}/>{busy?'Deleting…':'Delete session'}</button></div></section></div>}{errorToast}{helpOpen && <div className="modal-backdrop"><section className="rules-dialog" role="dialog" aria-modal="true" aria-labelledby="rules-title"><div className="dialog-title"><h2 id="rules-title">Competition guide</h2><button autoFocus className="icon-button" aria-label="Close competition guide" onClick={() => setHelpOpen(false)}><X size={21} /></button></div><HelpContent /></section></div>}{leaveOpen && <div className="modal-backdrop"><section className="leave-dialog" role="dialog" aria-modal="true" aria-labelledby="leave-title"><h2 id="leave-title">Leave your student place?</h2><p>Your place will remain registered. Ask the host to release your device before joining again.</p><div><button className="button secondary" autoFocus onClick={() => setLeaveOpen(false)}>Stay in competition</button><button className="button primary" onClick={leave}>Leave competition</button></div></section></div>}
  </>;
}
