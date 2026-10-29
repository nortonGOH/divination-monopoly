/* Wenchang rescue: visual card only; credits and answer disclosure remain server-owned. */
(()=>{
'use strict';
const cfg=window.QUIZ_AUTH_CONFIG||{};
const base=String(cfg.supabaseUrl||'').replace(/\/$/,'');
const key=String(cfg.publishableKey||'');
const status=document.getElementById('wenchangCardStatus');
const button=document.getElementById('wenchangCardAction');
if(!status||!button)return;
const member=()=>window.quizMemberToken?.()||'';
function display(){
 const signedIn=Boolean(member());
 status.textContent=signedIn?'答錯後可使用文昌星救援，按下按鈕查看目前剩餘點數。':
 '訪客試玩不消耗救援點數；註冊會員可在答錯後解鎖答案與解析。';
 button.textContent=signedIn?'查看救援餘額':'註冊／登入解鎖救援';
 button.disabled=false;
}
button.addEventListener('click',async()=>{
 const token=member();
 if(!token){
   document.getElementById('playerSignInBtn')?.click();
   return;
 }
 button.disabled=true;
 status.textContent='正在安全讀取會員文昌星救援餘額…';
 try{
   const response=await fetch(base+'/rest/v1/rpc/quiz_wenchang_status',{
     method:'POST',headers:{apikey:key,Authorization:'Bearer '+token,'Content-Type':'application/json'},
     body:'{}',cache:'no-store'
   });
   const data=await response.json().catch(()=>({}));
   if(!response.ok)throw Error(data?.message||'無法查詢');
   status.textContent='可用救援 '+data.credits+'／10 點。每 2 小時補充 3 點；答錯時可選擇是否使用。';
 }catch(error){status.textContent='讀取失敗：'+error.message;}
 finally{button.disabled=false;}
});
window.addEventListener('quiz-member-session-changed',display);
display();
})();
