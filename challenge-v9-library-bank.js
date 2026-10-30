/* Bank management shortcut. Question imports use the guarded, review-first editor.
 * Never redistribute existing questions between lunar mansions automatically. */
(() => {
  'use strict';
  const manage=document.getElementById('manageBankBtn');
  const heading=document.getElementById('quizTitle')?.closest('.quiz-heading');
  if(!manage||!heading)return;
  const css=document.createElement('style');
  css.textContent=`
    #manageBankBtn{display:none!important}
    .v9-resource-selector{position:fixed;right:14px;bottom:14px;display:inline-flex;align-items:center;z-index:900;filter:drop-shadow(0 4px 12px #24323b33)}
    .v9-resource-trigger{font:inherit;font-size:.76rem;border:1px solid #bba37d;border-radius:24px;background:#fff8eaeb;color:#58452d;padding:9px 12px;cursor:pointer}
  `;
  document.head.append(css);
  const wrap=document.createElement('div');wrap.className='v9-resource-selector';
  const trigger=document.createElement('button');
  trigger.type='button';
  trigger.className='v9-resource-trigger';
  trigger.textContent='管理題庫';
  trigger.setAttribute('aria-label','開啟題庫管理');
  wrap.append(trigger);
  heading.append(wrap);
  trigger.addEventListener('click',()=>manage.click());
})();
