/* Top-five leaderboard for every registered Auth account; never display emails or user IDs. */
(() => {
'use strict';
const box=document.createElement('section');box.className='challenge-leaderboard';box.setAttribute('aria-label','挑戰者排行榜');
const style=document.createElement('style');
style.textContent=`
 .challenge-leaderboard{margin:16px 0;padding:18px;background:#fffaf0;border:1px solid #d8caaf;border-radius:14px;box-shadow:0 5px 19px #37352c0b}
 .challenge-leaderboard h2{margin:0;font-size:1.15rem;color:#24353c}
 .challenge-leaderboard .board-head{display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:8px}
 .challenge-leaderboard .board-head button{font:inherit;font-size:.8rem;padding:7px 11px;background:#fdf6e8;border:1px solid #c5af87;border-radius:8px;cursor:pointer}
 .challenge-leaderboard table{width:100%;border-collapse:collapse;margin-top:12px;font-size:.87rem}
 .challenge-leaderboard td,.challenge-leaderboard th{text-align:left;padding:9px 7px;border-bottom:1px solid #e7d7c0}
 .challenge-leaderboard .leaderboard-note{color:#6a645a;font-size:.8rem;line-height:1.6}
`;
document.head.append(style);
const head=document.createElement('div');head.className='board-head';
const title=document.createElement('h2');title.textContent='挑戰者排行榜';
const reload=document.createElement('button');reload.type='button';reload.textContent='更新排行';
head.append(title,reload);
const description=document.createElement('p');description.className='leaderboard-note';
description.textContent='所有註冊會員自動參與，依累計答對數排序。僅展示前五名的暱稱及成績，不公開電子郵件。';
const status=document.createElement('p');status.setAttribute('role','status');status.className='leaderboard-note';
status.textContent='正在載入排行榜…';box.append(head,description,status);
const layout=document.querySelector('.information')||document.querySelector('main');
layout?.append(box);
const cfg=window.QUIZ_AUTH_CONFIG||{};
const url=String(cfg.supabaseUrl||'').replace(/\/$/,'');
const key=String(cfg.publishableKey||'');
async function load(){
 if(!url||!key){status.textContent='尚未連接 Supabase。';return;}
 reload.disabled=true;status.textContent='正在更新排行榜…';
 try{
   const r=await fetch(url+'/rest/v1/rpc/quiz_public_leaderboard',{
      method:'POST',headers:{'apikey':key,'Content-Type':'application/json'},
      body:'{}',cache:'no-store'
   });
   const payload=await r.json().catch(()=>({}));
   if(!r.ok)throw Error(payload.message||payload.error||('HTTP '+r.status));
   if(!Array.isArray(payload))throw Error('排行榜格式錯誤');
   const countResponse=await fetch(url+'/rest/v1/rpc/quiz_public_registration_count',{method:'POST',headers:{'apikey':key,'Content-Type':'application/json'},body:'{}',cache:'no-store'});
   const countData=await countResponse.json().catch(()=>({}));
   if(!countResponse.ok||!Number.isInteger(Number(countData.registered_count)))throw Error('註冊人數讀取失敗');
   const memberCount=Number(countData.registered_count);
   box.querySelector('table')?.remove();
   if(!payload.length){status.textContent='註冊人數 '+memberCount+' 人，目前尚無排行。';return;}
   status.textContent='註冊人數 '+memberCount+' 人｜顯示排行榜前 '+Math.min(5,payload.length)+' 名';
   const table=document.createElement('table');
   const thead=document.createElement('thead'),tr=document.createElement('tr');
   ['名次','暱稱','參戰','答對','成功率'].forEach(x=>{const th=document.createElement('th');th.textContent=x;tr.append(th);});
   thead.append(tr);table.append(thead);
   const tbody=document.createElement('tbody');
   for(const p of payload.slice(0,5)){
     const row=document.createElement('tr');
     [p.position,p.nickname,p.total_attempts,p.correct_attempts,(Number(p.success_rate)||0).toFixed(1)+'%'].forEach(x=>{
       const td=document.createElement('td');td.textContent=String(x??'');row.append(td);
     });tbody.append(row);
   }
   table.append(tbody);box.append(table);
 }catch(e){
   box.querySelector('table')?.remove();
   status.textContent='排行榜尚未就緒：'+e.message+'。請檢查是否已執行最新排行榜 SQL。';
 }finally{reload.disabled=false;}
}
reload.addEventListener('click',load);
window.addEventListener('quiz-leaderboard-refresh',load);
load();
})();