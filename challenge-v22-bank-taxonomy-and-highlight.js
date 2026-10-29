/* v22: filter bank by category, clarify manual classification, highlight Wenchang rules. */
(() => {
  'use strict';
  const types = new Set(['山','醫','命','卜','相','天文曆法','易學','待分類']);
  const $ = id => document.getElementById(id);
  const css = document.createElement('style');
  css.textContent = [
    '.player-dialog .wenchang-rule-highlight{display:block;background:#fff2a6;color:#483818;border-left:4px solid #d7b536;padding:11px 13px;border-radius:7px;margin:12px 0 0;line-height:1.85}',
    '.bank-inventory .bank-type-link{font:inherit;font-weight:700;color:#205b51;background:transparent;border:1px solid transparent;border-radius:7px;padding:6px 9px;cursor:pointer}',
    '.bank-inventory .bank-type-link:hover,.bank-inventory .bank-type-link:focus-visible{background:#e3efe8;border-color:#9ab8a4}',
    '.bank-inventory .bank-type-link[aria-pressed="true"]{background:#d8e9df;border-color:#599276}',
    '#quizClassificationNote{display:block;margin:9px 0 8px;padding:9px 12px;background:#fff2c8;border-left:3px solid #d2aa3f;border-radius:6px;font-size:.85rem;line-height:1.6}'
  ].join('\n');
  document.head.append(css);
  const login = document.querySelector('dialog.player-dialog');
  if(login) {
    const intro = [...login.querySelectorAll('p')].find(p => p.textContent.includes('✦ 文昌星救援：'));
    if(intro && !intro.querySelector('.wenchang-rule-highlight')){
      const contents = intro.textContent;
      const start = contents.indexOf('✦ 文昌星救援：');
      const top = contents.slice(0,start).trim();
      const details = contents.slice(start).trim();
      intro.replaceChildren(document.createTextNode(top));
      const panel = document.createElement('span');
      panel.className='wenchang-rule-highlight';
      panel.textContent=details;
      intro.append(panel);
    }
  }
  const picker = $('editKnowledgeType');
  if(picker){
    const label=picker.closest('label');
    if(label){
      for(const node of label.childNodes){
        if(node.nodeType===Node.TEXT_NODE){node.textContent='數術類型（四選一題目）';break;}
      }
    }
    if(!$('quizClassificationNote')){
      const note=document.createElement('small');
      note.id='quizClassificationNote';
      note.textContent='數術類型僅適用四選一題目。變更時保留題號與原始題材資料，儲存後將以新的數術類型篩選並更新統計。';
      picker.insertAdjacentElement('afterend',note);
    }
  }
  const inventory = document.querySelector('#bankDialog .bank-inventory-scroll');
  if(!inventory)return;
  function selectType(type) {
    const filter = $('bankKnowledgeType'), difficulty = $('bankDifficulty');
    if(!filter || ![...filter.options].some(x=>x.value===type))return;
    filter.value=type;
    if(difficulty && [...difficulty.options].some(x=>x.value==='all'))difficulty.value='all';
    const mansion=$('bankFilter'), search=$('bankSearch');
    if(mansion)mansion.value='all';
    if(search)search.value='';
    if(typeof renderBankList==='function')renderBankList();
    ($('bankListCount')||$('bankList'))?.scrollIntoView({behavior:'smooth',block:'nearest'});
  }
  function relink(){
    for(const tr of inventory.querySelectorAll('tbody tr')){
      const td=tr.cells[0];
      if(!td || td.querySelector('.bank-type-link'))continue;
      const type=td.textContent.trim();
      if(!types.has(type))continue;
      const button=document.createElement('button');
      button.type='button';
      button.className='bank-type-link';
      button.textContent=type;
      button.title='顯示「'+type+'」類型全部難度的題目';
      button.setAttribute('aria-label','篩選「'+type+'」所有難度的題目');
      button.addEventListener('click',()=>selectType(type));
      td.replaceChildren(button);
    }
    const current=$('bankKnowledgeType')?.value;
    const diff=$('bankDifficulty')?.value;
    for(const btn of inventory.querySelectorAll('button.bank-type-link')){
      btn.setAttribute('aria-pressed',String(btn.textContent===current && diff==='all'));
    }
  }
  new MutationObserver(relink).observe(inventory,{childList:true});
  $('bankKnowledgeType')?.addEventListener('change',relink);
  $('bankDifficulty')?.addEventListener('change',relink);
  relink();
})();