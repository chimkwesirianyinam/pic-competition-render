import { digest,randomToken,verifyPassword } from './password.mjs';
export const COOKIE='pic_host_session';
// Dummy verification makes an unknown email take the same password-derivation path.
const dummy='pbkdf2-sha256:100000:00000000000000000000000000000000:'+'0'.repeat(64);
export function publicOrigin(req,env){return env.APP_ORIGIN||new URL(req.url).origin;}
export function allowedOrigin(req,env){return req.headers.get('origin')===publicOrigin(req,env);}
export function cookieToken(req){return req.headers.get('cookie')?.split(';').map(v=>v.trim()).find(v=>v.startsWith(COOKIE+'='))?.slice(COOKIE.length+1);}
export async function findHost(token,db,now=Date.now()) {if(!/^[a-f0-9]{64}$/.test(token||''))return null;return db.prepare('SELECT a.id AS userId,a.email,a.name AS displayName FROM host_sessions s JOIN host_accounts a ON a.id=s.host_id WHERE s.token_hash=? AND s.expires>?').bind(await digest(token),now).first();}
export async function login(email,password,client,db,now=Date.now()) {
 email=String(email||'').trim().toLowerCase().slice(0,254);
 const keys=['email:'+await digest(email),'client:'+await digest(client||'unknown')];
 const attempts=await db.batch(keys.map(key=>db.prepare('INSERT INTO login_limits VALUES(?,1,?) ON CONFLICT(key) DO UPDATE SET attempts=CASE WHEN reset_at<=? THEN 1 ELSE attempts+1 END,reset_at=CASE WHEN reset_at<=? THEN excluded.reset_at ELSE reset_at END RETURNING attempts').bind(key,now+900000,now,now)));
 if(attempts.some(r=>r.results[0].attempts>10))return {error:'rate',status:429};
 const account=await db.prepare('SELECT * FROM host_accounts WHERE email=?').bind(email).first();
 const correct=await verifyPassword(String(password||''),account?.password_hash||dummy);
 if(!correct||!account)return {error:'credentials',status:401};
 const token=randomToken();
 await db.batch([...keys.map(key=>db.prepare('DELETE FROM login_limits WHERE key=?').bind(key)),db.prepare('DELETE FROM host_sessions WHERE expires<=?').bind(now),db.prepare('DELETE FROM login_limits WHERE reset_at<=?').bind(now),db.prepare('INSERT INTO host_sessions VALUES(?,?,?)').bind(await digest(token),account.id,now+604800000)]);
 return {token,status:200};
}
export async function logout(token,db){if(token)await db.prepare('DELETE FROM host_sessions WHERE token_hash=?').bind(await digest(token)).run();}
export function sessionCookie(token,req,maxAge=604800){return `${COOKIE}=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}${new URL(req.url).protocol==='https:'?'; Secure':''}`;}
