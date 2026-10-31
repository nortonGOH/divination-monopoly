(()=>{'use strict';
const bar=document.querySelector('#bankDialog .bank-toolbar'),cfg=window.QUIZ_AUTH_CONFIG||{};
const base=String(cfg.supabaseUrl||'').replace(/\/$/,''),key=String(cfg.publishableKey||'');
if(!bar||!base||!key)return;
const el=(tag,value='')=>{const e=document.createElement(tag);e.textContent=value;return e;};
const button=el('button','每日知識解析卡管理');button.type='button';button.className='outline-btn';bar.append(button);
const dialog=el('dialog');dialog.id='dailyKnowledgeEditorDialog';dialog.style.cssText='width:min(820px,calc(100vw - 24px));max-height:92dvh;overflow:auto;padding:22px;border:1px solid #cbbd9e;border-radius:14px;background:#fffaf0';
const title=el('h2','每日知識解析卡：內容與顯示管理'),status=el('p');status.setAttribute('role','status');
const show=el('input');show.type='checkbox';const showLabel=el('label',' 顯示每日知識解析卡（三則輪播）');showLabel.prepend(show);
const saveVisibility=el('button','儲存顯示設定');saveVisibility.type='button';
const list=el('div');list.className='daily-admin-title-list';list.setAttribute('aria-label','卡片標題清單');
const newButton=el('button','＋ 新增卡片');newButton.type='button';
const selectedTitle=el('h3','請選擇一張卡片');
const details=el('div');details.className='daily-admin-card-details';
const edit=el('button','修改此卡片');edit.type='button';edit.hidden=true;
const cancel=el('button','取消修改');cancel.type='button';
const form=el('form');form.style.cssText='display:grid;gap:10px';form.hidden=true;
function field(label,tag,max){const l=el('label',label),v=el(tag);v.maxLength=max;v.style.cssText='display:block;width:100%;padding:8px;border:1px solid #beae91;border-radius:7px';l.append(v);form.append(l);return v;}
const name=field('標題（100字）','input',100),content=field('知識解析內容（1800字）','textarea',1800);content.rows=7;
const caution=field('研究提醒（700字，可留空）','textarea',700);caution.rows=2;
const source=field('文獻或資料來源名稱（250字）','input',250),url=field('HTTPS來源網址（600字）','input',600);
const active=el('input');active.type='checkbox';const activeLabel=el('label',' 啟用此卡片供每日選取');activeLabel.prepend(active);form.append(activeLabel);
const preview=el('div');preview.style.cssText='padding:12px;background:white;border:1px solid #dbcbaa;white-space:pre-wrap';preview.hidden=true;
const controls=el('div');controls.style.cssText='display:flex;gap:8px;flex-wrap:wrap';
const save=el('button','儲存卡片'),view=el('button','預覽'),close=el('button','關閉');
for(const b of [save,view,cancel]){b.type='button';controls.append(b)}form.append(controls);
close.type='button';
const grid=el('div');grid.className='daily-admin-grid';
const left=el('div');left.append(el('h3','卡片標題'),newButton,list);
const right=el('div');right.append(selectedTitle,details,edit,form,preview);
grid.append(left,right);dialog.append(title,status,showLabel,saveVisibility,el('hr'),grid,close);document.body.append(dialog);
const css=el('style');css.textContent=[
 '.daily-admin-grid{display:grid;grid-template-columns:minmax(200px,260px) minmax(0,1fr);gap:16px;margin:15px 0}',
 '.daily-admin-title-list{display:grid;gap:6px;align-content:start;max-height:55dvh;overflow:auto}',
 '.daily-admin-title-list button{text-align:left;padding:10px;border:1px solid #c7ae83;border-radius:8px;background:#fff;cursor:pointer;overflow-wrap:anywhere}',
 '.daily-admin-title-list button[aria-pressed=true]{background:#e6efe9;border-color:#557b65}',
 '.daily-admin-card-details{padding:12px;background:#fff;border:1px solid #d5c4a6;border-radius:10px;white-space:pre-wrap;overflow-wrap:anywhere;line-height:1.7}',
 '#dailyKnowledgeEditorDialog [hidden]{display:none!important}',
 '@media(max-width:650px){.daily-admin-grid{grid-template-columns:1fr}.daily-admin-title-list{max-height:26dvh}}'
].join('');document.head.append(css);
let cards=[],settingsRevision=null,current=null,creating=false;
const token=()=>typeof adminAccessToken==='string'?adminAccessToken:'';
async function rpc(fn,data={}){
 if(!token())throw Error('請登入管理員');
 const r=await fetch(base+'/rest/v1/rpc/'+fn,{method:'POST',headers:{apikey:key,Authorization:'Bearer '+token(),'Content-Type':'application/json'},body:JSON.stringify(data),cache:'no-store'});
 const json=await r.json().catch(()=>({}));
 if(!r.ok)throw Error(json.message||'HTTP '+r.status);
 return json;
}
function showCard(c){
 details.replaceChildren();
 if(!c){details.textContent='請先點選左側卡片標題。';return;}
 for(const [label,value] of [
   ['知識解析',c.body],['研究提醒',c.caution||'（無）'],
   ['資料來源',c.source_label],['來源網址',c.source_url],
   ['目前類型',c.knowledge_type||'未分類'],['狀態',c.is_active?'已啟用':'已停用']
 ]){
  const p=el('p');p.append(el('strong',label+'：'),document.createTextNode(String(value||'')));details.append(p);
 }
}
function fill(c){
 name.value=c?.title||'';content.value=c?.body||'';caution.value=c?.caution||'';
 source.value=c?.source_label||'';url.value=c?.source_url||'';active.checked=c?.is_active!==false;
}
function selectCard(c){
 current=c||null;creating=false;selectedTitle.textContent=c?.title||'請選擇一張卡片';
 fill(c);showCard(c);details.hidden=false;edit.hidden=!c;form.hidden=true;preview.hidden=true;renderList();
}
function renderList(){
 list.replaceChildren();
 if(!cards.length)list.append(el('p','尚無卡片，請使用「新增卡片」。'));
 for(const c of cards){
  const b=el('button',(c.is_active?'● ':'○ ')+c.title);b.type='button';
  b.setAttribute('aria-pressed',String(!creating&&current?.id===c.id));
  b.onclick=()=>selectCard(c);list.append(b);
 }
}
function newCard(){
 current=null;creating=true;fill(null);selectedTitle.textContent='新增卡片';
 details.hidden=true;edit.hidden=true;form.hidden=false;preview.hidden=true;renderList();name.focus();
}
newButton.onclick=newCard;
edit.onclick=()=>{if(!current)return;fill(current);details.hidden=true;edit.hidden=true;form.hidden=false;name.focus();};
cancel.onclick=()=>selectCard(creating?cards[0]||null:current);
async function load(selectedId){
 status.textContent='讀取中…';save.disabled=saveVisibility.disabled=true;
 try{
  const data=await rpc('quiz_admin_daily_knowledge_list');
  cards=Array.isArray(data.cards)?data.cards:[];
  settingsRevision=data.settings_revision;show.checked=data.visible===true;
  selectCard(cards.find(x=>x.id===selectedId)||cards[0]||null);
  status.textContent='已載入 '+cards.length+' 則；目前啟用 '+cards.filter(c=>c.is_active).length+' 則。';
 }catch(e){cards=[];current=null;list.replaceChildren();form.hidden=true;status.textContent='讀取失敗：'+e.message;}
 finally{save.disabled=saveVisibility.disabled=false;}
}
view.onclick=()=>{preview.hidden=false;preview.textContent=name.value+'\n\n'+content.value+'\n\n'+(caution.value?'研究提醒：'+caution.value+'\n':'')+'來源：'+source.value+'\n'+url.value;};
save.onclick=async()=>{
 if(!name.value.trim()||!content.value.trim()||!source.value.trim()||!url.value.trim()){status.textContent='請先填寫必要欄位。';return;}
 if(!/^https:\/\/[^\s]+$/i.test(url.value.trim())){status.textContent='來源網址必須使用 HTTPS。';return;}
 save.disabled=true;status.textContent='正在儲存卡片…';
 try{
  // Existing card category remains unchanged; new card is deliberately unclassified.
  const result=await rpc('quiz_admin_daily_knowledge_save',{
   p_id:current?.id||null,p_title:name.value,p_body:content.value,p_caution:caution.value,
   p_source_label:source.value,p_source_url:url.value,p_active:active.checked,
   p_expected_revision:current?.revision??null,p_knowledge_type:current?.knowledge_type??null
  });
  await load(result.id);status.textContent='卡片已儲存。';
 }catch(e){status.textContent='儲存失敗：'+e.message;}
 finally{save.disabled=false;}
};
saveVisibility.onclick=async()=>{saveVisibility.disabled=true;try{await rpc('quiz_admin_daily_knowledge_visibility',{p_visible:show.checked,p_expected_revision:settingsRevision});await load();await window.quizRefreshFeatureVisibility?.();status.textContent='顯示設定已儲存。';}catch(e){status.textContent='設定失敗：'+e.message;}finally{saveVisibility.disabled=false;}};
close.onclick=()=>dialog.close();
button.onclick=()=>{if(!token()){if(typeof displayBankToast==='function')displayBankToast('請先登入管理員');return;}dialog.showModal();void load();};
window.addEventListener('quiz-admin-session-changed',()=>{if(!token()&&dialog.open)dialog.close();});
})();