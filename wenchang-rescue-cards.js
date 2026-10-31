/* Four Wenchang Rescue cards: free tools use public question text only.
 * All credits, account validation and answer disclosure remain in v7 Supabase RPC.
 */
(() => {
  'use strict';
  const dlg = document.querySelector('dialog.wenchang-dialog');
  if (!dlg || dlg.dataset.rescueCards === 'ready') return;
  const yes = dlg.querySelector('.wenchang-primary');
  const no = dlg.querySelector('.wenchang-actions button:not(.wenchang-primary)');
  const answer = dlg.querySelector('.wenchang-answer');
  const actions = dlg.querySelector('.wenchang-actions');
  if (!yes || !no || !answer || !actions) return;
  dlg.dataset.rescueCards = 'ready';
  dlg.classList.add('wenchang-card-dialog');
  const style = document.createElement('style');
  style.textContent = [
    '.wenchang-card-dialog{width:min(680px,calc(100vw - 24px));padding:20px}',
    '.wenchang-card-dialog .wenchang-original-reveal{display:none!important}',
    '.wenchang-card-dialog .wenchang-intro{font-size:.85rem;color:#626456;margin:6px 0 13px}',
    '.wenchang-card-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px;margin:12px 0}',
    '.wenchang-card-dialog .wenchang-card-choice{display:flex;align-items:flex-start;text-align:left;gap:11px;padding:13px;background:#fffdf7;border:1px solid #c9b996;border-radius:12px;width:100%;min-height:99px;white-space:normal}',
    '.wenchang-card-dialog .wenchang-card-choice[aria-expanded=true]{outline:2px solid #356a60;background:#edf5ee;border-color:#356a60}',
    '.wenchang-card-symbolic{flex:none;font-size:1.45rem;line-height:1.3;color:#8d6730}',
    '.wenchang-card-copy{display:grid;gap:5px;min-width:0}',
    '.wenchang-card-copy strong{font-size:.97rem;color:#263943}',
    '.wenchang-card-copy small{font-size:.78rem;line-height:1.5;color:#636c6c}',
    '.wenchang-card-price{font-size:.74rem;color:#765a31;font-weight:700}',
    '.wenchang-card-detail{padding:14px;margin:10px 0 16px;border:1px solid #c2cdbf;border-radius:12px;background:#fbfcf7}',
    '.wenchang-card-detail[hidden]{display:none!important}',
    '.wenchang-card-detail h3{margin:0 0 9px;font-size:1.06rem;color:#345a4c}',
    '.wenchang-card-detail p{margin:6px 0;font-size:.86rem;line-height:1.7;overflow-wrap:anywhere}',
    '.wenchang-card-detail .wenchang-plain-question{padding:10px;background:#f0eee7;border-radius:8px;white-space:pre-wrap}',
    '.wenchang-card-dialog .wenchang-compare-list{display:grid;gap:7px;margin:10px 0}',
    '.wenchang-card-dialog .wenchang-compare-option{display:block;width:100%;text-align:left;white-space:normal;background:#fff}',
    '.wenchang-card-dialog .wenchang-compare-option[aria-pressed=true]{opacity:.72;text-decoration:line-through;background:#eeece7}',
    '.wenchang-card-dialog .wenchang-paid-action{background:#315f56;color:#fff;border-color:#315f56;margin:9px 0 3px}',
    '.wenchang-card-dialog textarea{display:block;width:100%;min-height:105px;border:1px solid #a9a9a0;border-radius:8px;padding:10px;font:inherit;background:white;color:#293b40}',
    '.wenchang-card-dialog button:focus-visible,.wenchang-card-dialog textarea:focus-visible{outline:3px solid #c38429;outline-offset:2px}',
    '.wenchang-card-dialog .wenchang-answer{margin-top:12px}',
    '.wenchang-card-dialog .wenchang-footnote{font-size:.76rem;color:#64716b}',
    '@media(max-width:530px){.wenchang-card-grid{grid-template-columns:1fr}.wenchang-card-dialog{padding:14px}.wenchang-card-dialog .wenchang-card-choice{min-height:70px}}'
  ].join('\n');
  document.head.append(style);
  const make = (tag, str, cls) => {
    const el = document.createElement(tag);
    if (str != null) el.textContent = str;
    if (cls) el.className = cls;
    return el;
  };
  const intro = make('p','文昌星救援卡僅提供已註冊電子郵件並登入的會員；暱稱＋IP 訪客不適用。免費卡只使用公開題面，文昌解惑需驗證會員後解鎖。','wenchang-intro');
  const grid = make('div',null,'wenchang-card-grid');
  grid.setAttribute('role','group');
  grid.setAttribute('aria-label','救援卡片選擇');
  const detail = make('section',null,'wenchang-card-detail');
  detail.id = 'wenchangCardDetail';
  detail.hidden = true;
  const types = [
    ['read','◇','審題羅盤','整理題幹、分類與推理方向','免費'],
    ['compare','▦','選項推敲','自己標記需要排除的選項','免費'],
    ['reveal','✦','文昌解惑','驗證身分後解鎖正確答案與解析','1 點（答對可賺取）'],
    ['notes','✎','溫故札記','寫下疑問並複製個人筆記','免費']
  ];
  const choices = new Map();
  let selected='',questionText='',noteText='',pending=false,active=false;
  for (const [id,symbol,title,desc,price] of types) {
    const choice=make('button',null,'wenchang-card-choice');
    choice.type='button';
    choice.dataset.card=id;
    choice.setAttribute('aria-controls',detail.id);
    choice.setAttribute('aria-expanded','false');
    const icon=make('span',symbol,'wenchang-card-symbolic');
    icon.setAttribute('aria-hidden','true');
    const copy=make('span',null,'wenchang-card-copy');
    copy.append(make('strong',title),make('small',desc),make('span',price,'wenchang-card-price'));
    choice.append(icon,copy);
    choice.addEventListener('click',()=>showCard(id));
    choices.set(id,choice);
    grid.append(choice);
  }
  actions.before(intro,grid,detail);
  yes.classList.add('wenchang-original-reveal');
  detail.append(answer);

  const options=()=>[...(document.querySelector('#answerOptions')?.children||[])].slice(0,4);
  const add=(parent,tag,str,cls)=>{
    const element=make(tag,str,cls);
    parent.append(element);
    return element;
  };
  function showCard(id) {
    if(window.quizEmailMemberSession?.() !== true){
      selected='';
      detail.hidden=false;
      detail.replaceChildren(make('p','救援卡僅供已註冊電子郵件並登入的會員使用；暱稱與 IP 登記不具救援權限。'));
      return;
    }
    selected=id;
    for (const [key,choice] of choices) choice.setAttribute('aria-expanded',String(key===id));
    detail.replaceChildren();
    detail.hidden=false;
    if (id==='read') {
      add(detail,'h3','審題羅盤・重新理解題意');
      const type=document.getElementById('quizAvailable')?.textContent?.trim();
      if(type)add(detail,'p','題型資訊：'+type);
      add(detail,'p',questionText||'無法讀取目前題目','wenchang-plain-question');
      add(detail,'p','思考方向：找出核心對象、限定語及時間／地域脈絡，留意概念之間是否容易混淆。');
      add(detail,'p','一般性讀題建議，不表示已查證題庫或替您排除任何答案。','wenchang-footnote');
    } else if(id==='compare') {
      add(detail,'h3','選項推敲・個人排除筆記');
      const previous=options().findIndex(x=>x.classList.contains('wrong'));
      add(detail,'p',previous>=0?'您本次選了 '+['A','B','C','D'][previous]+'，可以自行標記想排除的選項。':'點選選項可以暫時標記為排除。');
      const list=add(detail,'div',null,'wenchang-compare-list');
      const opts=options();
      if(!opts.length)add(list,'p','目前沒有可比較的選項。');
      opts.forEach((el,i)=>{
        const btn=add(list,'button',['A','B','C','D'][i]+'．'+el.textContent.trim(),'wenchang-compare-option');
        btn.type='button';
        btn.setAttribute('aria-pressed','false');
        btn.addEventListener('click',()=>{
          btn.setAttribute('aria-pressed',String(btn.getAttribute('aria-pressed')!=='true'));
        });
      });
      add(detail,'p','排除只是使用者標記；不代表選項正誤，不會影響正式成績。','wenchang-footnote');
    } else if(id==='reveal') {
      add(detail,'h3','文昌解惑・查看正解與解析');
      add(detail,'p','每答對 1 題可得 1 點，首次解鎖扣 1 點；已解鎖的答案可免費重看。點數由伺服器核實。');
      const button=add(detail,'button','使用 1 點解鎖','wenchang-paid-action');
      button.type='button';
      button.id='wenchangCardRevealAction';
      button.addEventListener('click',()=>{
        if(pending||yes.disabled||yes.hidden||!dlg.open)return;
        pending=true;
        button.disabled=true;
        yes.click();
      });
      detail.append(answer);
      syncReveal();
      add(detail,'p','救援不會抵銷已累計的答錯次數，也不會提前解除鎖定。','wenchang-footnote');
    } else if(id==='notes') {
      add(detail,'h3','溫故札記・待考證問題');
      add(detail,'p','記錄自己對題目、概念與文獻的疑惑：');
      const field=add(detail,'textarea');
      field.id='wenchangReflectionText';
      field.setAttribute('aria-label','個人錯題反思');
      field.placeholder='我的原先判斷……仍待考證的問題……';
      field.value=noteText;
      field.addEventListener('input',()=>{noteText=field.value;});
      const copy=add(detail,'button','複製札記');
      copy.type='button';
      const notice=add(detail,'p','只保留在本次開啟的視窗中；不會上傳或自動儲存。','wenchang-footnote');
      copy.addEventListener('click',async()=>{
        const copied='題目：'+questionText+'\n我的反思：'+noteText;
        try{
          if(!navigator.clipboard?.writeText)throw Error('unavailable');
          await navigator.clipboard.writeText(copied);
          notice.textContent='札記已複製，網站不會儲存您的內容。';
        }catch(_){
          field.focus();
          field.select();
          notice.textContent='瀏覽器未授權複製；已選取您的筆記，請手動複製。';
        }
      });
    }
  }
  function syncReveal() {
    if (!active || selected!=='reveal') return;
    const button=detail.querySelector('#wenchangCardRevealAction');
    if(!button)return;
    const unlocked=yes.hidden||!answer.hidden;
    if(unlocked){
      pending=false;
      button.disabled=true;
      button.textContent='本題已解鎖';
    } else {
      if(!yes.disabled)pending=false;
      button.disabled=yes.disabled||pending;
      button.textContent=pending?'正在聯繫伺服器…':'使用 1 點解鎖';
    }
  }
  new MutationObserver(syncReveal).observe(yes,{attributes:true,attributeFilter:['hidden','disabled']});
  new MutationObserver(syncReveal).observe(answer,{attributes:true,attributeFilter:['hidden']});
  new MutationObserver(()=>{
    active=dlg.open;
    if(active){
      questionText=document.getElementById('questionText')?.textContent?.trim()||'';
      noteText='';
      selected='';
      pending=false;
      detail.hidden=true;
      detail.replaceChildren();
      detail.append(answer);
      for(const choice of choices.values())choice.setAttribute('aria-expanded','false');
    } else {
      pending=false;
    }
  }).observe(dlg,{attributes:true,attributeFilter:['open']});
})();