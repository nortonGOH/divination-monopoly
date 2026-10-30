/* Managed notices are edited exclusively by authenticated administrators via RPC. */
(()=>{
'use strict';
const toolbar=document.querySelector('#bankDialog .bank-toolbar'),cfg=window.QUIZ_AUTH_CONFIG||{};
const base=String(cfg.supabaseUrl||'').replace(/\/$/,''),key=String(cfg.publishableKey||'');
if(!toolbar||!base||!key)return;
const create=(tag,text='')=>{const e=document.createElement(tag);e.textContent=text;return e;};
const trigger=create('button','公告訊息管理');trigger.type='button';trigger.className='outline-btn';toolbar.append(trigger);
const dialog=create('dialog');dialog.id='quizNoticeAdminDialog';dialog.style.cssText='width:min(680px,calc(100vw - 24px));max-height:90dvh;overflow:auto;padding:24px;border-radius:14px;border:1px solid #cbbd9e;background:#fffaf0;';
const heading=create('h2','題庫公告訊息管理'),hint=create('p','可儲存草稿、發布新公告或下架。只有已發布的內容會出現在訪客首頁。'),status=create('p');
status.setAttribute('role','status');status.setAttribute('aria-live','polite');
const form=create('form');form.style.cssText='display:grid;gap:14px';
function input(labelText,tag,max){const l=create('label',labelText),field=create(tag);field.maxLength=max;field.style.cssText='display:block;width:100%;padding:10px;margin-top:5px;border:1px solid #cbbd9e;border-radius:7px;background:white';l.append(field);form.append(l);return field;}
const title=input('公告標題（最多 80 字）','input',80);
const body=input('公告內容（最多 4000 字）','textarea',4000);body.rows=8;
const checkbox=create('input');checkbox.type='checkbox';checkbox.checked=true;
const label=create('label',' 同時顯示最近 14 日題庫更新統計');label.prepend(checkbox);form.append(label);
const preview=create('div');preview.style.cssText='padding:14px;border:1px solid #d7c9ad;border-radius:8px;background:#fff;white-space:pre-wrap;';
const controls=create('div');controls.style.cssText='display:flex;flex-wrap:wrap;gap:8px';
function btn(t){const b=create('button',t);b.type='button';b.className='outline-btn';controls.append(b);return b;}
const draft=btn('儲存草稿'),publish=btn('發布公告'),unpublish=btn('下架公告'),show=btn('預覽'),close=btn('關閉');
form.append(controls);dialog.append(heading,hint,status,form,preview);document.body.append(dialog);
let current=null;
const token=()=>typeof adminAccessToken==='string'?adminAccessToken:'';
async function rpc(name,payload={}){
 if(!token())throw Error('請先登入管理員');
 const response=await fetch(base+'/rest/v1/rpc/'+name,{method:'POST',headers:{apikey:key,Authorization:'Bearer '+token(),'Content-Type':'application/json'},body:JSON.stringify(payload),cache:'no-store'});
 if(!response.ok){const detail=await response.json().catch(()=>({}));throw Error(detail.message||'伺服器拒絕操作（HTTP '+response.status+'）');}
 return response.json();
}
function render(){if(!current)return;title.value=current.title||'';body.value=current.body||'';checkbox.checked=current.show_banks!==false;status.textContent=current.published?'目前已發布（版本 '+current.publication_revision+'）；修改草稿不會影響已發布內容。':'目前未發布；未發布時訪客只會看到自動題庫更新統計。';preview.hidden=true;}
async function load(){status.textContent='正在讀取公告…';try{current=await rpc('quiz_admin_notice_get');render();}catch(e){current=null;status.textContent='讀取失敗：'+e.message;}}
function busy(value){[draft,publish,unpublish].forEach(b=>b.disabled=value);}
async function save(action){
 if(!current)return;
 const t=title.value.trim(),b=body.value.trim();
 if(action==='publish'&&(!t||!b)){status.textContent='發布必須填寫標題與內容。';return;}
 busy(true);status.textContent='正在提交，並核對公告版本…';
 try{
  const result=await rpc('quiz_admin_notice_save',{p_action:action,p_title:t,p_body:b,p_show_banks:checkbox.checked,p_expected_revision:current.revision});
  if(!result||result.revision<=current.revision)throw Error('資料庫沒有確認新修訂版本');
  current=result;render();status.textContent=action==='publish'?'已發布新版公告，訪客首次進入時會顯示。':action==='unpublish'?'公告已下架。':'草稿已儲存，尚未發布。';
 }catch(e){status.textContent='操作失敗：'+e.message+'。若公告由其他管理員修改，請關閉後重新開啟讀取。';}
 finally{busy(false);}
}
draft.onclick=()=>void save('draft');publish.onclick=()=>void save('publish');unpublish.onclick=()=>void save('unpublish');
show.onclick=()=>{preview.hidden=false;preview.textContent=(title.value.trim()||'（尚無標題）')+'\n\n'+(body.value.trim()||'（尚無內容）')+(checkbox.checked?'\n\n〔附：最近 14 日題庫更新統計〕':'');};
close.onclick=()=>dialog.close();
trigger.onclick=()=>{if(!token()){if(typeof displayBankToast==='function')displayBankToast('請先登入管理員。');return;}dialog.showModal();void load();};
window.addEventListener('quiz-admin-session-changed',()=>{if(!token()&&dialog.open){current=null;dialog.close();}});
})();
