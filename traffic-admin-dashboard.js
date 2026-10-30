/* Admin-only traffic dashboard; report authorization is enforced by Supabase RPC. */
(()=>{
 'use strict';
 const toolbar=document.querySelector('#bankDialog .bank-toolbar');
 const cfg=window.QUIZ_AUTH_CONFIG||{};
 const base=String(cfg.supabaseUrl||'').replace(/\/$/,'');
 const key=String(cfg.publishableKey||'');
 if(!toolbar||!base||!key)return;
 const make=(tag,t='')=>{const n=document.createElement(tag);n.textContent=t;return n;};
 const button=make('button','網站流量統計');button.type='button';button.className='outline-btn';toolbar.append(button);
 const dialog=make('dialog');dialog.id='trafficAdminDialog';dialog.className='v8-stats-dialog';
 dialog.style.cssText='width:min(900px,calc(100vw - 24px));max-height:90dvh;overflow:auto';
 const title=make('h2','網站流量統計（管理員）');
 const note=make('p','記錄首頁與二十八宿圖鑑的頁面載入次數，包含未登入訪客與註冊會員。週一為每週起點，日期採臺灣時間。來源依來源網站及 UTM 參數推定。');
 const stats=make('div');stats.style.cssText='display:flex;flex-wrap:wrap;gap:10px;margin:12px 0';
 const status=make('p','');status.setAttribute('role','status');
 const menu=make('select');menu.setAttribute('aria-label','統計期間');
 for(const [v,t] of [['daily','每日'],['weekly','每週'],['monthly','每月']]){const option=make('option',t);option.value=v;menu.append(option);}
 const listing=make('div'),sources=make('div'),pages=make('div');
 const refresh=make('button','重新整理');refresh.type='button';
 const close=make('button','關閉');close.type='button';close.onclick=()=>dialog.close();
 dialog.append(title,note,status,stats,menu,listing,sources,pages,refresh,close);
 document.body.append(dialog);
 let result=null;
 function table(target,headers,rows){
  target.replaceChildren();
  const table=make('table');table.className='v8-stats-table';
  const tr=make('tr');headers.forEach(x=>{const th=make('th',x);tr.append(th);});
  const thead=make('thead');thead.append(tr);table.append(thead);
  const tbody=make('tbody');
  rows.forEach(values=>{const row=make('tr');values.forEach(v=>row.append(make('td',String(v))));tbody.append(row);});
  table.append(tbody);target.append(table);
 }
 const mapSource={direct:'直接進入',search:'搜尋引擎',social:'社群平台',referral:'其他網站推薦',internal:'站內連結',unknown:'無法判定'};
 function render(){
  if(!result)return;
  stats.replaceChildren();
  for(const [label,value] of [['今日',result.today_views],['本週',result.week_views],['本月',result.month_views],['累計',result.total]]){
   const card=make('div',label+'：'+Number(value||0).toLocaleString('zh-TW')+' 次');
   card.style.cssText='padding:12px;background:#f2eee2;border:1px solid #d2c5ae;border-radius:9px;font-weight:700';
   stats.append(card);
  }
  const periods=result[menu.value]||[];
  table(listing,[{daily:'日期',weekly:'週起始日',monthly:'月份'}[menu.value],'瀏覽次數'],periods.map(x=>[x.period,x.views]));
  sources.replaceChildren(make('h3','累計流量來源'));
  const src=make('div');table(src,['來源','瀏覽次數'],(result.sources||[]).map(x=>[mapSource[x.source]||'其他',x.views]));sources.append(src);
  pages.replaceChildren(make('h3','累計頁面分布'));
  const p=make('div');table(p,['頁面','瀏覽次數'],(result.pages||[]).map(x=>[x.page==='home'?'首頁':'二十八宿圖鑑',x.views]));pages.append(p);
 }
 async function load(){
  if(typeof adminAccessToken!=='string'||!adminAccessToken){status.textContent='請先登入管理員。';return;}
  status.textContent='正在讀取流量統計…';
  try{
   const response=await fetch(base+'/rest/v1/rpc/quiz_admin_traffic_report',{
    method:'POST',headers:{apikey:key,Authorization:'Bearer '+adminAccessToken,'Content-Type':'application/json'},
    body:'{}',cache:'no-store'
   });
   if(!response.ok)throw Error('權限驗證或讀取失敗（HTTP '+response.status+'）');
   result=await response.json();render();
   status.textContent='已更新｜統計開始於追蹤功能啟用之後；不包含此前的歷史流量。';
  }catch(e){result=null;stats.replaceChildren();listing.replaceChildren();sources.replaceChildren();pages.replaceChildren();status.textContent='查詢失敗：'+e.message;}
 }
 menu.addEventListener('change',render);
 refresh.onclick=()=>void load();
 button.onclick=()=>{if(!adminAccessToken){if(typeof displayBankToast==='function')displayBankToast('請先登入管理員。');return;}dialog.showModal();void load();};
})();
