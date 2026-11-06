/* Original four-chapter xianxia quest; story is fictional, grades are server-verified. */
(()=>{
'use strict';
const layout=document.querySelector('#mainContent');
if(!layout||typeof MANSIONS==='undefined'||MANSIONS.length!==28)return;
const chapters=[
 {title:'青龍篇・啟程',tag:'第一章｜青龍七宿',story:'暮雲初開，旅人循東方七宿尋得第一卷星圖。答對一關，便點亮下一處星路。'},
 {title:'玄武篇・問道',tag:'第二章｜玄武七宿',story:'踏入北方水境，以觀象與辨義修習心法；守關試煉，須以知識破除迷障。'},
 {title:'白虎篇・試劍',tag:'第三章｜白虎七宿',story:'西行越過秋夜星野，古老試劍石只認經過查證的答案。'},
 {title:'朱雀篇・歸真',tag:'第四章｜朱雀七宿',story:'南方七宿映照歸途，完成最後七關，便收集完整二十八宿星圖。'}
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
section.append(meter,chaptersUI,story,stages,status,disclaimer);layout.before(section);
let chapterIndex=0,activeStage=null,passed=0,currentKey=null;
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
  button.append(el('span',chapter.tag),el('strong',chapter.title));
  button.addEventListener('click',()=>{chapterIndex=i;render();});chaptersUI.append(button);
 });
 story.textContent=chapters[chapterIndex].story;stages.replaceChildren();
 for(let i=chapterIndex*7;i<chapterIndex*7+7;i++){
  const completed=i<passed,available=i===passed,m=MANSIONS[i];
  const button=el('button','','adventure-stage');button.type='button';
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
 if(!window.quizMemberToken?.()&&!window.quizNicknameActive?.()){
  say('請先設定暱稱。初階與中階可免註冊挑戰，高階須登入會員。');
  window.quizNicknameFocus?.();return;
 }
 if(!window.quizPlayerMayChallenge?.()){say('目前無法開始挑戰，請確認帳號或暱稱模式。');return;}
 if(typeof window.quizAdventureOpenStage!=='function'){say('題庫尚未準備完成，請稍後重新開啟。');return;}
 if(!window.quizAdventureOpenStage(index)){say('本宿在所選難度或數術類型下沒有可作答題目，請調整條件再試。');return;}
 activeStage=index;
 say('已進入第 '+(index+1)+' 關「'+MANSIONS[index].name+'」。請於數術問答答對一題，解鎖下一關。');
 document.getElementById('quizTitle')?.scrollIntoView({behavior:'smooth',block:'center'});
}
window.addEventListener('quiz-answer-graded',event=>{
 reconcile();const detail=event.detail||{};
 if(!detail.correct||!detail.questionId||activeStage===null||activeStage!==passed)return;
 const question=typeof questionBank!=='undefined'&&Array.isArray(questionBank)?questionBank.find(q=>String(q.id)===String(detail.questionId)):null;
 if(!question||question.mansion!==MANSIONS[activeStage].name)return;
 const complete=activeStage;passed=Math.min(28,passed+1);activeStage=null;
 if(currentKey){try{localStorage.setItem(prefix+currentKey,String(passed));}catch(_){}}
 const chapterCleared=passed>0&&passed%7===0;
 chapterIndex=Math.min(3,Math.floor(passed/7));render();
 say(chapterCleared?'✦ '+chapters[Math.floor(complete/7)].title+'全章通關！已解鎖下一章。':'✦ 第 '+(complete+1)+' 關通過！星路已開啟下一關。');
});
for(const id of ['spinBtn','polaris-trigger']){
 const node=document.getElementById(id);if(!node)continue;
 node.addEventListener('click',()=>{activeStage=null;},true);
 if(id==='polaris-trigger')node.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' ')activeStage=null;},true);
}
window.addEventListener('quiz-member-session-changed',()=>{reconcile();render();});
window.addEventListener('quiz-nickname-state-changed',()=>{reconcile();render();});
render();say('選擇青龍篇的第一關開始旅程；原有北斗自由抽宿仍可使用。');
})();