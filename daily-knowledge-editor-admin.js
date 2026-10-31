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
const newButton=el('button','新增卡片');newButton.type='button';
const cardList=el('select');cardList.id='dailyKnowledgeCardPicker';cardList.setAttribute('aria-label','選擇現有卡片');cardList.style.cssText='display:block;width:100%;max-width:100%;padding:11px;margin:10px 0 16px;border:1px solid #cbbd9e;border-radius:9px;background:#fffdf8;font:inherit';
const listHeading=el('label','現有卡片（選擇標題檢視或修改）');listHeading.htmlFor=cardList.id;
const form=el('form');form.hidden=true;form.style.cssText='display:grid;gap:10px';
function field(label,tag,max){const l=el('label',label),v=el(tag);v.maxLength=max;v.style.cssText='display:block;width:100%;padding:8px;border:1px solid #beae91;border-radius:7px';l.append(v);form.append(l);return v;}
// The API still requires a knowledge type. Preserve it internally, without a visible dropdown.
const typeSelect=el('input');typeSelect.type='hidden';form.append(typeSelect);
const name=field('標題（100字）','input',100),content=field('知識解析內容（1800字）','textarea',1800);content.rows=7;
const caution=field('研究提醒（700字，可留空）','textarea',700);caution.rows=2;
const source=field('文獻或資料來源名稱（250字）','input',250),url=field('HTTPS來源網址（600字）','input',600);
const active=el('input');active.type='checkbox';const activeLabel=el('label',' 啟用此卡片供每日選取');activeLabel.prepend(active);form.append(activeLabel);
const preview=el('div');preview.style.cssText='padding:12px;background:white;border:1px solid #dbcbaa;white-space:pre-wrap';preview.hidden=true;
const controls=el('div');controls.style.cssText='display:flex;gap:8px;flex-wrap:wrap';
const save=el('button','儲存卡片'),view=el('button','預覽'),close=el('button','關閉');
for(const b of [save,view,close]){b.type='button';controls.append(b)}form.append(controls);
dialog.append(title,status,showLabel,saveVisibility,el('hr'),newButton,listHeading,cardList,form,preview);document.body.append(dialog);
let cards=[],types=[],settingsRevision=null,current=null;
const token=()=>typeof adminAccessToken==='string'?adminAccessToken:'';
async function rpc(fn,data={}){
 if(!token())throw Error('請登入管理員');
 const r=await fetch(base+'/rest/v1/rpc/'+fn,{method:'POST',headers:{apikey:key,Authorization:'Bearer '+token(),'Content-Type':'application/json'},body:JSON.stringify(data),cache:'no-store'});
 const json=await r.json().catch(()=>({}));
 if(!r.ok)throw Error(json.message||'HTTP '+r.status);
 return json;
}
function loadCard(c,creating=false){current=c||null;typeSelect.value=c?.knowledge_type||(types.includes('通識')?'通識':types[0]||'');name.value=c?.title||'';content.value=c?.body||'';caution.value=c?.caution||'';source.value=c?.source_label||'';url.value=c?.source_url||'';active.checked=c?.is_active!==false;preview.hidden=true;form.hidden=!c&&!creating;cardListRender();}
function cardListRender(){cardList.replaceChildren();const placeholder=el('option',cards.length?'請選擇卡片標題':'目前沒有卡片，請點選新增卡片');placeholder.value='';cardList.append(placeholder);for(const c of cards){const entry=el('option',(c.is_active?'● ':'○ ')+c.title);entry.value=c.id;cardList.append(entry);}cardList.value=current?.id||'';}
async function load(){status.textContent='讀取中…';save.disabled=saveVisibility.disabled=true;
 try{const data=await rpc('quiz_admin_daily_knowledge_list');cards=data.cards||[];types=data.types||[];settingsRevision=data.settings_revision;show.checked=data.visible===true;loadCard(null);status.textContent='已載入 '+cards.length+' 則；目前啟用 '+cards.filter(c=>c.is_active).length+' 則。';save.disabled=saveVisibility.disabled=false;}
 catch(e){status.textContent='讀取失敗：'+e.message;}}
cardList.onchange=()=>{const chosen=cards.find(c=>String(c.id)===cardList.value);loadCard(chosen||null);};
newButton.onclick=()=>{loadCard(null,true);name.focus();};
view.onclick=()=>{preview.hidden=false;preview.textContent='數術類型：'+(typeSelect.value||'尚未分類')+'\n'+name.value+'\n\n'+content.value+'\n\n'+(caution.value?'研究提醒：'+caution.value+'\n':'')+'來源：'+source.value+'\n'+url.value;};
save.onclick=async()=>{save.disabled=true;status.textContent='正在儲存卡片…';try{
 if(!types.includes(typeSelect.value))throw Error('尚無可用的數術類型，無法儲存；請先確認後端設定');
 const result=await rpc('quiz_admin_daily_knowledge_save',{p_knowledge_type:typeSelect.value,p_id:current?.id||null,p_title:name.value,p_body:content.value,p_caution:caution.value,p_source_label:source.value,p_source_url:url.value,p_active:active.checked,p_expected_revision:current?.revision||null});
 await load();const x=cards.find(c=>c.id===result.id);if(x)loadCard(x);status.textContent='卡片已儲存。頁面重新載入後使用最新公開內容。';
 }catch(e){status.textContent='儲存失敗：'+e.message;}finally{save.disabled=false;}};
saveVisibility.onclick=async()=>{saveVisibility.disabled=true;try{await rpc('quiz_admin_daily_knowledge_visibility',{p_visible:show.checked,p_expected_revision:settingsRevision});await load();await window.quizRefreshFeatureVisibility?.();status.textContent='顯示設定已儲存。';}catch(e){status.textContent='設定失敗：'+e.message;}finally{saveVisibility.disabled=false;}};
close.onclick=()=>dialog.close();
button.onclick=()=>{if(!token()){if(typeof displayBankToast==='function')displayBankToast('請先登入管理員');return;}dialog.showModal();void load();};
window.addEventListener('quiz-admin-session-changed',()=>{if(!token()&&dialog.open)dialog.close();});
})();