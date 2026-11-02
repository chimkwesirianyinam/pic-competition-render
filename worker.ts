import { handleGame,GameError } from './lib/game';
import { allowedOrigin,publicOrigin,cookieToken,findHost,login,logout,sessionCookie } from './lib/host-auth.mjs';
import { getLogo,postLogo } from './lib/logo';
import { logoStore } from './lib/logo-store.mjs';
import { limitedBody } from './lib/request.mjs';
export type Env={DB:D1Database;ASSETS:Fetcher;APP_ORIGIN?:string};
const json=(value:unknown,status=200)=>Response.json(value,{status,headers:{'Cache-Control':'no-store'}});
const redirect=(path:string,req:Request,env:Env,cookie?:string)=>new Response(null,{status:303,headers:{Location:new URL(path,publicOrigin(req,env)).href,'Cache-Control':'no-store',...(cookie?{'Set-Cookie':cookie}:{})}});
function cacheKey(req:Request,code:string){return new Request(new URL('/__pic_state_cache/'+encodeURIComponent(code),req.url));}
export async function route(req:Request,env:Env):Promise<Response>{
 const path=new URL(req.url).pathname;
 if(req.method==='POST'&&!allowedOrigin(req,env))return json({error:'Invalid request origin.'},403);
 if(path==='/api/health'&&req.method==='GET'){await env.DB.prepare('SELECT 1').first();return json({status:'ok'});}
 if(path==='/api/account'&&req.method==='GET'){const user=await findHost(cookieToken(req),env.DB);return json({user:user?{email:user.email,displayName:user.displayName}:null});}
 if(path==='/host/login'&&req.method==='POST'){
  const form=await new Response(await limitedBody(req,8192),{headers:{'Content-Type':req.headers.get('Content-Type')||''}}).formData();
  const result=await login(form.get('email'),form.get('password'),req.headers.get('CF-Connecting-IP')||'local',env.DB);
  return redirect(result.token?'/?host=1':'/host?error='+result.error,req,env,result.token?sessionCookie(result.token,req):undefined);
 }
 if(path==='/host/logout'&&req.method==='POST'){await logout(cookieToken(req),env.DB);return redirect('/',req,env,sessionCookie('',req,0));}
 if(path==='/api/game'&&req.method==='POST'){
  let data;try{data=JSON.parse(new TextDecoder().decode(await limitedBody(req,16000)));}catch(e){if((e as any).status)throw e;return json({error:'Invalid JSON request.'},400);}
  if(!data||typeof data!=='object'||Array.isArray(data))return json({error:'Invalid request.'},400);
  const code=String(data.code||'').trim().toUpperCase();
  // Public snapshots contain no credentials. Short edge caching reduces D1 reads;
  // mutation requests always bypass it and keep the original database algorithm.
  const cache=typeof caches!=='undefined'?(caches as unknown as {default:Cache}).default:null;
  const key=cacheKey(req,code);
  if(data.action==='state'&&cache){const cached=await cache.match(key);if(cached){const h=new Headers(cached.headers);h.set('Cache-Control','no-store');return new Response(cached.body,{headers:h});}}
  if(data.action!=='state'&&cache)await cache.delete(key);
  const needsHost=data.action==='rooms'||data.action==='create'||data.action==='resume'||typeof data.secret==='string';
  const user=needsHost?await findHost(cookieToken(req),env.DB):null;
  const result=await handleGame(data,env.DB,Date.now(),user?.userId||null);
  if(data.action==='state'&&cache)await cache.put(key,Response.json(result,{headers:{'Cache-Control':'public, max-age=1'}}));
  if(data.action!=='state'&&cache)await cache.delete(key);
  return json(result);
 }
 if(path==='/api/logo'&&req.method==='GET')return getLogo(req,{DB:env.DB,BUCKET:logoStore(env.DB)});
 if(path==='/api/logo'&&req.method==='POST')return postLogo(req,{...env,BUCKET:logoStore(env.DB)});
 if(path.startsWith('/api/')||path==='/host/login'||path==='/host/logout')return json({error:'Not found.'},404);
 if(req.method!=='GET'&&req.method!=='HEAD')return new Response('Method not allowed',{status:405});
 return env.ASSETS.fetch(req);
}
export default {async fetch(req:Request,env:Env){try{const response=await route(req,env);const headers=new Headers(response.headers);headers.set('X-Content-Type-Options','nosniff');headers.set('X-Frame-Options','DENY');headers.set('Referrer-Policy','same-origin');return new Response(response.body,{status:response.status,statusText:response.statusText,headers});}catch(e){if(e instanceof GameError)return json({error:e.message},e.status);if((e as any).status===413)return json({error:'Request too large.'},413);console.error('PIC request failed',e instanceof Error?e.message:'Unknown error');return json({error:'Could not complete the request. Check your connection and try again.'},500);}}};
