import { readFileSync,writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { ask } from './prompt.mjs';
const local=process.argv.includes('--local');
function run(args,capture=false){const result=spawnSync(process.execPath,['node_modules/wrangler/bin/wrangler.js',...args],{stdio:capture?['inherit','pipe','pipe']:'inherit',encoding:'utf8',env:{...process.env,WRANGLER_SEND_METRICS:'false'}});if(result.status!==0){if(capture)process.stderr.write(result.stderr||result.stdout||'');throw new Error('Cloudflare command failed. Fix the error above, then run setup again.');}return result.stdout||'';}
try{
 console.log('PIC Competition Software — Cloudflare setup\nThis uses Workers + D1. No R2 or paid plan is enabled by this wizard.');
 const config=JSON.parse(readFileSync('wrangler.jsonc','utf8'));
 if(!local){
  run(['login']);
  if(config.d1_databases[0].database_id==='00000000-0000-0000-0000-000000000000'){
   const existing=(await ask('Existing D1 database ID, or Enter to create a new database: ')).trim();let id=existing;
   if(!existing){const name=(await ask('New database name [pic-competition]: ')).trim()||'pic-competition';const output=run(['d1','create',name,'--location','weur','--update-config','false'],true);process.stdout.write(output);id=output.match(/[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}/i)?.[0];config.d1_databases[0].database_name=name;}
   if(!/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(id||''))throw new Error('Could not read the database ID. Copy it from Cloudflare → D1 and run setup again.');
   config.d1_databases[0].database_id=id;writeFileSync('wrangler.jsonc',JSON.stringify(config,null,2)+'\n');
  }
 }
 run(['d1','migrations','apply','DB',local?'--local':'--remote']);
 const answer=(await ask('Create the first host account now? [Y/n]: ')).trim().toLowerCase();
 if(answer!=='n'){const result=spawnSync(process.execPath,['scripts/host-account.mjs',local?'--local':'--remote'],{stdio:'inherit'});if(result.status!==0)throw new Error('Host setup did not finish. Run npm run host:create to retry.');}
 console.log(local?'Local setup ready. Run npm run dev.':'Setup ready. Run npm run deploy to publish. Keep wrangler.jsonc: it now contains your database ID, not your password.');
}catch(e){console.error(e.message);process.exitCode=1;}
