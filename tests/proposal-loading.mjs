import fs from 'node:fs';import vm from 'node:vm';import assert from 'node:assert/strict';
const script=fs.readFileSync('app.js','utf8');
const record={id:'a',source:'a',title:'王子的黑手党骑士',en:'',aliases:[],tags:[],resources:[],date:'2026-11-28',autoGroup:'a',linkKey:'a'};
const proposal={id:'p',kind:'alias',left_id:'a',alias_name:'王骑',reason:'',votes:1,approved:false};
const tick=()=>new Promise(resolve=>setImmediate(resolve));
for(const slow of ['catalog','aliases']){
 const els={},element=()=>({value:'',innerHTML:'',textContent:'',setAttribute(){},addEventListener(){}});let release;const gate=new Promise(r=>release=r);
 const context={document:{querySelector:k=>els[k]??=element(),querySelectorAll:()=>[],addEventListener(){}},localStorage:{getItem:()=>null},fetch:async url=>{const key=String(url).split('/').at(-1);if(key===slow)await gate;return {ok:true,json:async()=>key==='catalog'?{items:[record],meta:{sources:[],sourceRecordCount:1}}:key==='aliases'?{proposals:[proposal],threshold:2}:{counts:{}}};}};
 vm.createContext(context);vm.runInContext(script,context);await tick();
 if(slow==='catalog'){assert.ok(els['#proposal-list'].innerHTML.includes('剧名加载中'));assert.ok(!els['#proposal-list'].innerHTML.includes('未知剧集'));}
 release();await tick();await tick();assert.ok(els['#proposal-list'].innerHTML.includes(record.title),slow+' response order updates proposal names');assert.ok(!els['#proposal-list'].innerHTML.includes('剧名加载中'));assert.ok(!els['#proposal-list'].innerHTML.includes('未知剧集'));
 context.removed={...proposal,left_id:'removed'};vm.runInContext('proposals=[removed];renderProposals()',context);assert.ok(els['#proposal-list'].innerHTML.includes('该记录已不在当前目录'));
}
console.log('PASS: both catalog/proposal response orders resolve names, loading labels and genuinely removed records');
