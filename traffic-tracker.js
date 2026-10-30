/* Page-load counting for both guests and members. No identifying information collected. */
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
 fetch(base+'/rest/v1/rpc/quiz_track_page_view',{
  method:'POST',headers:{apikey:key,'Content-Type':'application/json'},
  body:JSON.stringify({p_page:page,p_source:source}),keepalive:true,cache:'no-store'
 }).catch(()=>{}); // Analytics must never interfere with the website.
})();
