import fs from 'node:fs';import os from 'node:os';import path from 'node:path';import vm from 'node:vm';import assert from 'node:assert/strict';import {spawnSync}from'node:child_process';
const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'drama-alias-test-')),dbFile=path.join(tmp,'db.sqlite');
const python=`import json,sqlite3,sys
p=json.load(open(sys.argv[1]))
c=sqlite3.connect(p['file']);c.row_factory=sqlite3.Row
if 'schema' in p:
 c.executescript(p['schema']);c.commit();print('{}')
else:
 out=[]
 with c:
  for s in p['statements']:
   cur=c.execute(s['sql'],s.get('args',[]));rows=[dict(r) for r in cur.fetchall()] if cur.description else []
   out.append({'results':rows})
 print(json.dumps(out))`;
function sql(payload){const payloadFile=path.join(tmp,'query.json');fs.writeFileSync(payloadFile,JSON.stringify({file:dbFile,...payload}));const r=spawnSync('python',['-c',python,payloadFile],{stdio:['ignore','pipe','pipe'],encoding:'utf8',timeout:10000});if(r.status!==0)throw Error(r.stderr);return JSON.parse(r.stdout);}
sql({schema:fs.readdirSync('drizzle').filter(p=>p.endsWith('.sql')).sort().map(p=>fs.readFileSync('drizzle/'+p,'utf8').replaceAll('--> statement-breakpoint','')).join('\n')});
class Statement{constructor(sqlText,args=[]){this.sql=sqlText;this.args=args;}bind(...args){return new Statement(this.sql,args)}async all(){return sql({statements:[this]})[0]}async first(){return (await this.all()).results[0]||null}async run(){return this.all()}}
const env={DB:{prepare:s=>new Statement(s),batch:async statements=>sql({statements})}};
const src=fs.readFileSync('dist/server/index.js','utf8');const workerFile=path.join(tmp,'worker.mjs');fs.writeFileSync(workerFile,src);const {default:worker}=await import(workerFile);
const base='https://drama-cross-search.eagertangerine4.chatgpt.site';
const browser=()=>({cookie:''});
async function call(who,url,body){const headers={origin:base};if(who.cookie)headers.cookie=who.cookie;if(body)headers['content-type']='application/json';const r=await worker.fetch(new Request(base+url,{method:body?'POST':'GET',headers,body:body?JSON.stringify(body):undefined}),env);const set=r.headers.get('set-cookie');if(set)who.cookie=set.split(';')[0];return {status:r.status,body:await r.json()};}
try{
const one=browser();await call(one,'/api/aliases');
let r=await call(one,'/api/aliases',{kind:'alias',left_id:'ceo',alias_name:'测试：总裁男仆新译名'});assert.equal(r.status,200);let proposal=r.body.proposals[0];const aliasId=proposal.id;assert.equal(proposal.votes,1);assert.equal(proposal.approved,false);
for(let i=0;i<3;i++)r=await call(one,'/api/aliases/vote',{id:aliasId});assert.equal(r.body.proposals[0].votes,1,'same browser deduplicated');
const atOne=r.body.proposals;
r=await call(browser(),'/api/aliases/vote',{id:aliasId});assert.equal(r.body.proposals[0].votes,2);assert.equal(r.body.proposals[0].approved,true,'two approves');const approvedAlias=r.body.proposals;
const duplicate=await call(one,'/api/aliases',{kind:'alias',left_id:'ceo',alias_name:'测试：总裁男仆新译名',reason:'再次提交相同的译名不得创建新提议。'});assert.equal(duplicate.body.proposals.length,1);assert.equal(duplicate.body.proposals[0].votes,2);
r=await call(one,'/api/aliases',{kind:'merge',left_id:'ceo',right_id:'agent',reason:'同剧'});const merge=r.body.proposals.find(p=>p.kind==='merge');
await call(one,'/api/aliases',{kind:'merge',left_id:'agent',right_id:'ceo',reason:'反向选择应复用同一条合并提议。'});
for(let i=0;i<1;i++)r=await call(browser(),'/api/aliases/vote',{id:merge.id});assert.equal(r.body.proposals.filter(p=>p.kind==='merge').length,1);assert.equal(r.body.proposals.find(p=>p.id===merge.id).approved,true);
assert.equal((await call(one,'/api/aliases',{kind:'merge',left_id:'ceo',right_id:'ceo',reason:'不能与自己合并同一条剧集记录。'})).status,400);
assert.equal((await call(one,'/api/aliases',{kind:'alias',left_id:'ceo',alias_name:'与我的危险经纪人签约',reason:'已经存在的另一条记录应该走合并。'})).status,409);
assert.equal((await call(one,'/api/aliases',{kind:'alias',left_id:'missing',alias_name:'some name',reason:'不存在的记录不能被用户提交合并。'})).status,400);
assert.equal((await call(browser(),'/api/aliases',{kind:'merge',left_id:'ceo',right_id:'agent',reason:'长'.repeat(501)})).status,400);
const forged=await worker.fetch(new Request(base+'/api/aliases',{method:'POST',headers:{origin:'https://evil.test','content-type':'application/json'},body:'{}'}),env);assert.equal(forged.status,403);
const els={};const element=()=>({value:'',innerHTML:'',textContent:'',setAttribute(){},addEventListener(){}});const context={document:{querySelector:k=>els[k]??=(element()),querySelectorAll:()=>[],addEventListener(){}},localStorage:{getItem:()=>null},fetch:()=>new Promise(()=>{})};vm.createContext(context);vm.runInContext(fs.readFileSync('app.js','utf8'),context);context.fixtureRecords=JSON.parse(fs.readFileSync('catalog.json','utf8')).filter(r=>['ceo','agent','c-2400','c-2382'].includes(r.id));vm.runInContext('data=fixtureRecords',context);
context.fixture=atOne;vm.runInContext('proposals=fixture;render()',context);assert.ok(els['#result'].innerHTML.includes('本剧的别名 / 合并提议'));assert.ok(els['#result'].innerHTML.includes('data-vote='));
context.fixture=atOne;vm.runInContext('proposals=fixture',context);assert.equal(vm.runInContext('groupedCatalog().find(g=>g.members.some(m=>m.id==="ceo")).aliases.includes("测试:总裁男仆新译名")',context),false);
context.pendingMerge=merge;vm.runInContext('proposals=[pendingMerge]',context);assert.equal(vm.runInContext('groupedCatalog().filter(g=>proposalsFor(g).includes("data-vote=")).length',context),2);assert.equal(vm.runInContext('proposalsFor({members:[{id:"unrelated"}]})',context),'');
context.fixture=approvedAlias;vm.runInContext('proposals=fixture',context);assert.equal(vm.runInContext('groupedCatalog().find(g=>g.members.some(m=>m.id==="ceo")).aliases.includes("测试:总裁男仆新译名")',context),true);
context.fixture=r.body.proposals;vm.runInContext('proposals=fixture',context);const groups=vm.runInContext('groupedCatalog()',context);assert.equal(groups.length,1);assert.equal(groups[0].members.length,4);assert.ok(groups[0].aliases.includes('与我的危险经纪人签约'));
vm.runInContext('render()',context);assert.ok(!els['#result'].innerHTML.includes('drama-proposals'),'approved proposals hidden while merged records remain');assert.ok(els['#result'].innerHTML.includes('/go/ceo-c'));assert.ok(els['#result'].innerHTML.includes('/go/agent-c'));assert.ok(els['#result'].innerHTML.includes('157 人评分'));assert.ok(els['#result'].innerHTML.includes('27 人评分'));
els['#q'].value='测试：总裁男仆新译名';vm.runInContext('render()',context);assert.ok(els['#result'].innerHTML.includes('总裁的男仆'));
assert.equal(vm.runInContext('esc("<img src=x onerror=alert(1)>")',context),'&lt;img src=x onerror=alert(1)&gt;');
console.log('PASS: SQLite migrations, 1/2 threshold, browser deduplication, proposal deduplication, reverse merge, validation, same-origin, approved alias search, non-destructive grouping, scores/links retained, escaping');
}finally{fs.rmSync(tmp,{recursive:true,force:true});}
