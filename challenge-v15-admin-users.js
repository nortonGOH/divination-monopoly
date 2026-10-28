/* Administrator member management; all privileges checked by Supabase Edge Function. */
(()=>{
'use strict';
const toolbar=document.querySelector('#bankDialog .bank-toolbar');
const cfg=window.QUIZ_AUTH_CONFIG||{};
const base=String(cfg.supabaseUrl||'').replace(/\/$/,'');
const publicKey=String(cfg.publishableKey||'');
if(!toolbar||!base)return;
const btn=document.createElement('button');btn.type='button';btn.className='outline-btn';btn.textContent='會員帳號管理';toolbar.append(btn);
const dialog=document.createElement('dialog');dialog.className='v8-stats-dialog';dialog.style.width='min(840px,calc(100vw - 24px))';
const title=document.createElement('h3');title.textContent='會員帳號管理（限管理員）';
const note=document.createElement('p');note.textContent='新增帳號採電子郵件邀請，受邀者自行設定密碼。刪除會員將失去登入權限，且可能清除相關挑戰資料，請謹慎操作。';
const form=document.createElement('form');form.style.cssText='display:flex;gap:8px;flex-wrap:wrap;margin:12px 0';
const email=document.createElement('input');email.type='email';email.placeholder='受邀者電子郵件';email.required=true;email.style.cssText='flex:1;min-width:210px;padding:9px;';
const invite=document.createElement('button');invite.textContent='寄送邀請';invite.type='submit';
const close=document.createElement('button');close.textContent='關閉';close.type='button';close.onclick=()=>dialog.close();
form.append(email,invite);
const status=document.createElement('p');status.setAttribute('role','status');
const output=document.createElement('div');dialog.append(title,note,form,status,output,close);document.body.append(dialog);
const call=async body=>{
 if(!adminAccessToken)throw Error('請先登入題庫管理員');
 const r=await fetch(base+'/functions/v1/quiz-admin-users',{method:'POST',headers:{apikey:publicKey,Authorization:'Bearer '+adminAccessToken,'Content-Type':'application/json'},body:JSON.stringify(body)});
 const data=await r.json().catch(()=>({}));
 if(!r.ok)throw Error(data.error||data.message||('HTTP '+r.status));
 return data;
};
async function load(){
 status.textContent='載入會員帳號中…';output.replaceChildren();
 try{
 const data=await call({action:'list'});
 const table=document.createElement('table');table.className='v8-stats-table';
 const head=document.createElement('tr');['電子郵件（僅管理員）','註冊日期','動作'].forEach(t=>{const th=document.createElement('th');th.textContent=t;head.append(th);});
 const thead=document.createElement('thead');thead.append(head);table.append(thead);
 const tbody=document.createElement('tbody');
 for(const account of data.users||[]){
  const tr=document.createElement('tr');
  for(const v of [account.email||'（未提供）',account.created_at?new Date(account.created_at).toLocaleDateString('zh-TW'):'—']){
    const td=document.createElement('td');td.textContent=v;tr.append(td);
  }
  const td=document.createElement('td'),del=document.createElement('button');del.type='button';del.textContent='刪除帳號';
  del.addEventListener('click',async()=>{
   if(!window.confirm('確定刪除帳號 '+account.email+'？此操作可能無法復原，且不會保留挑戰成績。'))return;
   const confirmText=window.prompt('請輸入「刪除」兩個字，以再次確認。');
   if(confirmText!=='刪除')return;
   del.disabled=true;
   try{await call({action:'delete',user_id:account.id});status.textContent='帳號刪除成功。';await load();}
   catch(e){status.textContent='刪除失敗：'+e.message;del.disabled=false;}
  });
  td.append(del);tr.append(td);tbody.append(tr);
 }
 table.append(tbody);output.append(table);status.textContent='會員帳號共 '+(data.users||[]).length+' 個（僅管理員可查詢電子郵件）。';
 }catch(e){status.textContent='帳號查詢失敗：'+e.message;}
}
btn.onclick=()=>{if(!adminAccessToken){displayBankToast('請先完成管理員登入。');return;}dialog.showModal();load();};
form.addEventListener('submit',async e=>{
 e.preventDefault();invite.disabled=true;
 try{const data=await call({action:'invite',email:email.value});status.textContent=data.message||'邀請已寄出';email.value='';await load();}
 catch(err){status.textContent='邀請失敗：'+err.message;}finally{invite.disabled=false;}
});
})();