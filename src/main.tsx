import React,{useEffect,useState} from 'react';
import { createRoot } from 'react-dom/client';
import CompetitionApplication from '../components/application';
import AudienceDisplay from '../components/audience-display';
import type { PortalUser } from '../components/workspace';
import '../styles.css';
function HostSignIn({user}:{user:PortalUser}){
 const error=new URLSearchParams(location.search).get('error');
 useEffect(()=>{if(user)location.replace('/?host=1');},[user]);
 return <main className="standalone-auth"><section className="panel"><span className="eyebrow">PENNY INTERNATIONAL COLLEGE</span><h1>Host sign in</h1><p>PIC Competition Software</p>{error&&<p role="alert">{error==='rate'?'Too many attempts. Try again in 15 minutes.':'Email or password is incorrect.'}</p>}<form action="/host/login" method="post"><label>Email address<input type="email" name="email" required autoComplete="username" maxLength={254}/></label><label>Password<input type="password" name="password" required autoComplete="current-password" maxLength={256}/></label><button className="button primary">Sign in</button></form><p>Your administrator creates host accounts and resets passwords.</p><a href="/">Back to the competition portal</a></section></main>;
}
function Root(){const [user,setUser]=useState<PortalUser>(null),[loaded,setLoaded]=useState(false),[error,setError]=useState(false);useEffect(()=>{if(location.pathname==='/display'){setLoaded(true);return;}let live=true;fetch('/api/account',{cache:'no-store'}).then(async r=>{if(!r.ok)throw new Error();const data=await r.json() as {user:PortalUser};if(live){setUser(data.user);setLoaded(true);}}).catch(()=>{if(live)setError(true);});return()=>{live=false;};},[]);
 if(!loaded)return <main className="standalone-auth"><section className="panel"><h1>PIC Competition Software</h1><p role="status">{error?'Could not connect to the competition server.':'Connecting…'}</p>{error&&<button className="button primary" onClick={()=>location.reload()}>Try again</button>}</section></main>;
 if(location.pathname==='/display')return <AudienceDisplay/>;
 if(location.pathname==='/host')return <HostSignIn user={user}/>;
 if(location.pathname==='/host/signout')return <main className="standalone-auth"><section className="panel"><h1>Sign out?</h1><form action="/host/logout" method="post"><button className="button primary">Sign out</button></form><a href="/?host=1">Stay signed in</a></section></main>;
 return <CompetitionApplication user={user} signInUrl="/host" signOutUrl="/host/signout"/>;
}
createRoot(document.getElementById('root')!).render(<Root/>);
