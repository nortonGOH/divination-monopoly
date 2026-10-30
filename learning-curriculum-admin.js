/* Admin curriculum editor: credentials from existing administrator login; server RLS is authoritative. */
(()=>{
 'use strict';
 const host=document.querySelector('#bankDialog .bank-toolbar');
 const cfg=window.QUIZ_AUTH_CONFIG||{};
 const base=String(cfg.supabaseUrl||'').replace(/\/$/,'');
 const key=String(cfg.publishableKey||'');
 if(!host||!base||!key)return;
 const el=(name,txt='',cls='')=>{const n=document.createElement(name);n.textContent=txt;if(cls)n.className=cls;return n;};
 const open=el('button','會員教材管理','outline-btn');open.type='button';host.append(open);
 const dialog=el('dialog','','v8-stats-dialog');dialog.id='curriculumAdminDialog';
 dialog.style.cssText='width:min(900px,calc(100vw - 24px));max-height:90dvh;overflow:auto;';
 const heading=el('h2','術數史・會員專屬教材｜管理員編輯');
 const note=el('p','僅可修改會員專屬單元的導讀、學習重點、研究方法、思考問題、證據限制與參考來源；不會修改題庫及會員成績。');
 const message=el('p');message.id='curriculumAdminStatus';message.setAttribute('role','status');
 const selector=el('select');selector.id='curriculumAdminSelect';selector.style.cssText='width:100%;padding:9px;';
 const form=el('form');form.id='curriculumAdminForm';form.style.cssText='display:grid;gap:10px;margin:12px 0;';
 function field(labelText,rows=3){
  const label=el('label',labelText);const input=el('textarea');input.rows=rows;input.required=true;
  input.style.cssText='display:block;width:100%;box-sizing:border-box;min-height:70px;padding:10px;';
  label.append(input);form.append(label);return input;
 }
 const lead=field('導讀',4),points=field('學習重點（每行一項，至少一項）',5),
 method=field('史料與研究方法'),question=field('研究思考問題'),
 caution=field('證據界線'),sources=field('參考來源代碼（逗號或換行分隔，僅限已登錄代碼）',2);
 const hint=el('p','可用來源代碼：'+Object.entries(window.NUMEROLOGY_CURRICULUM?.sources||{}).map(([k,v])=>k+'（'+v.label+'）').join('、'));
 hint.style.fontSize='.8rem';
 const save=el('button','儲存教材修訂');save.type='submit';save.className='primary';
 const close=el('button','關閉');close.type='button';close.onclick=()=>dialog.close();
 form.append(hint,save);
 dialog.append(heading,note,message,selector,form,close);document.body.append(dialog);
 let rows=[],editing=null;
 const token=()=>typeof adminAccessToken==='string'?adminAccessToken:'';
 async function call(url,options={}){
  if(!token())throw Error('管理員工作階段已結束');
  const response=await fetch(base+'/rest/v1/learning_curriculum_lessons'+url,{
   ...options,cache:'no-store',
   headers:{apikey:key,Authorization:'Bearer '+token(),...(options.headers||{})}
  });
  if(!response.ok)throw Error('伺服器拒絕請求（HTTP '+response.status+'）');
  return response.json();
 }
 function loadForm(){
  editing=rows.find(x=>x.id===selector.value)||null;
  for(const [input,value] of [[lead,editing?.lead],[points,editing?.points?.join('\n')],
   [method,editing?.method],[question,editing?.question],[caution,editing?.caution],
   [sources,editing?.sources?.join('\n')]])input.value=value||'';
  save.disabled=!editing;
 }
 async function load(){
  if(!token()){message.textContent='請先登入題庫管理員。';return;}
  message.textContent='正在讀取受保護的教材…';
  save.disabled=true;
  try{
   const list=await call('?select=id,title,lead,points,method,question,caution,sources,revision&access_tier=eq.member&published=eq.true&order=track.asc,sort_order.asc');
   if(!Array.isArray(list)||list.length!==36)throw Error('教材資料不完整或無權限');
   rows=list;selector.replaceChildren();
   for(const item of rows){const option=el('option',item.title);option.value=item.id;selector.append(option);}
   loadForm();message.textContent='已載入 '+rows.length+' 個會員專屬單元。每次儲存僅更新所選單元。';
  }catch(e){rows=[];editing=null;selector.replaceChildren();message.textContent='無法載入：'+e.message;}
 }
 selector.addEventListener('change',loadForm);
 open.onclick=()=>{
  if(!token()){if(typeof displayBankToast==='function')displayBankToast('請先完成管理員登入。');return;}
  if(!dialog.open)dialog.showModal();void load();
 };
 form.addEventListener('submit',async event=>{
  event.preventDefault();
  if(!editing||!token())return;
  const nextPoints=points.value.split(/\r?\n/).map(x=>x.trim()).filter(Boolean);
  const nextSources=[...new Set(sources.value.split(/[\r\n,，]+/).map(x=>x.trim()).filter(Boolean))];
  const allowed=window.NUMEROLOGY_CURRICULUM?.sources||{};
  if(!nextPoints.length||nextPoints.length>12||nextSources.length===0||nextSources.some(id=>!Object.hasOwn(allowed,id))){
   message.textContent='請至少填寫一項學習重點與有效來源代碼；學習重點最多 12 項。';return;
  }
  const textFields=[lead.value,method.value,question.value,caution.value];
  if(textFields.some(x=>!x.trim()||x.length>12000)||nextPoints.some(x=>x.length>2000)){
   message.textContent='必填欄位不可為空，單欄文字最多 12000 字，重點每項最多 2000 字。';return;
  }
  const previous=editing;
  save.disabled=true;message.textContent='正在儲存，並檢查修訂版本是否已更新…';
  try{
   const payload={lead:lead.value.trim(),points:nextPoints,method:method.value.trim(),
    question:question.value.trim(),caution:caution.value.trim(),sources:nextSources};
   const data=await call('?id=eq.'+encodeURIComponent(previous.id)+'&revision=eq.'+previous.revision+'&access_tier=eq.member&select=id,revision',{
    method:'PATCH',headers:{'Content-Type':'application/json',Prefer:'return=representation'},body:JSON.stringify(payload)
   });
   if(!Array.isArray(data)||data.length!==1)throw Error('儲存未生效：可能無管理權限，或教材已由其他管理員更新。請重新載入。');
   message.textContent='儲存成功：修訂版本 '+data[0].revision+'。會員重新開啟教材時可讀到更新。';
   await load();
   window.dispatchEvent(new Event('learning-curriculum-admin-updated'));
  }catch(e){message.textContent='儲存失敗：'+e.message;}
  finally{save.disabled=false;}
 });
 window.addEventListener('quiz-admin-session-changed',()=>{if(!token()){rows=[];editing=null;selector.replaceChildren();dialog.close();}});
})();
