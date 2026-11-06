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
const orderTitle=el('h2','首頁區塊排序・九宮格編號'),orderTip=el('p','將區塊分配至 1–9 號位置。編號由小至大決定首頁區塊的上下順序；空格不顯示。此設定不改變資料、可見性或圓盤位置。'),orderStatus=el('p');
orderStatus.setAttribute('role','status');
const orderList=el('div');orderList.id='homepageNineGridOrder';orderList.style.cssText='display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:9px;margin:15px 0';
const orderSave=el('button','儲存九宮格排序'),orderClose=el('button','關閉');orderSave.type=orderClose.type='button';
orderDialog.append(orderTitle,orderTip,orderStatus,orderList,orderSave,orderClose);document.body.append(orderDialog);
const orderNames={daily_knowledge_front:'每日知識解析卡',learning_journal:'學習修行簿',spin_challenge:'按我或北極星開始挑戰',quiz:'數術問答',wenchang:'文昌星救援卡'};
const orderKeys=Object.keys(orderNames);
const nineSlots=9;
let orderValue=[...orderKeys,...Array(nineSlots-orderKeys.length).fill(null)],orderRevision=null;
function normalizedOrder(value){
 if(!Array.isArray(value)||![orderKeys.length,nineSlots].includes(value.length))return null;
 const next=value.length===nineSlots?value.slice():[...value,...Array(nineSlots-value.length).fill(null)];
 const keys=next.filter(item=>item!==null);
 if(keys.length!==orderKeys.length||new Set(keys).size!==orderKeys.length||keys.some(k=>!orderKeys.includes(k)))return null;
 return next;
}
function renderOrder(){
 orderList.replaceChildren();
 orderValue.forEach((key,i)=>{
  const cell=el('label');
  cell.style.cssText='display:flex;flex-direction:column;gap:8px;min-width:0;padding:11px 7px;border:1px solid #cbbd9e;border-radius:10px;background:'+(key?'#fffdf7':'#f5efe2');
  const number=el('strong','位置 '+(i+1));
  number.style.cssText='font-size:.88rem;color:#3d574e';
  const chooser=el('select');
  chooser.setAttribute('aria-label','位置 '+(i+1)+' 的區塊');
  chooser.style.cssText='width:100%;min-width:0;max-width:100%;padding:8px 2px;border:1px solid #b9aa8e;border-radius:6px;background:white;font:inherit;font-size:.82rem';
  const empty=el('option','— 空白 —');empty.value='';chooser.append(empty);
  for(const [name,label] of Object.entries(orderNames)){
   const option=el('option',label);option.value=name;chooser.append(option);
  }
  chooser.value=key||'';
  chooser.onchange=()=>{
   const wanted=chooser.value||null;
   if(wanted===orderValue[i])return;
   const previous=orderValue[i];
   if(wanted){
    const other=orderValue.indexOf(wanted);
    if(other===-1){renderOrder();return;}
    orderValue[other]=previous;orderValue[i]=wanted;
   }else if(previous){
    const spare=orderValue.findIndex((item,pos)=>item===null&&pos!==i);
    if(spare===-1){renderOrder();return;}
    orderValue[spare]=previous;orderValue[i]=null;
   }
   renderOrder();orderStatus.textContent='排序已調整，請按「儲存九宮格排序」。';
  };
  cell.append(number,chooser);orderList.append(cell);
 });
}
orderBtn.onclick=async()=>{
 if(!token()){if(typeof displayBankToast==='function')displayBankToast('請先完成管理員登入');return;}
 orderDialog.showModal();orderSave.disabled=true;orderStatus.textContent='正在讀取排序…';
 try{const data=await rpc('quiz_admin_homepage_order');orderValue=normalizedOrder(data.order)||[...orderKeys,...Array(nineSlots-orderKeys.length).fill(null)];orderRevision=data.revision;renderOrder();orderSave.disabled=false;orderStatus.textContent='選取九宮格位置中的區塊即可交換位置，空格會自動保留。';}
 catch(error){orderStatus.textContent='讀取失敗：'+error.message;}
};
orderSave.onclick=async()=>{
 if(orderRevision===null)return;
 orderSave.disabled=true;orderStatus.textContent='儲存中…';
 try{const data=await rpc('quiz_admin_save_homepage_order',{p_order:orderValue,p_expected_revision:orderRevision});orderRevision=data.revision;await window.quizRefreshHomepageOrder?.();orderStatus.textContent='九宮格排序已儲存並套用。';}
 catch(error){orderStatus.textContent='儲存失敗：'+error.message+'（請重新開啟讀取）';}
 finally{orderSave.disabled=false;}
};
orderClose.onclick=()=>orderDialog.close();
// Reversible, global homepage map / chapter layout setting. Only admins may write.
const mapBtn=el('button','首頁地圖版面／恢復');mapBtn.type='button';mapBtn.className='outline-btn';bar.append(mapBtn);
const mapDialog=el('dialog');mapDialog.id='homepageLayoutDialog';
mapDialog.style.cssText='width:min(570px,calc(100vw - 24px));max-height:86dvh;overflow:auto;padding:22px;border:1px solid #cbbd9e;border-radius:14px;background:#fffaf0';
const mapTitle=el('h2','首頁版面切換與恢復');
const mapTip=el('p','可切換「三部八景二十四神」道教身神文獻地圖，或恢復原本的「四象二十八宿章回卡片」。北斗二十八宿抽題、會員、題庫和關卡紀錄都不會刪除。');
const mapStatus=el('p');mapStatus.setAttribute('role','status');
const mapOptions=el('div');mapOptions.style.cssText='display:grid;gap:10px;margin:16px 0';
const mapRadios={};
for(const [mode,heading,help] of [
 ['map','道教三部八景・二十四神地圖','依《雲笈七籤》卷三十一展示上中下三部各八位身神；點擊節點查看典籍。'],
 ['classic','原版章回卡片','恢復四章四象卡片與每章七關列表的既有版面。']
]){
 const label=el('label');label.style.cssText='display:flex;gap:12px;align-items:flex-start;padding:13px;border:1px solid #d4c39f;background:#fffdf7;border-radius:10px';
 const radio=el('input');radio.type='radio';radio.name='homepage-layout-mode';radio.value=mode;mapRadios[mode]=radio;
 const content=el('div');const headingNode=el('strong',heading),small=el('div',help);small.style.cssText='font-size:.82rem;color:#6d6b62;margin-top:5px;line-height:1.6';
 content.append(headingNode,small);label.append(radio,content);mapOptions.append(label);
}
const mapActions=el('div');mapActions.style.cssText='display:flex;flex-wrap:wrap;gap:9px';
const mapSave=el('button','套用所選版面'),mapRestore=el('button','恢復原版面'),mapClose=el('button','關閉');
for(const button of [mapSave,mapRestore,mapClose])button.type='button';
mapRestore.className='outline-btn';mapClose.className='outline-btn';
mapActions.append(mapSave,mapRestore,mapClose);
mapDialog.append(mapTitle,mapTip,mapStatus,mapOptions,mapActions);document.body.append(mapDialog);
let mapRevision=null,mapMode=null;
async function loadMapSetting(){
 mapSave.disabled=mapRestore.disabled=true;mapStatus.textContent='正在讀取版面設定…';
 try{
  const result=await rpc('quiz_admin_homepage_layout');
  if(!['classic','map'].includes(result.mode))throw Error('未知版面設定');
  mapMode=result.mode;mapRevision=result.revision;mapRadios[mapMode].checked=true;
  mapSave.disabled=mapRestore.disabled=false;
  mapStatus.textContent=mapMode==='map'?'目前使用道教三部八景二十四神地圖。':'目前使用原版章回卡片。';
 }catch(error){mapRevision=null;mapStatus.textContent='讀取失敗：'+error.message;}
}
mapBtn.onclick=()=>{if(!token()){if(typeof displayBankToast==='function')displayBankToast('請先完成管理員登入');return;}mapDialog.showModal();void loadMapSetting();};
async function saveMap(mode){
 if(mapRevision===null)return;
 mapSave.disabled=mapRestore.disabled=true;mapStatus.textContent='正在儲存版面設定…';
 try{
  const result=await rpc('quiz_admin_save_homepage_layout',{p_mode:mode,p_expected_revision:mapRevision});
  mapRevision=result.revision;mapMode=result.mode;mapRadios[mapMode].checked=true;
  await window.quizRefreshHomepageLayout?.();
  mapStatus.textContent=mapMode==='classic'?'已恢復原版章回卡片；題庫及紀錄未變更。':'已套用道教三部八景二十四神地圖。';
 }catch(error){mapStatus.textContent='儲存失敗：'+error.message+'。請關閉並重新開啟以讀取最新版設定。';mapRevision=null;}
 finally{mapSave.disabled=mapRestore.disabled=mapRevision===null;}
}
mapSave.onclick=()=>void saveMap(mapRadios.map.checked?'map':'classic');
mapRestore.onclick=()=>{if(!window.confirm('確定將所有訪客的首頁恢復為原版章回卡片嗎？此操作不刪除任何資料。'))return;void saveMap('classic');};
mapClose.onclick=()=>mapDialog.close();

window.addEventListener('quiz-admin-session-changed',()=>{if(!token()){if(dialog.open){revision=null;dialog.close();}if(orderDialog.open){orderRevision=null;orderDialog.close();}if(mapDialog.open){mapRevision=null;mapDialog.close();}}});
})();