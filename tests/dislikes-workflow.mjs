import fs from 'node:fs';import os from 'node:os';import path from 'node:path';import vm from 'node:vm';import assert from 'node:assert/strict';import {spawnSync}from'node:child_process';
const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'drama-watchlist-test-')),dbFile=path.join(tmp,'db.sqlite');
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
 const a=browser(),b=browser(),other=browser(),creds={username:'DislikeUser',password:'dislike-password'};
 assert.equal((await call(a,'/api/account/register',creds)).status,200);
 assert.equal((await call(a,'/api/account/dislikes',{add:['ceo','c-2400'],remove:[]})).status,200);
 await call(b,'/api/account/login',creds);
 assert.deepEqual((await call(b,'/api/account')).body.dislikes,['c-2400','ceo']);
 await call(a,'/api/account/favorites',{add:['ceo'],remove:[]});
 assert.deepEqual((await call(a,'/api/account')).body.favorites,['ceo']);
 await call(b,'/api/account/dislikes',{add:[],remove:['ceo']});
 assert.deepEqual((await call(a,'/api/account')).body.dislikes,['c-2400']);
 await call(other,'/api/account/register',{username:'OtherDisliker',password:'other-password'});
 assert.deepEqual((await call(other,'/api/account')).body.dislikes,[]);
 assert.equal((await call(browser(),'/api/account/dislikes',{add:['ceo']})).status,401);
 assert.equal((await call(a,'/api/account/dislikes',{add:['<script>']})).status,400);
 const forged=await worker.fetch(new Request(base+'/api/account/dislikes',{method:'POST',headers:{origin:'https://evil.test','content-type':'application/json',cookie:a.cookie},body:JSON.stringify({add:['ceo']})}),env);assert.equal(forged.status,403);
 await call(a,'/api/account/logout',{});assert.deepEqual((await call(a,'/api/account')).body.dislikes,[]);
 assert.deepEqual((await call(b,'/api/account')).body.dislikes,['c-2400']);
 const els={},storage=new Map([['drama-no-login-prompt','true']]),element=()=>({value:'',innerHTML:'',textContent:'',checked:false,setAttribute(){},addEventListener(){},showModal(){},close(){}});
 const context={document:{querySelector:k=>els[k]??=element(),querySelectorAll:()=>[],addEventListener(){}},localStorage:{getItem:k=>storage.get(k)||null,setItem:(k,v)=>storage.set(k,v)},fetch:()=>new Promise(()=>{})};vm.createContext(context);vm.runInContext(fs.readFileSync('app.js','utf8'),context);
 context.group={id:'a',members:[{id:'a'},{id:'c'}]};await vm.runInContext('toggleDislike(group)',context);assert.deepEqual(JSON.parse(storage.get('drama-dislikes')),['a','c']);await vm.runInContext('toggleDislike(group)',context);assert.deepEqual(JSON.parse(storage.get('drama-dislikes')),[]);
 await vm.runInContext('toggleDislike(group)',context);let cloud=['b'];context.fetch=async(url,options)=>{if(String(url).endsWith('/dislikes')){const body=JSON.parse(options.body);cloud=[...new Set([...cloud,...body.add])].filter(id=>!body.remove.includes(id));}return {ok:true,json:async()=>({user:{id:'cloud',username:'Test'},dislikes:cloud,favorites:[],watchlist:{}})}};
 context.login={user:{id:'cloud',username:'Test'},dislikes:['b'],favorites:[],watchlist:{}};await vm.runInContext('adoptAccount(login,true)',context);assert.deepEqual([...vm.runInContext('disliked',context)].sort(),['a','b','c']);assert.equal(storage.get('drama-dislikes'),'[]');await els['#logout-account'].onclick();assert.ok(vm.runInContext('account!==null',context),'opening confirmation does not log out');await els['#confirm-logout'].onclick();assert.equal(vm.runInContext('disliked.length',context),0);
 console.log('PASS: dislikes sync, cancellation, independent favorites, auth/CSRF/account isolation, guest persistence and login merge/logout privacy');
}finally{fs.rmSync(tmp,{recursive:true,force:true});}
