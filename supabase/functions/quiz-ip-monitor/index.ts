/* Trusted-edge IP collector. Deploy with verify_jwt=false after SQL staging tests. */
const BASE=(Deno.env.get('SUPABASE_URL')||'').replace(/\/$/,'');
const SECRET=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')||'';
const ORIGIN='https://nortongoh.github.io';
const HEADERS={
 'Access-Control-Allow-Origin':ORIGIN,
 'Access-Control-Allow-Methods':'POST,OPTIONS',
 'Access-Control-Allow-Headers':'apikey,content-type,x-client-info',
 'Content-Type':'application/json','Cache-Control':'no-store','Vary':'Origin'
};
function reply(payload:unknown,status=200){
 return new Response(JSON.stringify(payload),{status,headers:HEADERS});
}
async function rpc(name:string,body:Record<string,unknown>){
 const result=await fetch(BASE+'/rest/v1/rpc/'+name,{
  method:'POST',headers:{apikey:SECRET,Authorization:'Bearer '+SECRET,
  'Content-Type':'application/json'},body:JSON.stringify(body),cache:'no-store'
 });
 if(!result.ok)throw Error('Backend RPC unavailable: '+result.status);
 return await result.json().catch(()=>null);
}
Deno.serve(async req=>{
 if(req.method==='OPTIONS')return new Response(null,{status:204,headers:HEADERS});
 if(req.method!=='POST')return reply({error:'Method not allowed'},405);
 if(req.headers.get('origin')!==ORIGIN)return reply({error:'Origin denied'},403);
 if(!BASE||!SECRET)return reply({error:'Backend not configured'},503);
 if(Number(req.headers.get('content-length')||0)>1200)return reply({error:'Too large'},413);
 // Trust only the provider-overwritten edge IP header, never browser payload/XFF.
 const ip=(req.headers.get('cf-connecting-ip')||'').trim();
 if(!/^[0-9a-f:.]{2,45}$/i.test(ip)||ip.includes(','))
  return reply({error:'Cannot establish source IP'},503);
 try{
  const body=await req.json();
  if(!body||typeof body!=='object'||Array.isArray(body))return reply({error:'Invalid payload'},400);
  const {kind,page,source,target=''}=body;
  if(!['view','click'].includes(kind)||!['home','atlas'].includes(page)
    ||!['direct','search','social','referral','internal','unknown'].includes(source)
    ||typeof target!=='string'||!/^[-a-z0-9_:.]{0,80}$/i.test(target))
   return reply({error:'Invalid dimensions'},400);
  const result=await rpc('quiz_ip_monitor_record',{
   p_ip:ip,p_kind:kind,p_page:page,p_source:source,p_target:target
  });
  if(result?.blocked)return reply({blocked:true,error:'IP access restricted'},403);
  if(result?.rate_limited)return reply({rate_limited:true},429);
  if(!result?.recorded)return reply({error:'Monitoring unavailable'},503);
  if(kind==='view')await rpc('quiz_track_page_view',{p_page:page,p_source:source});
  return reply({ok:true});
 }catch(e){
  console.error('IP monitor backend error',String(e).slice(0,120));
  return reply({error:'Monitoring temporarily unavailable'},503);
 }
});
