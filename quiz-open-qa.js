/* 數術知識大挑戰 v6：初／中／高階共用二十八宿問答與題庫管理。
 * 原始問答保持來源答案，未校勘的文字以「待考」顯示。
 * 本檔沿用頁面原有 Supabase Auth 與 quiz_admins/RLS，不包含任何私密金鑰。
 */
(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  if (!$('quizScope') || !$('bankDialog') || typeof cloudCall !== 'function') return;
  const levels = ['初階','中階','高階'];
  const fields = 'id,source_question_no,difficulty,category,mansion,prompt,source_title,source_url,review_status';
  let openRows = [], source = '尚未載入', currentId = '', currentOpen = null;
  // Read-only snapshot for the administrator's type-by-level inventory panel.
  window.quizGetOpenQuestions=()=>openRows.map(q=>({...q}));
  let reviewCount = 0, masteredCount = 0, editingOpenId = null;
  let openLoadPending = true;
  const baseSelect = selectQuizForMansion;
  const baseShow = showQuestion;
  const baseAnswer = answerQuestion;
  const baseEdit = editQuestion;
  const baseDelete = removeQuestion;
  const baseClear = clearEditor;
  const isAdmin = () => Boolean(adminAccessToken);
  const node = (tag, className, value) => {
    const n = document.createElement(tag);
    if (className) n.className = className;
    if (value !== undefined) n.textContent = value;
    return n;
  };
  const normalize = (q) => ({
    id:String(q.id || ''), source_question_no: q.source_question_no == null ? null : Number(q.source_question_no),
    difficulty: levels.includes(q.difficulty) ? q.difficulty : '中階',
    category:String(q.category || '其他'), mansion:String(q.mansion || ''),
    prompt:String(q.prompt || ''), reference_answer:String(q.reference_answer || ''),
    source_title:String(q.source_title || ''), source_url:String(q.source_url || ''),
    review_status:String(q.review_status || '待考'), type:'open'
  });
  // 單一難度選擇器；沒有第二套「數術深究開放問答」卡片。
  const selectorWrap = node('label','level-chooser');
  selectorWrap.textContent='挑戰難度';
  const levelSelect = node('select');
  levelSelect.id='quizDifficulty';
  for(const l of levels) {const opt = node('option','',l);opt.value=l;levelSelect.append(opt);}
  {const o=node('option','','不分難度');o.value='all';levelSelect.prepend(o);}
  levelSelect.value='初階';
  selectorWrap.append(levelSelect);
  const header=$('quizTitle')?.closest('.quiz-heading');
  header?.appendChild(selectorWrap);
  const style=node('style');
  style.textContent=`
    .level-chooser{display:flex;align-items:center;gap:8px;flex-wrap:wrap;font-size:.86rem;color:var(--ink,#26313a);font-weight:700}
    .level-chooser select,.level-filter select{border:1px solid var(--stroke,#d9cfb9);border-radius:9px;background:#fffaf0;padding:7px 10px;color:var(--ink,#26313a);font:inherit}
    .open-answer-control{display:flex;flex-wrap:wrap;gap:9px;margin-top:12px}
    .open-answer-control button{font:inherit;cursor:pointer;padding:10px 15px;background:#fffaf0;color:#26313a;border:1px solid #cdbb98;border-radius:9px}
    .open-answer-control button:hover{background:#f0e2c8}
    .open-answer-content{white-space:pre-wrap;line-height:1.85;text-align:left;border-left:3px solid #b08548;padding:12px 14px;background:#fffaf0;border-radius:6px;margin-top:12px}
    .qa-review-note{font-size:.8rem;color:var(--muted,#68717a);line-height:1.6;margin-top:8px}
    .level-filter{display:flex;gap:6px;align-items:center}
    #openAnswerEditor label{display:block;margin:12px 0}
    #openAnswerEditor textarea,#openAnswerEditor input,#openAnswerEditor select{width:100%;font:inherit;border:1px solid #cabda4;border-radius:8px;padding:10px;background:#fff}
    #openAnswerEditor textarea{resize:vertical;min-height:120px}
    #bankList .bank-item-top{font-size:.8rem}
    #openAnswerEditor[hidden],.option-editor[hidden],#editAnswer[hidden]{display:none!important}
    @media(max-width:640px){.level-chooser{width:100%}.quiz-heading{flex-wrap:wrap}}
  `;
  document.head.append(style);
  const managerFilters=$('bankFilter')?.closest('.bank-filters');
  const managerLevel=node('label','level-filter');managerLevel.textContent='難度';
  const managerLevelSelect=node('select');managerLevelSelect.id='bankDifficulty';
  for(const [value,label] of [['all','全部難度'],...levels.map(x=>[x,x])]) {const o=node('option','',label);o.value=value;managerLevelSelect.append(o);}
  managerLevel.append(managerLevelSelect);
  if(managerFilters)managerFilters.append(managerLevel);

  // 題型與難度整合到既有編輯表單（非額外的開放問答管理區）。
  const form=$('questionForm');
  const formColumns=form.querySelector('.editor-columns');
  const levelEditor=node('label','', '題目難度');
  const levelEditorSelect=node('select');levelEditorSelect.id='editDifficulty';
  for(const l of levels){const o=node('option','',l);o.value=l;levelEditorSelect.append(o);}
  levelEditorSelect.value='中階';levelEditor.append(levelEditorSelect);
  const typeEditor=node('label','', '題目類型');
  const typeSelect=node('select');typeSelect.id='editQuestionType';
  for(const [value,label] of [['choice','四選一'],['open','開放問答']]){const o=node('option','',label);o.value=value;typeSelect.append(o);}
  typeEditor.append(typeSelect);
  formColumns?.append(levelEditor,typeEditor);
  const openEditor=node('div');openEditor.id='openAnswerEditor';openEditor.hidden=true;
  openEditor.innerHTML=`<label>參考答案（保留來源原文）<textarea id="editReferenceAnswer" rows="7" maxlength="12000" placeholder="請輸入問答的參考答案"></textarea></label>
    <label>來源標題<input id="editSourceTitle" maxlength="180" placeholder="例如：數術知識問答六十題"></label>
    <label>來源題號（選填）<input id="editSourceNo" type="number" min="1" max="100000"></label>
    <label>學術校核狀態<select id="editReviewStatus"><option>待考</option><option>已核校</option></select></label>`;
  form.querySelector('.editor-actions')?.before(openEditor);
  const optionEditor=form.querySelector('.option-editor');
  const answerEditor=$('editAnswer')?.closest('label');
  const explanationEditor=$('editExplanation')?.closest('label');
  const optionInputs=[0,1,2,3].map(i=>$('editOption'+i));
  // An explicit edit state protects the original question ID and question type.
  const editNotice=node('div','quiz-edit-notice');
  editNotice.id='quizEditNotice';editNotice.hidden=true;editNotice.setAttribute('role','status');
  form.before(editNotice);
  const editStyles=node('style');
  editStyles.textContent=`
    #quizEditNotice{padding:12px 15px;margin:0 0 15px;border:1px solid #bea067;border-radius:10px;background:#fff0cf;color:#534329;font-size:.85rem;line-height:1.7;overflow-wrap:anywhere}
    #quizEditNotice[hidden]{display:none!important}
    #bankList .bank-item.quiz-being-edited{outline:2px solid #bd8b47;background:#fff4d8}
    #questionForm #editQuestionType:disabled{background:#ece5d5;color:#544b3e;opacity:1}
  `;
  document.head.append(editStyles);
  function showEditMode(q,type){
    form.dataset.editingId=q.id;
    editNotice.hidden=false;
    editNotice.textContent='正在修改'+(type==='open'?'開放問答':'四選一選擇題')+'｜題號：'+q.id+'。題號與題型固定；確認修改後按「儲存修改」，或按「取消修改」。';
    typeSelect.disabled=true;
    $('cancelEditBtn').textContent='取消修改';
    for(const item of $('bankList').querySelectorAll('.bank-item'))item.classList.toggle('quiz-being-edited',item.dataset.questionId===q.id&&item.dataset.questionType===type);
  }
  function stopEditMode(){
    delete form.dataset.editingId;
    editNotice.hidden=true;editNotice.textContent='';
    typeSelect.disabled=false;
    $('cancelEditBtn').textContent='清除表單';
    for(const item of $('bankList').querySelectorAll('.bank-item'))item.classList.remove('quiz-being-edited');
  }
  function changeType(){
    const isOpen=typeSelect.value==='open';
    openEditor.hidden=!isOpen;
    if(optionEditor)optionEditor.hidden=isOpen;
    if(answerEditor)answerEditor.hidden=isOpen;
    if(explanationEditor)explanationEditor.hidden=isOpen;
    for(const inp of optionInputs){inp.required=!isOpen;inp.disabled=isOpen;}
    $('editReferenceAnswer').required=isOpen;
  }
  typeSelect.addEventListener('change',changeType);
  function scoreText(){
    $('quizScore').textContent=`四選一已答 ${answeredCount} · 答對 ${correctCount}｜問答複習 ${reviewCount} · 掌握 ${masteredCount}`;
  }
  function renderOpen(q, poolSize){
    activeQuestion=null;questionAnswered=false;currentOpen=q;currentId=q.id;
    $('quizCategory').textContent=q.category+' · 開放問答';
    $('quizAvailable').textContent=`${levelSelect.value} · 本宿 ${poolSize} 題`;
    $('questionText').textContent=q.prompt;
    $('answerFeedback').textContent='';
    const wrap=$('answerOptions');wrap.replaceChildren();
    const controls=node('div','open-answer-control');
    const reveal=node('button','', '顯示參考答案');reveal.type='button';
    const mastered=node('button','', '✓ 已掌握');mastered.type='button';mastered.hidden=true;
    const retry=node('button','', '↻ 待複習');retry.type='button';retry.hidden=true;
    const answer=node('div','open-answer-content');answer.hidden=true;
    answer.textContent='';
    reveal.addEventListener('click',async()=>{reveal.disabled=true;try{const data=await window.quizRevealOpenAnswer(q.id);answer.textContent='來源參考答案（'+q.review_status+'）\n'+data.reference_answer+'\n\n來源：'+(q.source_title||'管理員自訂題目');reveal.hidden=true;answer.hidden=false;mastered.hidden=false;retry.hidden=false;}catch(e){$('answerFeedback').textContent='請先登入會員才能查看參考答案（鎖定期間不可查看）：'+e.message;}finally{reveal.disabled=false;}});
    const mark=async(yes)=>{
      if(typeof window.challengeRecordOpen==='function'){
        const recorded=await window.challengeRecordOpen(q,yes);
        if(!recorded)return;
      }
      reviewCount++;if(yes)masteredCount++;scoreText();selectQuizForMansion(activeMansion);
    };
    mastered.addEventListener('click',()=>mark(true));retry.addEventListener('click',()=>mark(false));
    controls.append(reveal,mastered,retry);wrap.append(controls,answer);
    const note=node('p','qa-review-note','參考答案依來源文件保存，未逐題考證；二十八宿歸屬僅為教學互動分組。');wrap.append(note);
    $('nextQuestionBtn').disabled=false;scoreText();
  }
  function currentLevel(){return levelSelect.value;}
  // 兩種題型共用唯一的二十八宿問答欄；抽宿及換題均走本函數。
  selectQuizForMansion=function(index){
    activeMansion=index;
    const mansion=MANSIONS[index].name, level=currentLevel();
    const multiple=questionBank.filter(q=>q.mansion===mansion && (level==='all'||(q.difficulty||'中階')===level)).map(q=>({...q,type:'choice'}));
    const opened=openRows.filter(q=>q.mansion===mansion && (level==='all'||q.difficulty===level));
    const pool=multiple.concat(opened);
    $('quizScope').textContent=`目前星宿：${mansion}`;
    $('quizAvailable').textContent=`${level} · 本宿共 ${pool.length} 題`;
    scoreText();
    if(!pool.length){
      activeQuestion=null;currentOpen=null;questionAnswered=false;
      $('quizCategory').textContent=openLoadPending?'正在載入':'本宿暫無題目';
      $('questionText').textContent=openLoadPending?'正在載入難度題庫…':`${mansion} 在「${level}」目前沒有題目，請選其他難度，或由管理員新增。`;
      $('answerOptions').replaceChildren();$('answerFeedback').textContent='';$('nextQuestionBtn').disabled=true;
      return;
    }
    const alternatives=pool.filter(q=>q.id!==currentId), choices=alternatives.length?alternatives:pool;
    const q=choices[fairRandomInt(choices.length)];currentId=q.id;
    if(q.type==='open')renderOpen(q,pool.length);
    else{currentOpen=null;baseShow(q,pool.length);$('quizAvailable').textContent=`${level} · 本宿共 ${pool.length} 題`;scoreText();}
  };
  answerQuestion=function(i){baseAnswer(i);scoreText();};
  levelSelect.addEventListener('change',()=>{currentId='';selectQuizForMansion(activeMansion);});

  async function fetchOpen(){
    try{
      if(!CLOUD_READY)throw new Error('未啟用 Supabase');
      const data=await cloudCall(adminAccessToken?'/rest/v1/rpc/quiz_admin_open_question_bank':'/rest/v1/quiz_open_questions?select='+fields+'&order=source_question_no.asc.nullslast,id.asc&limit=3000',adminAccessToken?{method:'POST',headers:{'Content-Type':'application/json'},body:'{}'}:{},Boolean(adminAccessToken));
      if(!Array.isArray(data))throw new Error('雲端問答題庫格式無效');
      openRows=data.map(normalize);source='Supabase 開放問答題庫';
    }catch(err){
      openRows=[];source='無法載入問答題庫：'+err.message;
    }finally{openLoadPending=false;selectQuizForMansion(activeMansion);renderBankList();}
  }
  // 在同一個「數術題庫管理」列表呈現四選一與開放問答。
  function editOpen(id){
    const q=openRows.find(x=>x.id===id);if(!q)return;
    editingOpenId=id;editingQuestionId=null;
    $('editorHeading').textContent='編輯開放問答';$('saveQuestionBtn').textContent='儲存修改';
    typeSelect.value='open';levelEditorSelect.value=q.difficulty;
    $('editMansion').value=q.mansion;
    // Source category is historical metadata, not a second classification selector.
    $('editCategory').value=q.category||'其他';
    $('editPrompt').value=q.prompt;
    $('editReferenceAnswer').value=q.reference_answer;
    $('editSourceTitle').value=q.source_title;
    $('editSourceNo').value=q.source_question_no??'';
    $('editReviewStatus').value=q.review_status;
    changeType();showEditMode(q,'open');$('editPrompt').focus();$('editPrompt').scrollIntoView({block:'nearest'});
  }
  editQuestion=function(id){
    if(openRows.some(q=>q.id===id))return editOpen(id);
    editingOpenId=null;typeSelect.value='choice';changeType();baseEdit(id);
    const q=questionBank.find(item=>item.id===id);
    if(q)showEditMode(q,'choice');
  };
  clearEditor=function(){editingOpenId=null;typeSelect.value='choice';stopEditMode();changeType();baseClear();levelEditorSelect.value='中階';};
  const oldResetButton=$('newQuestionBtn');
  // 主頁原有「新增題目」事件呼叫 clearEditor，故無須另建入口。
  const oldFilter=$('bankFilter'),search=$('bankSearch');
  renderBankList=function(){
    const target=$('bankList');target.replaceChildren();
    const mansion=oldFilter.value, difficulty=managerLevelSelect.value, keyword=search.value.trim().toLowerCase();
    const kind=$('bankKnowledgeType')?.value||'all';
    const all=[...questionBank.map(q=>({...q,type:'choice',difficulty:q.difficulty||'中階'})),...openRows];
    // Filter the data by its stable question ID and persisted knowledge_type.
    // Open Q&A has no knowledge_type database column, so type-filtered views
    // include only choice questions. Do not guess from duplicate question text.
    const rows=all.filter(q=>(mansion==='all'||q.mansion===mansion) &&
       (difficulty==='all'||q.difficulty===difficulty) &&
       (kind==='all'||(q.type==='choice'&&inferKnowledgeType(q)===kind)) &&
       (!keyword||[q.prompt,q.category,q.mansion,q.explanation,q.reference_answer,q.knowledge_type].filter(Boolean).join(' ').toLowerCase().includes(keyword)));
    $('bankListCount').textContent=`${rows.length} / ${all.length} 題`+(kind==='all'?'':'（數術類型僅篩選四選一）');
    if(!rows.length){target.append(node('p','bank-list-empty','目前沒有符合條件的題目。'));return;}
    for(const q of rows){
      const item=node('article','bank-item');
      item.dataset.questionId=q.id;item.dataset.questionType=q.type;
      if(form.dataset.editingId===q.id)item.classList.add('quiz-being-edited');
      item.append(node('div','bank-item-top',`${q.difficulty} · ${q.mansion} · ${q.type==='open'?'開放問答':inferKnowledgeType(q)+' · 四選一'}`));
      item.append(node('div','bank-item-question',q.prompt));
      const actions=node('div','bank-item-actions');
      const edit=node('button','', '修改題目');edit.type='button';edit.addEventListener('click',()=>editQuestion(q.id));
      const del=node('button','delete','刪除');del.type='button';
      del.addEventListener('click',()=>removeQuestion(q.id));
      actions.append(edit,del);item.append(actions);target.append(item);
    }
  };
  managerLevelSelect.addEventListener('change',renderBankList);
  removeQuestion=async function(id){
    const q=openRows.find(x=>x.id===id);
    if(!q)return baseDelete(id);
    if(!isAdmin()){displayBankToast('請先登入管理員。');return;}
    if(!confirm(`確定刪除此題嗎？\n${q.prompt}`))return;
    try{
      await cloudCall('/rest/v1/quiz_open_questions?id=eq.'+encodeURIComponent(id),{method:'DELETE'},true);
      await fetchOpen();displayBankToast('開放問答已刪除。');
    }catch(e){displayBankToast('刪除失敗：'+e.message);}
  };
  // 插入 capture 階段處理開放問答，避免原四選一 submit handler驗證四個選項。
  form.addEventListener('submit',async event=>{
    if(typeSelect.value!=='open')return;
    event.preventDefault();event.stopImmediatePropagation();
    if(!isAdmin()){displayBankToast('請先登入管理員。');return;}
    const payload={id:editingOpenId||('open-custom-'+(crypto.randomUUID?.()||Date.now())),
      source_question_no:$('editSourceNo').value?Number($('editSourceNo').value):null,
      difficulty:levelEditorSelect.value, mansion:$('editMansion').value,category:$('editCategory').value,
      prompt:$('editPrompt').value.trim(),reference_answer:$('editReferenceAnswer').value.trim(),
      source_title:$('editSourceTitle').value.trim(),source_url:editingOpenId?(openRows.find(q=>q.id===editingOpenId)?.source_url||''):'',
      review_status:$('editReviewStatus').value};
    if(!payload.prompt||!payload.reference_answer){displayBankToast('請填寫題目與參考答案。');return;}
    if(editingOpenId&&!window.confirm('確定儲存這道開放問答的修改？原題號會保留。'))return;
    $('saveQuestionBtn').disabled=true;
    try{
      await cloudCall('/rest/v1/quiz_open_questions?on_conflict=id',{method:'POST',headers:{'Content-Type':'application/json','Prefer':'resolution=merge-duplicates,return=minimal'},body:JSON.stringify([payload])},true);
      const wasEditing=Boolean(editingOpenId);
      await fetchOpen();clearEditor();displayBankToast(wasEditing?'開放問答修改已儲存至 Supabase。':'開放問答已儲存至 Supabase。');
    }catch(e){displayBankToast('儲存失敗：'+e.message);}finally{$('saveQuestionBtn').disabled=false;}
  },true);
  // 原有匯入／匯出 JSON 仍專供四選一題目，避免不相容的格式互相覆蓋。
  $('exportBankBtn').textContent='↓ 匯出四選一 JSON';
  $('importBankBtn').textContent='↑ 匯入四選一 JSON';
  const exportOpen=node('button','outline-btn','↓ 匯出開放問答 JSON');exportOpen.type='button';
  exportOpen.addEventListener('click',()=>{
    const blob=new Blob([JSON.stringify({version:1,questions:openRows},null,2)],{type:'application/json'});
    const u=URL.createObjectURL(blob),a=node('a');a.href=u;a.download='open-questions-backup.json';a.click();setTimeout(()=>URL.revokeObjectURL(u),1500);
  });
  $('exportBankBtn').after(exportOpen);
  window.quizRefreshOpenBank=fetchOpen;
  clearEditor();fetchOpen();
})();
