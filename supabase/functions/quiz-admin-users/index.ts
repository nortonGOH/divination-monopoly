// Admin-only Supabase Edge Function: invite/list/delete accounts.
// No service-role key is ever sent to the public web site.
const SUPABASE_URL=Deno.env.get('SUPABASE_URL')||'';
const ADMIN_KEY=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')||'';
const ANON_KEY=Deno.env.get('SUPABASE_ANON_KEY')||'';
const ORIGIN='https://nortongoh.github.io';
const headers={'Access-Control-Allow-Origin':ORIGIN,'Access-Control-Allow-Headers':'authorization,apikey,content-type,x-client-info','Access-Control-Allow-Methods':'POST,OPTIONS','Vary':'Origin','Content-Type':'application/json'};
function reply(data,status=200){return new Response(JSON.stringify(data),{status,headers});}
function fail(message,status){return reply({error:message},status);}
async function api(path,method,auth,body){
 const r=await fetch(SUPABASE_URL+path,{method,headers:{'apikey':ADMIN_KEY,'Authorization':'Bearer '+auth,'Content-Type':'application/json'},body:body?JSON.stringify(body):undefined});
 const data=await r.json().catch(()=>({}));
 if(!r.ok)throw new Error(data.msg||data.message||data.error_description||data.error||'Auth service failed '+r.status);
 return data;
}
Deno.serve(async req=>{
 if(req.method==='OPTIONS')return new Response(null,{status:204,headers});
 if(req.method!=='POST')return fail('只允許 POST',405);
 if(!ADMIN_KEY||!SUPABASE_URL||!ANON_KEY)return fail('伺服器管理憑證尚未設定',503);
 const incoming=req.headers.get('Origin');
 if(incoming&&incoming!==ORIGIN)return fail('不允許此來源',403);
 const authorization=req.headers.get('Authorization')||'';
 const jwt=authorization.startsWith('Bearer ')?authorization.slice(7):'';
 if(!jwt)return fail('請先登入管理員帳號',401);
 try{
   // Validate actual user token with Supabase Auth (not untrusted JWT metadata).
   const check=await fetch(SUPABASE_URL+'/auth/v1/user',{headers:{'apikey':ANON_KEY,Authorization:'Bearer '+jwt}});
   if(!check.ok)return fail('管理員登入狀態已失效',401);
   const me=await check.json();
   if(!me?.id)return fail('無法辨識帳號',401);
   // Restrict administrator privilege to DB-managed quiz_admins, never user_metadata.
   const lookup=await fetch(SUPABASE_URL+'/rest/v1/quiz_admins?select=user_id&user_id=eq.'+encodeURIComponent(me.id),{
     headers:{apikey:ANON_KEY,Authorization:'Bearer '+jwt}});
   if(!lookup.ok)return fail('無法確認管理員權限',403);
   const memberships=await lookup.json();
   if(!Array.isArray(memberships)||memberships.length!==1)return fail('需要題庫管理員權限',403);
   const body=await req.json().catch(()=>({}));
   const action=body.action;
   if(action==='list'){
      const all=[];
      for(let page=1;page<=5;page++){
        const result=await api('/auth/v1/admin/users?page='+page+'&per_page=100','GET',ADMIN_KEY);
        const users=result.users||[];
        all.push(...users.map(u=>({id:u.id,email:u.email||'',created_at:u.created_at,confirmed_at:u.email_confirmed_at||null})));
        if(users.length<100)break;
      }
      return reply({users:all});
   }
   if(action==='invite'){
      const email=String(body.email||'').trim().toLowerCase();
      if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)||email.length>254)return fail('請輸入有效的電子郵件',400);
      // Invitation email lets invitee set password safely.
      await api('/auth/v1/invite','POST',ADMIN_KEY,{email});
      return reply({ok:true,message:'邀請已寄出，由受邀者設定自己的密碼。'});
   }
   if(action==='delete'){
      const target=String(body.user_id||'');
      if(!/^[0-9a-f]{8}-[0-9a-f-]{27,}$/i.test(target))return fail('帳號 ID 不正確',400);
      if(target===me.id)return fail('不可刪除自己的管理員帳號',403);
      const adminCheck=await fetch(SUPABASE_URL+'/rest/v1/quiz_admins?select=user_id&user_id=eq.'+encodeURIComponent(target),{headers:{apikey:ADMIN_KEY,Authorization:'Bearer '+ADMIN_KEY}});
      if(!adminCheck.ok)return fail('無法檢查目標帳號的管理員權限',503);
      const admins=await adminCheck.json();
      if(Array.isArray(admins)&&admins.length)return fail('為避免誤刪，禁止在此刪除管理員帳號',403);
      await api('/auth/v1/admin/users/'+encodeURIComponent(target),'DELETE',ADMIN_KEY);
      return reply({ok:true,message:'帳號已刪除，相關資料將依資料表外鍵設定處理。'});
   }
   return fail('未知管理操作',400);
 }catch(e){return fail(String(e.message||e),400);}
});