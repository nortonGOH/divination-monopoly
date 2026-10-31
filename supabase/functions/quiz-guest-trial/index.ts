/* Anonymous five-answer trial. Trusted database RPC owns the atomic allowance. */
const URL_BASE=(Deno.env.get('SUPABASE_URL')||'').replace(/\/$/,'');
const SERVICE_KEY=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')||'';
const ORIGIN='https://nortongoh.github.io';
const responseHeaders={
  'Access-Control-Allow-Origin':ORIGIN,
  'Access-Control-Allow-Methods':'POST,OPTIONS',
  'Access-Control-Allow-Headers':'apikey,content-type,x-client-info',
  'Content-Type':'application/json','Cache-Control':'no-store','Vary':'Origin'
};
const respond=(json:unknown,status=200)=>new Response(JSON.stringify(json),{status,headers:responseHeaders});
const invalidIP=(s:string)=> !/^[0-9a-f:.]{2,45}$/i.test(s)||s.includes(',')||s.includes(' ');
async function hashIP(ip:string){
  const key=await crypto.subtle.importKey('raw',new TextEncoder().encode(SERVICE_KEY),
    {name:'HMAC',hash:'SHA-256'},false,['sign']);
  const digest=await crypto.subtle.sign('HMAC',key,new TextEncoder().encode('quiz-trial-ip:v1:'+ip.toLowerCase()));
  return [...new Uint8Array(digest)].map(x=>x.toString(16).padStart(2,'0')).join('');
}
async function database(rpc:string,payload:Record<string,unknown>){
  const res=await fetch(URL_BASE+'/rest/v1/rpc/'+rpc,{
    method:'POST',headers:{apikey:SERVICE_KEY,Authorization:'Bearer '+SERVICE_KEY,
      'Content-Type':'application/json'},body:JSON.stringify(payload),cache:'no-store'
  });
  const result=await res.json().catch(()=>null);
  if(!res.ok)throw Error(String(result?.message||'Database trial service error'));
  return result;
}
Deno.serve(async req=>{
  if(req.method==='OPTIONS')return new Response(null,{status:204,headers:responseHeaders});
  if(req.method!=='POST')return respond({error:'只接受 POST'},405);
  if(req.headers.get('origin')!==ORIGIN)return respond({error:'不允許此來源'},403);
  if(!URL_BASE||!SERVICE_KEY)return respond({error:'試玩服務尚未完成設定'},503);
  const length=Number(req.headers.get('content-length')||'0');
  if(length>2048)return respond({error:'請求資料過大'},413);
  // Fail closed: do not accept user-submitted IPs or fallback to spoofable XFF.
  // This is a best-effort IP quota, not a guaranteed unique-person identity.
  // Deploy only behind the managed edge that overwrites CF-Connecting-IP.
  const ip=req.headers.get('cf-connecting-ip')?.trim()||'';
  if(invalidIP(ip))return respond({error:'無法確認訪客 IP，請先登入會員再挑戰'},503);
  try{
    const payload=await req.json();
    if(payload===null||typeof payload!=='object'||Array.isArray(payload))return respond({error:'無效請求'},400);
    const identity=await hashIP(ip);
    if(payload.action==='status'){
      return respond(await database('quiz_trial_status',{p_identity:identity}));
    }
    if(payload.action==='answer'){
      const id=payload.question_id;
      const answer=payload.answer_index;
      if(typeof id!=='string'||id.length<1||id.length>150||
         !Number.isInteger(answer)||answer<0||answer>3)
        return respond({error:'題目或選項不正確'},400);
      const result=await database('quiz_trial_submit',{p_identity:identity,
        p_question_id:id,p_answer_index:answer});
      return respond(result);
    }
    return respond({error:'無效試玩操作'},400);
  }catch(error){
    // Never echo raw database SQL, service credentials, or visitor IP.
    console.error('trial backend request failed',String(error).slice(0,160));
    return respond({error:'試玩服務暫時無法使用，請稍後再試或登入會員'},503);
  }
});
