/* GitHub Pages / Supabase Auth / Cloudflare Turnstile integration.
 * Public Site Key: window.QUIZ_AUTH_CONFIG.turnstileSiteKey
 * NEVER place Turnstile Secret Key or Supabase secret keys in this file.
 * Each auth form gets its own fresh challenge. Tokens are never logged/stored.
 */
(() => {
  'use strict';
  const siteKey=String(window.QUIZ_AUTH_CONFIG?.turnstileSiteKey||'').trim();
  const forms=new Map();
  let scriptError=false;
  let scanScheduled=false;
  const statusNote=(form,message)=>{
    let el=form.querySelector('[data-turnstile-note]');
    if(!el){el=document.createElement('p');el.dataset.turnstileNote='';el.style.cssText='margin:4px 0;color:#9a452e;font-size:.84rem';form.append(el);}
    el.textContent=message;
  };
  function render(form,state){
    if(state.id!==null||!window.turnstile||!siteKey||!form.isConnected)return;
    try {
      state.id=window.turnstile.render(state.slot,{
        sitekey:siteKey,theme:'light',size:'flexible',
        callback:(token)=>{state.token=token;statusNote(form,'安全驗證已完成，可以提交。');},
        'expired-callback':()=>{state.token='';statusNote(form,'安全驗證已過期，請重新驗證。');},
        'error-callback':()=>{state.token='';statusNote(form,'安全驗證載入失敗，請重新整理後再試。');return true;}
      });
    }catch(err){statusNote(form,'Turnstile 無法載入：'+(err.message||'未知錯誤'));}
  }
  function scan(){
    scanScheduled=false;
    for(const form of document.querySelectorAll('form')){
      if(!form.querySelector('input[type="password"]'))continue;
      let state=forms.get(form);
      if(!state){
        const slot=document.createElement('div');slot.dataset.turnstileSlot='';
        slot.style.cssText='min-height:65px;max-width:330px;margin:10px 0;';
        const action=form.querySelector('button[type="submit"]');
        if(action && action.parentElement===form)form.insertBefore(slot,action);
        else form.append(slot);
        state={id:null,slot,token:''};forms.set(form,state);
      }
      render(form,state);
    }
  }
  function requestScan(){if(!scanScheduled){scanScheduled=true;queueMicrotask(scan);}}
  const observer=new MutationObserver(requestScan);
  observer.observe(document.documentElement,{childList:true,subtree:true});
  window.quizCaptcha={
    token(form){
      if(!siteKey)throw new Error('尚未設定 Turnstile Site Key；請在 config.js 加入 turnstileSiteKey。');
      if(scriptError)throw new Error('無法載入 Cloudflare 驗證元件，請確認網路連線。');
      const state=forms.get(form);
      if(!state?.token)throw new Error('請先完成表單中的 Cloudflare 安全驗證。');
      return state.token;
    },
    reset(form){
      const state=forms.get(form);if(!state)return;
      state.token='';
      if(state.id!==null&&window.turnstile){try{window.turnstile.reset(state.id);}catch(e){console.warn('Turnstile reset failed',e);}}
      statusNote(form,'請重新完成安全驗證，才能再次提交。');
    }
  };
  requestScan();
  if(siteKey){
    const s=document.createElement('script');
    s.src='https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
    s.async=true;
    s.onload=()=>{requestScan();};
    s.onerror=()=>{scriptError=true;for(const form of forms.keys())statusNote(form,'驗證元件載入失敗。請檢查網路或瀏覽器擴充功能。');};
    document.head.append(s);
  }else{
    for(const form of forms.keys())statusNote(form,'尚未設定 Cloudflare Turnstile Site Key。');
  }
})();
