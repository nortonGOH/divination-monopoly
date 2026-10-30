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
  function openQuestion(){
    if(!canResume())return;
    subtitle.textContent=(scope?.textContent||'本次抽宿')+' · 請選擇正確答案';
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

  // The official wheel event fires after the authoritative question selection;
  // a special square or an empty eligible pool does not open a blank modal.
  window.addEventListener('challenge-spin-finished',event=>{
    if(event.detail?.cell?.type==='mansion' && canResume())openQuestion();
    else{
      if(dialog.open)dialog.close();
      resume.hidden=true;
    }
  });
  new MutationObserver(updateResume).observe(panel,{attributes:true,attributeFilter:['hidden']});
  for(const target of [spin,document.getElementById('polaris-trigger')]){
    target?.addEventListener('click',()=>{resume.hidden=true;},true);
  }
})();
