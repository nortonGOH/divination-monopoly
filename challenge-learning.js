/* Learning hub: existing authenticated grading and Wenchang rules remain authoritative.
 * No answer key is read from public questionBank (its answer field is a placeholder).
 */
(()=>{
'use strict';
const $=id=>document.getElementById(id);
const quiz=$('quizTitle')?.closest('.quiz-section');
const cfg=window.QUIZ_AUTH_CONFIG||{};
const base=String(cfg.supabaseUrl||'').replace(/\/$/,'');
const key=String(cfg.publishableKey||'');
if(!quiz||!base||!key)return;
const make=(tag,text='',cls='')=>{
 const x=document.createElement(tag);x.textContent=text;if(cls)x.className=cls;return x;
};
const css=make('style');
css.textContent=`
.learning-hub{margin:17px 0;padding:17px;border:1px solid #d8c49e;border-radius:15px;background:linear-gradient(145deg,#fffaf0,#efe6d5)}
.learning-hub h3{font-size:1.16rem;margin:0 0 6px;letter-spacing:.06em}
.learning-hub p{line-height:1.72}
.learning-hub .learning-muted{font-size:.82rem;color:#626e72;margin:6px 0 12px}
.learning-actions{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:9px}
.learning-actions button,.learning-list button,.learning-refresh{font:inherit;border:1px solid #b69b6c;background:#fffcf5;border-radius:10px;padding:10px 11px;cursor:pointer;text-align:left;color:#293a41}
.learning-actions button[aria-pressed=true]{border:2px solid #356f64;background:#e6f2ec;font-weight:bold}
.learning-actions button:focus-visible,.learning-list button:focus-visible,.learning-refresh:focus-visible{outline:3px solid #c38429;outline-offset:2px}
.learning-actions button:disabled,.learning-list button:disabled{cursor:not-allowed;opacity:.62}
.learning-summary{display:flex;justify-content:space-between;align-items:center;gap:8px;flex-wrap:wrap}
.learning-refresh{font-size:.8rem;padding:7px 9px}
.learning-status{font-size:.83rem;min-height:1.8em;margin:9px 0}
.learning-list{display:grid;gap:8px}
.learning-list button{width:100%;display:flex;align-items:center;justify-content:space-between;gap:8px;line-height:1.45}
.learning-list button .learning-check{color:#34715e;font-size:.83rem;flex:none}
.learning-label{font-size:.76rem;color:#755a2c;font-weight:bold}
.learning-badges{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px}
.learning-badge{border:1px solid #d9d2c3;background:#f7f3e9;border-radius:10px;padding:10px;opacity:.63}
.learning-badge.earned{opacity:1;border-color:#af8b45;background:#fff2d2}
.learning-badge strong{display:block;margin-bottom:4px;font-size:.87rem}
.learning-badge small{font-size:.75rem;line-height:1.5;display:block}
.learning-knowledge{border:1px solid #b7cdbd;border-radius:10px;background:#eff6ed;padding:12px;margin:14px 0 0}
.learning-knowledge[hidden],.learning-hub [hidden]{display:none!important}
.learning-knowledge h4{margin:0 0 8px;font-size:1rem}
.learning-knowledge p{margin:6px 0;white-space:pre-wrap;font-size:.84rem;overflow-wrap:anywhere}
.learning-knowledge .learning-source{font-size:.76rem;color:#586861}
@media(max-width:480px){.learning-hub{padding:12px}.learning-actions{grid-template-columns:1fr}.learning-badges{grid-template-columns:1fr}}
`;
document.head.append(css);
const root=make('section','','learning-hub');root.setAttribute('aria-label','每日挑戰、錯題複習與學習成就');
const title=make('h3','學習修行簿');
const note=make('p','每日三題・知識解析・錯題回顧・成就徽章','learning-muted');
const actions=make('div','','learning-actions');
const modes=[['daily','☀ 每日挑戰'],['review','↻ 錯題複習'],['badge','✦ 成就徽章'],['knowledge','▣ 知識解析卡']];
const btns={};
modes.forEach(([name,label])=>{
 const button=make('button',label);button.type='button';
 button.setAttribute('aria-pressed','false');
 button.addEventListener('click',()=>chooseMode(name));
 actions.append(button);btns[name]=button;
});
const summary=make('div','','learning-summary');
const progress=make('strong','會員登入後可載入學習紀錄');
const refresh=make('button','更新進度','learning-refresh');refresh.type='button';
refresh.addEventListener('click',()=>void loadProgress());
summary.append(progress,refresh);
const status=make('p','登入後即可取得今日固定三題與個人錯題紀錄。','learning-status');
status.setAttribute('role','status');
const list=make('div','','learning-list');
const badges=make('div','','learning-badges');badges.hidden=true;
const card=make('aside','','learning-knowledge');card.hidden=true;
card.setAttribute('aria-label','知識解析卡');
root.append(title,note,actions,summary,status,list,badges,card);
quiz.before(root);
let snapshot=null,mode='daily',busy=false,shownQuestionId='',lastKnowledge=null;
const hasToken=()=>Boolean(window.quizMemberToken?.());
const question=(id)=>typeof questionBank!=='undefined' && Array.isArray(questionBank)?
 questionBank.find(x=>x.id===id):null;
function resetCard(){
 card.replaceChildren();card.hidden=true;lastKnowledge=null;
}
function setStatus(s){status.textContent=s;}
function makeCard(record){
 card.replaceChildren();card.hidden=false;
 const heading=make('h4','知識解析卡');card.append(heading);
 const q=question(record.id);
 const title=make('p',q?.prompt||'題目 '+record.id);card.append(title);
 if(record.correctAnswer!=null && Number.isInteger(Number(record.correctAnswer))
   && Number(record.correctAnswer)>=0 && Number(record.correctAnswer)<=3 && q){
   const n=Number(record.correctAnswer);
   card.append(make('p','正確答案：'+['A','B','C','D'][n]+'．'+q.options[n]));
 }else{
   card.append(make('p','尚未解鎖正確答案；答對或依法使用文昌星救援後才顯示。'));
 }
 if(record.explanation){
   card.append(make('p','題庫解析：'+record.explanation));
 }else{
   card.append(make('p',record.correctAnswer==null?
     '本題尚無可公開的解析。':'原始題庫尚未提供可核對的逐題解析。'));
 }
 card.append(make('p','學術提示：解析依現有題庫整理，不代表已逐條核對古籍原文；引用原始文獻前仍須另行考證。','learning-source'));
}
function actionState(){
 for(const [name,button] of Object.entries(btns))button.setAttribute('aria-pressed',String(mode===name));
}
const achievements=[
 ['first','初試鋒芒','累積答對 1 題',s=>s.mastered>=1],
 ['ten','博學十問','累積答對 10 題',s=>s.mastered>=10],
 ['repair','知錯能改','曾答錯後成功答對 1 題',s=>s.recovered>=1],
 ['recover5','溫故知新','曾答錯後成功答對 5 題',s=>s.recovered>=5],
 ['daily3','三日精進','累積完成 3 日每日挑戰',s=>s.days>=3],
 ['streak7','七日持恆','連續 7 日完成每日挑戰',s=>s.streak>=7]
];
function renderBadges(){
 badges.replaceChildren();badges.hidden=false;list.replaceChildren();
 if(!snapshot){setStatus('請先登入，才能讀取個人成就。');return;}
 for(const [,name,desc,fn] of achievements){
   const attained=fn(snapshot);
   const b=make('div','','learning-badge'+(attained?' earned':''));
   b.append(make('strong',(attained?'◆ ':'◇ ')+name),make('small',desc));
   badges.append(b);
 }
 setStatus('獲得 '+achievements.filter(x=>x[3](snapshot)).length+'／'+achievements.length+
 ' 枚徽章。依伺服器正式答題與每日挑戰紀錄計算，不以本機快取計分。');
}
function quizButton(id,left,right,disabled){
 const q=question(id),button=make('button');
 button.type='button';button.disabled=disabled||!q;
 button.append(make('span',q?(q.prompt.length>58?q.prompt.slice(0,58)+'…':q.prompt):'題目載入中（請更新題庫）'));
 button.append(make('span',right,'learning-check'));
 button.title=left;
 button.addEventListener('click',()=>openLearningQuestion(id));
 return button;
}
function render(){
 actionState();badges.hidden=true;list.replaceChildren();
 if(!hasToken()){
   progress.textContent='請登入會員開始學習';
   setStatus('每日挑戰與錯題紀錄僅供登入會員使用，不影響訪客五次試玩額度。');
   if(mode==='badge')renderBadges();
   return;
 }
 if(!snapshot){
   progress.textContent='尚未讀取學習資料';
   setStatus('按「更新進度」載入資料，或者重新登入。');
   return;
 }
 progress.textContent='今日 '+snapshot.done+'／'+snapshot.assigned+
   ' 題｜連續 '+snapshot.streak+' 天｜已掌握 '+snapshot.mastered+' 題';
 if(mode==='badge'){renderBadges();return;}
 if(mode==='knowledge'){
   setStatus('答對後自動展示題庫解析；答錯時須經文昌星救援解鎖。');
   if(lastKnowledge)makeCard(lastKnowledge);
   else {card.hidden=false;card.replaceChildren(make('h4','知識解析卡'),make('p','請先完成一題正式答題。尚未取得伺服器認證的答案。'));}
   return;
 }
 if(mode==='daily'){
   setStatus('以臺灣時間每日更新三題；當日題組固定。答對才算完成，答錯可依原規則重試。');
   if(!snapshot.daily.length){list.append(make('p','今日沒有可分配的新題目。'));return;}
   snapshot.daily.forEach((entry,i)=>{
     const row=quizButton(entry.id,'今日挑戰 '+(i+1),
       entry.correct?'✓ 已完成':'第 '+(i+1)+' 題',Boolean(entry.correct));
     list.append(row);
   });
   return;
 }
 setStatus('僅列出最近 20 道尚未答對的題目；練習仍計入正式答題、錯誤次數與冷卻時間。');
 if(!snapshot.wrong.length){list.append(make('p','目前沒有待複習的錯題。'));return;}
 snapshot.wrong.forEach(entry=>list.append(quizButton(entry.id,'複習題目',
   '已作答 '+entry.attempts+' 次',false)));
}
function chooseMode(name){
 mode=name;actionState();
 if(!hasToken()){
   $('playerSignInBtn')?.click();
   render();return;
 }
 render();
 if(!snapshot)void loadProgress();
}
async function rpc(){
 const token=window.quizMemberToken?.();
 if(!token)throw Error('請先登入會員');
 const response=await fetch(base+'/rest/v1/rpc/quiz_learning_dashboard',{
   method:'POST',headers:{'apikey':key,'Authorization':'Bearer '+token,'Content-Type':'application/json'},
   body:'{}',cache:'no-store'
 });
 const data=await response.json().catch(()=>({}));
 if(!response.ok)throw Error(data?.message||data?.error||'HTTP '+response.status);
 if(!data||!Array.isArray(data.daily)||!Array.isArray(data.wrong))throw Error('伺服器回傳的學習紀錄格式不正確');
 return data;
}
async function loadProgress(){
 if(busy)return;
 const token=window.quizMemberToken?.();
 if(!token){snapshot=null;resetCard();render();return;}
 busy=true;refresh.disabled=true;setStatus('正在驗證會員進度…');
 try{
   const data=await rpc();
   if(window.quizMemberToken?.()!==token)return;
   snapshot={
     date:String(data.date||''),done:Math.max(0,Number(data.done)||0),
     assigned:Math.max(0,Number(data.assigned)||0),
     daily:data.daily,wrong:data.wrong,
     mastered:Math.max(0,Number(data.mastered)||0),
     recovered:Math.max(0,Number(data.recovered)||0),
     days:Math.max(0,Number(data.days)||0),
     streak:Math.max(0,Number(data.streak)||0)
   };
   render();
 }catch(error){
   if(window.quizMemberToken?.()===token){snapshot=null;render();setStatus('無法讀取學習進度：'+error.message+'。請確認後端學習資料表已安全部署。');}
 }finally{busy=false;refresh.disabled=false;}
}
function openLearningQuestion(id){
 if(!hasToken()){$('playerSignInBtn')?.click();return;}
 if(typeof window.quizPlayerMayChallenge==='function'&&!window.quizPlayerMayChallenge()){
   setStatus('目前帳號挑戰已鎖定，請等候原有冷卻時間結束。');return;
 }
 if(typeof spinning!=='undefined' && spinning){setStatus('抽宿尚未完成，請稍後選題。');return;}
 const q=question(id);
 if(!q){setStatus('這道題目不在目前題庫快照，請更新頁面與題庫。');return;}
 if(typeof showQuestion!=='function'){setStatus('原有答題模組尚未載入。');return;}
 shownQuestionId=id;
 showQuestion(q,1);
 const panel=quiz.querySelector('.quiz-panel');
 if(panel)panel.hidden=false;
 const empty=quiz.querySelector('.v8-empty-note');
 if(empty)empty.hidden=true;
 $('quizScope').textContent=(mode==='daily'?'今日挑戰':'錯題複習')+'｜'+q.mansion;
 $('quizAvailable').textContent=q.difficulty+'・'+(q.knowledge_type||q.category);
 setStatus('已載入題目。答題仍採原有伺服器驗證、錯誤累計與文昌星救援規則。');
 panel?.scrollIntoView?.({behavior:'smooth',block:'nearest'});
}
window.addEventListener('quiz-member-session-changed',()=>{
 snapshot=null;shownQuestionId='';resetCard();render();if(hasToken())void loadProgress();
});
window.addEventListener('quiz-answer-graded',()=>{
 if(hasToken())void loadProgress();
});
window.addEventListener('quiz-learning-answer-resolved',event=>{
 const d=event.detail||{};
 if(!d.accepted||!d.questionId||!hasToken())return;
 lastKnowledge={id:String(d.questionId),correctAnswer:d.correctAnswer,
   explanation:String(d.explanation||'')};
 if(d.correct||d.administratorExempt){makeCard(lastKnowledge);}
 else if(mode==='knowledge'||shownQuestionId===d.questionId){makeCard(lastKnowledge);}
});
window.addEventListener('quiz-learning-answer-revealed',event=>{
 const d=event.detail||{};
 if(!d.questionId||!hasToken())return;
 lastKnowledge={id:String(d.questionId),correctAnswer:d.correctAnswer,
   explanation:String(d.explanation||'')};makeCard(lastKnowledge);
});
actionState();render();
})();
