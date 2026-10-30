// Server-only IP deduplication; never reveal or persist raw IP.
const cors={'Access-Control-Allow-Origin':'https://nortongoh.github.io','Access-Control-Allow-Methods':'POST, OPTIONS','Access-Control-Allow-Headers':'content-type, apikey, authorization','Vary':'Origin'};
Deno.serve(async(req)=>{
 if(req.method==='OPTIONS')return new Response(null,{status:204,headers:cors});
 if(req.method!=='POST')return new Response('Method not allowed',{status:405,headers:cors});
 const origin=req.headers.get('origin')||'';
 if(origin!=='https://nortongoh.github.io')return new Response('Forbidden',{status:403,headers:cors});
 const base=Deno.env.get('SUPABASE_URL')||'';
 const secret=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')||'';
 if(!base||!secret)return new Response('Not configured',{status:503,headers:cors});
 const headers={apikey:secret,Authorization:'Bearer '+secret,'Content-Type':'application/json'};
 const respond=(body,status=200)=>new Response(JSON.stringify(body),{status,headers:{...cors,'Content-Type':'application/json','Cache-Control':'no-store'}});
 try{
  const updates=await fetch(base+'/rest/v1/rpc/quiz_recent_bank_updates',{method:'POST',headers,body:'{}'});
  if(!updates.ok)throw Error('Announcement unavailable');
  const data=await updates.json();
  const configRes=await fetch(base+'/rest/v1/quiz_update_editor_notice?select=published_title,published_body,published_show_banks,is_published,publication_revision&id=eq.1',{headers});
  if(!configRes.ok)throw Error('Notice settings unavailable');
  const config=(await configRes.json())[0]||{};
  const manual=config.is_published===true&&!!config.published_title&&!!config.published_body;
  const banks=Array.isArray(data?.banks)?data.banks:[];
  if(!manual&&(!data?.version||!banks.length))return respond({show:false});
  const version=manual?'admin-'+config.publication_revision:(data.version||'');
  const displayBanks=manual?config.published_show_banks!==false:true;
  // Platform-provided forwarded address. No IP information is sent by the browser.
  const ip=(req.headers.get('cf-connecting-ip')||req.headers.get('x-forwarded-for')?.split(',')[0]||'').trim();
  if(!ip || ip.length>64)return respond({show:false});
  const key=await crypto.subtle.importKey('raw',new TextEncoder().encode(secret),{name:'HMAC',hash:'SHA-256'},false,['sign']);
  const bytes=await crypto.subtle.sign('HMAC',key,new TextEncoder().encode(version+'|'+ip));
  const digest=Array.from(new Uint8Array(bytes),x=>x.toString(16).padStart(2,'0')).join('');
  const seen=await fetch(base+'/rest/v1/rpc/quiz_claim_update_notice',{method:'POST',headers,body:JSON.stringify({p_version:version,p_ip_digest:digest})});
  if(!seen.ok)throw Error('Duplicate-check unavailable');
  return respond({show:await seen.json()===true,days:data.days,banks:displayBanks?banks:[],version,title:manual?config.published_title:'近期題庫更新公告',body:manual?config.published_body:'',show_banks:displayBanks});
 }catch(_){return respond({show:false});}
});
