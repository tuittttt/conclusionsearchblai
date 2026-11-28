import fs from 'node:fs';import os from 'node:os';import path from 'node:path';import vm from 'node:vm';import assert from 'node:assert/strict';import {spawnSync}from'node:child_process';
const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'drama-account-test-')),dbFile=path.join(tmp,'db.sqlite');
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
 const first=browser(),second=browser(),other=browser();const credentials={username:'Cloud_User',password:'test-password-123'};
 assert.equal((await call(browser(),'/api/account')).body.user,null);
 let r=await call(first,'/api/account/register',credentials);assert.equal(r.status,200);assert.equal(r.body.user.username,'Cloud_User');const recovery=r.body.recoveryCode;assert.match(recovery,/^[a-f0-9]{64}$/);assert.ok(first.cookie.startsWith('__Host-drama_session='));assert.ok(!JSON.stringify(r.body).includes('password_hash'));
 const row=sql({statements:[{sql:'SELECT * FROM accounts'}]})[0].results[0];assert.notEqual(row.password_hash,credentials.password);assert.notEqual(row.recovery_hash,recovery);assert.equal(row.password_hash.length,64);
 assert.equal((await call(other,'/api/account/register',{...credentials,username:'cloud_user'})).status,409);
 assert.equal((await call(first,'/api/account/favorites',{add:['ceo','agent'],remove:[]})).status,200);
 assert.equal((await call(second,'/api/account/login',{...credentials,password:'wrong-password'})).status,401);
 assert.equal((await call(second,'/api/account/login',{...credentials,username:'CLOUD_USER'})).status,200);assert.deepEqual(new Set((await call(second,'/api/account')).body.favorites),new Set(['ceo','agent']));
 await call(second,'/api/account/favorites',{add:['c-2400'],remove:['agent']});assert.deepEqual(new Set((await call(first,'/api/account')).body.favorites),new Set(['ceo','c-2400']));
 assert.equal((await call(other,'/api/account/register',{username:'Other_User',password:'another-password'})).status,200);assert.deepEqual((await call(other,'/api/account')).body.favorites,[],'accounts isolated');assert.equal((await call(browser(),'/api/account/favorites',{add:['ceo']})).status,401);
 const forged=await worker.fetch(new Request(base+'/api/account/favorites',{method:'POST',headers:{origin:'https://evil.test','content-type':'application/json',cookie:first.cookie},body:JSON.stringify({add:['hacked']})}),env);assert.equal(forged.status,403);
 assert.equal((await call(first,'/api/account/favorites',{add:[{}]})).status,400);assert.equal((await call(first,'/api/account/favorites',{add:['<script>']})).status,400);
 const oldSession=first.cookie;await call(first,'/api/account/logout',{});assert.equal((await call(first,'/api/account')).body.user,null);assert.equal((await call({cookie:oldSession},'/api/account')).body.user,null,'logout revokes old cookie');assert.equal((await call(second,'/api/account')).body.user.username,'Cloud_User');
 const recovered=await call(first,'/api/account/recover',{username:credentials.username,password:'new-test-password',recoveryCode:recovery});assert.equal(recovered.status,200);assert.notEqual(recovered.body.recoveryCode,recovery);assert.equal((await call(second,'/api/account')).body.user,null,'password reset revokes other sessions');assert.equal((await call(browser(),'/api/account/login',credentials)).status,401);assert.equal((await call(browser(),'/api/account/recover',{username:credentials.username,password:'other-password',recoveryCode:recovery})).status,401);assert.ok((await call(first,'/api/account')).body.favorites.includes('ceo'),'reset preserves favorites');
 let last;for(let i=0;i<16;i++)last=await call(browser(),'/api/account/login',{username:'NoSuchUser',password:'not-a-password'});assert.equal(last.status,429);
 console.log('PASS: salted password hashing, secure sessions, cross-browser favorites, account isolation, CSRF validation, logout revocation, recovery rotation and login rate limiting');
 // Frontend guest collection is optional; account data must not leak into guest storage.
 const els={},storage=new Map(),element=()=>({value:'',innerHTML:'',textContent:'',checked:false,setAttribute(){},addEventListener(){},showModal(){this.open=true},close(){this.open=false}});const context={document:{querySelector:k=>els[k]??=element(),querySelectorAll:()=>[],addEventListener(){}},localStorage:{getItem:k=>storage.get(k)||null,setItem:(k,v)=>storage.set(k,v)},fetch:()=>new Promise(()=>{})};vm.createContext(context);vm.runInContext(fs.readFileSync('app.js','utf8'),context);context.guestGroup={members:[{id:'ceo'}]};await vm.runInContext('toggleFavorite(guestGroup)',context);assert.ok(storage.get('drama-favs').includes('ceo'));assert.equal(els['#favorite-login-dialog'].open,true);context.document.querySelector('#favorite-no-remind').checked=true;els['#favorite-continue'].onclick();assert.equal(storage.get('drama-no-login-prompt'),'true');assert.equal(els['#favorite-login-dialog'].open,false);
 const cloud=new Set(['agent']);context.fetch=async(path,options)=>{if(String(path).endsWith('/favorites')){const body=JSON.parse(options.body);for(const id of body.add||[])cloud.add(id);for(const id of body.remove||[])cloud.delete(id);}return {ok:true,json:async()=>({user:{id:'user',username:'Cloud_User'},favorites:[...cloud]})};};
 context.loginResult={user:{id:'user',username:'Cloud_User'},favorites:['agent']};await vm.runInContext('adoptAccount(loginResult,true)',context);assert.deepEqual(new Set(vm.runInContext('saved',context)),new Set(['agent','ceo']));assert.equal(storage.get('drama-favs'),'[]','cloud favorites are not stored as anonymous favorites');assert.equal(els['#logout-account'].hidden,false);await els['#logout-account'].onclick();assert.equal(vm.runInContext('account',context),null);assert.equal(vm.runInContext('saved.length',context),0);assert.ok(cloud.has('ceo'),'logout does not delete cloud favorites');
 await vm.runInContext('adoptAccount(loginResult,false)',context);let finishFavorite;const favoriteGate=new Promise(resolve=>finishFavorite=resolve);context.fetch=async(path)=>{if(String(path).endsWith('/favorites')){await favoriteGate;return {ok:true,json:async()=>({user:{id:'user',username:'Cloud_User'},favorites:['private-favorite']})};}return {ok:true,json:async()=>({user:null,favorites:[]})};};const pendingFavorite=vm.runInContext('toggleFavorite(guestGroup)',context);await els['#logout-account'].onclick();finishFavorite();await pendingFavorite;assert.equal(vm.runInContext('saved.length',context),0,'late save response cannot expose account data after logout');
 const freshEls={},fresh={document:{querySelector:k=>freshEls[k]??=element(),querySelectorAll:()=>[],addEventListener(){}},localStorage:context.localStorage,fetch:()=>new Promise(()=>{})};vm.createContext(fresh);vm.runInContext(fs.readFileSync('app.js','utf8'),fresh);fresh.group={members:[{id:'agent'}]};await vm.runInContext('toggleFavorite(group)',fresh);assert.ok(!freshEls['#favorite-login-dialog']?.open,'never-remind persists across reloads while anonymous favorites still work');
 console.log('PASS: optional guest favorite prompt, never-remind preference, local/cloud union on login, logout UI and anonymous storage isolation');
}finally{fs.rmSync(tmp,{recursive:true,force:true});}
