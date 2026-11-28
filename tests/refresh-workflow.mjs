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
globalThis.fetch=async url=>{fetchCount++;url=String(url);let body;if(url.endsWith('/data.json'))body={generated:new Date().toISOString(),items:seed.a.records.map(r=>({title:r.sourceTitle,date:r.date,image:r.cover,links:Object.fromEntries(r.resources.map(l=>[l.label,l.url]))}))};else if(url.endsWith('/tags'))body={options:[],tags:[]};else if(url.endsWith('/reviews'))body={ready:true,stale:false,reviews:seed.a.records.flatMap(r=>r.score?Array.from({length:r.score[1]},()=>({drama:r.sourceTitle,rating:r.score[0]})):[])};else if(url.includes('www.tdmf.top'))return new Response('source temporarily unavailable',{status:503});else if(url.endsWith('/api/dramas'))body={ok:true,items:seed.c.records.map(r=>({id:r.sourceId,name:r.sourceTitle,sub:r.en,type:r.type,created_at:Date.parse(r.date),posterFile:'test.jpg',links:Object.fromEntries(r.resources.map(l=>[l.label,l.url]))}))};else if(url.endsWith('/api/stats?all=1'))body={ok:true,stats:Object.fromEntries(seed.c.records.filter(r=>r.score).map(r=>[r.sourceId,{avg:r.score[0],count:r.score[1]}]))};else throw Error('Unexpected source URL: '+url);return Response.json(body);};
try{
const call=(path,options={})=>worker.fetch(new Request(base+path,options),env);
assert.equal((await call('/api/refresh',{method:'POST',headers:{origin:base}})).status,401);
assert.equal((await call('/api/refresh',{method:'POST',headers:{origin:'https://other.test'}})).status,403);
const options={method:'POST',headers:{origin:base,cookie:'drama_visitor=11111111-1111-4111-8111-111111111111'}};
let r=await call('/api/refresh',options);assert.equal(r.status,200);const result=await r.json();assert.equal(result.status,'partial');assert.equal(result.sources.find(r=>r.source==='b').ok,false);
const catalog=await (await call('/api/catalog')).json();assert.equal(catalog.items.filter(r=>r.source==='b').length,830);assert.ok(catalog.meta.sources.find(s=>s.source==='b').error);assert.equal(catalog.meta.sourceRecordCount,3716);
let calls=fetchCount;r=await call('/api/refresh',options);assert.equal((await r.json()).status,'partial');assert.ok(fetchCount>calls);
// A claim from another Worker blocks overlap, but abandoned claims expire.
sql({statements:[{sql:"INSERT INTO refresh_runs(slot,started_at,status) VALUES ('other',?,'running')",args:[new Date().toISOString()]}]});
calls=fetchCount;r=await call('/api/refresh',options);assert.equal((await r.json()).status,'already_started');assert.equal(fetchCount,calls);
sql({statements:[{sql:"UPDATE refresh_runs SET started_at=? WHERE slot='other'",args:[new Date(Date.now()-360000).toISOString()]}]});
assert.equal((await (await call('/api/refresh',options)).json()).status,'partial');
assert.equal((await (await call('/api/refresh-status')).json()).nextAllowedAt,null);
// New Sweet origin uses the site's public SQLite API and keeps stable click keys.
const failingSweet=globalThis.fetch;
sql({statements:[{sql:'DELETE FROM refresh_runs'}]});
globalThis.fetch=async url=>String(url)==='https://www.tdmf.top/api/select?table=drama_library&id=main'?Response.json({data:{data:seed.b.records.map(r=>({id:r.sourceId,title:r.sourceTitle,enTitle:r.en,addedAt:r.date,rating:r.score?.[0],votes:r.score?.[1],links:r.resources.map(l=>({platform:l.label,url:l.url}))})),updated_at:'2026-11-25T12:00:00Z'},error:null}):failingSweet(url);
const sweetResult=await (await call('/api/refresh',options)).json();assert.equal(sweetResult.sources.find(s=>s.source==='b').ok,true);assert.equal((await call('/go/'+seed.b.records[0].linkKey)).headers.get('location'),'https://www.tdmf.top/');
const sweetCatalog=await (await call('/api/catalog')).json();assert.ok(sweetCatalog.items.filter(r=>r.source==='b').every(r=>r.cover.startsWith('https://www.tdmf.top/posters/')));
console.log('PASS: migrated Sweet public API, stable redirect keys, new cover origin');
// A ratings outage must not block new catalog entries or erase existing scores.
const scored=catalog.items.find(r=>r.source==='a'&&r.score);assert.ok(scored);
sql({statements:[{sql:'DELETE FROM refresh_runs'}]});
const healthyFetch=globalThis.fetch;
globalThis.fetch=async url=>{if(String(url).endsWith('/reviews'))return Response.json({error:'评价服务暂时不可用'});const response=await healthyFetch(url);if(String(url).endsWith('/data.json')){const body=await response.json();body.items.push({title:'新增回归测试剧 New Regression Drama',date:'2026-11-25'});return Response.json(body);}return response;};
r=await call('/api/refresh',options);const degraded=await r.json();assert.equal(degraded.sources.find(s=>s.source==='a').ok,true);assert.ok(degraded.sources.find(s=>s.source==='a').warning);
const updated=await (await call('/api/catalog')).json();const a=updated.items.filter(r=>r.source==='a');assert.equal(a.length,seed.a.records.length+1);assert.deepEqual(a.find(r=>r.sourceTitle===scored.sourceTitle).score,scored.score);assert.equal(a.find(r=>r.sourceTitle.includes('New Regression Drama')).score,null);assert.ok(updated.meta.sources.find(s=>s.source==='a').warning);assert.equal(updated.meta.sources.find(s=>s.source==='a').error,null);
// Network failures use the same fallback, while recovery replaces old scores.
sql({statements:[{sql:'DELETE FROM refresh_runs'}]});globalThis.fetch=async url=>{if(String(url).endsWith('/reviews'))throw Error('timeout');return healthyFetch(url);};
assert.equal((await (await call('/api/refresh',options)).json()).sources.find(s=>s.source==='a').ok,true);
sql({statements:[{sql:'DELETE FROM refresh_runs'}]});globalThis.fetch=healthyFetch;
assert.equal((await (await call('/api/refresh',options)).json()).sources.find(s=>s.source==='a').warning,null);assert.equal((await (await call('/api/catalog')).json()).meta.sources.find(s=>s.source==='a').warning,null);
console.log('PASS: ratings service errors and network failures preserve scores, new titles sync without fabricated ratings, recovery clears warning');
assert.equal((await call('/go/ceo-c')).headers.get('location'),'https://mztj666.com/?drama=2400');const counts=await (await call('/api/counts')).json();assert.equal(counts.counts['ceo-c'],1);
r=await call('/source-code.zip');const bytes=new Uint8Array(await r.arrayBuffer());assert.equal(bytes[0],0x50);assert.equal(bytes[1],0x4b);
// The fourth source starts without a seed snapshot, then participates in refresh and redirects.
const priorFetch=globalThis.fetch;const pageDrama={id:'page-test',title:'第四来源测试剧',titleEn:'Fourth Source Drama',published:true,publishDate:'2026-11-28',listedAt:1795839875628,category:'奇幻',tags:['甜宠'],portraitImages:['cover-id'],averageRating:4.5,ratingCount:2,links:{baidu:{url:'https://pan.baidu.com/s/test',status:'available'},quark:{url:'https://pan.quark.cn/s/expired',status:'unavailable'}}};
globalThis.fetch=async url=>String(url)==='https://www.pagevii.com/api/data'?Response.json({dramas:[pageDrama,{...pageDrama,id:'draft',published:false}]}):priorFetch(url);
const pageResult=await (await call('/api/refresh',options)).json();assert.equal(pageResult.sources.find(s=>s.source==='d').ok,true);
const pageCatalog=await (await call('/api/catalog')).json();const pageRecord=pageCatalog.items.find(r=>r.source==='d');assert.equal(pageCatalog.meta.sources.find(s=>s.source==='d').count,1);assert.deepEqual(pageRecord.score,[4.5,2]);assert.deepEqual(pageRecord.tags,['奇幻','甜宠']);assert.equal(pageRecord.resources.length,1);assert.equal(pageRecord.cover,'https://www.pagevii.com/api/media?key=cover-id');assert.equal((await call('/go/'+pageRecord.linkKey)).headers.get('location'),'https://www.pagevii.com/');assert.equal((await call('/go/'+pageRecord.linkKey+'-resource-0')).headers.get('location'),'https://pan.baidu.com/s/test');
globalThis.fetch=async url=>String(url)==='https://www.pagevii.com/api/data'?Response.json({dramas:[]}):priorFetch(url);
assert.equal((await (await call('/api/refresh',options)).json()).sources.find(s=>s.source==='d').ok,false);assert.equal((await (await call('/api/catalog')).json()).items.filter(r=>r.source==='d').length,1);
console.log('PASS: fourth source without seed, public catalog/ratings/tags/media/resources, draft and invalid link exclusion, stable redirects, failed update preservation');
console.log('PASS: authorized same-site refresh, atomic snapshots, failed-source preservation, 3716 records retained, immediate repeat refresh, overlap lock and stale-lock recovery, legacy redirect/count, open-source download');
}finally{globalThis.fetch=originalFetch;fs.rmSync(tmp,{recursive:true,force:true});}
