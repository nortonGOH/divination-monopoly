/* Page and button-click monitoring. IP is never read or submitted by this script. */
(()=>{
 'use strict';
 const cfg=window.QUIZ_AUTH_CONFIG||{};
 const base=String(cfg.supabaseUrl||'').replace(/\/$/,'');
 const key=String(cfg.publishableKey||'');
 if(!base||!key)return;
 const page=location.pathname.endsWith('/mansions-atlas.html')?'atlas':'home';
 let source='direct';
 try{
  const query=new URLSearchParams(location.search);
  const campaign=(query.get('utm_source')||'').toLowerCase().slice(0,100);
  const ref=document.referrer?new URL(document.referrer):null;
  const host=ref?.hostname.toLowerCase()||'';
  if(/google\.|bing\.|yahoo\.|duckduckgo\.|baidu\./.test(campaign+' '+host))source='search';
  else if(/facebook|instagram|threads|youtube|tiktok|reddit|line|x\.com|twitter/.test(campaign+' '+host))source='social';
  else if(ref)source=ref.origin===location.origin?'internal':'referral';
  else if(campaign)source='referral';
 }catch(_){source='unknown';}
 const endpoint=base+'/functions/v1/quiz-ip-monitor';
 function record(kind,target=''){
  return fetch(endpoint,{
   method:'POST',headers:{apikey:key,'Content-Type':'application/json'},
   body:JSON.stringify({kind,page,source,target}),keepalive:true,cache:'no-store'
  }).catch(()=>{}); // Monitoring must not interrupt viewing or navigation.
 }
 void record('view');
 const safeIds=new Set(['spinBtn','nextQuestionBtn','polaris-trigger',
   'playerSignInBtn','guestbookLogin','manageBankBtn']);
 document.addEventListener('click',event=>{
  const button=event.target?.closest?.('button,a,[role="button"]');
  if(!button)return;
  // Only predefined control IDs or generic element categories are sent.
  const target=safeIds.has(button.id)?button.id:(button.tagName==='A'?'link':'button');
  void record('click',target);
 },{passive:true});
})();
