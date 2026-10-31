/* v8 interface: one right-side challenge panel; wheel-only four-choice questions. */
(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  const aside = document.querySelector('.information');
  const quiz = document.querySelector('.quiz-section');
  const panel = quiz?.querySelector('.quiz-panel');
  const foot = quiz?.querySelector('.quiz-foot');
  if (!aside || !quiz || !panel || typeof selectQuizForMansion !== 'function' ||
      typeof finishSpin !== 'function' || typeof spin !== 'function') return;

  const style = document.createElement('style');
  style.textContent = '.v8-hidden-detail{display:none!important}.quiz-panel[hidden],.quiz-foot[hidden]{display:none!important}' +
    '.v8-empty-note{margin:10px 0 14px;padding:12px 14px;background:#fff7e9;border:1px solid #e0ceb0;border-radius:10px;color:#594c3c;line-height:1.65}' +
    '.v8-stats-dialog{width:min(740px,calc(100vw - 30px));max-height:85vh;overflow:auto;border:1px solid #d1b88e;border-radius:15px;padding:20px;background:#fffcf5;color:#24303b}' +
    '.v8-stats-dialog::backdrop{background:#152233b3}.v8-stats-table{width:100%;border-collapse:collapse;font-size:.86rem}.v8-stats-table th,.v8-stats-table td{padding:10px 7px;border-bottom:1px solid #e6dac7;text-align:left;word-break:break-word}' +
    '.v8-stats-dialog button{padding:8px 13px;border:1px solid #c8b595;border-radius:9px;background:#fffaf0;color:#554735;cursor:pointer;font:inherit}';
  document.head.appendChild(style);

  /* Preserve legacy DOM ids for history/astronomy scripts, but remove redundant display. */
  const oldLabel = aside.querySelector(':scope > .side-label');
  if (oldLabel) oldLabel.classList.add('v8-hidden-detail');
  ['.star-heading','.details','.description'].forEach(sel => {
    const part=aside.querySelector(':scope > '+sel);
    if(part){part.hidden=true;part.classList.add('v8-hidden-detail');}
  });
  const status=$('status');
  if(status) quiz.insertBefore(status, quiz.querySelector('.quiz-heading'));
  const next=$('nextQuestionBtn');
  if(next) next.hidden=true;
  if(foot) foot.hidden=true;

  const note=document.createElement('p');
  note.className='v8-empty-note';
  note.setAttribute('role','status');
  note.textContent='請先選擇難度，再點「抽宿挑戰」。只有抽中星宿時才會出現該宿的四選一題目。';
  quiz.insertBefore(note, panel);
  let wheelReady=false;

  function hideQuestion(message){
    wheelReady=false;
    panel.hidden=true;
    if(foot)foot.hidden=true;
    activeQuestion=null;
    questionAnswered=false;
    $('answerOptions').replaceChildren();
    if(message){note.textContent=message;note.hidden=false;}
    else note.hidden=true;
  }
  function showQuestionPanel(){
    panel.hidden=false;
    note.hidden=true;
  }
  hideQuestion(note.textContent);

  /* Never mix free-response Q&A into the wheel challenge. Keep it in the admin bank. */
  selectQuizForMansion=function(index){
    activeMansion=index;
    const mansion=MANSIONS[index]?.name;
    const requestedType=typeof window.quizFiveArtsSelection==='function'?window.quizFiveArtsSelection():'all';
    // No selected challenge type means a mixed random draw across all three difficulties.
    const level=window.quizMemberToken?.()?(requestedType==='all'?'all':($('quizDifficulty')?.value||'初階')):'初階';
    const levelLabel=level==='all'?'隨機初／中／高階':level;
    const completed=window.quizCompletedIds||new Set();
    const playable=questionBank.filter(q =>
      !completed.has(q.id) &&
      q.mansion===mansion && (level==='all'||(q.difficulty||'中階')===level) &&
      (requestedType==='all'||(typeof inferKnowledgeType==='function' && inferKnowledgeType(q)===requestedType)) &&
      // Public quiz questions omit the answer; only the server grades submissions.
      Array.isArray(q.options) && q.options.length===4
    );
    $('quizScope').textContent='目前星宿：'+mansion;
    $('quizAvailable').textContent=levelLabel+' · 本宿 '+playable.length+' 題四選一';
    if(!wheelReady) {
      hideQuestion('請按「抽宿挑戰」開始；點選星宿或切換難度不會直接出題。');
      return;
    }
    // Active nickname beginners and unlocked registered members are both eligible.
    // The old guest-trial gate must not override a verified nickname session.
    const nicknameAllowed=Boolean(!window.quizMemberToken?.() && window.quizNicknameActive?.());
    const memberAllowed=Boolean(window.quizMemberToken?.() && window.quizPlayerMayChallenge?.());
    if(!nicknameAllowed && !memberAllowed) {
      hideQuestion('請先輸入初階暱稱，或註冊登入會員才能參加挑戰。');
      return;
    }
    if(!playable.length){
      hideQuestion('已抽中 '+mansion+'，目前「'+levelLabel+'」條件下沒有尚未作答的四選一題目，請更換條件或再抽宿。');
      return;
    }
    const previous=activeQuestion?.id;
    const alternatives=playable.filter(q=>q.id!==previous);
    const pool=alternatives.length?alternatives:playable;
    const selected=pool[fairRandomInt(pool.length)];
    showQuestion(selected,playable.length);
    $('quizAvailable').textContent=levelLabel+' · 本宿 '+playable.length+' 題四選一';
    showQuestionPanel();
  };

  const oldFinish=finishSpin;
  finishSpin=function(slotIndex){
    const cell=BOARD_SLOTS[slotIndex];
    wheelReady=Boolean(cell && cell.type==='mansion');
    oldFinish(slotIndex);
    if(!cell || cell.type!=='mansion'){
      const ev=cell && SPECIAL_CARDS[cell.specialIndex];
      hideQuestion(ev ? '抽中「'+ev.name+'」：'+ev.message+'（特殊格不計分）' : '請重新抽宿。');
    }
  };
  // The v7 listeners hold a reference to the original spin function.
  // Capture interactions before those listeners, not only by reassignment.
  for(const el of [$('spinBtn'),$('polaris-trigger')]) {
    if(!el)continue;
    el.addEventListener('click',()=>{
      if(!spinning)hideQuestion('北斗旋轉中，待瑤光停在星宿後才會出題。');
    },true);
    el.addEventListener('keydown',e=>{
      if((e.key==='Enter'||e.key===' ')&&!spinning)hideQuestion('北斗旋轉中，待瑤光停在星宿後才會出題。');
    },true);
  }
  const oldSpin=spin;
  spin=function(){
    if(spinning)return;
    hideQuestion('北斗旋轉中，待瑤光停在星宿後才會出題。');
    oldSpin();
  };
  const oldInspect=inspectMansion;
  inspectMansion=function(index){
    wheelReady=false;
    oldInspect(index);
    hideQuestion('已選取 '+MANSIONS[index].name+' 查看位置。請按「抽宿挑戰」才會出題。');
  };
  const difficulty=$('quizDifficulty');
  if(difficulty) difficulty.addEventListener('change',()=>{
    hideQuestion('已切換至「'+difficulty.value+'」，請重新抽宿挑戰。');
  });
  if(next) next.addEventListener('click',()=>hideQuestion('請重新抽宿，才能取得下一道題目。'));

  /* Administrator-only individual account statistics, read through secured RPC. */
  const bar=document.querySelector('#bankDialog .bank-toolbar');
  if(bar){
    const btn=document.createElement('button');
    btn.type='button';btn.className='outline-btn';btn.textContent='會員挑戰紀錄';
    bar.appendChild(btn);
    const dlg=document.createElement('dialog');dlg.className='v8-stats-dialog';
    const head=document.createElement('h3');head.textContent='每位會員挑戰紀錄';
    const help=document.createElement('p');help.textContent='參戰次數＝已提交的四選一答題次數；成功率＝答對次數÷參戰次數。僅授權管理員可查看帳號資料。';
    const result=document.createElement('div');result.setAttribute('role','status');
    const close=document.createElement('button');close.type='button';close.textContent='關閉';
    close.addEventListener('click',()=>dlg.close());
    dlg.append(head,help,result,close);document.body.append(dlg);
    btn.addEventListener('click',async()=>{
      if(!adminAccessToken){displayBankToast('請先以管理員帳號登入，才能查閱會員挑戰紀錄。');return;}
      result.textContent='正在取得會員統計…';
      dlg.showModal();
      try{
        const rows=await cloudCall('/rest/v1/rpc/quiz_admin_challenger_stats_nicknames',{
          method:'POST',headers:{'Content-Type':'application/json'},body:'{}'
        },true);
        if(!Array.isArray(rows))throw Error('統計格式不正確');
        result.replaceChildren();
        if(!rows.length){result.textContent='尚未有答題紀錄。';return;}
        const table=document.createElement('table');table.className='v8-stats-table';
        const thead=document.createElement('thead'),hr=document.createElement('tr');
        ['會員暱稱','參戰','成功','失敗','成功率'].forEach(t=>{const th=document.createElement('th');th.textContent=t;hr.append(th);});
        thead.append(hr);table.append(thead);
        const body=document.createElement('tbody');
        rows.forEach(r=>{
          const tr=document.createElement('tr');
          const vals=[r.nickname||'（未設定暱稱）',r.total_attempts,r.correct_attempts,r.wrong_attempts,(Number(r.success_rate)||0).toFixed(1)+'%'];
          vals.forEach(v=>{const td=document.createElement('td');td.textContent=String(v??'—');tr.append(td);});
          body.append(tr);
        });
        table.append(body);result.append(table);
      }catch(error){result.textContent='無法讀取挑戰紀錄：'+error.message+'。請先在 Supabase 執行 v8 統計升級 SQL。';}
    });
  }
})();
