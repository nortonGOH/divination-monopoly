/* Keep the wheel and the question on one page: a native, accessible modal.
 * Installed after the existing quiz controllers to preserve server-side grading,
 * guest trial limits, knowledge filters, and Wenchang rescue interactions.
 */
(() => {
  'use strict';
  const section=document.querySelector('.quiz-section');
  const panel=section?.querySelector('.quiz-panel');
  const note=section?.querySelector('.v8-empty-note');
  const spin=document.getElementById('spinBtn');
  const scope=document.getElementById('quizScope');
  if(!section||!panel||!note||!spin||typeof window.HTMLDialogElement==='undefined')return;

  const dialog=document.createElement('dialog');
  dialog.id='quizQuestionDialog';
  dialog.className='quiz-question-dialog';
  dialog.setAttribute('aria-labelledby','quizQuestionDialogTitle');
  dialog.setAttribute('aria-describedby','quizQuestionDialogSubtitle');

  const header=document.createElement('div');
  header.className='quiz-question-dialog-head';
  const intro=document.createElement('div');
  const kicker=document.createElement('p');
  kicker.className='quiz-question-dialog-kicker';
  kicker.textContent='數術大作戰 · 抽宿挑戰';
  const title=document.createElement('h2');
  title.id='quizQuestionDialogTitle';
  title.textContent='星宿問答';
  const subtitle=document.createElement('p');
  subtitle.id='quizQuestionDialogSubtitle';
  subtitle.className='quiz-question-dialog-subtitle';
  intro.append(kicker,title,subtitle);
  const close=document.createElement('button');
  close.id='quizQuestionDialogClose';
  close.className='quiz-question-dialog-close';
  close.type='button';
  close.setAttribute('aria-label','關閉題目，返回主畫面');
  close.textContent='✕ 關閉';
  header.append(intro,close);

  const content=document.createElement('div');
  content.className='quiz-question-dialog-content';
  dialog.append(header,content);
  panel.before(dialog);
  content.append(panel);

  const resume=document.createElement('button');
  resume.type='button';
  resume.id='quizQuestionResume';
  resume.className='outline-btn quiz-question-resume';
  resume.textContent='↗ 返回本次題目';
  resume.hidden=true;
  note.after(resume);

  const canResume=()=>!panel.hidden && typeof activeQuestion!=='undefined' &&
    Boolean(activeQuestion) && (typeof spinning==='undefined'||!spinning);
  function updateResume(){
    resume.hidden=dialog.open||!canResume();
  }
  let spinMode='explore',mainStage=null;
  window.addEventListener('challenge-spin-started',event=>{
    spinMode=event.detail?.mode==='main'?'main':'explore';
    mainStage=Number.isInteger(event.detail?.stageIndex)?event.detail.stageIndex:null;
  });
  function openQuestion(){
    if(!canResume())return;
    kicker.textContent=spinMode==='main'?'星宿劍途 · 主線試煉':'星宿劍途 · 秘境探索';
    title.textContent=spinMode==='main'?(mainStage!==null&&(mainStage+1)%7===0?'四象守關試煉':'星宿通關試煉'):'秘境星宿遭遇';
    subtitle.textContent=(scope?.textContent||'本次星宿')+(spinMode==='main'?' · 答對解鎖下一關':' · 自由探索不推進主線')+' · 請選擇正確答案';
    resume.hidden=true;
    if(!dialog.open)dialog.showModal();
    const target=panel.querySelector('.answer-btn:not(:disabled)');
    (target||close).focus({preventScroll:true});
  }
  close.addEventListener('click',()=>dialog.close());
  resume.addEventListener('click',openQuestion);
  dialog.addEventListener('close',()=>{
    updateResume();
    // Returning to the wheel never changes the current question or score.
    if(document.activeElement===document.body)spin.focus({preventScroll:true});
  });
  dialog.addEventListener('click',event=>{
    // Clicking the backdrop closes only the question, never submits an answer.
    if(event.target===dialog)dialog.close();
  });

  // Open immediately when the four-option question has actually been rendered.
  // The wheel-finished listener below remains as a backwards-compatible fallback.
  window.addEventListener('quiz-question-ready',()=>{
    if(canResume()){
      if(blocked.open)blocked.close();
      openQuestion();
    }
  });
  // Do not show an empty question dialog when the current stage is blocked
  // or no question matches the selected category/difficulty.
  const blocked=document.createElement('dialog');
  blocked.className='quiz-question-dialog';
  blocked.id='quizChallengeUnavailableDialog';
  const blockedTitle=document.createElement('h2');
  blockedTitle.textContent='目前無法開啟本次試煉';
  const blockedReason=document.createElement('p');
  blockedReason.setAttribute('role','status');
  blockedReason.style.cssText='line-height:1.8;white-space:pre-wrap';
  const blockedClose=document.createElement('button');
  blockedClose.type='button';blockedClose.textContent='返回調整條件';
  blockedClose.className='outline-btn';
  blockedClose.addEventListener('click',()=>blocked.close());
  blocked.append(blockedTitle,blockedReason,blockedClose);
  section.append(blocked);
  function showBlocked(reason){
    if(canResume())return; // Never replace a valid question with a warning.
    blockedReason.textContent=reason||'目前沒有符合篩選條件的題目，請調整挑戰類型或難度後再試。';
    if(!blocked.open)blocked.showModal();
    blockedClose.focus({preventScroll:true});
  }
  window.addEventListener('quiz-question-unavailable',event=>showBlocked(event.detail?.reason));
  window.addEventListener('challenge-spin-blocked',event=>showBlocked(event.detail?.reason));
  // The official wheel event fires after the authoritative question selection;
  // a special square or an empty eligible pool does not open a blank modal.
  window.addEventListener('challenge-spin-finished',event=>{
    if(event.detail?.cell?.type==='mansion' && canResume()){
      if(blocked.open)blocked.close();
      if(!dialog.open)openQuestion();
    }else{
      if(dialog.open)dialog.close();
      resume.hidden=true;
    }
  });
  new MutationObserver(updateResume).observe(panel,{attributes:true,attributeFilter:['hidden']});
  for(const target of [spin,document.getElementById('polaris-trigger')]){
    target?.addEventListener('click',()=>{resume.hidden=true;},true);
  }
})();
