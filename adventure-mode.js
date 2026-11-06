/* Original four-chapter xianxia quest; story is fictional, grades are server-verified. */
(()=>{
'use strict';
const layout=document.querySelector('#mainContent');
if(!layout||typeof MANSIONS==='undefined'||MANSIONS.length!==28)return;
const chapters=[
 {title:'青龍篇・啟程',tag:'第一章｜青龍七宿',icon:'🐉',beast:'qinglong',story:'暮雲初開，旅人循東方七宿尋得第一卷星圖。答對一關，便點亮下一處星路。'},
 {title:'玄武篇・問道',tag:'第二章｜玄武七宿',icon:'🐢🐍',beast:'xuanwu',story:'踏入北方水境，以觀象與辨義修習心法；守關試煉，須以知識破除迷障。'},
 {title:'白虎篇・試劍',tag:'第三章｜白虎七宿',icon:'🐅',beast:'baihu',story:'西行越過秋夜星野，古老試劍石只認經過查證的答案。'},
 {title:'朱雀篇・歸真',tag:'第四章｜朱雀七宿',icon:'🐦‍🔥',beast:'zhuque',story:'南方七宿映照歸途，完成最後七關，便收集完整二十八宿星圖。'}
];
const el=(tag,txt='',cls='')=>{const e=document.createElement(tag);e.textContent=txt;if(cls)e.className=cls;return e;};
const section=el('section','','adventure-journey');section.id='adventureJourney';section.setAttribute('aria-labelledby','adventureHeading');
const heading=el('h2','星宿劍途：四象二十八關');heading.id='adventureHeading';
section.append(el('p','二十八宿星路 · 原創仙俠闖關','adventure-kicker'),heading,
 el('p','從青龍起程，循玄武、白虎、朱雀四章逐關試煉。選擇已解鎖的星宿，回答數術題庫；只有經伺服器核實的正確答案，才會點亮下一關。','adventure-description'));
const meter=el('div','','adventure-progress-wrap');
const progressText=el('strong','','adventure-progress-text');
const accountNote=el('span','','adventure-account-note');
const bar=el('progress');bar.max=28;bar.value=0;bar.setAttribute('aria-label','已完成的仙俠關卡');
meter.append(progressText,accountNote,bar);
const chaptersUI=el('div','','adventure-chapters');chaptersUI.setAttribute('role','group');chaptersUI.setAttribute('aria-label','四象章回');
const story=el('p','','adventure-story');
const stages=el('div','','adventure-stages');stages.setAttribute('aria-label','二十八宿關卡');
const status=el('p','','adventure-story-status');status.setAttribute('role','status');status.setAttribute('aria-live','polite');
const disclaimer=el('p','劇情、修行關卡與守關稱謂為原創遊戲設定，並非古代星占或道教文獻原文。旅程進度僅保存在本裝置；正式排行榜及答題成績仍由伺服器核實。','adventure-disclaimer');
const mapScroll=el('div','','adventure-map-scroll');
const mapScene=el('div','','adventure-map-scene');
const mapRoute=document.createElementNS('http://www.w3.org/2000/svg','svg');
mapRoute.setAttribute('viewBox','0 0 1000 700');
mapRoute.setAttribute('preserveAspectRatio','none');
mapRoute.setAttribute('aria-hidden','true');
mapRoute.classList.add('adventure-map-routes');
const stageCoords=[
 [115,172],[220,158],[300,183],[340,245],[304,319],[209,296],[120,342],
 [125,468],[225,442],[300,461],[340,523],[300,589],[209,576],[117,617],
 [660,620],[731,580],[818,594],[894,526],[818,458],[731,444],[660,463],
 [660,342],[731,302],[816,323],[896,245],[816,179],[731,162],[660,184]
];
for(let chapter=0;chapter<4;chapter++){
 const path=document.createElementNS('http://www.w3.org/2000/svg','polyline');
 path.setAttribute('points',stageCoords.slice(chapter*7,chapter*7+7).map(p=>p.join(',')).join(' '));
 path.classList.add('adventure-route-line','adventure-route-'+chapter);
 mapRoute.append(path);
}
// Four stylized star paths join the original routes to the actual interactive
// Dipper compass in the middle of the adventure map.
for(const [i,targetIndex] of [3,10,20,21].entries()){
 const connector=document.createElementNS('http://www.w3.org/2000/svg','line');
 connector.setAttribute('x1','500');connector.setAttribute('y1','350');
 connector.setAttribute('x2',String(stageCoords[targetIndex][0]));
 connector.setAttribute('y2',String(stageCoords[targetIndex][1]));
 connector.classList.add('adventure-route-line','adventure-route-link','adventure-route-'+i);
 mapRoute.append(connector);
}
const mapCompass=el('div','北 ↑　東 ←　✦　→ 西　↓ 南','adventure-map-compass');
mapScene.append(mapRoute,mapCompass,chaptersUI,story,stages);
mapScroll.append(mapScene);
section.append(meter,mapScroll,status,disclaimer);layout.before(section);
let layoutMode='classic';
function setLayoutMode(value){
 layoutMode=value==='map'?'map':'classic';
 section.dataset.layout=layoutMode;
 document.documentElement.dataset.adventureView=layoutMode;
 // Move the SAME original SVG wheel element, never clone it. Its spin handlers,
 // Polaris click target, quiz events, admin visibility and live state all persist.
 if(wheelCard){
  if(layoutMode==='map'&&wheelCard.parentElement!==mapScene){
   mapScene.append(wheelCard);
  }else if(layoutMode==='classic'&&wheelCard.parentElement!==layout){
   layout.insertBefore(wheelCard,layout.querySelector('.information'));
  }
  wheelCard.setAttribute('aria-label',layoutMode==='map'?
   '四象星路地圖中央的北斗七星互動羅盤':'二十八星宿與北斗七星互動圓盤');
 }
 mapScroll.setAttribute('aria-label',layoutMode==='map'?'四象二十八宿仙俠地圖，中央可操作北斗羅盤，可左右捲動':'四象章回與關卡');
 render();
}
window.quizApplyHomepageLayout=setLayoutMode;
async function refreshLayout(){
 const cfg=window.QUIZ_AUTH_CONFIG||{};
 const base=String(cfg.supabaseUrl||'').replace(/\/$/,'');
 const key=String(cfg.publishableKey||'');
 if(!base||!key){setLayoutMode('classic');return;}
 try{
  const result=await fetch(base+'/rest/v1/rpc/quiz_public_homepage_layout',{
   method:'POST',headers:{apikey:key,'Content-Type':'application/json'},
   body:'{}',cache:'no-store'
  });
  if(!result.ok)throw Error('版面設定讀取失敗');
  const data=await result.json();
  if(!['classic','map'].includes(data?.mode))throw Error('未知版面設定');
  setLayoutMode(data.mode);
 }catch(error){console.warn('首頁版面設定：'+error.message);setLayoutMode('classic');}
}
window.quizRefreshHomepageLayout=refreshLayout;

// The North Star is the RPG compass; preserve the original SVG wheel and spin animation.
const wheelCard=layout.querySelector('.wheel-card');
const wheelHeader=wheelCard?.querySelector('.wheel-header');
const modes=el('div','','adventure-wheel-modes');
modes.setAttribute('role','group');
modes.setAttribute('aria-label','北斗星路羅盤玩法');
const questMode=el('button','','adventure-mode-button');
const exploreMode=el('button','','adventure-mode-button');
const wheelTip=el('p','','adventure-wheel-hint');
const encounter=el('div','','adventure-encounter');
encounter.setAttribute('role','status');
encounter.setAttribute('aria-live','polite');
const encounterKicker=el('strong','✧ 星路羅盤紀事','adventure-encounter-title');
const encounterText=el('p','主線試煉會讓瑤光指向下一個待通關的星宿。','adventure-encounter-text');
encounter.append(encounterKicker,encounterText);
modes.append(questMode,exploreMode);
if(wheelHeader){wheelHeader.after(modes,wheelTip);}
wheelCard?.append(encounter);
let chapterIndex=0,activeStage=null,passed=0,currentKey=null;
let wheelMode='main',lastSpinMode='main',lastSpinStage=null;
const wheelButton=document.getElementById('spinBtn');
const polaris=document.getElementById('polaris-trigger');
function updateModes(){
 questMode.textContent='⚔ 主線試煉';questMode.type='button';
 exploreMode.textContent='✧ 秘境探索';exploreMode.type='button';
 questMode.setAttribute('aria-pressed',String(wheelMode==='main'));
 exploreMode.setAttribute('aria-pressed',String(wheelMode==='explore'));
 wheelTip.textContent=wheelMode==='main'?
  '主線試煉：啟動北極星後，北斗定位到目前解鎖的星宿；答對現有題庫才會通關。':
  '秘境探索：32 格公平隨機抽選，可能遇到星宿試煉或四個機緣／命數事件；探索不會推進主線。';
}
function switchMode(next){
 if(next!=='main'&&next!=='explore')return;
 wheelMode=next;activeStage=null;updateModes();
 encounterText.textContent=next==='main'?'主線羅盤就緒；點北極星或下方按鈕，定位下一個待通關星宿。':
  '秘境已開啟；點北極星或下方按鈕，隨機探索星宿與特殊事件。';
}
questMode.addEventListener('click',()=>switchMode('main'));
exploreMode.addEventListener('click',()=>switchMode('explore'));
updateModes();
const prefix='quiz_xianxia_quest_v1:';
function identity(){
 const token=window.quizMemberToken?.();
 if(token){
  // JWT sub is a browser-progress namespace only, NOT an authorization check.
  try{const raw=token.split('.')[1].replace(/-/g,'+').replace(/_/g,'/');
   const sub=JSON.parse(atob(raw)).sub;
   if(typeof sub==='string'&&/^[a-f0-9-]{36}$/i.test(sub))return 'member:'+sub;
  }catch(_){}
  return 'member:unidentified';
 }
 const nick=window.quizNicknameActive?.()?window.quizNicknameProfile?.()?.nickname:'';
 return nick?'nickname:'+nick:'';
}
function reconcile(){
 const key=identity();if(key===currentKey)return;
 currentKey=key;activeStage=null;passed=0;
 if(!key)return;
 try{const x=Number(localStorage.getItem(prefix+key));
  if(Number.isInteger(x)&&x>=0&&x<=28)passed=x;
 }catch(_){}
}
function say(message){status.textContent=message;}
function render(){
 reconcile();progressText.textContent='星路進度　'+passed+'／28 關';bar.value=passed;
 accountNote.textContent=currentKey?'挑戰者旅程｜此裝置進度':'遊客可閱覽章回，挑戰前請設定暱稱';
 chaptersUI.replaceChildren();
 chapters.forEach((chapter,i)=>{
  const button=el('button','','adventure-chapter');button.type='button';button.setAttribute('aria-pressed',String(chapterIndex===i));
  button.dataset.region=String(i);
  button.dataset.beast=chapter.beast;
  const icon=el('span',chapter.icon,'adventure-chapter-icon');icon.setAttribute('aria-hidden','true');
  if(chapter.beast==='xuanwu')icon.classList.add('adventure-chapter-icon-paired');
  button.append(icon,el('span',chapter.tag),el('strong',chapter.title));
  button.addEventListener('click',()=>{chapterIndex=i;render();});chaptersUI.append(button);
 });
 story.textContent=chapters[chapterIndex].story;stages.replaceChildren();
 story.setAttribute('aria-label',chapters[chapterIndex].title+'劇情');
 for(let i=(layoutMode==='map'?0:chapterIndex*7);i<(layoutMode==='map'?28:chapterIndex*7+7);i++){
  const completed=i<passed,available=i===passed,m=MANSIONS[i];
  const button=el('button','','adventure-stage');button.type='button';
  button.dataset.region=String(Math.floor(i/7));
  button.style.setProperty('--map-x',String(stageCoords[i][0]/10)+'%');
  button.style.setProperty('--map-y',String(stageCoords[i][1]/7)+'%');
  button.dataset.state=completed?'complete':available?'current':'locked';button.disabled=!completed&&!available;
  button.setAttribute('aria-label','第 '+(i+1)+' 關 '+m.name+'，'+(completed?'已通過':available?'可挑戰':'尚未解鎖'));
  button.append(el('span',i===chapterIndex*7+6?'第 '+(i+1)+' 關 · 守關':'第 '+(i+1)+' 關','adventure-stage-number'),
   el('strong',m.name,'adventure-stage-name'),el('span',completed?'✓ 已過關':available?'⚔ 挑戰':'🔒 未解鎖','adventure-stage-state'));
  button.addEventListener('click',()=>enter(i));stages.append(button);
 }
}
function enter(index){
 reconcile();
 if(index>passed){say('此關尚未解鎖，請先完成前一關。');return;}
 if(index<passed){say('此關已通過。主線羅盤將指向下一個尚未通關的星宿；可切換秘境探索自由遊歷。');return;}
 if(!window.quizMemberToken?.()&&!window.quizNicknameActive?.()){
  say('請先設定暱稱。初階與中階可免註冊挑戰，高階須登入會員。');
  window.quizNicknameFocus?.();return;
 }
 if(!window.quizPlayerMayChallenge?.()){say('目前無法開始挑戰，請確認帳號或暱稱模式。');return;}
 if(typeof window.quizAdventureCanChallengeStage!=='function'||!window.quizAdventureCanChallengeStage(index)){
  say('本宿在所選難度或數術類型下沒有可作答題目，請調整條件再試。');return;
 }
 if(!wheelButton){say('星路羅盤按鈕尚未載入。');return;}
 switchMode('main');
 say('第 '+(index+1)+' 關「'+MANSIONS[index].name+'」就緒，正在啟動北斗定位。');
 wheelButton.click();
 document.getElementById('skyWheel')?.scrollIntoView({behavior:'smooth',block:'center'});
}
// Main-quest selection intentionally targets the next stage. Free exploration
// leaves the original 32-cell unbiased random picker untouched.
window.quizAdventureWheelPlan=()=>{
 reconcile();
 if(wheelMode!=='main')return {mode:'explore'};
 if(passed>=28)return {mode:'main',blocked:true,reason:'四象二十八關已全部完成。可切換「秘境探索」繼續自由抽宿。'};
 if(!currentKey)return {mode:'main',blocked:true,reason:'先設定暱稱或登入會員，才能開始主線試煉。'};
 if(typeof window.quizAdventureCanChallengeStage!=='function')return {mode:'main',blocked:true,reason:'題庫尚未準備完成，請稍後重試。'};
 if(!window.quizAdventureCanChallengeStage(passed))return {mode:'main',blocked:true,reason:'第 '+(passed+1)+' 關「'+MANSIONS[passed].name+'」沒有符合目前難度與類型的可用題目，請調整篩選條件。'};
 return {mode:'main',slotIndex:passed+Math.floor(passed/7),stageIndex:passed};
};
window.addEventListener('challenge-spin-blocked',event=>{
 activeStage=null;encounterText.textContent=event.detail?.reason||'主線試煉暫不可用。';
 say(encounterText.textContent);
});
window.addEventListener('challenge-spin-started',event=>{
 const detail=event.detail||{};
 lastSpinMode=detail.mode==='main'?'main':'explore';
 lastSpinStage=lastSpinMode==='main'&&Number.isInteger(detail.stageIndex)?detail.stageIndex:null;
 activeStage=lastSpinStage;
 encounterText.textContent=lastSpinMode==='main'?
  '⚔ 北斗循星圖旋轉，正定位第 '+(lastSpinStage+1)+' 關「'+MANSIONS[lastSpinStage].name+'」。':
  '✧ 北斗漫遊三垣四象的想像秘境，正在隨機探索三十二格。';
});
window.addEventListener('challenge-spin-finished',event=>{
 const cell=event.detail?.cell;
 if(!cell)return;
 if(cell.type==='mansion'){
  const index=cell.mansionIndex,m=MANSIONS[index];
  if(lastSpinMode==='main'&&index===lastSpinStage){
   encounterText.textContent='⚔ 第 '+(index+1)+' 關「'+m.name+'」已定位！請回答彈出的四選一題目；答對可解鎖後續星路。';
  }else{
   activeStage=null;
   encounterText.textContent='✧ 遭遇「'+m.name+'」！這是自由探索試煉，答題成績依伺服器核實，但不影響主線解鎖。';
  }
 }else{
  activeStage=null;
  const eventCard=SPECIAL_CARDS[cell.specialIndex];
  encounterText.textContent='✧ '+(eventCard?.name||'命數事件')+'：'+(eventCard?.message||'可重新啟動星路羅盤。');
 }
});
window.addEventListener('quiz-answer-graded',event=>{
 reconcile();const detail=event.detail||{};
 if(!detail.correct||!detail.questionId||activeStage===null||activeStage!==passed)return;
 const question=typeof questionBank!=='undefined'&&Array.isArray(questionBank)?questionBank.find(q=>String(q.id)===String(detail.questionId)):null;
 if(!question||question.mansion!==MANSIONS[activeStage].name)return;
 const complete=activeStage;passed=Math.min(28,passed+1);activeStage=null;
 encounterText.textContent='✦ 星關突破！已通過第 '+(complete+1)+' 關「'+MANSIONS[complete].name+'」，下一次主線旋轉將指向新的星宿。';
 if(currentKey){try{localStorage.setItem(prefix+currentKey,String(passed));}catch(_){}}
 const chapterCleared=passed>0&&passed%7===0;
 chapterIndex=Math.min(3,Math.floor(passed/7));render();
 say(chapterCleared?'✦ '+chapters[Math.floor(complete/7)].title+'全章通關！已解鎖下一章。':'✦ 第 '+(complete+1)+' 關通過！星路已開啟下一關。');
});
window.addEventListener('quiz-member-session-changed',()=>{reconcile();render();});
window.addEventListener('quiz-nickname-state-changed',()=>{reconcile();render();});
render();void refreshLayout();say('星路羅盤預設「主線試煉」：點北極星會定位第一個尚未通關的星宿；切換「秘境探索」可公平隨機抽宿。');
})();