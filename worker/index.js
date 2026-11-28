const json=(value,status=200)=>new Response(JSON.stringify(value),{status,headers:{'content-type':'application/json; charset=utf-8','cache-control':'no-store'}});
export default {async fetch(request,env){
 const url=new URL(request.url);
 if(Object.hasOwn(PUBLIC_FILES,url.pathname)){if(!['GET','HEAD'].includes(request.method))return new Response('Method not allowed',{status:405});return new Response(request.method==='HEAD'?null:PUBLIC_FILES[url.pathname],{headers:{'content-type':'text/plain; charset=utf-8','cache-control':'no-store','x-content-type-options':'nosniff'}});}
 if(url.pathname==='/source-code.zip'){const bytes=Uint8Array.from(atob(SOURCE_ZIP),c=>c.charCodeAt(0));return new Response(bytes,{headers:{'content-type':'application/zip','content-disposition':'attachment; filename=conclusionsearch-source.zip','cache-control':'public, max-age=300'}});}
 if(url.pathname==='/api/catalog'){try{return json(await getCatalog(env));}catch(error){console.error('catalog read failed');return json({error:'目录暂时不可用'},503);}}
 if(url.pathname==='/api/refresh-status'){try{return json(await refreshStatus(env));}catch{return json({error:'同步状态暂不可用'},503);}}
 if(url.pathname==='/api/refresh')return refreshCatalog(request,env);
 const aliases=await aliasEndpoint(request,env);if(aliases)return aliases;
 if(url.pathname==='/api/counts'){
  if(request.method!=='GET')return json({error:'method_not_allowed'},405);
  try{const result=await env.DB.prepare('SELECT link_id, clicks FROM link_clicks').all();return json({counts:Object.fromEntries(result.results.map(r=>[r.link_id,r.clicks]))});}catch{return json({error:'counts_unavailable'},503);}
 }
 if(url.pathname.startsWith('/go/')){
  const id=url.pathname.slice(4),routes=catalogRoutes((await getCatalog(env)).items),destination=Object.hasOwn(routes,id)?routes[id]:null;
  if(!destination)return new Response('链接不存在',{status:404});
  if(!['GET','HEAD'].includes(request.method))return new Response('Method not allowed',{status:405});
  const prefetch=(request.headers.get('purpose')||'')+' '+(request.headers.get('sec-purpose')||'');
  if(request.method==='GET'&&!prefetch.includes('prefetch')){
   try{await env.DB.prepare('INSERT INTO link_clicks (link_id, clicks) VALUES (?, 1) ON CONFLICT(link_id) DO UPDATE SET clicks = clicks + 1').bind(id).run();}catch(error){console.error('Click counter unavailable');}
  }
  return new Response(null,{status:302,headers:{location:destination,'cache-control':'no-store','referrer-policy':'no-referrer'}});
 }
 if(url.pathname==='/'||url.pathname==='/index.html')return new Response(request.method==='HEAD'?null:HTML,{headers:{'content-type':'text/html; charset=utf-8','cache-control':'no-store, max-age=0','pragma':'no-cache','expires':'0'}});
 return new Response('Not found',{status:404});
},async scheduled(event,env,ctx){ctx.waitUntil(runCatalogRefresh(env));}};
