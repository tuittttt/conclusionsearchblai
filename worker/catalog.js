const SOURCE_NAMES={a:'在云的背面种花',b:'甜度满分小剧院',c:'喵仔的剧集库',d:'风停在第七页 · PageVII'};
const SOURCE_URLS={a:'https://aishort.cloudofflowers.com/',b:'https://www.tdmf.top/',c:'https://mztj666.com/',d:'https://www.pagevii.com/'};
const keyName=s=>String(s||'').normalize('NFKC').toLowerCase().replace(/[’‘]/g,"'").replace(/[\p{P}\p{Z}\s]/gu,'');
function safeURL(raw,base){if(typeof raw!=='string'||!raw.trim())return null;try{const u=new URL(raw,base);return u.protocol==='https:'?u.href:null;}catch{return null;}}
function displayNames(title,en=''){
 title=String(title||'').trim();en=String(en||'').trim();
 if(!en){const m=title.match(/([A-Za-z0-9][A-Za-z0-9\s’'.,!?&:+()\-–—/]*[A-Za-z0-9!?])$/);if(m){en=m[1].trim();if(en.length<4)en='';}}
 let zh=en&&title.endsWith(en)?title.slice(0,-en.length).trim():title;
 zh=zh||title;const aliases=zh.split(/\s*[/／|｜]\s*/).map(s=>s.trim()).filter(s=>s.length>=3);
 return {title:zh,en,aliases:aliases.length>1?aliases:[]};
}
const cleanTags=value=>[...new Set((Array.isArray(value)?value:typeof value==='string'?[value]:[]).filter(t=>typeof t==='string'||typeof t==='number').map(t=>String(t).trim()).filter(Boolean))];
const scoreValue=(score,count)=>Number(count)>0&&Number(score)>=.5&&Number(score)<=5?[Math.round(Number(score)*10)/10,Number(count)]:null;
function preciseTime(value){if(typeof value==='number')return Number.isFinite(value)&&value>0?value:null;if(typeof value==='string'&&value.includes('T')){const n=Date.parse(value);return Number.isFinite(n)?n:null;}return null;}
function flowerSummaryScore(value){const m=String(value||'').match(/评分[：:]\s*(\d+(?:\.\d+)?)\s*\/\s*5\s*[（(]\s*(\d+)\s*条评分/);return m?scoreValue(m[1],m[2]):null;}
async function normalizeFlower(raw,reviews,fetchedAt,previous=[],tagData=null){
 if(!Array.isArray(raw.items))throw Error('目录格式不正确');
 const ratingsReady=Array.isArray(reviews?.reviews)&&reviews.ready;
 const tagsReady=Array.isArray(tagData?.tags)&&Array.isArray(tagData?.options),tagMap=new Map();if(tagsReady)for(const t of tagData.tags){if(typeof t.drama!=='string'||typeof t.tag!=='string'||!(Number(t.count)>0))continue;const key=keyName(t.drama);tagMap.set(key,[...(tagMap.get(key)||[]),t.tag]);}
 const previousTags=new Map(previous.map(r=>[keyName(r.sourceTitle),r.tags||[]]));
 const previousScores=new Map(previous.map(r=>[keyName(r.sourceTitle),r.score]));
 const scores=new Map();for(const r of ratingsReady?reviews.reviews:[]){if(Number(r.rating)<.5||Number(r.rating)>5)continue;const k=keyName(r.drama),s=scores.get(k)||[0,0];s[0]+=Number(r.rating);s[1]++;scores.set(k,s);}
 return Promise.all(raw.items.filter(x=>x.title).map(async (x,sourceOrder)=>{
  const names=displayNames(x.title),legacy=keyName(names.en)===keyName("The CEO's Manservant")?'ceo':keyName(names.en)===keyName('Signed By My Dangerous Agent')?'agent':null;
  const stable=String(x.image||'').match(/[a-f0-9]{8}-[a-f0-9-]{27,}/i)?.[0]||(await digest(x.title)).slice(0,24);
  const id=legacy||'a-'+stable,s=scores.get(keyName(x.title));
  return {id,...names,source:'a',sourceId:String(x.title),sourceTitle:x.title,date:x.date||null,sortAt:preciseTime(x.updated_at)||preciseTime(x.added_at),sourceOrder,type:'AI剧',tags:cleanTags(tagsReady?(tagMap.get(keyName(x.title))||[]):(previousTags.get(keyName(x.title))||[])),cover:safeURL(x.thumbnail||x.image,SOURCE_URLS.a),score:(s?scoreValue(s[0]/s[1],s[1]):null)||flowerSummaryScore(x.rating)||((!ratingsReady||reviews.stale)?previousScores.get(keyName(x.title)):null)||null,url:SOURCE_URLS.a+'drama.html?title='+encodeURIComponent(x.title)+'&drama='+encodeURIComponent(x.title),linkKey:(legacy||id)+'-a',resources:Object.entries(x.links||{}).map(([label,url])=>({label,url:safeURL(url)})).filter(r=>r.url),fetchedAt};
 }));
}
function isSweetLGBT(record){const labels=cleanTags(record.tags).map(t=>t.normalize('NFKC').toUpperCase().replace(/\s/g,''));return !labels.some(t=>['BG','OBG'].includes(t))&&labels.some(t=>['OBL','OGL','BL','GL','LGBT','LGBT+','LGBTQ','LGBTQ+','LGBTQIA+'].includes(t));}
function normalizeSweet(raw,fetchedAt,ratings=null,previous=[]){
 if(!Array.isArray(raw))throw Error('目录格式不正确');
 return raw.filter(x=>!x._deleted&&x.id&&x.title&&isSweetLGBT(x)).map((x,sourceOrder)=>{
  const names=displayNames(x.title,x.enTitle),id='b-'+x.id;const social=ratings&&Object.hasOwn(ratings,String(x.id))?ratings[String(x.id)]:null;const prior=previous.find(r=>r.sourceId===String(x.id))?.score;const score=social?scoreValue(social.rating,social.votes):(!ratings&&prior&&prior[1]>=Number(x.votes||0)?prior:scoreValue(x.rating,x.votes));
  return {id,...names,source:'b',sourceId:String(x.id),sourceTitle:String(x.title),date:x.addedAt||null,sortAt:preciseTime(x.updatedAt)||preciseTime(x.createdAt)||preciseTime(x.addedAt),sourceOrder,type:'',tags:cleanTags([...cleanTags(x.tags),...cleanTags(x.styles),...cleanTags(x.country)]),cover:SOURCE_URLS.b.split('?')[0]+'posters/'+String(x.id).replace(/[^A-Za-z0-9_-]/g,'_')+'.webp',score,url:SOURCE_URLS.b,linkKey:id+'-b',resources:(x.links||[]).map(l=>({label:l.platform||'资源',url:safeURL(l.url)})).filter(r=>r.url),fetchedAt};
 });
}
function normalizeCat(raw,stats,fetchedAt){
 if(!raw.ok||!Array.isArray(raw.items)||!stats.ok||!stats.stats)throw Error('目录或评分格式不正确');
 return raw.items.filter(x=>x.id&&x.name).map((x,sourceOrder)=>{
  const names=displayNames(x.name,x.sub),id='c-'+x.id,legacy=Number(x.id)===2400?'ceo':Number(x.id)===2382?'agent':null,s=stats.stats[String(x.id)];
  const cover=x.posterBlob?SOURCE_URLS.c+'api/poster/'+x.id+'?v='+encodeURIComponent(x.posterVer||'20261119a'):x.posterFile?SOURCE_URLS.c+'posters_tn/'+encodeURIComponent(x.posterFile)+'?v=20261119a':null;
  return {id,...names,source:'c',sourceId:String(x.id),sourceTitle:x.name,date:x.created_at?new Date(x.created_at).toISOString().slice(0,10):null,sortAt:preciseTime(x.updated_at)||preciseTime(x.created_at),sourceOrder,type:{ai:'AI剧',short:'真人短剧',long:'长剧'}[x.type]||x.type||'',tags:cleanTags([x.genre,x.country,x.year,...cleanTags(x.tags)]),cover,score:s?scoreValue(s.avg,s.count):null,url:SOURCE_URLS.c+'?drama='+x.id,linkKey:(legacy||id)+'-c',resources:Object.entries(x.links||{}).filter(([k])=>k!=='pwd').map(([key,url])=>({label:({baidu:'百度网盘',uc:'UC网盘',quark:'夸克网盘',xunlei:'迅雷网盘'})[key]||key,url:safeURL(url)})).filter(r=>r.url),fetchedAt};
 });
}
function normalizePageVII(raw,fetchedAt){
 if(!Array.isArray(raw.dramas))throw Error('目录格式不正确');
 return raw.dramas.filter(x=>x.id&&x.title&&x.published!==false).map((x,sourceOrder)=>{
  const names=displayNames(x.title,x.titleEn),id='d-'+x.id,image=[...(x.portraitImages||[]),...(x.landscapeImages||[]),...(x.images||[])].find(k=>typeof k==='string'&&k);
  return {id,...names,aliases:[...new Set([...names.aliases,...String(x.aliases||'').split(/[,，]/).map(t=>t.trim()).filter(Boolean)])],source:'d',sourceId:String(x.id),sourceTitle:x.title,date:x.publishDate||(preciseTime(x.createdAt)?new Date(x.createdAt).toISOString().slice(0,10):null),sortAt:preciseTime(x.listedAt)||preciseTime(x.createdAt),sourceOrder,type:'',tags:cleanTags([x.category,...cleanTags(x.tags)]),cover:image?SOURCE_URLS.d+'api/media?key='+encodeURIComponent(image):null,score:scoreValue(x.averageRating,x.ratingCount),url:SOURCE_URLS.d,linkKey:id+'-d',resources:Object.entries(x.links||{}).filter(([,l])=>l&&l.status!=='unavailable').map(([key,l])=>({label:({baidu:'百度网盘',quark:'夸克网盘',xunlei:'迅雷网盘',uc:'UC网盘'})[key]||key,url:safeURL(l.url)})).filter(l=>l.url),fetchedAt};
 });
}
function matchCatalog(snapshots){
 const records=['a','b','c','d'].flatMap(s=>snapshots[s]?.records||[]),parents=new Map(records.map(r=>[r.id,r.id])),members=new Map(records.map(r=>[r.id,[r]]));
 function find(id){let p=id;while(parents.get(p)!==p)p=parents.get(p);while(parents.get(id)!==id){const old=parents.get(id);parents.set(id,p);id=old;}return p;}
 function union(a,b,english){const x=find(a),y=find(b);if(x===y)return;const first=members.get(x),second=members.get(y);if(first.some(p=>second.some(q=>p.source===q.source)))return;
  if(!english){const e1=new Set(first.map(r=>keyName(r.en)).filter(Boolean)),e2=new Set(second.map(r=>keyName(r.en)).filter(Boolean));if(e1.size&&e2.size&&![...e1].some(e=>e2.has(e)))return;}
  parents.set(y,x);members.set(x,first.concat(second));members.delete(y);
 }
 for(const english of [true,false]){
  const index=new Map();for(const r of records){const values=english?[r.en]:[r.title,...r.aliases];for(const name of new Set(values.map(keyName).filter(s=>s.length>=(english?6:3)))){if(!index.has(name))index.set(name,[]);index.get(name).push(r);}}
  for(const items of index.values()){if(items.length<2)continue;const counts={};for(const r of items)counts[r.source]=(counts[r.source]||0)+1;if(Object.values(counts).some(n=>n>1))continue;for(let n=1;n<items.length;n++)union(items[0].id,items[n].id,english);}
 }
 return records.map(r=>({...r,autoGroup:find(r.id)}));
}
let liveCatalogCache=null;
async function getCatalog(env,force=false){
 if(!force&&liveCatalogCache&&Date.now()-liveCatalogCache.time<60000)return liveCatalogCache.value;
 const snapshots=structuredClone(SEED);snapshots.d||={records:[],successAt:null};const statuses=await env.DB.prepare('SELECT * FROM source_status').all();
 for(const status of statuses.results){const chunks=await env.DB.prepare('SELECT payload FROM source_snapshots WHERE source=? AND revision=? ORDER BY chunk_index').bind(status.source,status.active_revision).all();snapshots[status.source]={records:chunks.results.length?chunks.results.flatMap(c=>JSON.parse(c.payload)):(snapshots[status.source]?.records||[]),successAt:status.success_at,sourceUpdatedAt:status.source_updated_at,error:status.error,attemptAt:status.attempt_at};}
 // Apply the category policy to existing snapshots as well as new imports.
 snapshots.b.records=snapshots.b.records.filter(isSweetLGBT);
 // Stored snapshots may still contain the retired WorkBuddy address.
 for(const r of snapshots.b?.records||[]){r.url=SOURCE_URLS.b;r.cover=SOURCE_URLS.b+'posters/'+String(r.sourceId).replace(/[^A-Za-z0-9_-]/g,'_')+'.webp';}
 const items=matchCatalog(snapshots),groups=new Set(items.map(r=>r.autoGroup));
 const value={items,meta:{sourceRecordCount:items.length,dramaCount:groups.size,sources:['a','b','c','d'].map(source=>({source,name:SOURCE_NAMES[source],count:snapshots[source]?.records.length||0,successAt:snapshots[source]?.successAt||null,sourceUpdatedAt:snapshots[source]?.sourceUpdatedAt||null,warning:snapshots[source]?.error?.match(/^(评分暂不可用|标签暂不可用)/)?snapshots[source].error:null,error:snapshots[source]?.error?.match(/^(评分暂不可用|标签暂不可用)/)?null:(snapshots[source]?.error||null)})),schedule:null}};
 liveCatalogCache={time:Date.now(),value};return value;
}
function catalogRoutes(items){const routes={'source-a':SOURCE_URLS.a,'source-b':SOURCE_URLS.b,'source-c':SOURCE_URLS.c,'source-d':SOURCE_URLS.d};for(const r of items){routes[r.linkKey]=r.url;r.resources.forEach((link,i)=>routes[r.linkKey+'-resource-'+i]=link.url);}return routes;}
async function fetchSource(url,asText=false,headers={},timeout=20000){const response=await fetch(url,{headers:{accept:asText?'text/html':'application/json',...headers},signal:AbortSignal.timeout(timeout)});if(!response.ok)throw Error('来源返回 HTTP '+response.status);return asText?response.text():response.json();}
async function decodeSweetRatings(raw){if(!raw||typeof raw!=='object')throw Error('评分数据未准备好');if(raw._gz===1){if(typeof raw.d!=='string'||raw.d.length>8*1024*1024)throw Error('评分压缩数据异常');const bytes=Uint8Array.from(atob(raw.d),c=>c.charCodeAt(0));raw=await new Response(new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'))).json();}if(!raw.r||typeof raw.r!=='object'||Array.isArray(raw.r))throw Error('评分格式不正确');return raw.r;}
async function fetchFlowerRatings(){let error='评分数据未准备好';for(const timeout of [20000,35000]){try{const reviews=await fetchSource('https://api.cloudofflower.ccwu.cc/reviews',false,{},timeout);if(Array.isArray(reviews?.reviews)&&reviews.ready)return reviews;error=String(reviews?.error||error);}catch(reason){error=String(reason?.message||'请求失败');}}return {error:error.slice(0,100)};}
async function fetchSourceSnapshot(source,previous=[]){const fetchedAt=new Date().toISOString();
 if(source==='a'){const [raw,reviews,tagData]=await Promise.all([fetchSource(SOURCE_URLS.a+'data.json'),fetchFlowerRatings(),fetchSource('https://api.cloudofflower.ccwu.cc/tags').catch(()=>null)]);const ratingsReady=Array.isArray(reviews?.reviews)&&reviews.ready;return {records:await normalizeFlower(raw,reviews,fetchedAt,previous,tagData),warning:[ratingsReady?(reviews.stale?'评分暂不可用（实时同步）：当前展示原站缓存评分':null):'评分暂不可用（接口）：已使用原站目录评分或保留上次评分'+(reviews?.error?'（'+reviews.error+'）':''),Array.isArray(tagData?.tags)&&Array.isArray(tagData?.options)?null:'标签暂不可用：保留已有标签，接口恢复后自动补充'].filter(Boolean).join('；')||null,successAt:fetchedAt,sourceUpdatedAt:raw.generated};}
 if(source==='b'){const [raw,social]=await Promise.all([fetchSource(SOURCE_URLS.b+'api/select?table=drama_library&id=main'),fetchSource(SOURCE_URLS.b+'api/select?table=drama_library&id=guest_social').then(r=>{if(r.error)throw Error();return decodeSweetRatings(r.data?.data);}).catch(()=>null)]);if(raw.error||!Array.isArray(raw.data?.data))throw Error('来源数据未准备好');return {records:normalizeSweet(raw.data.data,fetchedAt,social,previous),warning:social?null:'评分暂不可用（新评分接口）：已保留可用的历史评分',successAt:fetchedAt,sourceUpdatedAt:raw.data.updated_at};}
 if(source==='d'){const raw=await fetchSource(SOURCE_URLS.d+'api/data');return {records:normalizePageVII(raw,fetchedAt),successAt:fetchedAt,sourceUpdatedAt:null};}
 const [raw,stats]=await Promise.all([fetchSource(SOURCE_URLS.c+'api/dramas'),fetchSource(SOURCE_URLS.c+'api/stats?all=1')]);return {records:normalizeCat(raw,stats,fetchedAt),successAt:fetchedAt,sourceUpdatedAt:null};
}
async function refreshStatus(env){const run=await env.DB.prepare('SELECT * FROM refresh_runs ORDER BY started_at DESC LIMIT 1').first();return {lastRun:run?{startedAt:run.started_at,finishedAt:run.finished_at,status:run.status,summary:run.summary?JSON.parse(run.summary):null}:null,nextAllowedAt:null};}
async function storeSnapshot(env,source,snapshot){const revision=crypto.randomUUID(),statements=[];for(let i=0;i<snapshot.records.length;i+=50)statements.push(env.DB.prepare('INSERT INTO source_snapshots (source,revision,chunk_index,payload) VALUES (?,?,?,?)').bind(source,revision,i/50,JSON.stringify(snapshot.records.slice(i,i+50))));statements.push(env.DB.prepare('INSERT INTO source_status (source,active_revision,success_at,attempt_at,source_updated_at,error) VALUES (?,?,?,?,?,NULL) ON CONFLICT(source) DO UPDATE SET active_revision=excluded.active_revision,success_at=excluded.success_at,attempt_at=excluded.attempt_at,source_updated_at=excluded.source_updated_at,error=NULL').bind(source,revision,snapshot.successAt,snapshot.successAt,snapshot.sourceUpdatedAt));if(snapshot.warning)statements.push(env.DB.prepare('UPDATE source_status SET error=? WHERE source=?').bind(snapshot.warning,source));await env.DB.batch(statements);await env.DB.prepare('DELETE FROM source_snapshots WHERE source=? AND revision<>?').bind(source,revision).run();}
async function refreshCatalog(request,env){
 if(request.method!=='POST')return json({error:'需要 POST'},405);
 // Policy: anonymous same-site visitors may refresh only these fixed public sources, only one refresh may run at a time sitewide.
 const origin=request.headers.get('origin');if(origin!=='https://drama-cross-search.eagertangerine4.chatgpt.site'&&origin!==new URL(request.url).origin)return json({error:'请从本站的更新按钮发起'},403);
 if(!/(?:^|;\s*)drama_visitor=[a-f0-9-]{36}(?:;|$)/.test(request.headers.get('cookie')||''))return json({error:'请先刷新网页再试，以取得访客更新权限'},401);
 return runCatalogRefresh(env);
}
async function runCatalogRefresh(env){
 const now=Date.now(),slot=crypto.randomUUID();
 // Atomic claim across Worker instances; abandoned runs expire after five minutes.
 const lock=await env.DB.prepare("INSERT INTO refresh_runs (slot,started_at,status) SELECT ?,?,'running' WHERE NOT EXISTS (SELECT 1 FROM refresh_runs WHERE status='running' AND started_at>?)").bind(slot,new Date(now).toISOString(),new Date(now-300000).toISOString()).run();
 if(!lock.meta?.changes)return json({status:'already_started',message:'已有更新正在进行，请稍候再试'});
 try{
 const existing=await env.DB.prepare('SELECT source FROM source_status').all();for(const source of ['a','b','c','d'])if(!existing.results.some(r=>r.source===source))await storeSnapshot(env,source,SEED[source]||{records:[],successAt:null,sourceUpdatedAt:null});
 const previousCatalog=await getCatalog(env,true);
 const results=await Promise.allSettled(['a','b','c','d'].map(async source=>{
  const snapshot=await fetchSourceSnapshot(source,previousCatalog.items.filter(r=>r.source===source));const prev=previousCatalog.meta.sources.find(s=>s.source===source);if(!snapshot.records.length||prev.count&&snapshot.records.length<prev.count*.5)throw Error('记录数异常减少，保留旧数据');
  await storeSnapshot(env,source,snapshot);return {source,count:snapshot.records.length,warning:snapshot.warning||null};
 }));
 const summary=[];for(let i=0;i<results.length;i++){const source=['a','b','c','d'][i],r=results[i];if(r.status==='fulfilled')summary.push({...r.value,ok:true});else{const error=String(r.reason?.message||'同步失败').slice(0,180);await env.DB.prepare('UPDATE source_status SET attempt_at=?,error=? WHERE source=?').bind(new Date().toISOString(),error,source).run();summary.push({source,ok:false,error});}}
 const status=summary.every(r=>r.ok)?'succeeded':summary.some(r=>r.ok)?'partial':'failed';await env.DB.prepare('UPDATE refresh_runs SET status=?,finished_at=?,summary=? WHERE slot=?').bind(status,new Date().toISOString(),JSON.stringify(summary),slot).run();liveCatalogCache=null;return json({status,sources:summary,meta:(await getCatalog(env,true)).meta},status==='failed'?502:200);
 }catch(error){await env.DB.prepare("UPDATE refresh_runs SET status='failed',finished_at=? WHERE slot=?").bind(new Date().toISOString(),slot).run();liveCatalogCache=null;throw error;}
}
