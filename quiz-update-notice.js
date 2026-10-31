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
 const message=document.createElement('p');message.style.whiteSpace='pre-wrap';message.style.lineHeight='1.75';
 const close=document.createElement('button');close.type='button';close.textContent='知道了，開始挑戰';close.style.cssText='padding:11px 16px;min-height:44px;cursor:pointer';close.addEventListener('click',()=>dialog.close());
 dialog.append(title,message,intro,list,close);document.body.append(dialog);
 const knowledge=document.createElement('section');knowledge.id='quizPopupKnowledge';knowledge.style.cssText='margin:16px 0;padding:15px;border:1px solid #ccb58d;border-radius:12px;background:#fffdf6';
 const knowledgeTitle=document.createElement('h3');knowledgeTitle.textContent='✦ 今日知識解析卡';
 const knowledgeBody=document.createElement('p');knowledgeBody.style.cssText='line-height:1.8;white-space:pre-line';
 const knowledgeCaution=document.createElement('p');knowledgeCaution.style.fontSize='.84rem';
 const knowledgeSource=document.createElement('p');
 knowledge.append(knowledgeTitle,knowledgeBody,knowledgeCaution,knowledgeSource);
 dialog.insertBefore(knowledge,close);
 const noticeRequest=fetch(base+'/functions/v1/quiz-update-notice',{method:'POST',headers:{'Content-Type':'application/json',apikey:String(cfg.publishableKey||'')},body:'{}',cache:'no-store'})
  .then(r=>{if(!r.ok)throw Error('notice');return r.json();}).catch(()=>({show:false}));
 const ready=Promise.allSettled([noticeRequest,window.quizFeatureVisibilityReady||Promise.resolve(),window.quizDailyKnowledgeReady||Promise.resolve(),window.quizHomepageBlocksReady||Promise.resolve()]);
 ready.then(results=>{
   const data=results[0].status==='fulfilled'?results[0].value:{show:false};
   const showNotice=data?.show===true;
   const canShowCard=window.quizHomepageBlockVisibility?.daily_knowledge_popup!==false;
   const item=canShowCard?window.quizPickDailyKnowledgeForPopup?.():null;
   if(!showNotice&&!item)return;
   title.textContent=showNotice?String(data.title||'近期題庫更新公告'):'每日知識解析卡';
   message.textContent=showNotice?String(data.body||''):'';
   message.hidden=!message.textContent;
   intro.hidden=!showNotice||data.show_banks===false;
   list.hidden=!showNotice||data.show_banks===false;
   list.replaceChildren();
   if(showNotice){for(const bank of (Array.isArray(data.banks)?data.banks:[]).slice(0,12)){
     const row=document.createElement('li');row.textContent=String(bank.name)+'：'+Number(bank.changed_count||0)+' 題有新增或修訂紀錄';list.append(row);
   }}
   knowledge.hidden=!item;
   if(item){
     knowledgeTitle.textContent='✦ '+String(item.title||'今日知識解析卡');
     knowledgeBody.textContent=String(item.content||'').replace(/\s*(題目|正確答案|知識解析)\s*([：:])/g,(_match,label,colon)=>'\n'+label+colon).trim();
     knowledgeCaution.textContent=item.caution?'研究提醒：'+item.caution:'';
     knowledgeSource.replaceChildren();
     const sourceLabels=(item.source||[]).map(source=>String(source?.label||'').trim()).filter(Boolean);
     knowledgeSource.textContent=sourceLabels.length?'資料來源：'+sourceLabels.join('、'):'';
     knowledgeSource.hidden=!sourceLabels.length;
   }
   if(!dialog.open)dialog.showModal();
   close.focus();
 });
})();
