/* Administrator IP monitor. Live data only via admin-authorized RPCs. */
(()=>{
 'use strict';
 const toolbar=document.querySelector('#bankDialog .bank-toolbar');
 const cfg=window.QUIZ_AUTH_CONFIG||{};
 const base=String(cfg.supabaseUrl||'').replace(/\/$/,'');
 const key=String(cfg.publishableKey||'');
 if(!toolbar||!base||!key)return;
 const make=(tag,value='')=>{const n=document.createElement(tag);n.textContent=value;return n;};
 const launch=make('button','IP 流量監控');launch.type='button';launch.className='outline-btn';toolbar.append(launch);
 const dialog=make('dialog');dialog.className='v8-stats-dialog';dialog.id='ipMonitorDialog';
 dialog.style.cssText='width:min(1000px,calc(100vw - 24px));max-height:90dvh;overflow:auto';
 const title=make('h2','IP 監控與異常流量警示');
 const note=make('p','每 5 分鐘 80 次活動或 40 次點擊即提示異常，不自動封鎖。僅限制受保護的網站互動與訪客試玩，無法禁止讀取 GitHub Pages 公開頁面。IP 紀錄保存 30 天。');
 const notice=make('p');notice.setAttribute('role','status');
 const settings=make('div');settings.style.cssText='display:flex;flex-wrap:wrap;gap:9px;align-items:center;margin:12px 0';
 const ip=make('input');ip.placeholder='完整 IPv4 / IPv6';ip.setAttribute('aria-label','欲鎖定的 IP');ip.style.minWidth='180px';
 const reason=make('input');reason.placeholder='鎖定原因（至少 2 字）';reason.setAttribute('aria-label','操作原因');reason.style.minWidth='190px';
 const duration=make('select');duration.setAttribute('aria-label','鎖定期間');
 for(const [v,t] of [['60','1 小時'],['1440','24 小時'],['10080','7 天']]){
  const o=make('option',t);o.value=v;duration.append(o);
 }
 const block=make('button','鎖定 IP');block.type='button';
 const refresh=make('button','重新整理');refresh.type='button';
 const close=make('button','關閉');close.type='button';close.onclick=()=>dialog.close();
 settings.append(ip,reason,duration,block,refresh,close);
 const warning=make('div'),active=make('div'),top=make('div'),recent=make('div');
 dialog.append(title,note,notice,settings,warning,active,top,recent);
 document.body.append(dialog);
 async function rpc(name,payload={}){
  if(typeof adminAccessToken!=='string'||!adminAccessToken)throw Error('請先登入管理員');
  const r=await fetch(base+'/rest/v1/rpc/'+name,{
   method:'POST',headers:{apikey:key,Authorization:'Bearer '+adminAccessToken,'Content-Type':'application/json'},
   body:JSON.stringify(payload),cache:'no-store'
  });
  const data=await r.json().catch(()=>({}));
  if(!r.ok)throw Error(data.message||data.error||'HTTP '+r.status);
  return data;
 }
 function table(container,headers,rows){
  const t=make('table');t.className='v8-stats-table';
  const head=make('thead'),tr=make('tr');
  for(const label of headers){const th=make('th',label);tr.append(th);}
  head.append(tr);t.append(head);
  const tbody=make('tbody');
  for(const cells of rows){
   const row=make('tr');
   for(const item of cells){
    const td=make('td');
    if(item instanceof Node)td.append(item);else td.textContent=String(item??'');
    row.append(td);
   }
   tbody.append(row);
  }
  t.append(tbody);container.append(t);
 }
 async function act(action,address){
  if(!address)return;
  const why=reason.value.trim()||(action==='unblock'?'Manual unlock':'');
  if(why.length<2||why.length>200){notice.textContent='請填入 2–200 字的操作原因。';return;}
  if(!confirm((action==='block'?'鎖定':'解除鎖定')+' '+address+'？共享 IP 可能影響其他使用者。'))return;
  block.disabled=true;
  try{
   await rpc('quiz_admin_ip_monitor_action',{p_ip:address,p_action:action,
    p_minutes:Number(duration.value),p_reason:why});
   notice.textContent='已送出'+(action==='block'?'鎖定':'解鎖')+'指令，請確認清單狀態。';
   await load(false);
  }catch(e){notice.textContent='操作失敗：'+e.message;}
  finally{block.disabled=false;}
 }
 async function load(silent=false){
  if(!silent)notice.textContent='正在讀取來源 IP…';
  try{
   const data=await rpc('quiz_admin_ip_monitor_report');
   const suspects=(data.top_ips||[]).filter(x=>x.alert);
   launch.textContent=suspects.length?'IP 監控 ⚠ '+suspects.length:'IP 流量監控';
   if(!dialog.open)return;
   warning.replaceChildren(make('h3','異常流量警示'));
   warning.append(make('p',suspects.length?'最近五分鐘有 '+suspects.length+' 個 IP 達到警示門檻，請人工判斷是否鎖定。':'目前沒有達到警示門檻的 IP。'));
   active.replaceChildren(make('h3','目前鎖定清單'));
   table(active,['IP','原因','解除時間','操作'],(data.blocks||[]).map(b=>{
    const btn=make('button','解鎖');btn.type='button';btn.onclick=()=>void act('unblock',b.ip);
    return [b.ip,b.reason,new Date(b.expires_at).toLocaleString('zh-TW',{hour12:false}),btn];
   }));
   top.replaceChildren(make('h3','最近 24 小時來源 IP'));
   table(top,['IP','5 分鐘活動','5 分鐘點擊','24 小時活動','判定','操作'],(data.top_ips||[]).map(x=>{
    const btn=make('button','鎖定');btn.type='button';btn.onclick=()=>{ip.value=x.ip;void act('block',x.ip);};
    return [x.ip,x.events5m,x.clicks5m,x.events24h,x.alert?'⚠ 頻繁流量':'一般',btn];
   }));
   recent.replaceChildren(make('h3','最近 100 筆事件'));
   table(recent,['時間','IP','類型','頁面','控制項'],(data.recent||[]).map(x=>[
    new Date(x.occurred_at).toLocaleString('zh-TW',{hour12:false}),x.ip,x.kind,x.page,x.target||'—'
   ]));
   if(!silent)notice.textContent='資料已更新。警示不代表惡意流量；資料蒐集從新版本部署後開始。';
  }catch(e){if(!silent)notice.textContent='IP 監控尚未就緒：'+e.message;launch.textContent='IP 流量監控';}
 }
 block.onclick=()=>void act('block',ip.value.trim());
 refresh.onclick=()=>void load(false);
 launch.onclick=()=>{if(!adminAccessToken){if(typeof displayBankToast==='function')displayBankToast('請先登入管理員');return;}dialog.showModal();void load(false);};
 window.addEventListener('quiz-admin-session-changed',()=>{if(adminAccessToken)void load(true);else launch.textContent='IP 流量監控';});
 window.setInterval(()=>{if(adminAccessToken)void load(true);},60000);
})();
