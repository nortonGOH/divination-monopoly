(()=>{'use strict';
const bar=document.querySelector('#bankDialog .bank-toolbar'),cfg=window.QUIZ_AUTH_CONFIG||{};
const base=String(cfg.supabaseUrl||'').replace(/\/$/,'');const key=String(cfg.publishableKey||'');
if(!bar||!base||!key)return;
const el=(t,s='')=>{const n=document.createElement(t);n.textContent=s;return n;};
const open=el('button','前台顯示設定');open.type='button';open.className='outline-btn';bar.append(open);
const dialog=el('dialog');dialog.id='featureVisibilityDialog';dialog.style.cssText='width:min(560px,calc(100vw - 24px));padding:24px;border:1px solid #cbbd9e;border-radius:14px;background:#fffaf0';
const title=el('h2','前台顯示設定'),description=el('p','分別控制留言板與排行榜是否顯示。隱藏不會刪除留言、分數或會員資料。');
const status=el('p');status.setAttribute('role','status');
const a=el('input'),b=el('input'),c=el('input');a.type=b.type=c.type='checkbox';
const la=el('label',' 顯示留言板'),lb=el('label',' 顯示挑戰者排行榜'),lc=el('label',' 顯示每日知識解析卡（三則輪播）');la.prepend(a);lb.prepend(b);lc.prepend(c);
for(const n of [la,lb,lc])n.style.cssText='display:block;padding:12px 0';
const save=el('button','儲存顯示設定'),close=el('button','關閉');save.type=close.type='button';save.className=close.className='outline-btn';
dialog.append(title,description,status,la,lb,lc,save,close);document.body.append(dialog);
let revision=null;
const token=()=>typeof adminAccessToken==='string'?adminAccessToken:'';
async function rpc(name,payload={}){
 if(!token())throw Error('請先登入管理員');
 const res=await fetch(base+'/rest/v1/rpc/'+name,{method:'POST',headers:{apikey:key,Authorization:'Bearer '+token(),'Content-Type':'application/json'},body:JSON.stringify(payload),cache:'no-store'});
 if(!res.ok)throw Error((await res.json().catch(()=>({}))).message||'權限驗證失敗（HTTP '+res.status+'）');
 return res.json();
}
async function load(){
 save.disabled=true;status.textContent='正在讀取設定…';
 try{const x=await rpc('quiz_admin_feature_visibility');a.checked=x.guestbook_visible;b.checked=x.leaderboard_visible;c.checked=x.daily_knowledge_visible!==false;revision=x.revision;save.disabled=false;status.textContent='設定已載入。';}
 catch(e){revision=null;status.textContent='讀取失敗：'+e.message;}
}
open.onclick=()=>{if(!token()){if(typeof displayBankToast==='function')displayBankToast('請先完成管理員登入');return;}dialog.showModal();void load();};
save.onclick=async()=>{
 if(revision===null)return;save.disabled=true;status.textContent='正在儲存…';
 try{
 const x=await rpc('quiz_admin_set_feature_visibility_v2',{p_guestbook_visible:a.checked,p_leaderboard_visible:b.checked,p_daily_knowledge_visible:c.checked,p_expected_revision:revision});
 revision=x.revision;status.textContent='已儲存。前台顯示設定已更新。';
 await window.quizRefreshFeatureVisibility?.();
 }catch(e){status.textContent='儲存失敗：'+e.message+'。請重新讀取後再試。';}
 finally{save.disabled=false;}
};
close.onclick=()=>dialog.close();
window.addEventListener('quiz-admin-session-changed',()=>{if(!token()&&dialog.open){revision=null;dialog.close();}});
})();