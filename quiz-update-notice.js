/* One-time per IP and announcement version, decided on server. */
(()=>{
 'use strict';
 const cfg=window.QUIZ_AUTH_CONFIG||{};
 const base=String(cfg.supabaseUrl||'').replace(/\/$/,'');
 if(!base||!location.pathname.endsWith('/')&&!location.pathname.endsWith('/index.html'))return;
 const dialog=document.createElement('dialog');dialog.id='quizUpdateNoticeDialog';
 dialog.style.cssText='width:min(580px,calc(100vw - 28px));max-height:85dvh;overflow:auto;padding:24px;border:2px solid #b39b6c;border-radius:16px;background:#fffaf0;color:#29362f;box-shadow:0 15px 55px #1117';
 const title=document.createElement('h2');title.textContent='近期題庫更新公告';
 const intro=document.createElement('p');intro.textContent='以下是近 14 日有新增或修訂紀錄的題庫類型與題目數（包含已匯入題目；不等於全是新題）。';
 const list=document.createElement('ul');
 const footer=document.createElement('p');footer.textContent='本訊息在同一來源 IP 對同一版本僅顯示一次。';
 const close=document.createElement('button');close.type='button';close.textContent='知道了，開始挑戰';close.style.cssText='padding:11px 16px;min-height:44px;cursor:pointer';close.addEventListener('click',()=>dialog.close());
 dialog.append(title,intro,list,footer,close);document.body.append(dialog);
 fetch(base+'/functions/v1/quiz-update-notice',{method:'POST',headers:{'Content-Type':'application/json',apikey:String(cfg.publishableKey||'')},body:'{}',cache:'no-store'})
 .then(r=>{if(!r.ok)throw Error('notice');return r.json();})
 .then(data=>{
   if(data.show!==true||!Array.isArray(data.banks)||!data.banks.length)return;
   list.replaceChildren();
   for(const item of data.banks.slice(0,12)){
    const row=document.createElement('li');row.textContent=String(item.name)+'：'+Number(item.changed_count||0)+' 題有新增或修訂紀錄';list.append(row);
   }
   if(!dialog.open)dialog.showModal();
   close.focus();
 }).catch(()=>{});
})();
