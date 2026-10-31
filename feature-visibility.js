(()=>{'use strict';
const cfg=window.QUIZ_AUTH_CONFIG||{},base=String(cfg.supabaseUrl||'').replace(/\/$/,'');
const key=String(cfg.publishableKey||'');
const style=document.createElement('style');style.id='featureVisibilityCSS';document.head.append(style);
const blockSelectors={wenchang:'#wenchangCard',daily_knowledge:'#dailyKnowledgeCarousel',learning_journal:'.learning-hub',wheel:'.wheel-card',star_details:'.information',quiz:'.quiz-section',guestbook:'#guestbook',leaderboard:'.challenge-leaderboard'};
const selectors={guestbook:'#guestbook, .ux-quick-nav a[href="#guestbookTitle"]',leaderboard:'.challenge-leaderboard'};
let blockFlags={};
function applyBlocks(flags){
 blockFlags=flags&&typeof flags==='object'?flags:{};
 let css=Object.entries(blockSelectors).filter(([key])=>blockFlags[key]===false).map(([,selector])=>selector+'{display:none!important;}').join('\n');
 if(blockFlags.wheel===false)css+='\n.layout{grid-template-columns:minmax(0,1fr)!important;}';
 document.getElementById('homepageBlockVisibilityCSS').textContent=css;
 window.quizHomepageBlockVisibility=blockFlags;
 window.dispatchEvent(new Event('quiz-homepage-blocks-changed'));
}
const blockStyle=document.createElement('style');blockStyle.id='homepageBlockVisibilityCSS';document.head.append(blockStyle);
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
async function refreshBlocks(){
 if(!base||!key){applyBlocks({});return;}
 try{
 const response=await fetch(base+'/rest/v1/rpc/quiz_public_homepage_blocks',{method:'POST',headers:{apikey:key,'Content-Type':'application/json'},body:'{}',cache:'no-store'});
 if(!response.ok)throw Error('block settings unavailable');
 const data=await response.json();applyBlocks(data?.blocks||{});
 }catch(error){console.warn('首頁區塊設定讀取失敗',error);applyBlocks({});}
}
window.quizRefreshHomepageBlocks=refreshBlocks;
window.quizHomepageBlocksReady=refreshBlocks();
window.quizRefreshFeatureVisibility=refresh;window.quizFeatureVisibilityReady=refresh();
})();