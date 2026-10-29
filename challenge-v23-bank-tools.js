(()=>{
'use strict';
const dlg=document.getElementById('bankDialog'),toolbar=dlg?.querySelector('.bank-toolbar');
if(!toolbar||typeof fetchCloudBank!=='function')return;
const wrap=document.createElement('section');wrap.style.cssText='padding:14px 22px;border-bottom:1px solid #e3d7c2;background:#fffcf6';
const title=document.createElement('strong');title.textContent='更新統計與安全校正版匯入';
const desc=document.createElement('p');desc.textContent='更新統計會從 Supabase 重新讀取正式題庫；校正版先逐題比對差異，不直接覆寫或清空資料庫。';
const refresh=document.createElement('button'),importBtn=document.createElement('button'),file=document.createElement('input'),message=document.createElement('p'),results=document.createElement('div'),apply=document.createElement('button');
refresh.type='button';refresh.textContent='↻ 更新統計';importBtn.type='button';importBtn.textContent='校正版 JSON：比對後更新';apply.type='button';apply.textContent='確認套用勾選的題目';apply.hidden=true;
file.type='file';file.accept='.json,application/json';file.hidden=true;message.setAttribute('role','status');
for(const b of [refresh,importBtn,apply])b.style.cssText='margin:8px 8px 8px 0;padding:8px 12px;cursor:pointer;border:1px solid #b9a87e;border-radius:7px;background:#fff4db;color:#31574a';
wrap.append(title,desc,refresh,importBtn,file,message,results,apply);toolbar.after(wrap);
const oldImport=document.getElementById('importBankBtn'),mode=document.getElementById('importMode'),reset=document.getElementById('resetBankBtn');
for(const btn of [oldImport,mode,reset]){if(btn){btn.disabled=true;btn.title='為保護校正資料，請改用安全校正版匯入';}}
const fieldNames=['mansion','category','knowledge_type','difficulty','prompt','options','answer','explanation'];
const norm=q=>{const o={id:String(q.id)};for(const k of fieldNames)o[k]=k==='options'?q.options.map(String):k==='answer'?Number(q.answer):String(q[k]??'');return o;};
const same=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
async function fresh(){if(!adminAccessToken)throw Error('請先登入管理員');return fetchCloudBank(true);}
async function sync(){const rows=await fresh();questionBank=rows;questionSource='Supabase 正式題庫（已更新）';refreshBankInterface();return rows;}
refresh.onclick=async()=>{refresh.disabled=true;message.textContent='讀取中…';try{const rows=await sync();message.textContent='統計已更新：四選一 '+rows.length+' 題；開放問答 '+(window.quizGetOpenQuestions?.().length||0)+' 題。';}catch(e){message.textContent='更新失敗：'+e.message;}finally{refresh.disabled=false;}};
let plan=[];
importBtn.onclick=()=>file.click();
file.onchange=async()=>{
 const f=file.files?.[0];file.value='';if(!f)return;
 results.replaceChildren();apply.hidden=true;plan=[];message.textContent='正在比對題庫…';
 try{
 if(f.size>2097152)throw Error('檔案不得超過 2 MB');
 const raw=JSON.parse(await f.text()),data=Array.isArray(raw)?raw:raw.questions;
 if(!Array.isArray(data)||!data.length||data.length>3000)throw Error('題庫格式不正確');
 const ids=new Set(),incoming=[];
 for(const q of data){
  if(!q?.id||ids.has(String(q.id)))throw Error('題目 ID 缺漏或重複');
  ids.add(String(q.id));
  if(!Object.hasOwn(q,'answer')||!Object.hasOwn(q,'explanation'))throw Error('缺少正確答案或解析欄位：'+q.id);
  incoming.push(norm(validBank([q])[0]));
 }
 const current=await fresh(),existing=new Map(current.map(q=>[q.id,norm(q)]));
 const byText=new Map(current.map(q=>[q.prompt.replace(/\s+/g,''),q.id]));
 plan=incoming.map(q=>{
  const before=existing.get(q.id)||null;
  const changed=before?fieldNames.filter(k=>!same(before[k],q[k])):[];
  const duplicate=!before&&byText.has(q.prompt.replace(/\s+/g,''));
  return{id:q.id,before,after:q,mode:before?'update':'insert',changed,kind:duplicate?'疑似重複':!before?'新增':changed.length?'校正':'相同'};
 });
 const sums={};for(const q of plan)sums[q.kind]=(sums[q.kind]||0)+1;
 message.textContent='比對結果：新增 '+(sums['新增']||0)+'、需校正 '+(sums['校正']||0)+'、相同 '+(sums['相同']||0)+'、疑似重複 '+(sums['疑似重複']||0)+'。請先檢視並勾選。';
 const items=document.createElement('div');items.style.cssText='max-height:330px;overflow:auto;border:1px solid #d9cfb9;padding:8px';
 for(const q of plan){
  const el=document.createElement('div');el.style.cssText='border-bottom:1px solid #eee;padding:9px 0';
  const label=document.createElement('label'),input=document.createElement('input');input.type='checkbox';input.dataset.id=q.id;input.disabled=q.kind==='相同'||q.kind==='疑似重複';
  label.append(input,document.createTextNode(' '+q.id+'／'+q.kind+(q.changed.length?'（'+q.changed.join('、')+'）':'')));el.append(label);
  if(q.kind==='校正'){
   const d=document.createElement('details'),s=document.createElement('summary'),pre=document.createElement('pre');s.textContent='查看修改前後逐欄差異';pre.style.cssText='white-space:pre-wrap;overflow-wrap:anywhere;font-size:12px';
   pre.textContent=q.changed.map(k=>k+'\n舊：'+JSON.stringify(q.before[k])+'\n新：'+JSON.stringify(q.after[k])).join('\n\n');d.append(s,pre);el.append(d);
  }
  if(q.kind==='疑似重複')el.append(document.createTextNode(' 相同題幹已存在其他題號，請先人工檢查。'));
  items.append(el);
 }
 results.replaceChildren(items);apply.hidden=false;
 }catch(e){message.textContent='比對失敗：'+e.message;}
};
apply.onclick=async()=>{
 const checked=new Set([...results.querySelectorAll('input:checked')].map(x=>x.dataset.id));
 const changes=plan.filter(x=>checked.has(x.id)&&['新增','校正'].includes(x.kind));if(!changes.length)return;
 const dangerous=changes.filter(x=>x.changed.some(k=>['prompt','options','answer'].includes(k))).length;
 if(!confirm('新增 '+changes.filter(q=>q.kind==='新增').length+' 題、校正 '+changes.filter(q=>q.kind==='校正').length+' 題。'+(dangerous?'其中 '+dangerous+' 題修改題幹、選項或正確答案，可能影響歷史作答結果。':'')+'\n所有更動都會寫入修訂日誌；確定套用？'))return;
 apply.disabled=true;message.textContent='檢查最新版本並套用中…';
 try{
  const now=new Map((await fresh()).map(q=>[q.id,norm(q)]));
  for(const q of changes){
   const old=now.get(q.id)||null;
   if(!same(old,q.before))throw Error('題目 '+q.id+' 在預覽後被其他管理員修改，請重新比對。');
  }
  let added=0,updated=0;
  for(let i=0;i<changes.length;i+=150){
   const batch=changes.slice(i,i+150).map(q=>({mode:q.mode,id:q.id,before:q.before,after:q.after}));
   const r=await cloudCall('/rest/v1/rpc/quiz_admin_apply_question_changes',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({p_changes:batch})},true);
   added+=r.inserted||0;updated+=r.updated||0;
  }
  const after=await sync();results.replaceChildren();apply.hidden=true;message.textContent='完成：新增 '+added+' 題、更新 '+updated+' 題；目前四選一 '+after.length+' 題。';
 }catch(e){message.textContent='更新未完成：'+e.message+'；請重新比對確認。';}
 finally{apply.disabled=false;}
};
})();