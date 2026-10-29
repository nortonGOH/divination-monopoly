/* v10: five-arts classification (山、醫、命、卜、相) separate from fine topic category. */
(() => {
'use strict';
const $=id=>document.getElementById(id);
const form=$('questionForm'),dialog=$('bankDialog'),filterBar=$('bankFilter')?.closest('.bank-filters');
if(!form||!dialog||!filterBar||typeof inferKnowledgeType!=='function')return;
const types=[['all','數術類型'],['山','山（修練）'],['醫','醫（漢醫）'],['命','命（星、命）'],['卜','卜（占卜）'],['相','相（相術、風水）'],['式占','式占'],['天文曆法','天文曆法'],['易學','易學'],['待分類','待分類']];
const chooser=(id,all)=>{const select=document.createElement('select');select.id=id;for(const [v,name] of types){if(!all&&v==='all')continue;const opt=document.createElement('option');opt.value=v;opt.textContent=name;select.append(opt);}return select;};
const editLabel=document.createElement('label');editLabel.textContent='數術類型';
const editSelect=chooser('editKnowledgeType',false);editLabel.append(editSelect);
form.querySelector('.editor-columns')?.append(editLabel);
const filterLabel=document.createElement('label');filterLabel.textContent='數術類型篩選';
const filterSelect=chooser('bankKnowledgeType',true);filterLabel.append(filterSelect);filterBar.append(filterLabel);
const challengeHeader=$('quizTitle')?.closest('.quiz-heading');
const challengeLabel=document.createElement('label');challengeLabel.className='level-chooser';challengeLabel.textContent='挑戰類型';
const challengeSelect=chooser('challengeKnowledgeType',true);challengeLabel.append(challengeSelect);challengeHeader?.append(challengeLabel);
const style=document.createElement('style');style.textContent='#editKnowledgeType,#bankKnowledgeType,#challengeKnowledgeType{max-width:100%;border:1px solid #cbb99d;background:#fffaf0;padding:8px;border-radius:9px;font:inherit;color:#343b3d}.quiz-heading{flex-wrap:wrap}';document.head.append(style);
// The base bank's editors call global functions dynamically, so wrap both entry points.
// Sync the administrator's manual classification with the editor when a question is opened.
const defaultNote='選擇數術類型後按「儲存修改」。保留原題號與原始題材資料；重新載入後即可在新類型中找到題目。';
function updateEditorType(question){
  const isChoice=Boolean(question);
  editSelect.disabled=!isChoice;
  editSelect.value=isChoice?inferKnowledgeType(question):'待分類';
  editSelect.title=isChoice?'修改四選一題目的數術類型':'開放問答目前未設有數術類型資料欄位';
  const note=$('quizClassificationNote');
  if(note)note.textContent=isChoice?defaultNote:'開放問答目前無數術類型欄位，不能在此變更；原有題材資料仍保留。';
}
const previousEdit=editQuestion;
editQuestion=function(id){
  previousEdit(id);
  const question=questionBank.find(q=>q.id===id);
  updateEditorType(question);
};
const previousClear=clearEditor;
clearEditor=function(){
  previousClear();
  editSelect.disabled=false;
  editSelect.value='待分類';
  const note=$('quizClassificationNote');
  if(note)note.textContent=defaultNote;
};
const questionTypeSelect=$('editQuestionType');
questionTypeSelect?.addEventListener('change',()=>{
  // No knowledge_type column exists on open questions. Prevent phantom edits.
  if(questionTypeSelect.value==='open'){
    updateEditorType(null);
  }else{
    editSelect.disabled=false;
    const note=$('quizClassificationNote');
    if(note)note.textContent=defaultNote;
  }
});
// quiz-open-qa.js applies category, difficulty, search and persisted type
// together before DOM creation. Filtering rendered text loses question identity.

filterSelect.addEventListener('change',renderBankList);
// Use a single source of truth for challenge type selection in the v8 wheel-only selection.
window.quizFiveArtsSelection=()=>challengeSelect.value;
challengeSelect.addEventListener('change',()=>{
  const panel=document.querySelector('.quiz-section .quiz-panel');
  if(panel)panel.hidden=true;
  const note=document.querySelector('.v8-empty-note');if(note){note.hidden=false;note.textContent='已切換數術類型；請重新抽宿取得符合條件的四選一題目。';}
});
const save=form.querySelector('#saveQuestionBtn');
if(save){
  // Existing handler builds its payload from editKnowledgeType in index.html.
  editSelect.value='待分類';
}
})();
