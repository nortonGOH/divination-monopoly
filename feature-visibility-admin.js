(()=>{'use strict';
const bar=document.querySelector('#bankDialog .bank-toolbar'),cfg=window.QUIZ_AUTH_CONFIG||{};
const base=String(cfg.supabaseUrl||'').replace(/\/$/,'');const key=String(cfg.publishableKey||'');
if(!bar||!base||!key)return;
const el=(t,s='')=>{const n=document.createElement(t);n.textContent=s;return n;};
const open=el('button','前台顯示設定');open.type='button';open.className='outline-btn';bar.append(open);
const dialog=el('dialog');dialog.id='featureVisibilityDialog';dialog.style.cssText='width:min(560px,calc(100vw - 24px));padding:24px;border:1px solid #cbbd9e;border-radius:14px;background:#fffaf0';
const title=el('h2','前台顯示設定'),description=el('p','每個前台功能均可獨立顯示或隱藏；隱藏不會刪除資料。');
const status=el('p');status.setAttribute('role','status');
const a=el('input'),b=el('input');a.type=b.type='checkbox';
const la=el('label',' 顯示留言板'),lb=el('label',' 顯示挑戰者排行榜');la.prepend(a);lb.prepend(b);
for(const n of [la,lb])n.style.cssText='display:block;padding:12px 0';
const save=el('button','儲存顯示設定'),close=el('button','關閉');save.type=close.type='button';save.className=close.className='outline-btn';
const sections=[
 ['wenchang','文昌星救援卡'],['daily_knowledge_popup','每日知識解析卡（開啟網頁彈出）'],['daily_knowledge_front','每日知識解析卡（首頁輪播）'],['spin_challenge','抽宿挑戰'],['quick_nav','首頁快捷導覽（開始挑戰／題目與難度／二十八宿互動圖鑑／互動學習地圖）'],['learning_journal','學習修行簿'],
 ['wheel','二十八宿＋四特殊格 · 32格圓盤'],
 ['quiz','數術問答（含難度、類型、試玩資訊與題目）'],['guestbook','數術交流留言板'],['leaderboard','挑戰者排行榜']
];
const blockInputs={};const blockArea=el('div');blockArea.style.cssText='max-height:52vh;overflow:auto;display:grid;gap:8px;margin:12px 0';
for(const [key,label] of sections){const row=el('label');row.style.cssText='display:flex;align-items:center;gap:10px;padding:12px;background:#fffdf8;border:1px solid #dccbaa;border-radius:9px';const input=el('input');input.type='checkbox';input.checked=true;blockInputs[key]=input;row.append(input,document.createTextNode(label));blockArea.append(row);}
la.hidden=lb.hidden=true;
dialog.append(title,description,status,blockArea,save,close);document.body.append(dialog);
let revision=null,blockRevision=null;
const token=()=>typeof adminAccessToken==='string'?adminAccessToken:'';
async function rpc(name,payload={}){
 if(!token())throw Error('請先登入管理員');
 const res=await fetch(base+'/rest/v1/rpc/'+name,{method:'POST',headers:{apikey:key,Authorization:'Bearer '+token(),'Content-Type':'application/json'},body:JSON.stringify(payload),cache:'no-store'});
 if(!res.ok)throw Error((await res.json().catch(()=>({}))).message||'權限驗證失敗（HTTP '+res.status+'）');
 return res.json();
}
async function load(){
 save.disabled=true;status.textContent='正在讀取設定…';
 try{const x=await rpc('quiz_admin_homepage_blocks');blockRevision=x.revision;revision=x.revision;for(const [key,input] of Object.entries(blockInputs)){const legacy={guestbook:x.guestbook_visible,leaderboard:x.leaderboard_visible,daily_knowledge_front:x.daily_knowledge_visible,daily_knowledge_popup:x.blocks?.daily_knowledge!==false};input.checked=typeof x.blocks?.[key]==='boolean'?x.blocks[key]:legacy[key]!==false;}save.disabled=false;status.textContent='設定已載入。';}
 catch(e){revision=null;status.textContent='讀取失敗：'+e.message;}
}
open.onclick=()=>{if(!token()){if(typeof displayBankToast==='function')displayBankToast('請先完成管理員登入');return;}dialog.showModal();void load();};
save.onclick=async()=>{
 if(revision===null)return;save.disabled=true;status.textContent='正在儲存…';
 try{
 const blocks=Object.fromEntries(Object.entries(blockInputs).map(([key,input])=>[key,input.checked]));
 const x=await rpc('quiz_admin_save_homepage_blocks',{p_blocks:blocks,p_expected_revision:blockRevision});
 blockRevision=x.revision;revision=x.revision;status.textContent='已儲存。前台區塊顯示設定已更新。';
 await window.quizRefreshHomepageBlocks?.();
 }catch(e){status.textContent='儲存失敗：'+e.message+'。請重新讀取後再試。';}
 finally{save.disabled=false;}
};
close.onclick=()=>dialog.close();
// Dedicated order editor; keep it separate from visibility toggles and their revisions.
const orderBtn=el('button','首頁區塊排序');orderBtn.type='button';orderBtn.className='outline-btn';bar.append(orderBtn);
const orderDialog=el('dialog');orderDialog.style.cssText='width:min(600px,calc(100vw - 24px));max-height:88dvh;overflow:auto;padding:22px;border:1px solid #cbbd9e;border-radius:14px;background:#fffaf0';
const orderTitle=el('h2','首頁區塊排序'),orderTip=el('p','使用上移／下移調整右側內容區塊順序，不會更動內容、資料或顯示開關。'),orderStatus=el('p');
orderStatus.setAttribute('role','status');
const orderList=el('div');orderList.style.cssText='display:grid;gap:8px;margin:12px 0';
const orderSave=el('button','儲存排序'),orderClose=el('button','關閉');orderSave.type=orderClose.type='button';
orderDialog.append(orderTitle,orderTip,orderStatus,orderList,orderSave,orderClose);document.body.append(orderDialog);
const orderNames={daily_knowledge_front:'每日知識解析卡（首頁輪播）',learning_journal:'學習修行簿',spin_challenge:'抽宿挑戰',quiz:'數術問答',wenchang:'文昌星救援卡'};
const orderKeys=Object.keys(orderNames);
let orderValue=orderKeys.slice(),orderRevision=null;
function renderOrder(){
 orderList.replaceChildren();
 orderValue.forEach((key,i)=>{
  const row=el('div');row.style.cssText='display:flex;align-items:center;justify-content:space-between;gap:10px;padding:10px;border:1px solid #d4c29f;border-radius:8px';
  row.append(el('span',(i+1)+'．'+orderNames[key]));
  const controls=el('div');controls.style.cssText='display:flex;gap:5px';
  for(const [label,offset] of [['上移',-1],['下移',1]]){
   const b=el('button',label);b.type='button';b.disabled=i+offset<0||i+offset>=orderValue.length;
   b.onclick=()=>{const other=i+offset;[orderValue[i],orderValue[other]]=[orderValue[other],orderValue[i]];renderOrder();};
   controls.append(b);
  }
  row.append(controls);orderList.append(row);
 });
}
orderBtn.onclick=async()=>{
 if(!token()){if(typeof displayBankToast==='function')displayBankToast('請先完成管理員登入');return;}
 orderDialog.showModal();orderSave.disabled=true;orderStatus.textContent='正在讀取排序…';
 try{const data=await rpc('quiz_admin_homepage_order');orderValue=Array.isArray(data.order)&&data.order.length===orderKeys.length?data.order:orderKeys.slice();orderRevision=data.revision;renderOrder();orderSave.disabled=false;orderStatus.textContent='可使用上移及下移調整順序。';}
 catch(error){orderStatus.textContent='讀取失敗：'+error.message;}
};
orderSave.onclick=async()=>{
 if(orderRevision===null)return;
 orderSave.disabled=true;orderStatus.textContent='儲存中…';
 try{const data=await rpc('quiz_admin_save_homepage_order',{p_order:orderValue,p_expected_revision:orderRevision});orderRevision=data.revision;await window.quizRefreshHomepageOrder?.();orderStatus.textContent='排序已儲存並套用。';}
 catch(error){orderStatus.textContent='儲存失敗：'+error.message+'（請重新開啟讀取）';}
 finally{orderSave.disabled=false;}
};
orderClose.onclick=()=>orderDialog.close();
window.addEventListener('quiz-admin-session-changed',()=>{if(!token()&&dialog.open){revision=null;dialog.close();}});
})();