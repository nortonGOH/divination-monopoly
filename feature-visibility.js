(()=>{'use strict';
const cfg=window.QUIZ_AUTH_CONFIG||{},base=String(cfg.supabaseUrl||'').replace(/\/$/,'');
const key=String(cfg.publishableKey||'');
const style=document.createElement('style');style.id='featureVisibilityCSS';document.head.append(style);
const selectors={guestbook:'#guestbook, .ux-quick-nav a[href="#guestbookTitle"]',leaderboard:'.challenge-leaderboard'};
function apply(flags){
 style.textContent=(flags.guestbook_visible===false?selectors.guestbook+'{display:none!important;}':'')+
 (flags.leaderboard_visible===false?selectors.leaderboard+'{display:none!important;}':'');
 window.quizFeatureVisibility=flags;
 window.dispatchEvent(new Event('quiz-feature-visibility-changed'));
}
apply({guestbook_visible:false,leaderboard_visible:false});
async function refresh(){
 if(!base||!key){apply({guestbook_visible:true,leaderboard_visible:true});return;}
 try{
  const r=await fetch(base+'/rest/v1/rpc/quiz_public_feature_visibility',
   {method:'POST',headers:{apikey:key,'Content-Type':'application/json'},body:'{}',cache:'no-store'});
  if(!r.ok)throw Error('visibility request failed');
  const data=await r.json();
  if(typeof data?.guestbook_visible!=='boolean'||typeof data?.leaderboard_visible!=='boolean')throw Error('invalid flags');
  apply(data);
 }catch(_){apply({guestbook_visible:true,leaderboard_visible:true});}
}
window.quizRefreshFeatureVisibility=refresh;void refresh();
})();