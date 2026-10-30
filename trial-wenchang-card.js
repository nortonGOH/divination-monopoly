/* Wenchang rescue: earned points and answer disclosure remain server-owned. */
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
 status.textContent=signedIn?'每答對 1 題可累積 1 點，答錯時可用 1 點解鎖解析；按此查看餘額。':
 '訪客試玩不累積文昌點數；註冊會員答對題目可取得救援點數。';
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
   if(data.credit_source!=='correct_answers')throw Error('新點數制度尚未啟用');
   status.textContent='可用 '+data.credits+' 點｜答對累積 '+data.earned+' 點｜解鎖花費 '+data.spent+' 點。每答對 1 題得 1 點，無定時補點與上限。';
 }catch(error){status.textContent='讀取失敗：'+error.message;}
 finally{button.disabled=false;}
});
window.addEventListener('quiz-member-session-changed',display);
display();
})();
