/* Administrator-only IP observation. No lock, ban, or user restriction controls. */
(()=>{
 'use strict';
 const toolbar=document.querySelector('#bankDialog .bank-toolbar');
 const cfg=window.QUIZ_AUTH_CONFIG||{};
 const base=String(cfg.supabaseUrl||'').replace(/\/$/,'');
 const key=String(cfg.publishableKey||'');
 if(!toolbar||!base||!key)return;
 const make=(tag,value='')=>{const node=document.createElement(tag);node.textContent=value;return node;};
 const launch=make('button','IP 流量觀測');launch.type='button';launch.className='outline-btn';toolbar.append(launch);
 const dialog=make('dialog');dialog.className='v8-stats-dialog';dialog.id='ipMonitorDialog';
 dialog.style.cssText='width:min(1000px,calc(100vw - 24px));max-height:90dvh;overflow:auto';
 const title=make('h2','IP 來源流量與異常警示');
 const note=make('p','僅供統計與人工觀察，不限制任何 IP、會員或訪客。五分鐘內達 80 次活動或 40 次點擊，僅顯示異常提醒。來源 IP 記錄預定保留 30 天。');
 const status=make('p');status.setAttribute('role','status');
 const controls=make('div');
 const refresh=make('button','重新整理');refresh.type='button';
 const close=make('button','關閉');close.type='button';close.onclick=()=>dialog.close();
 controls.append(refresh,close);
 const warning=make('div'),top=make('div'),recent=make('div'),nicknameSources=make('div');
 dialog.append(title,note,status,controls,warning,top,recent,nicknameSources);document.body.append(dialog);
 async function report(){
  if(typeof adminAccessToken!=='string'||!adminAccessToken)throw Error('請先登入管理員');
  const r=await fetch(base+'/rest/v1/rpc/quiz_admin_ip_monitor_report',{
    method:'POST',headers:{apikey:key,Authorization:'Bearer '+adminAccessToken,'Content-Type':'application/json'},
    body:'{}',cache:'no-store'
  });
  const data=await r.json().catch(()=>({}));
  if(!r.ok)throw Error(data.message||data.error||'HTTP '+r.status);
  return data;
 }
 function table(container,headers,rows){
  const t=make('table');t.className='v8-stats-table';
  const head=make('thead'),tr=make('tr');
  for(const label of headers){tr.append(make('th',label));}
  head.append(tr);t.append(head);
  const body=make('tbody');
  for(const values of rows){
   const row=make('tr');for(const value of values)row.append(make('td',String(value??'')));
   body.append(row);
  }
  t.append(body);container.append(t);
 }
 async function load(silent=false){
  if(!silent)status.textContent='正在讀取來源 IP…';
  try{
   const data=await report();
   const alerts=(data.top_ips||[]).filter(x=>x.alert);
   launch.textContent=alerts.length?'IP 流量觀測 ⚠ '+alerts.length:'IP 流量觀測';
   if(!dialog.open)return;
   warning.replaceChildren(make('h3','異常流量警示'));
   warning.append(make('p',alerts.length?'最近五分鐘有 '+alerts.length+' 個來源 IP 達到觀測門檻。這不代表惡意活動，網站不會自動封鎖任何訪客。':'目前沒有達到警示門檻的來源 IP。'));
   top.replaceChildren(make('h3','最近 24 小時來源 IP'));
   table(top,['IP','5 分鐘活動','5 分鐘點擊','24 小時活動','判定'],(data.top_ips||[]).map(x=>[
    x.ip,x.events5m,x.clicks5m,x.events24h,x.alert?'⚠ 頻繁流量':'一般'
   ]));
   recent.replaceChildren(make('h3','最近 100 筆事件'));
   table(recent,['時間','IP','事件','頁面','控制項'],(data.recent||[]).map(x=>[
    new Date(x.occurred_at).toLocaleString('zh-TW',{hour12:false}),x.ip,x.kind,x.page,x.target||'—'
   ]));
   nicknameSources.replaceChildren(make('h3','暱稱玩家同 IP 來源觀測'));
   const x=await fetch(base+'/rest/v1/rpc/quiz_admin_nickname_ip_report',{
     method:'POST',headers:{apikey:key,Authorization:'Bearer '+adminAccessToken,
       'Content-Type':'application/json'},body:'{}',cache:'no-store'
   });
   if(x.ok){
     const n=await x.json();
     nicknameSources.append(make('p','同一來源 IP 可能有多位不同玩家；僅供觀察，不合併身分、不封鎖。'));
     table(nicknameSources,['IP','事件數','不同暱稱工作階段','最近活動'],(n.shared_sources||[]).map(v=>[
       v.ip,v.events,v.nickname_sessions,new Date(v.last_seen).toLocaleString('zh-TW',{hour12:false})
     ]));
     table(nicknameSources,['時間','來源 IP','暱稱','事件'],(n.recent||[]).map(v=>[
       new Date(v.occurred_at).toLocaleString('zh-TW',{hour12:false}),v.ip,v.nickname,v.action
     ]));
   }else nicknameSources.append(make('p','暱稱玩家來源觀測尚未部署或目前無權限讀取。'));
   if(!silent)status.textContent='觀測資料已更新。流量監測從部署後開始。';
  }catch(e){launch.textContent='IP 流量觀測';if(!silent)status.textContent='尚未能取得觀測資料：'+e.message;}
 }
 refresh.onclick=()=>void load();
 launch.onclick=()=>{
  if(typeof adminAccessToken!=='string'||!adminAccessToken){
   if(typeof displayBankToast==='function')displayBankToast('請先登入管理員');
   return;
  }
  dialog.showModal();void load();
 };
 window.addEventListener('quiz-admin-session-changed',()=>{
  if(typeof adminAccessToken==='string'&&adminAccessToken)void load(true);
  else launch.textContent='IP 流量觀測';
 });
 window.setInterval(()=>{
  if(dialog.open && typeof adminAccessToken==='string' && adminAccessToken)void load(true);
 },60000);
})();
