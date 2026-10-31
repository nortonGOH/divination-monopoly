/* Unregistered nickname beginner mode; raw IP and HMAC credentials never leave Edge. */
const BASE=(Deno.env.get('SUPABASE_URL')||'').replace(/\/$/,'');
const SERVICE=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')||'';
const ORIGIN='https://nortongoh.github.io';
const HEADERS={
 'Access-Control-Allow-Origin':ORIGIN,'Access-Control-Allow-Methods':'POST,OPTIONS',
 'Access-Control-Allow-Headers':'apikey,content-type,x-client-info',
 'Content-Type':'application/json','Cache-Control':'no-store','Vary':'Origin'
};
const respond=(data:unknown,status=200)=>new Response(JSON.stringify(data),{status,headers:HEADERS});
async function tokenDigest(token:string){
 const k=await crypto.subtle.importKey('raw',new TextEncoder().encode(SERVICE),
  {name:'HMAC',hash:'SHA-256'},false,['sign']);
 const b=await crypto.subtle.sign('HMAC',k,new TextEncoder().encode('nickname-beginner:v1:'+token));
 return [...new Uint8Array(b)].map(v=>v.toString(16).padStart(2,'0')).join('');
}
Deno.serve(async req=>{
 if(req.method==='OPTIONS')return new Response(null,{status:204,headers:HEADERS});
 if(req.method!=='POST')return respond({error:'Method not allowed'},405);
 if(req.headers.get('origin')!==ORIGIN)return respond({error:'Origin denied'},403);
 if(!BASE||!SERVICE)return respond({error:'Service unavailable'},503);
 if(Number(req.headers.get('content-length')||0)>1600)return respond({error:'Payload too large'},413);
 const ip=(req.headers.get('cf-connecting-ip')||'').trim();
 if(!/^[0-9a-f:.]{2,45}$/i.test(ip)||ip.includes(','))
  return respond({error:'Source IP could not be verified'},503);
 try{
  const data=await req.json();
  if(!data||typeof data!=='object'||Array.isArray(data))return respond({error:'Invalid data'},400);
  const {action,token,nickname,question_id,answer_index}=data;
  if(!['join','status','answer'].includes(action)
    ||typeof token!=='string'||!/^[a-f0-9]{64}$/.test(token))
   return respond({error:'Invalid session'},400);
  if(action==='join'&&(typeof nickname!=='string'||nickname.length<2||nickname.length>18||
    !/^[\p{L}\p{N}_-]+$/u.test(nickname)))
   return respond({error:'Invalid nickname'},400);
  if(action==='answer'&&(typeof question_id!=='string'||question_id.length<1||
    question_id.length>150||!Number.isInteger(answer_index)||
    answer_index<0||answer_index>3))
   return respond({error:'Invalid answer'},400);
  const body={
   p_action:action,p_token_digest:await tokenDigest(token),p_source_ip:ip,
   p_nickname:action==='join'?nickname:null,
   p_question_id:action==='answer'?question_id:null,
   p_answer_index:action==='answer'?answer_index:null
  };
  const res=await fetch(BASE+'/rest/v1/rpc/quiz_nickname_beginner_action',{
   method:'POST',headers:{apikey:SERVICE,Authorization:'Bearer '+SERVICE,
   'Content-Type':'application/json'},body:JSON.stringify(body),cache:'no-store'
  });
  const result=await res.json().catch(()=>({}));
  if(!res.ok){
   if(result?.code==='23505')
    return respond({error:'此暱名已被使用，請更換其他名稱。',code:'nickname_taken'},409);
   if(result?.code==='42501')return respond({error:'中、高階必須註冊會員才能作答'},403);
   console.error('Nickname RPC rejected request',res.status,String(result?.code||'').slice(0,25));
   return respond({error:'暱稱挑戰暫時無法使用'},res.status===400?400:503);
  }
  return respond(result);
 }catch(e){
  console.error('Nickname request error',String(e).slice(0,100));
  return respond({error:'暱稱挑戰暫時無法使用'},503);
 }
});
