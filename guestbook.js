/* Member guestbook. All ownership, deletion and gift rights are enforced in PostgreSQL. */
(()=>{
'use strict';
const root=document.getElementById('guestbook'), form=document.getElementById('guestbookForm');
if(!root||!form)return;
const cfg=window.QUIZ_AUTH_CONFIG||{};
const base=String(cfg.supabaseUrl||'').replace(/\/$/,'');
const key=String(cfg.publishableKey||'');
const get=id=>document.getElementById(id);
const area=get('guestbookBody'),submit=get('guestbookSubmit'),cancel=get('guestbookCancelEdit');
const login=get('guestbookLogin'),count=get('guestbookCount'),status=get('guestbookStatus');
const list=get('guestbookList'),refresh=get('guestbookRefresh');
let editingId=null,busy=false,epoch=0;
const member=()=>window.quizMemberToken?.()||null;
const administrator=()=>typeof adminAccessToken==='string'?adminAccessToken:null;
function node(tag,text,cls){
 const e=document.createElement(tag);
 if(text!==undefined)e.textContent=String(text);
 if(cls)e.className=cls;
 return e;
}
function report(message,failed=false){
 status.textContent=message;
 status.dataset.kind=failed?'error':'info';
}
function buttons(){
 const hasMember=Boolean(member());
 submit.disabled=!hasMember||busy||!base||!key;
 area.disabled=!hasMember||busy||!base||!key;
 submit.textContent=editingId?'儲存留言修改':hasMember?'發表留言':'登入後才能留言';
 login.hidden=hasMember;
 cancel.hidden=!editingId;
 count.textContent=Array.from(area.value).length+'／500 字';
}
function reset(){
 editingId=null;area.value='';buttons();
}
async function rpc(name,payload={},token=null){
 if(!base||!key)throw Error('留言板尚未設定 Supabase 服務');
 const headers={apikey:key,'Content-Type':'application/json'};
 if(token)headers.Authorization='Bearer '+token;
 else if(key.startsWith('eyJ'))headers.Authorization='Bearer '+key;
 const response=await fetch(base+'/rest/v1/rpc/'+name,{
  method:'POST',headers,body:JSON.stringify(payload),cache:'no-store'
 });
 const data=await response.json().catch(()=>null);
 if(!response.ok)throw Error(data?.message||data?.error||'HTTP '+response.status);
 return data;
}
const time=v=>{const d=new Date(v);return Number.isFinite(d.getTime())?
 d.toLocaleString('zh-TW',{hour12:false}):'—';};
function addButton(group,label,action){
 const b=node('button',label);
 b.type='button';b.addEventListener('click',action);group.append(b);return b;
}
function render(rows){
 list.replaceChildren();
 if(!Array.isArray(rows)){list.append(node('p','留言資料格式不正確，請重新整理。','guestbook-empty'));return;}
 if(rows.length===0){list.append(node('p','目前還沒有留言，歡迎分享第一則交流心得。','guestbook-empty'));return;}
 for(const message of rows){
  const card=node('article',undefined,'guestbook-item');
  card.dataset.messageId=String(message.id);
  const heading=node('div',undefined,'guestbook-item-header');
  heading.append(node('strong',message.nickname||'註冊會員'));
  heading.append(node('time',time(message.created_at)+(message.updated_at!==message.created_at?' · 已編輯':'')));
  const body=node('p',message.body||'','guestbook-item-content');
  const actions=node('div',undefined,'guestbook-item-actions');
  const awarded=Number(message.awarded_points);
  if(Number.isInteger(awarded)&&awarded>=1){
   actions.append(node('span','✦ 舊制歷史贈點 '+awarded+' 點（新制不計入）','guestbook-award'));
  }
  if(message.is_owner&&member()){
   addButton(actions,'修改我的留言',()=>{
    editingId=message.id;area.value=message.body||'';buttons();
    area.focus();area.scrollIntoView({behavior:'smooth',block:'center'});
    report('正在修改自己的留言。請按「儲存留言修改」確認。');
   });
   addButton(actions,'刪除我的留言',()=>remove(message.id,false));
  }
  if(administrator()){
   addButton(actions,'管理員刪除',()=>remove(message.id,true));

  }
  card.append(heading,body,actions);list.append(card);
 }
}
async function load(){
 const current=++epoch;
 refresh.disabled=true;
 try{
  const rows=await rpc('quiz_guestbook_list',{p_limit:30},member()||administrator());
  if(current===epoch)render(rows);
 }catch(error){
  if(current===epoch){
   list.replaceChildren(node('p','留言讀取失敗：'+error.message,'guestbook-empty'));
   report('留言讀取失敗：'+error.message,true);
  }
 }finally{if(current===epoch)refresh.disabled=false;}
}
async function operate(name,payload,token,success){
 if(busy)return;
 if(!token){report('請先登入會員或管理員。',true);return;}
 busy=true;buttons();
 try{
  await rpc(name,payload,token);
  reset();report(success);await load();
 }catch(error){report('操作沒有完成：'+error.message,true);}
 finally{busy=false;buttons();}
}
async function remove(id,isAdmin){
 if(!confirm(isAdmin?'確定以管理員身分刪除這則留言？':'確定刪除你自己的留言？'))return;
 await operate('quiz_guestbook_delete',{p_id:id},isAdmin?administrator():member(),'留言已刪除。');
}
form.addEventListener('submit',async event=>{
 event.preventDefault();
 if(busy)return;
 const content=area.value.trim();
 if(Array.from(content).length<2||Array.from(content).length>500){
   report('留言字數須介於 2～500 字。',true);return;
 }
 await operate('quiz_guestbook_save',{p_body:content,p_id:editingId},member(),
   editingId?'留言修改成功。':'留言發表成功。');
});
area.addEventListener('input',buttons);
cancel.addEventListener('click',()=>{reset();report('已取消修改。');});
refresh.addEventListener('click',load);
login.addEventListener('click',()=>{
 const signIn=document.getElementById('playerSignInBtn');
 if(signIn)signIn.click();else report('請先使用題目區的「註冊／登入」按鈕登入。',true);
});
window.addEventListener('quiz-member-session-changed',()=>{
 reset();buttons();void load();
});
window.addEventListener('quiz-admin-session-changed',()=>{buttons();void load();});
buttons();void load();
})();
