import fs from 'node:fs';import os from 'node:os';import path from 'node:path';import assert from 'node:assert/strict';import {spawnSync}from'node:child_process';
const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'drama-refresh-test-')),dbFile=path.join(tmp,'db.sqlite');
const python=`import json,sqlite3,sys
p=json.load(open(sys.argv[1]));c=sqlite3.connect(p['file']);c.row_factory=sqlite3.Row
if 'schema' in p:c.executescript(p['schema']);c.commit();print('{}')
else:
 out=[]
 with c:
  for s in p['statements']:
   cur=c.execute(s['sql'],s.get('args',[]));rows=[dict(r) for r in cur.fetchall()] if cur.description else [];out.append({'results':rows,'meta':{'changes':max(0,cur.rowcount)}})
 print(json.dumps(out))`;
function sql(payload){const file=path.join(tmp,'query.json');fs.writeFileSync(file,JSON.stringify({file:dbFile,...payload}));const r=spawnSync('python',['-c',python,file],{stdio:['ignore','pipe','pipe'],encoding:'utf8',timeout:10000,maxBuffer:20*1024*1024});if(r.status!==0)throw Error(r.stderr);return JSON.parse(r.stdout);}
sql({schema:fs.readdirSync('drizzle').filter(p=>p.endsWith('.sql')).sort().map(p=>fs.readFileSync('drizzle/'+p,'utf8').replaceAll('--> statement-breakpoint','')).join('\n')});
class Statement{constructor(sqlText,args=[]){this.sql=sqlText;this.args=args}bind(...args){return new Statement(this.sql,args)}async all(){return sql({statements:[this]})[0]}async first(){return (await this.all()).results[0]||null}async run(){return this.all()}}
const env={DB:{prepare:s=>new Statement(s),batch:async statements=>sql({statements})}};
const workerFile=path.join(tmp,'worker.mjs');fs.copyFileSync('dist/server/index.js',workerFile);const {default:worker}=await import(workerFile);
const seed=JSON.parse(fs.readFileSync('source-seed.json','utf8')),base='https://drama-cross-search.eagertangerine4.chatgpt.site';
let fetchCount=0;const originalFetch=globalThis.fetch;
globalThis.fetch=async url=>{fetchCount++;url=String(url);let body;if(url.endsWith('/data.json'))body={generated:new Date().toISOString(),items:seed.a.records.map(r=>({title:r.sourceTitle,date:r.date,image:r.cover,links:Object.fromEntries(r.resources.map(l=>[l.label,l.url]))}))};else if(url.endsWith('/reviews'))body={ready:true,stale:false,reviews:seed.a.records.flatMap(r=>r.score?Array.from({length:r.score[1]},()=>({drama:r.sourceTitle,rating:r.score[0]})):[])};else if(url.includes('tiandumanfen'))return new Response('source temporarily unavailable',{status:503});else if(url.endsWith('/api/dramas'))body={ok:true,items:seed.c.records.map(r=>({id:r.sourceId,name:r.sourceTitle,sub:r.en,type:r.type,created_at:Date.parse(r.date),posterFile:'test.jpg',links:Object.fromEntries(r.resources.map(l=>[l.label,l.url]))}))};else if(url.endsWith('/api/stats?all=1'))body={ok:true,stats:Object.fromEntries(seed.c.records.filter(r=>r.score).map(r=>[r.sourceId,{avg:r.score[0],count:r.score[1]}]))};else throw Error('Unexpected source URL: '+url);return Response.json(body);};
try{
const call=(path,options={})=>worker.fetch(new Request(base+path,options),env);
assert.equal((await call('/api/refresh',{method:'POST',headers:{origin:base}})).status,401);
assert.equal((await call('/api/refresh',{method:'POST',headers:{origin:'https://other.test'}})).status,403);
const options={method:'POST',headers:{origin:base,cookie:'drama_visitor=11111111-1111-4111-8111-111111111111'}};
let r=await call('/api/refresh',options);assert.equal(r.status,200);const result=await r.json();assert.equal(result.status,'partial');assert.equal(result.sources.find(r=>r.source==='b').ok,false);
const catalog=await (await call('/api/catalog')).json();assert.equal(catalog.items.filter(r=>r.source==='b').length,830);assert.ok(catalog.meta.sources.find(s=>s.source==='b').error);assert.equal(catalog.meta.sourceRecordCount,3716);
const calls=fetchCount;r=await call('/api/refresh',options);assert.equal((await r.json()).status,'already_started');assert.equal(fetchCount,calls);
assert.equal((await call('/go/ceo-c')).headers.get('location'),'https://mztj666.com/?drama=2400');const counts=await (await call('/api/counts')).json();assert.equal(counts.counts['ceo-c'],1);
r=await call('/source-code.zip');const bytes=new Uint8Array(await r.arrayBuffer());assert.equal(bytes[0],0x50);assert.equal(bytes[1],0x4b);
console.log('PASS: authorized same-site refresh, atomic snapshots, failed-source preservation, 3716 records retained, global hourly cooldown, legacy redirect/count, open-source download');
}finally{globalThis.fetch=originalFetch;fs.rmSync(tmp,{recursive:true,force:true});}
