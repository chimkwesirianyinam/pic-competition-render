const encode=new TextEncoder();
const hex=bytes=>Array.from(new Uint8Array(bytes),b=>b.toString(16).padStart(2,'0')).join('');
const unhex=s=>Uint8Array.from(s.match(/../g)||[],b=>parseInt(b,16));
export const randomToken=()=>hex(crypto.getRandomValues(new Uint8Array(32)));
export const digest=async value=>hex(await crypto.subtle.digest('SHA-256',encode.encode(value)));
async function derive(password,salt){const key=await crypto.subtle.importKey('raw',encode.encode(password),'PBKDF2',false,['deriveBits']);return hex(await crypto.subtle.deriveBits({name:'PBKDF2',salt:unhex(salt),iterations:100000,hash:'SHA-256'},key,256));}
export async function passwordHash(password){if(typeof password!=='string'||password.length<12||password.length>256)throw new Error('Use a password between 12 and 256 characters.');const salt=hex(crypto.getRandomValues(new Uint8Array(16)));return 'pbkdf2-sha256:100000:'+salt+':'+await derive(password,salt);}
export async function verifyPassword(password,hash){if(typeof password!=='string'||password.length>256)return false;const [kind,count,salt,expected]=String(hash||'').split(':');if(kind!=='pbkdf2-sha256'||count!=='100000'||! /^[a-f0-9]{32}$/.test(salt)||! /^[a-f0-9]{64}$/.test(expected))return false;const actual=await derive(password,salt);let mismatch=0;for(let i=0;i<64;i++)mismatch|=actual.charCodeAt(i)^expected.charCodeAt(i);return mismatch===0;}
