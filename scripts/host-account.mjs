import { randomUUID } from 'node:crypto';
import { mkdtempSync,writeFileSync,rmSync } from 'node:fs';
import path from 'node:path';
import { tmpdir } from 'node:os';
import { spawnSync } from 'node:child_process';
import { passwordHash } from '../lib/password.mjs';
import { ask,secret } from './prompt.mjs';
const target=process.argv.includes('--local')?'--local':'--remote';
const reset=process.argv.includes('--reset');
try {
 console.log(`${reset?'Resetting':'Creating'} a host account in the ${target.slice(2)} database.`);
 const email=(process.env.PIC_HOST_EMAIL||await ask('Host email: ')).trim().toLowerCase();
 if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))throw new Error('Enter a valid email address.');
 const name=(process.env.PIC_HOST_NAME||await ask('Display name [Competition host]: ')).trim()||'Competition host';
 const password=process.env.PIC_HOST_PASSWORD||await secret('Password (12–256 characters, hidden): ');
 if(!process.env.PIC_HOST_PASSWORD&&password!==await secret('Repeat password: '))throw new Error('Passwords did not match.');
 const hash=await passwordHash(password);
 const quote=s=>"'"+s.replaceAll("'","''")+"'";
 const sql=reset?`INSERT INTO host_accounts(id,email,name,password_hash) VALUES(${quote(randomUUID())},${quote(email)},${quote(name)},${quote(hash)}) ON CONFLICT(email) DO UPDATE SET password_hash=excluded.password_hash;\nDELETE FROM host_sessions WHERE host_id=(SELECT id FROM host_accounts WHERE email=${quote(email)});`:`INSERT INTO host_accounts(id,email,name,password_hash) VALUES(${quote(randomUUID())},${quote(email)},${quote(name)},${quote(hash)});`;
 const dir=mkdtempSync(path.join(tmpdir(),'pic-host-'));try{const file=path.join(dir,'account.sql');writeFileSync(file,sql,{mode:0o600});const result=spawnSync(process.execPath,['node_modules/wrangler/bin/wrangler.js','d1','execute','DB',target,'--file',file],{stdio:'inherit',env:{...process.env,WRANGLER_SEND_METRICS:'false'}});if(result.status!==0)throw new Error('Account update failed. If the account already exists, use --reset.');}finally{rmSync(dir,{recursive:true,force:true});}
 console.log(reset?'Host password updated; previous sign-ins revoked.':'Host account created. Password was not saved in this project.');
} catch(e){console.error(e.message);process.exitCode=1;}
