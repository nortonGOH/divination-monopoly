/* v9: Unified resource menu + one-click source import and level-balanced 28-mansion distribution.
   Uses the existing quiz_questions RLS admin session. No secret keys or local answer tracking. */
(() => {
  'use strict';
  const byId=id=>document.getElementById(id);
  const manage=byId('manageBankBtn');
  const library=byId('libraryStandaloneBtn');
  const heading=byId('quizTitle')?.closest('.quiz-heading');
  const dialog=byId('bankDialog');
  if(!manage||!library||!heading||!dialog)return;

  const css=document.createElement('style');
  css.textContent=`
    #manageBankBtn,#libraryStandaloneBtn{display:none!important}
    .v9-resource-selector{position:fixed;right:14px;bottom:14px;display:inline-flex;align-items:center;z-index:900;filter:drop-shadow(0 4px 12px #24323b33)}
    .v9-resource-trigger{font:inherit;font-size:.76rem;border:1px solid #bba37d;border-radius:24px;background:#fff8eaeb;color:#58452d;padding:9px 12px;cursor:pointer}
    .v9-resource-menu{position:absolute;right:0;bottom:calc(100% + 7px);min-width:205px;display:grid;gap:5px;border:1px solid #d6c4a5;background:#fffbf2;padding:8px;border-radius:11px;box-shadow:0 14px 35px #1721292b;z-index:20}
    .v9-resource-menu[hidden]{display:none!important}
    .v9-resource-menu button{border:0;text-align:left;background:transparent;padding:12px;border-radius:7px;color:#43392b;cursor:pointer;font:inherit}
    .v9-resource-menu button:hover,.v9-resource-menu button:focus-visible{background:#f0e3ce}
    .v9-balance-action{border:1px solid #a78b5d!important;background:#fff7e9!important}
  `;
  document.head.append(css);
  const wrap=document.createElement('div');wrap.className='v9-resource-selector';
  const trigger=document.createElement('button');trigger.type='button';
  trigger.className='v9-resource-trigger';trigger.setAttribute('aria-haspopup','true');
  trigger.setAttribute('aria-expanded','false');trigger.textContent='管理題庫／文獻庫 ▾';
  const menu=document.createElement('div');menu.className='v9-resource-menu';menu.hidden=true;
  const bankAction=document.createElement('button');bankAction.type='button';bankAction.textContent='數術題庫管理';
  const libraryAction=document.createElement('button');libraryAction.type='button';libraryAction.textContent='站內文獻庫';
  menu.append(bankAction,libraryAction);wrap.append(trigger,menu);heading.append(wrap);
  const setMenu=open=>{menu.hidden=!open;trigger.setAttribute('aria-expanded',String(open));};
  trigger.addEventListener('click',()=>setMenu(menu.hidden));
  bankAction.addEventListener('click',()=>{setMenu(false);manage.click();});
  libraryAction.addEventListener('click',()=>{setMenu(false);library.click();});
  document.addEventListener('click',e=>{if(!wrap.contains(e.target))setMenu(false);});
  document.addEventListener('keydown',e=>{if(e.key==='Escape')setMenu(false);});

  const toolbar=dialog.querySelector('.bank-toolbar');
  if(!toolbar||typeof fetchCloudBank!=='function'||typeof upsertCloud!=='function'||
     typeof persistBank!=='function'||typeof validBank!=='function')return;
  const importBtn=document.createElement('button');importBtn.type='button';importBtn.className='outline-btn v9-balance-action';
  importBtn.textContent='匯入新增題目並均分28宿';
  const balanceBtn=document.createElement('button');balanceBtn.type='button';balanceBtn.className='outline-btn';
  balanceBtn.textContent='重新均分現有題庫';
  const input=document.createElement('input');input.type='file';input.accept='.json,application/json';input.hidden=true;
  toolbar.append(importBtn,balanceBtn,input);

  const LEVELS=['初階','中階','高階'];
  const MANSIONS=Array.isArray(window.MANSION_NAMES)?window.MANSION_NAMES:
     (typeof MANSION_NAMES!=='undefined'?MANSION_NAMES:[]);
  function balancedRows(rows){
    if(MANSIONS.length!==28)throw Error('二十八宿資料不完整，無法執行均分。');
    const pool=rows.map(q=>({...q,difficulty:LEVELS.includes(q.difficulty)?q.difficulty:'中階'}));
    for(const level of LEVELS){
      const sub=pool.filter(q=>q.difficulty===level).sort((a,b)=>a.id.localeCompare(b.id,'en'));
      sub.forEach((q,i)=>{q.mansion=MANSIONS[i%28];});
    }
    return pool;
  }
  async function apply(includeNew,sourceRows=[]){
    if(!adminAccessToken){displayBankToast('請先登入題庫管理員帳號。');return;}
    if(!window.confirm(includeNew?
      '將選取的JSON新題與既有四選一題合併，再按初中高階均分28宿。保留現有題目及題號，但重新配置星宿。確定嗎？':
      '將現有全部四選一題目按難度均分到28宿，會改變星宿歸屬。確定嗎？'))return;
    importBtn.disabled=true;balanceBtn.disabled=true;
    try{
      const existing=await fetchCloudBank();
      const map=new Map(existing.map(q=>[q.id,q]));
      let added=0;
      if(includeNew){
        const imported=validBank(sourceRows);
        if(!imported.length)throw Error('選取的檔案沒有任何四選一題目。');
        for(const q of imported){if(!map.has(q.id)){map.set(q.id,q);added++;}}
      }
      const rows=balancedRows([...map.values()]);
      if(!rows.length)throw Error('雲端題庫為空，無法均分。');
      await upsertCloud(rows);
      await persistBank();
      const counts=LEVELS.map(l=>l+': '+rows.filter(q=>q.difficulty===l).length+'題');
      const short=LEVELS.filter(l=>rows.filter(q=>q.difficulty===l).length<28);
      const message='更新成功：新增 '+added+' 題；'+counts.join('、')+
        '。每一難度按28宿輪流平均配置。'+(short.length?'注意：'+short.join('、')+'不足28題，仍有空宮。':'');
      displayBankToast(message);
    }catch(err){displayBankToast('匯入／均分失敗：'+(err.message||String(err)));}
    finally{importBtn.disabled=false;balanceBtn.disabled=false;}
  }
  importBtn.addEventListener('click',()=>input.click());
  input.addEventListener('change',async()=>{
    const file=input.files?.[0];if(!file)return;
    try{
      if(file.size>2*1024*1024)throw Error('檔案超過2MB，請分批匯入。');
      const parsed=JSON.parse(await file.text());
      await apply(true,parsed);
    }catch(err){displayBankToast('讀取題庫檔失敗：'+err.message);}
    finally{input.value='';}
  });
  balanceBtn.addEventListener('click',()=>apply(false));
})();