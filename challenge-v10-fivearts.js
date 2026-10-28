/* v10: five-arts classification (山、醫、命、卜、相) separate from fine topic category. */
(() => {
'use strict';
const $=id=>document.getElementById(id);
const form=$('questionForm'),dialog=$('bankDialog'),filterBar=$('bankFilter')?.closest('.bank-filters');
if(!form||!dialog||!filterBar||typeof inferKnowledgeType!=='function')return;
const types=[['all','全部五術類型'],['山','山（修練）'],['醫','醫（漢醫）'],['命','命（星、命）'],['卜','卜（占卜）'],['相','相（相術、風水）'],['天文曆法','天文曆法'],['待分類','待分類']];
const chooser=(id,all)=>{const select=document.createElement('select');select.id=id;for(const [v,name] of types){if(!all&&v==='all')continue;const opt=document.createElement('option');opt.value=v;opt.textContent=name;select.append(opt);}return select;};
const editLabel=document.createElement('label');editLabel.textContent='五術類型';
const editSelect=chooser('editKnowledgeType',false);editLabel.append(editSelect);
form.querySelector('.editor-columns')?.append(editLabel);
const filterLabel=document.createElement('label');filterLabel.textContent='五術類型篩選';
const filterSelect=chooser('bankKnowledgeType',true);filterLabel.append(filterSelect);filterBar.append(filterLabel);
const challengeHeader=$('quizTitle')?.closest('.quiz-heading');
const challengeLabel=document.createElement('label');challengeLabel.className='level-chooser';challengeLabel.textContent='挑戰類型';
const challengeSelect=chooser('challengeKnowledgeType',true);challengeLabel.append(challengeSelect);challengeHeader?.append(challengeLabel);
const style=document.createElement('style');style.textContent='#editKnowledgeType,#bankKnowledgeType,#challengeKnowledgeType{max-width:100%;border:1px solid #cbb99d;background:#fffaf0;padding:8px;border-radius:9px;font:inherit;color:#343b3d}.quiz-heading{flex-wrap:wrap}';document.head.append(style);
// The base bank's editors call global functions dynamically, so wrap both entry points.
const previousEdit=editQuestion;
editQuestion=function(id){
  previousEdit(id);
  const question=questionBank.find(q=>q.id===id);
  if(question)editSelect.value=inferKnowledgeType(question);
};
const previousClear=clearEditor;
clearEditor=function(){previousClear();editSelect.value='待分類';};
const previousRender=renderBankList;
renderBankList=function(){
  previousRender();
  const wanted=filterSelect.value;
  if(wanted==='all')return;
  const list=$('bankList');
  for(const item of [...list.querySelectorAll('.bank-item')]){
    const text=item.querySelector('.bank-item-question')?.textContent;
    const match=questionBank.find(q=>q.prompt===text);
    // Legacy free-response questions have no five-arts field: mark as pending.
    const kind=match?inferKnowledgeType(match):'待分類';
    if(kind!==wanted)item.hidden=true;
  }
  const visible=[...list.querySelectorAll('.bank-item')].filter(x=>!x.hidden).length;
  $('bankListCount').textContent=visible+' / '+[...list.querySelectorAll('.bank-item')].length+' 個目前頁面題目';
};
filterSelect.addEventListener('change',renderBankList);
// Use a single source of truth for challenge type selection in the v8 wheel-only selection.
window.quizFiveArtsSelection=()=>challengeSelect.value;
challengeSelect.addEventListener('change',()=>{
  const panel=document.querySelector('.quiz-section .quiz-panel');
  if(panel)panel.hidden=true;
  const note=document.querySelector('.v8-empty-note');if(note){note.hidden=false;note.textContent='已切換五術類型；請重新抽宿取得符合條件的四選一題目。';}
});
const save=form.querySelector('#saveQuestionBtn');
if(save){
  // Existing handler builds its payload from editKnowledgeType in index.html.
  editSelect.value='待分類';
}
})();
