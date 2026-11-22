import fs from 'node:fs';import path from 'node:path';import {spawnSync} from 'node:child_process';
const cli=path.resolve('node_modules/wrangler/bin/wrangler.js');
function run(args,capture=false){const r=spawnSync(process.execPath,[cli,...args],{encoding:'utf8',stdio:capture?['inherit','pipe','pipe']:'inherit'});if(r.error||r.status!==0){if(capture)console.error(r.stderr||r.stdout);throw Error('Cloudflare command failed: '+args.join(' '));}return r.stdout||'';}
if(!fs.existsSync('dist/server/index.js'))throw Error('先执行 npm run build');
run(['deploy']);
const config=JSON.parse(fs.readFileSync('wrangler.jsonc','utf8'));
if(!config.d1_databases[0].database_id){
 const databases=JSON.parse(run(['d1','list','--json'],true));const database=databases.find(d=>d.name===config.d1_databases[0].database_name);
 if(!database)throw Error('无法找到新建数据库，请在 Cloudflare 确认数据库名称后再运行部署。');
 config.d1_databases[0].database_id=database.uuid||database.id;fs.writeFileSync('wrangler.jsonc',JSON.stringify(config,null,2)+'\n');
}
run(['d1','migrations','apply','DB','--remote']);
console.log('Cloudflare Worker 和数据库已就绪；普通 Cron 每6小时更新，不调用 AI。');
