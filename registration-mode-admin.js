/* Administrator registration preferences. UI preference does not change Supabase Auth itself. */
(()=>{
 'use strict';
 const toolbar=document.querySelector('#bankDialog .bank-toolbar');
 const cfg=window.QUIZ_AUTH_CONFIG||{};
 const base=String(cfg.supabaseUrl||'').replace(/\/$/,'');
 const key=String(cfg.publishableKey||'');
 if(!toolbar||!base||!key)return;
 const button=document.createElement('button');
 button.type='button';button.className='outline-btn';button.textContent='註冊方式設定';toolbar.append(button);
 const dialog=document.createElement('dialog');
 dialog.className='v8-stats-dialog';
 const h=document.createElement('h2');h.textContent='註冊方式設定（管理員）';
 const note=document.createElement('p');
 note.textContent='此選項只管理網站登記介面。正式阻擋新電子郵件帳號，仍需在 Supabase Authentication 設定「停用新註冊」。既有電子郵件會員登入不受影響。';
 const label=document.createElement('label');
 const checkbox=document.createElement('input');checkbox.type='checkbox';
 label.append(checkbox,' 允許新會員使用電子郵件註冊（網站介面）');
 const status=document.createElement('p');status.setAttribute('role','status');
 const save=document.createElement('button');save.type='button';save.textContent='儲存網站設定';save.disabled=true;
 const close=document.createElement('button');close.type='button';close.textContent='關閉';close.onclick=()=>dialog.close();
 dialog.append(h,note,label,status,save,close);document.body.append(dialog);
 async function rpc(name,body,admin){
  const response=await fetch(base+'/rest/v1/rpc/'+name,{
   method:'POST',headers:{apikey:key,'Content-Type':'application/json',...(admin?{Authorization:'Bearer '+adminAccessToken}:{})},
   body:JSON.stringify(body),cache:'no-store'
  });
  const data=await response.json().catch(()=>null);
  if(!response.ok)throw Error(data?.message||'HTTP '+response.status);
  return data;
 }
 async function load(){
  save.disabled=true;status.textContent='載入設定中…';
  try{
   const result=await rpc('quiz_public_registration_mode',{},false);
   checkbox.checked=result.email_signup_enabled===true;
   status.textContent='已讀取網站設定。注意：此設定不能單獨關閉 Supabase Auth 的註冊 API。';
   save.disabled=false;
  }catch(e){status.textContent='設定尚未部署：'+e.message;}
 }
 save.onclick=async()=>{
  if(!adminAccessToken){status.textContent='管理員登入已失效';return;}
  save.disabled=true;
  try{
   const result=await rpc('quiz_admin_set_registration_mode',{p_enabled:checkbox.checked},true);
   checkbox.checked=result.email_signup_enabled===true;
   status.textContent='網站設定已儲存。請另外確認 Supabase Authentication 端已同步設定，否則不能宣稱註冊已關閉。';
   window.dispatchEvent(new Event('quiz-registration-mode-changed'));
  }catch(e){status.textContent='儲存失敗：'+e.message;}
  finally{save.disabled=false;}
 };
 button.onclick=()=>{if(!adminAccessToken){if(typeof displayBankToast==='function')displayBankToast('請先登入管理員');return;}dialog.showModal();void load();};
})();
