const APPROVAL_THRESHOLD=2;
const normalizeName=s=>s.normalize('NFKC').replace(/[’‘]/g,"'").replace(/\s+/g,' ').trim().toLowerCase();
const digest=async value=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(value))),b=>b.toString(16).padStart(2,'0')).join('');
async function aliasEndpoint(request,env){
 const path=new URL(request.url).pathname;
 if(!['/api/aliases','/api/aliases/vote'].includes(path))return null;
 const CATALOG=(await getCatalog(env)).items;
 const cookies=request.headers.get('cookie')||'';
 const match=cookies.match(/(?:^|;\s*)drama_visitor=([a-f0-9-]{36})(?:;|$)/);
 const visitor=match?.[1]||crypto.randomUUID();
 const voter=await digest(visitor);
 const reply=(body,status=200)=>{const response=json(body,status);response.headers.set('set-cookie',`drama_visitor=${visitor}; Path=/; Max-Age=31536000; HttpOnly; Secure; SameSite=Lax`);return response;};
 const read=async()=>{const result=await env.DB.prepare(`SELECT p.id,CASE WHEN p.separate=1 THEN 'split' ELSE p.kind END AS kind,p.left_id,p.right_id,p.alias_name,p.reason,p.created_at,COUNT(v.voter_hash) AS votes,MAX(CASE WHEN v.voter_hash = ? THEN 1 ELSE 0 END) AS supported FROM alias_proposals p LEFT JOIN alias_votes v ON v.proposal_id=p.id GROUP BY p.id ORDER BY p.created_at DESC,p.id LIMIT 2000`).bind(voter).all();return result.results.map(r=>({...r,supported:!!r.supported,approved:r.votes>=APPROVAL_THRESHOLD}));};
 try{
  if(request.method==='GET'&&path==='/api/aliases')return reply({proposals:await read(),threshold:APPROVAL_THRESHOLD});
  if(request.method!=='POST')return reply({error:'不支持的请求方式'},405);
  const origin=request.headers.get('origin');
  if(origin!=='https://drama-cross-search.eagertangerine4.chatgpt.site'&&origin!==new URL(request.url).origin)return reply({error:'请从本站提交'},403);
  if(!(request.headers.get('content-type')||'').startsWith('application/json'))return reply({error:'需要 JSON 请求'},415);
  if(Number(request.headers.get('content-length')||0)>4096)return reply({error:'内容过长'},413);
  const raw=await request.text();if(raw.length>4096)return reply({error:'内容过长'},413);
  let body;try{body=JSON.parse(raw);}catch{return reply({error:'请求格式不正确'},400);}
  if(!body||typeof body!=='object')return reply({error:'请求格式不正确'},400);
  const now=Date.now();
  const recent=await env.DB.prepare('SELECT COUNT(*) AS n FROM alias_votes WHERE voter_hash=? AND created_at>?').bind(voter,now-3600000).first();
  if(recent.n>=40)return reply({error:'本浏览器支持次数过多，请稍后再试'},429);
  if(path==='/api/aliases/vote'){
   if(typeof body.id!=='string'||!/^[a-f0-9]{64}$/.test(body.id))return reply({error:'提议不存在'},404);
   const p=await env.DB.prepare('SELECT id FROM alias_proposals WHERE id=?').bind(body.id).first();if(!p)return reply({error:'提议不存在'},404);
   await env.DB.prepare('INSERT OR IGNORE INTO alias_votes (proposal_id,voter_hash,created_at) VALUES (?,?,?)').bind(body.id,voter,now).run();
  }else{
   const {kind,left_id,right_id}=body;
   if(!['alias','merge','split'].includes(kind)||!CATALOG.some(d=>d.id===left_id))return reply({error:'请选择有效的剧集'},400);
   const reason=typeof body.reason==='string'?body.reason.trim():'';
   if(reason.length>500)return reply({error:'依据最多填写 500 字'},400);
   let left=left_id,right=null,alias=null,key;
   if(kind==='merge'||kind==='split'){
    if(left_id===right_id||!CATALOG.some(d=>d.id===right_id)||(kind==='merge'&&CATALOG.find(d=>d.id===left_id)?.autoGroup===CATALOG.find(d=>d.id===right_id)?.autoGroup))return reply({error:'请选择另一条不同的剧集记录'},400);
    [left,right]=[left_id,right_id].sort();key=`${kind}:${left}:${right}`;
   }else{
    alias=typeof body.alias_name==='string'?body.alias_name.normalize('NFKC').replace(/\s+/g,' ').trim():'';
    if(alias.length<2||alias.length>120||/[\u0000-\u001f\u007f]/.test(alias))return reply({error:'别名应为 2～120 个字符'},400);
    const normalized=normalizeName(alias);
    const known=CATALOG.find(d=>[d.title,d.en,...d.aliases].some(n=>normalizeName(n)===normalized));
    if(known)return reply({error:known.autoGroup===CATALOG.find(d=>d.id===left)?.autoGroup?'这个名字已经收录':'这个名字属于已收录的记录，请选择“合并两条记录”'},409);
    key=`alias:${left}:${normalized}`;
   }
   const created=await env.DB.prepare('SELECT COUNT(*) AS n FROM alias_proposals WHERE created_by=? AND created_at>?').bind(voter,now-3600000).first();
   if(created.n>=10)return reply({error:'本浏览器提议过多，请稍后再试'},429);
   const id=await digest(key);
   const existing=await env.DB.prepare('SELECT id FROM alias_proposals WHERE id=?').bind(id).first();
   if(!existing){const total=await env.DB.prepare('SELECT COUNT(*) AS n FROM alias_proposals').first();if(total.n>=2000)return reply({error:'提议列表暂时已满'},429);}
   await env.DB.batch([
    env.DB.prepare('INSERT OR IGNORE INTO alias_proposals (id,kind,left_id,right_id,alias_name,reason,created_by,created_at,separate) VALUES (?,?,?,?,?,?,?,?,?)').bind(id,kind==='split'?'merge':kind,left,right,alias,reason,voter,now,kind==='split'?1:0),
    env.DB.prepare('INSERT OR IGNORE INTO alias_votes (proposal_id,voter_hash,created_at) VALUES (?,?,?)').bind(id,voter,now)
   ]);
  }
  return reply({proposals:await read(),threshold:APPROVAL_THRESHOLD});
 }catch(error){console.error('Alias service failure',error.message);return reply({error:'别名服务暂时不可用，请稍后重试'},503);}
}
