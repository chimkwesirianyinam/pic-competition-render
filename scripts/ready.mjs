import { readFileSync } from 'node:fs';
const config=JSON.parse(readFileSync('wrangler.jsonc','utf8'));
if(config.d1_databases[0].database_id==='00000000-0000-0000-0000-000000000000'){
 console.error('Run npm run setup first to configure your Cloudflare database.');process.exitCode=1;
}
