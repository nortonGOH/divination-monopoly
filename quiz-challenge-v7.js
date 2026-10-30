/* v7 player registrations & account-based 5 wrong answers -> 30 minute cooldown.
 * Supabase Auth validates passwords; PostgreSQL RPCs count wrong answers atomically.
 * Existing administrator login and the library reader remain separate.
 */
(() => {
'use strict';
const $=id=>document.getElementById(id);
if (!$('quizTitle') || typeof cloudCall!=='function') return;
const cfg=window.QUIZ_AUTH_CONFIG||{};
const base=String(cfg.supabaseUrl||'').replace(/\/$/,'');
const key=String(cfg.publishableKey||'');
// GitHub Pages publishes this project under /divination-monopoly/, not at the account root.
// Supabase Auth must allow this exact URL in Authentication > URL Configuration.
const EMAIL_CONFIRM_REDIRECT='https://nortongoh.github.io/divination-monopoly/';
let playerToken=null, playerEmail='', playerNickname='', playerState=null, busy=false;
window.quizMemberToken=()=>playerToken;
let lastAnnouncedMemberToken;
let trialInfo=null,trialRequest=false,trialError='';
const trialBanner=document.getElementById('trialBanner');
let unlockTimer=null, unlockAt='';
let completedIds=new Set();window.quizCompletedIds=completedIds;
window.quizPlayerMayChallenge=()=>Boolean((playerToken&&!playerState?.locked)||(!playerToken&&trialInfo&&!trialInfo.locked));
async function reloadCompleted(){completedIds=new Set(await endpoint('/rest/v1/rpc/quiz_answered_question_ids','POST',{}));window.quizCompletedIds=completedIds;}
const loginReady=Boolean(base&&key);
async function trialApi(action,extras={}){
  if(!loginReady)throw Error('試玩服務尚未設定。');
  const response=await fetch(base+'/functions/v1/quiz-guest-trial',{
    method:'POST',headers:{apikey:key,'Content-Type':'application/json'},
    body:JSON.stringify({action,...extras}),cache:'no-store'
  });
  const result=await response.json().catch(()=>({}));
  if(!response.ok)throw Error(result.error||result.message||'試玩伺服器無法連線');
  return result;
}
function showTrialBanner(error=''){
  if(!trialBanner)return;
  if(playerToken){
    trialBanner.dataset.state='member';
    trialBanner.textContent='會員正式挑戰模式｜試玩 IP 額度不影響註冊會員答題。';
  }else if(error){
    trialBanner.dataset.state='error';trialBanner.textContent='訪客試玩無法啟用：'+error+'。可註冊登入正式挑戰。';
  }else if(!trialInfo){
    trialBanner.dataset.state='loading';trialBanner.textContent='正在讀取 IP 試玩額度…';
  }else if(trialInfo.locked){
    trialBanner.dataset.state='locked';trialBanner.textContent='此 IP 已使用 5／5 次試玩答題，試玩已鎖定。請註冊或登入繼續挑戰。';
  }else{
    trialBanner.dataset.state='ready';trialBanner.textContent='訪客試玩｜此 IP 已答 '+trialInfo.used+'／5 題，剩餘 '+trialInfo.remaining+' 次。共用網路可能共用額度；試玩不含文昌星救援。';
  }
}
async function refreshTrial(){
  if(playerToken)return;
  if(trialRequest)return;
  trialRequest=true;trialError='';showTrialBanner();
  try{
    const result=await trialApi('status');
    if(playerToken)return;
    if(!Number.isInteger(result.used)||!Number.isInteger(result.remaining)||
      result.used<0||result.used>5||result.remaining!==5-result.used)
      throw Error('伺服器試玩額度回應異常');
    trialInfo=result;trialError='';showTrialBanner();drawState();
    if(!result.locked)selectQuizForMansion(activeMansion);
  }catch(error){
    trialInfo=null;trialError=error.message;showTrialBanner(trialError);drawState();
  }finally{trialRequest=false;}
}
const node=(tag,text='',cls='')=>{const x=document.createElement(tag);x.textContent=text;if(cls)x.className=cls;return x;};
const style=node('style');
style.textContent=`
  .player-strip{display:flex;align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap;margin:10px 0 14px;padding:10px 13px;border:1px solid #d6c49f;border-radius:10px;background:#fff8ea;color:#554b41;font-size:.86rem}
  .player-strip button,.player-dialog button{font:inherit;padding:8px 12px;border:1px solid #bca579;border-radius:8px;background:#fcf6e9;cursor:pointer;color:#333}
  .player-strip .player-main,.player-dialog .player-main{background:#315f56;color:#fff;border-color:#315f56}
  .player-lock{margin:10px 0;padding:12px;border-left:4px solid #ad503a;background:#faeae3;color:#84382b;font-size:.92rem}
  .player-dialog{border:1px solid #d6c49f;border-radius:16px;background:#fcf8ef;color:#253038;width:min(460px,calc(100vw - 28px));max-height:90vh;overflow:auto;padding:24px;box-shadow:0 24px 70px #131f283d}
  .player-dialog::backdrop{background:#17242ccc}
  .player-dialog form{display:grid;gap:10px}
  .player-dialog label{display:grid;gap:5px;font-weight:700}
  .player-dialog input{padding:12px;border:1px solid #ccb995;border-radius:8px;font:inherit;width:100%}
  .player-dialog .account-actions{display:flex;gap:8px;flex-wrap:wrap;margin:10px 0}
  .player-dialog p{line-height:1.75;white-space:pre-wrap;font-size:.9rem}
  .player-dialog h2{font-size:1.35rem;margin:0 0 10px}
  .player-dialog [hidden]{display:none!important}
  .player-dialog label:has(input[type=checkbox]){display:flex;align-items:center;gap:10px;font-weight:500}
  .player-dialog label:has(input[type=checkbox]) input{width:auto;flex:0 0 auto}
  .player-dialog .account-actions>button{min-height:44px;flex:1 1 120px}
  .player-dialog .auth-hint{font-size:.82rem;color:#566d68;margin:4px 0 6px}
  .player-dialog .auth-pending{color:#275f54;font-weight:600}
  .player-dialog .auth-verification{border:1px solid #d4c398;background:#fff8e9;border-radius:10px;padding:12px;margin:8px 0}
  .player-dialog .auth-verification p{margin:4px 0 10px}
  .player-dialog input:focus-visible,.player-dialog button:focus-visible{outline:3px solid #b88d43;outline-offset:2px}
  .player-dialog #playerAuthNotice{min-height:1.5em;overflow-wrap:anywhere}
`;
document.head.append(style);
const strip=node('div','','player-strip');
const summary=node('span','帳號模式：請先註冊或登入才能答題。');summary.id='playerStateText';
const actions=node('div');
const signInBtn=node('button','註冊／登入','player-main');signInBtn.type='button';signInBtn.id='playerSignInBtn';
const logoutBtn=node('button','登出');logoutBtn.type='button';logoutBtn.hidden=true;
actions.append(signInBtn,logoutBtn);strip.append(summary,actions);
$('quizTitle').closest('.quiz-heading').after(strip);
const alertBox=node('p','','player-lock');alertBox.hidden=true;alertBox.id='playerLockAlert';
$('quizAvailable').closest('.quiz-panel').prepend(alertBox);
// Keep the wheel clickable while a server-side lock is active, but explain why
// spins are blocked rather than leaving users with an apparently dead control.
const cooldownDialog=node('dialog','','player-dialog');
const cooldownTitle=node('h2','挑戰暫停・解鎖倒數');
const cooldownDetail=node('p','');
const cooldownExplanation=node('p','連續答錯累計達五次後，挑戰暫停三十分鐘。「文昌星救援」僅用於查看正確答案及解析，不會抵銷答錯次數，也不會提前解除鎖定。');
const cooldownActions=node('div','','account-actions');
const cooldownCheck=node('button','重新檢查解鎖狀態','player-main');cooldownCheck.type='button';
const cooldownClose=node('button','知道了');cooldownClose.type='button';
cooldownActions.append(cooldownCheck,cooldownClose);
cooldownDialog.append(cooldownTitle,cooldownDetail,cooldownExplanation,cooldownActions);
document.body.append(cooldownDialog);
let cooldownTicker=null,cooldownChecking=false;
function cooldownRemaining(){
 const until=new Date(playerState?.locked_until||'').getTime();
 if(!Number.isFinite(until))return '解鎖時間尚未取得，請重新登入後確認。';
 const seconds=Math.max(0,Math.ceil((until-Date.now())/1000));
 const hours=Math.floor(seconds/3600),minutes=Math.floor((seconds%3600)/60),secs=seconds%60;
 return '預計解鎖：'+dateText(playerState.locked_until)+'\n剩餘時間：'+hours+' 小時 '+String(minutes).padStart(2,'0')+' 分 '+String(secs).padStart(2,'0')+' 秒';
}
function renderCooldown(){
 if(!playerState?.locked){
   if(cooldownTicker){clearInterval(cooldownTicker);cooldownTicker=null;}
   if(cooldownDialog.open)cooldownDialog.close();
   return;
 }
 const line=cooldownRemaining();
 alertBox.textContent='本次已累計五次答錯，挑戰暫停三十分鐘。'+line.replace('\n','；')+'。點擊北極星可查看詳情。';
 cooldownDetail.textContent=line;
 if(!cooldownTicker)cooldownTicker=setInterval(renderCooldown,1000);
}
function openCooldown(){
 renderCooldown();
 if(playerState?.locked&&!cooldownDialog.open)cooldownDialog.showModal();
}
function handleCooldownRefreshError(error){
 const msg=String(error?.message||error);
 if(/jwt|expired|token|unauthori[sz]ed|^HTTP (401|403)|invalid claim|signature/i.test(msg)){
   playerToken=null;playerState=null;playerNickname='';
   renderCooldown();drawState();setDialogMode('login');showDlg();
   showError('登入狀態已過期，請重新登入後繼續；先前成績及答題紀錄仍保留。');
 }else{
   cooldownDetail.textContent='無法查詢解鎖狀態：'+msg+'\n請稍後再點「重新檢查解鎖狀態」。';
   if(!cooldownDialog.open)cooldownDialog.showModal();
 }
}
async function checkCooldown(continueSpin=false){
 if(cooldownChecking||!playerToken)return;
 cooldownChecking=true;cooldownCheck.disabled=true;
 try{
   await refresh();
   if(playerState?.locked){openCooldown();}
   else{
     if(cooldownDialog.open)cooldownDialog.close();
     if(continueSpin&&!spinning)spin();
   }
 }catch(error){handleCooldownRefreshError(error);}
 finally{cooldownChecking=false;cooldownCheck.disabled=false;}
}
cooldownCheck.addEventListener('click',()=>checkCooldown(false));
cooldownClose.addEventListener('click',()=>cooldownDialog.close());
function onLockedWheelClick(){
 if(!playerState?.locked)return;
 const until=new Date(playerState.locked_until||'').getTime();
 if(Number.isFinite(until)&&until<=Date.now())checkCooldown(true);
 else openCooldown();
}
const dialog=node('dialog','','player-dialog');
const heading=node('h2','數術知識挑戰・帳號登入');
const intro=node('p','請使用自己的電子郵件註冊。同一帳號累計答錯五次，將暫停挑戰三十分鐘；期滿歸零。\n\n✦ 文昌星救援：答錯時，可自行選擇是否使用 1 次救援，查看正確答案與解析。每答對 1 題累積 1 點文昌點數；首次解鎖答錯題目的正解使用 1 點，已解鎖不重複扣點；沒有定時補點與上限。救援不會抵銷答錯次數，也不會提前解除挑戰鎖定。');
const form=node('form');form.id='playerAuthForm';
const elabel=node('label','電子郵件'),email=node('input');email.type='email';email.required=true;email.autocomplete='email';email.inputMode='email';email.maxLength=254;email.id='playerEmail';elabel.append(email);
const nicknameLabel=node('label','暱稱（2–18字，可使用中英文、數字、底線、連字號）'),nickname=node('input');nickname.type='text';nickname.id='playerNickname';nickname.maxLength=18;nickname.autocomplete='nickname';nicknameLabel.append(nickname);
const leaderboardNote=node('p','所有註冊會員自動參與前五名挑戰者排行榜；僅公開暱稱及成績，不公開電子郵件。','auth-hint');
const plabel=node('label','密碼'),password=node('input');password.type='password';password.required=true;password.autocomplete='current-password';password.id='playerPassword';plabel.append(password);
const passwordTip=node('p','登入請輸入原密碼；註冊建議使用至少 12 個字元的獨立密碼。','auth-hint');
const showPassword=node('button','顯示密碼');showPassword.type='button';
showPassword.setAttribute('aria-controls','playerPassword');
showPassword.setAttribute('aria-pressed','false');
const confirmLabel=node('label','再輸入一次密碼'),confirmPassword=node('input');confirmPassword.id='playerConfirmPassword';confirmPassword.type='password';confirmPassword.autocomplete='new-password';confirmPassword.minLength=10;confirmLabel.append(confirmPassword);
const verification=node('div','','auth-verification');verification.hidden=true;
const verificationInfo=node('p','');
const verificationActions=node('div','','account-actions');
const resendBtn=node('button','重新寄送驗證信');resendBtn.type='button';
const verifiedLoginBtn=node('button','已完成驗證，前往登入','player-main');verifiedLoginBtn.type='button';
verificationActions.append(resendBtn,verifiedLoginBtn);verification.append(verificationInfo,verificationActions);
let verificationEmail='', resendAvailableAt=0, resendTimer=null;
const buttons=node('div','','account-actions');
const loginBtn=node('button','登入','player-main');loginBtn.type='submit';
const registerBtn=node('button','建立新帳號');registerBtn.type='button';
const saveProfileBtn=node('button','儲存暱稱');saveProfileBtn.type='button';saveProfileBtn.hidden=true;
const backBtn=node('button','返回登入');backBtn.type='button';backBtn.hidden=true;
const forgotBtn=node('button','忘記密碼？');forgotBtn.type='button';
const closeBtn=node('button','關閉');closeBtn.type='button';
buttons.append(loginBtn,registerBtn,forgotBtn,saveProfileBtn,backBtn,closeBtn);
form.append(elabel,plabel,passwordTip,showPassword,confirmLabel,nicknameLabel,leaderboardNote,buttons,verification);
const notice=node('p','密碼僅傳送至 Supabase Auth；網站原始碼不儲存密碼。');notice.setAttribute('role','status');notice.id='playerAuthNotice';notice.setAttribute('aria-live','polite');
dialog.append(heading,intro,form,notice);document.body.append(dialog);
const showDlg=()=>{if(!dialog.open)dialog.showModal();};
let dialogMode='login';
let recoveryAccessToken=null;
let recoveryEmailAvailableAt=0;
const recoveryHash=new URLSearchParams(window.location.hash.startsWith('#')?window.location.hash.slice(1):'');
const isRecoveryLink=recoveryHash.get('type')==='recovery';
const recoveryError=recoveryHash.get('error')||recoveryHash.get('error_code');
if(recoveryHash.has('access_token')||recoveryError){
  recoveryAccessToken=isRecoveryLink?recoveryHash.get('access_token'):null;
  // Credentials and one-time recovery tokens must never linger in the address bar.
  window.history.replaceState(null,'',window.location.pathname+window.location.search);
}
function setDialogMode(mode,preserveNotice=false){
  dialogMode=mode;
  const editing=mode==='profile',signup=mode==='signup',verify=mode==='verify';
  const recover=mode==='recover',reset=mode==='reset';
  elabel.hidden=editing||verify||reset;plabel.hidden=editing||verify||recover;
  passwordTip.hidden=editing||verify||recover;showPassword.hidden=editing||verify||recover;
  confirmLabel.hidden=!(signup||reset);nicknameLabel.hidden=!(editing||signup);
  leaderboardNote.hidden=!(editing||signup);
  buttons.hidden=verify;
  loginBtn.hidden=editing||verify;loginBtn.textContent=signup?'送出註冊':recover?'寄送密碼重設信':reset?'儲存新密碼':'登入';
  registerBtn.hidden=mode!=='login';forgotBtn.hidden=mode!=='login';
  saveProfileBtn.hidden=!editing;backBtn.hidden=!(signup||recover||reset);
  verification.hidden=!verify;
  email.required=!(editing||verify||reset);password.required=!(editing||verify||recover);
  nickname.required=signup;confirmPassword.required=signup||reset;
  password.minLength=signup||reset?10:0;
  password.autocomplete=signup||reset?'new-password':'current-password';
  plabel.firstChild.textContent=signup||reset?'設定新密碼（至少 10 個字元）':'密碼';
  if(!signup&&!reset){confirmPassword.setCustomValidity('');confirmPassword.value='';}
  heading.textContent=verify?'驗證電子郵件':editing?'修改暱稱':signup?'建立數術挑戰帳號':recover?'忘記密碼・寄送重設信':reset?'設定新密碼':'數術知識挑戰・帳號登入';
  if(verify){
    verificationInfo.textContent='若此信箱符合註冊條件，系統會將驗證信寄至 '+verificationEmail+'。請查看收件匣及垃圾郵件，點擊驗證連結後回來登入。收到信件與否仍取決於寄信服務額度。';
    updateResendButton();
  }
  if(!preserveNotice)notice.textContent=verify?'驗證信尚未確認送達；請先檢查信箱。':editing?'設定一次即可保存，下次登入會自動讀取。':
    signup?'請填寫電子郵件、密碼與暱稱。所有會員自動參與前五名排行榜。':
    recover?'輸入已註冊的電子郵件；若帳號存在，系統會寄送重設連結。請檢查收件匣及垃圾郵件。':
    reset?'請輸入至少 10 字元的新密碼，並再次確認。重設完成後須重新登入。':
    '登入不需要重填暱稱；忘記密碼可使用郵件重設。';
}
function updateResendButton(){
  const remaining=Math.max(0,Math.ceil((resendAvailableAt-Date.now())/1000));
  resendBtn.disabled=busy||remaining>0;
  resendBtn.textContent=remaining>0?'可於 '+remaining+' 秒後重寄':'重新寄送驗證信';
  if(!remaining&&resendTimer){clearInterval(resendTimer);resendTimer=null;}
}
function pauseResend(){
  resendAvailableAt=Date.now()+90*1000;
  if(resendTimer)clearInterval(resendTimer);
  resendTimer=setInterval(updateResendButton,1000);
  updateResendButton();
}
function normalAuthError(err,operation){
  const message=String(err?.message||err);
  if(err?.status===429||/rate limit|too many requests|over_email_send_rate_limit/i.test(message))
    return '認證郵件或請求已達 Supabase 限額，請稍後再試；若管理員尚未完成 SMTP 設定，須先設定寄信服務。請勿連續重送。';
  if(/email not confirmed|email_not_confirmed/i.test(message))
    return '這個信箱尚未完成驗證，請先點擊驗證信中的連結，再回來登入。';
  if(/invalid login credentials|invalid_credentials/i.test(message))
    return '帳號或密碼不正確；若尚未驗證電子郵件，請先完成驗證。';
  if(/already registered|user_already_exists/i.test(message))
    return '若已註冊此信箱，請返回登入；請勿重複建立帳號。';
  return operation+'失敗：'+message;
}
showPassword.addEventListener('click',()=>{
  const visible=password.type==='password';
  password.type=visible?'text':'password';
  showPassword.textContent=visible?'隱藏密碼':'顯示密碼';
  showPassword.setAttribute('aria-pressed',String(visible));
});
confirmPassword.addEventListener('input',()=>confirmPassword.setCustomValidity(''));
form.addEventListener('invalid',e=>{
  if(e.target===confirmPassword&&confirmPassword.validity.customError)
    showError('兩次輸入的密碼不同，請重新確認。');
  else showError('請檢查必填欄位及輸入格式：'+(e.target.closest('label')?.firstChild?.textContent||'表單')+'。');
},true);
const validNick=value=>/^[\p{L}\p{N}_-]{2,18}$/u.test(String(value||'').trim());
async function loadNickname(){
  if(!playerToken)return false;
  // A failed RPC is not equivalent to an account with no nickname.
  const p=await endpoint('/rest/v1/rpc/quiz_my_profile','POST',{});
  playerNickname=typeof p.nickname==='string'?p.nickname.trim():'';
  nickname.value=playerNickname;
  // The legacy opt-in flag no longer governs the mandatory public leaderboard.
  drawState();
  return Boolean(playerNickname);
}
async function updateNickname(){const name=nickname.value.trim();if(!validNick(name))throw Error('暱稱需為2–18字，限中英文、數字、底線或連字號。');const p=await endpoint('/rest/v1/rpc/quiz_set_player_profile','POST',{p_nickname:name,p_leaderboard_opt_in:true});playerNickname=p.nickname;drawState();window.dispatchEvent(new Event('quiz-leaderboard-refresh'));}
const tokenHeaders=()=>({'apikey':key,'Content-Type':'application/json',...(playerToken?{'Authorization':'Bearer '+playerToken}:{})});
window.quizRevealOpenAnswer=(questionId)=>endpoint('/rest/v1/rpc/quiz_reveal_open_answer','POST',{p_question_id:questionId});
async function endpoint(path,method='GET',obj=null){
 if(!loginReady)throw Error('請先在 config.js 設定 Supabase URL 與 Publishable Key。');
 const r=await fetch(base+path,{method,headers:tokenHeaders(),body:obj==null?undefined:JSON.stringify(obj),cache:'no-store'});
 const text=await r.text();let data={};try{data=text?JSON.parse(text):{};}catch(e){}
 if(!r.ok){
   const err=Error(data.msg||data.error_description||data.message||data.error||'HTTP '+r.status);
   err.status=r.status;err.code=data.code||data.error_code||'';
   throw err;
 }
 return data;
}
function dateText(value){return value?new Date(value).toLocaleString('zh-TW',{hour12:false}):'';}
function drawState(){
 if(playerToken!==lastAnnouncedMemberToken){lastAnnouncedMemberToken=playerToken;window.dispatchEvent(new Event('quiz-member-session-changed'));}
 const locked=Boolean(playerState?.locked);
 const nextUnlock=locked?String(playerState.locked_until||''):'';
 if(nextUnlock!==unlockAt){
   if(unlockTimer)clearTimeout(unlockTimer);unlockTimer=null;unlockAt=nextUnlock;
   if(locked && nextUnlock){
     const remaining=Math.max(1000,new Date(nextUnlock).getTime()-Date.now()+500);
     if(Number.isFinite(remaining))unlockTimer=setTimeout(()=>{
       if(!playerToken)return;
       refresh().then(()=>{if(!playerState?.locked)selectQuizForMansion(activeMansion);})
         .catch(handleCooldownRefreshError);
     },Math.min(remaining,2147483647));
   }
 }
 showTrialBanner(trialError);
 summary.textContent=playerToken?`${playerNickname||'尚未設定暱稱'}｜參戰 ${playerState?.total_attempts??0} 次｜答對 ${playerState?.correct_attempts??0} 次｜成功率 ${Number(playerState?.success_rate??0).toFixed(1)}%｜當期答錯 ${playerState?.wrong_count??0}/5${locked?'｜暫停至 '+dateText(playerState.locked_until):''}`:trialInfo&&!trialInfo.locked?'訪客試玩：剩餘 '+trialInfo.remaining+' 次答題｜登入會員可保存成績與使用文昌星救援。':'請註冊或登入，才能開始正式數術挑戰。';
 logoutBtn.hidden=!playerToken;signInBtn.hidden=!!playerToken;profileBtn.hidden=!playerToken;
 if(locked){alertBox.hidden=false;}else{alertBox.hidden=true;alertBox.textContent='';}
 renderCooldown();
 const allowed=(!!playerToken && !locked)||(!playerToken&&!!trialInfo&&!trialInfo.locked);
 if(!spinning){
   $('spinBtn').disabled=!allowed;
   if(locked){$('spinBtn').textContent='🔒 挑戰暫停・查看解鎖時間';$('spinBtn').title='點擊可查看解鎖倒數與原因';}
   else if($('spinBtn').textContent.startsWith('🔒')){$('spinBtn').textContent='✦　再次抽宿挑戰';$('spinBtn').title='';}
   $('nextQuestionBtn').disabled=!allowed || $('nextQuestionBtn').disabled;
 }
 if(!allowed && !spinning){
  $('answerOptions').replaceChildren();
  $('questionText').textContent=locked?'本次挑戰已達五次答錯，請於解鎖後繼續。':trialInfo?.locked?'此 IP 的 5 次試玩額度已用完，請註冊或登入會員繼續。':'請登入或等待試玩服務載入後再挑戰。';
  $('quizCategory').textContent=locked?'挑戰暫停':trialInfo?.locked?'試玩已達上限':'試玩／會員模式';
 }
}
async function refresh(){
 if(!playerToken){playerState=null;drawState();return;}
 playerState=await endpoint('/rest/v1/rpc/quiz_player_status','POST',{});
 await reloadCompleted();
 drawState();
}
function showError(msg){notice.textContent=msg;}
async function completeMemberLogin(data,address){
 if(!data?.access_token)throw Error('未取得有效登入憑證；請確認電子郵件或帳號狀態。');
 playerToken=data.access_token;playerEmail=address;
 password.value='';confirmPassword.value='';
 try{
   // Existing server-side player scores and previously unlocked answers are retained.
   try{await endpoint('/rest/v1/rpc/quiz_record_member_login','POST',{});}
   catch(error){console.warn('登入計次未寫入',error.message);}
   await refresh();
   const hasNickname=await loadNickname();
   if(!hasNickname){
     setDialogMode('profile');
     showError('登入成功。請儲存暱稱設定；電子郵件不會顯示於公開排行。');
     nickname.focus();
   }else{
     dialog.close();setDialogMode('login');
     selectQuizForMansion(activeMansion);
   }
 }catch(error){
   playerToken=null;playerState=null;playerNickname='';drawState();
   throw error;
 }
}
form.addEventListener('submit',async e=>{
 e.preventDefault();
 if(busy||dialogMode==='verify'||dialogMode==='profile')return;
 if(dialogMode==='signup'||dialogMode==='reset'){
   if(dialogMode==='signup'&&!validNick(nickname.value)){
     showError('暱稱需為 2～18 字，僅可使用中英文、數字、底線或連字號。');
     nickname.focus();return;
   }
   if(password.value!==confirmPassword.value){
     confirmPassword.setCustomValidity('兩次密碼不相同');
     showError('兩次輸入的密碼不同，請重新確認。');
     confirmPassword.reportValidity();return;
   }
 }
 busy=true;loginBtn.disabled=true;registerBtn.disabled=true;backBtn.disabled=true;
 const signup=dialogMode==='signup',recover=dialogMode==='recover',reset=dialogMode==='reset';
 const address=email.value.trim().toLowerCase();
 showError(reset?'正在安全更新密碼…':recover?'正在申請重設信，請勿重複寄送…':signup?'正在送出註冊請求，請勿重複點擊…':'正在驗證帳號，請稍候…');
 try{
   if(recover){
     if(Date.now()<recoveryEmailAvailableAt)throw Error('重設信已送出，請等候至少 90 秒並檢查收件匣及垃圾郵件。');
     const captcha=window.quizCaptcha.token(form);
     await endpoint('/auth/v1/recover?redirect_to='+encodeURIComponent(EMAIL_CONFIRM_REDIRECT),
       'POST',{email:address,gotrue_meta_security:{captcha_token:captcha}});
     recoveryEmailAvailableAt=Date.now()+90000;
     showError('若此電子郵件已註冊，系統將寄送密碼重設連結。請檢查收件匣與垃圾郵件；此訊息不代表郵件已送達。');
   }else if(reset){
     if(!recoveryAccessToken)throw Error('重設連結無效，請重新申請重設信。');
     const response=await fetch(base+'/auth/v1/user',{
       method:'PUT',headers:{apikey:key,Authorization:'Bearer '+recoveryAccessToken,'Content-Type':'application/json'},
       body:JSON.stringify({password:password.value}),cache:'no-store'
     });
     const result=await response.json().catch(()=>({}));
     if(!response.ok){
       const err=Error(result?.message||result?.msg||result?.error_description||'重設連結已過期或新密碼無效');
       err.status=response.status;throw err;
     }
     recoveryAccessToken=null;password.value='';confirmPassword.value='';
     setDialogMode('login',true);
     showError('密碼已更新成功。請使用新密碼重新登入；原有成績與文昌星救援點數不變。');
   }else{
     const captcha=window.quizCaptcha.token(form);
     if(signup){
     const result=await endpoint('/auth/v1/signup?redirect_to='+encodeURIComponent(EMAIL_CONFIRM_REDIRECT),
       'POST',{email:address,password:password.value,
         data:{nickname:nickname.value.trim()},
         gotrue_meta_security:{captcha_token:captcha}});
     password.value='';confirmPassword.value='';
     if(result?.access_token){
       await completeMemberLogin(result,address);
     }else{
       verificationEmail=address;
       setDialogMode('verify');
       pauseResend();
       showError('註冊請求已受理。若此信箱符合註冊條件，請查看驗證信並完成驗證；尚未代表已登入或郵件已送達。');
     }
   }else{
     const result=await endpoint('/auth/v1/token?grant_type=password','POST',{
       email:address,password:password.value,gotrue_meta_security:{captcha_token:captcha}});
     await completeMemberLogin(result,address);
     }
   }
 }catch(err){
   if(reset&&(err.status===401||err.status===403)){
     recoveryAccessToken=null;password.value='';confirmPassword.value='';setDialogMode('recover',true);
     showError('密碼重設連結已失效或過期，請重新申請重設信。');
   }else showError(normalAuthError(err,reset?'更新密碼':recover?'寄送重設信':signup?'註冊':'登入'));
 }finally{
   window.quizCaptcha.reset(form);
   busy=false;loginBtn.disabled=false;registerBtn.disabled=false;backBtn.disabled=false;
   updateResendButton();
 }
});
forgotBtn.addEventListener('click',()=>{if(busy)return;password.value='';confirmPassword.value='';setDialogMode('recover');showDlg();email.focus();});
registerBtn.addEventListener('click',()=>{
 if(busy)return;
 setDialogMode('signup');nickname.focus();
});
resendBtn.addEventListener('click',async()=>{
 if(busy||dialogMode!=='verify'||Date.now()<resendAvailableAt||!verificationEmail)return;
 busy=true;resendBtn.disabled=true;
 showError('正在向 Supabase 申請重寄驗證信…');
 try{
   const captcha=window.quizCaptcha.token(form);
   await endpoint('/auth/v1/resend?redirect_to='+encodeURIComponent(EMAIL_CONFIRM_REDIRECT),
     'POST',{email:verificationEmail,type:'signup',
       gotrue_meta_security:{captcha_token:captcha}});
   pauseResend();
   showError('重寄請求已受理。請檢查收件匣及垃圾郵件；是否送達仍依寄信服務狀態而定。');
 }catch(err){showError(normalAuthError(err,'重新寄送驗證信'));}
 finally{window.quizCaptcha.reset(form);busy=false;updateResendButton();}
});
verifiedLoginBtn.addEventListener('click',()=>{
 if(busy)return;
 const address=verificationEmail;setDialogMode('login');email.value=address;
 password.value='';password.focus();
});
function dismissPlayerDialog(){
 if(busy)return;
 recoveryAccessToken=null;
 password.value='';confirmPassword.value='';password.type='password';
 showPassword.textContent='顯示密碼';showPassword.setAttribute('aria-pressed','false');
 dialog.close();setDialogMode('login');
}
closeBtn.addEventListener('click',dismissPlayerDialog);
backBtn.addEventListener('click',()=>{
 if(busy)return;
 password.value='';confirmPassword.value='';recoveryAccessToken=null;setDialogMode('login');email.focus();
});
signInBtn.addEventListener('click',()=>{setDialogMode('login');showDlg();});
const profileBtn=node('button','修改暱稱');profileBtn.type='button';profileBtn.hidden=true;actions.append(profileBtn);
profileBtn.addEventListener('click',()=>{setDialogMode('profile');showDlg();nickname.focus();});
saveProfileBtn.addEventListener('click',async()=>{
  if(busy)return;busy=true;saveProfileBtn.disabled=true;
  try{
    await updateNickname();
    showError('暱稱已儲存，所有會員自動參與排行榜。');
    dialog.close();setDialogMode('login');
    selectQuizForMansion(activeMansion);
  }catch(e){showError('儲存失敗：'+(/Nickname already taken|unique|duplicate/i.test(e.message)?'此暱稱已有人使用，請改用其他暱稱。':e.message));}
  finally{saveProfileBtn.disabled=false;busy=false;}
});
logoutBtn.addEventListener('click',async()=>{
 const old=playerToken;playerToken=null;playerEmail='';playerNickname='';playerState=null;completedIds=new Set();window.quizCompletedIds=completedIds;
 nickname.value='';setDialogMode('login');closeWenchang();drawState();void refreshTrial();
 if(old)try{await fetch(base+'/auth/v1/logout',{method:'POST',headers:{'apikey':key,'Authorization':'Bearer '+old}});}catch(e){}
});
// The old site had local-only scoring. Intercept it, validate and count on the server first.
// 文昌星救援：真正扣點與答案解鎖由 Supabase RPC 執行，不信任瀏覽器數值。
const wenchangCSS=node('style');
wenchangCSS.textContent=`
  .wenchang-dialog{width:min(490px,calc(100vw - 24px));max-height:90dvh;overflow:auto;border:1px solid #d5bd83;border-radius:16px;padding:23px;background:#fffaf0;color:#27333b;box-shadow:0 22px 70px #101f3255}
  .wenchang-dialog::backdrop{background:#142235a8;backdrop-filter:blur(3px)}
  .wenchang-dialog h2{font-size:1.45rem;margin:0 0 10px;color:#6e562a}
  .wenchang-dialog p{line-height:1.8;white-space:pre-wrap;font-size:.92rem}
  .wenchang-dialog .wenchang-credit{font-weight:700;color:#466e60}
  .wenchang-dialog .wenchang-answer{white-space:pre-wrap;padding:12px;background:#eef4e9;border:1px solid #c4d4b7;border-radius:9px;line-height:1.9;font-size:.92rem}
  .wenchang-dialog .wenchang-actions{display:flex;flex-wrap:wrap;gap:9px;justify-content:flex-end;margin-top:18px}
  .wenchang-dialog button{font:inherit;padding:9px 14px;border:1px solid #bba77c;border-radius:8px;background:#fbf1df;cursor:pointer}
  .wenchang-dialog .wenchang-primary{background:#315f56;color:white;border-color:#315f56}
  .wenchang-dialog button:disabled{opacity:.55;cursor:not-allowed}
  .wenchang-dialog [hidden]{display:none!important}
`;
document.head.append(wenchangCSS);
const wenchangDialog=node('dialog','','wenchang-dialog');
const wenchangHeading=node('h2','✦ 文昌星救援');
const wenchangInfo=node('p','本題回答錯誤。可使用 1 點答對累積的文昌點數，解鎖正解與解析。');
const wenchangCredits=node('p','正在查詢文昌點數…','wenchang-credit');
const wenchangAnswer=node('div','','wenchang-answer');wenchangAnswer.hidden=true;
const wenchangActions=node('div','','wenchang-actions');
const wenchangYes=node('button','使用 1 點文昌點數','wenchang-primary');wenchangYes.type='button';
const wenchangNo=node('button','暫不使用');wenchangNo.type='button';
wenchangActions.append(wenchangNo,wenchangYes);
wenchangDialog.append(wenchangHeading,wenchangInfo,wenchangCredits,wenchangAnswer,wenchangActions);
document.body.append(wenchangDialog);
let wenchangPendingId=null,wenchangBusy=false;
function closeWenchang(){
  if(wenchangBusy)return;
  if(wenchangDialog.open)wenchangDialog.close();
  wenchangPendingId=null;
}
wenchangNo.addEventListener('click',closeWenchang);
wenchangDialog.addEventListener('cancel',event=>{if(wenchangBusy)event.preventDefault();else wenchangPendingId=null;});
async function offerWenchang(question){
  wenchangPendingId=question.id;
  wenchangAnswer.hidden=true;wenchangAnswer.textContent='';
  wenchangInfo.textContent='本題回答錯誤。首次解鎖需花費 1 點；同題已解鎖免扣點。';
  wenchangNo.textContent='暫不使用';
  wenchangYes.hidden=false;wenchangYes.disabled=true;
  wenchangCredits.textContent='正在查詢文昌點數…';
  if(!wenchangDialog.open)wenchangDialog.showModal();
  try{
    const status=await endpoint('/rest/v1/rpc/quiz_wenchang_status','POST',{});
    if(wenchangPendingId!==question.id)return;
    if(status.credit_source!=='correct_answers')throw Error('新文昌點數制度尚未啟用，請稍後再試');
    const credits=Number(status.credits);
    if(!Number.isSafeInteger(credits)||credits<0)throw Error('點數資料格式錯誤');
    wenchangCredits.textContent='可用：'+credits+' 點｜答對 '+Number(status.earned||0)+' 題｜已用 '+Number(status.spent||0)+' 點。';
    const access=await endpoint('/rest/v1/rpc/quiz_wenchang_question_access','POST',{p_question_id:question.id});
    if(wenchangPendingId!==question.id)return;
    const freeAccess=access.can_reveal_without_points===true;
    wenchangYes.disabled=credits<1&&!freeAccess;
    if(freeAccess)wenchangInfo.textContent='這道題目的答案已解鎖，現在可以免費重新查看。';
    else if(credits<1)wenchangInfo.textContent='目前點數不足；答對新題目可再獲得文昌點數。';
  }catch(err){if(wenchangPendingId===question.id){wenchangCredits.textContent='文昌點數查詢失敗：'+err.message;wenchangYes.disabled=true;}}
}
wenchangYes.addEventListener('click',async()=>{
  if(wenchangBusy||!wenchangPendingId)return;
  const id=wenchangPendingId;
  wenchangBusy=true;wenchangYes.disabled=true;wenchangNo.disabled=true;
  try{
    const result=await endpoint('/rest/v1/rpc/quiz_wenchang_reveal','POST',{p_question_id:id});
    const index=Number(result.correct_answer);
    const question=questionBank.find(q=>q.id===id);
    if(!Number.isInteger(index)||index<0||index>3||!question)throw Error('已解鎖，但題目資料不完整，請聯絡管理員。');
    const label=['A','B','C','D'][index]+'. '+question.options[index];
    wenchangAnswer.textContent='正確答案：'+label+(result.explanation?'\n\n解析：'+result.explanation:'');
    wenchangAnswer.hidden=false;
    wenchangInfo.textContent=result.used_credit?'已扣除 1 點文昌點數；本題以後重新查看不扣點。':'本題答案已解鎖，沒有扣除文昌點數。';
    if(playerState?.locked)wenchangInfo.textContent+='\n您已累計五次答錯，目前仍須等候三十分鐘鎖定期結束；救援不會解除鎖定。';
    wenchangCredits.textContent='目前剩餘：'+Number(result.status?.credits??0)+' 點';
    window.dispatchEvent(new Event('wenchang-points-changed'));
    wenchangYes.hidden=true;wenchangNo.textContent='關閉';
    if(activeQuestion?.id===id)$('answerFeedback').textContent='✕ 回答錯誤。已使用「文昌星救援」查看解析。'+(playerState?.locked?'\n本次已達五次答錯，請等待解鎖；點北極星可查看倒數。':'');
    window.dispatchEvent(new CustomEvent('quiz-learning-answer-revealed',{detail:{questionId:id,correctAnswer:index,explanation:result.explanation||''}}));
  }catch(err){wenchangInfo.textContent='救援失敗：'+err.message;wenchangYes.disabled=false;}
  finally{wenchangBusy=false;wenchangNo.disabled=false;}
});
const previousAnswer=answerQuestion;
answerQuestion=async function(index){
 if(busy)return;
 if(!playerToken){
   if(!trialInfo||trialInfo.locked){
     drawState();setDialogMode('login');showDlg();return;
   }
   if(!activeQuestion||questionAnswered||spinning)return;
   busy=true;
   try{
     const response=await trialApi('answer',{
       question_id:activeQuestion.id,answer_index:index
     });
     if(!Number.isInteger(response.used)||!Number.isInteger(response.remaining)||
       response.remaining!==5-response.used)
       throw Error('試玩次數回應異常');
     trialInfo={used:response.used,remaining:response.remaining,limit:5,locked:response.locked};
     if(response.accepted){
       questionAnswered=true;answeredCount++;if(response.correct)correctCount++;
       [...$('answerOptions').children].forEach((b,i)=>{
         b.disabled=true;
         if(i===index)b.classList.add(response.correct?'correct':'wrong');
       });
       $('answerFeedback').textContent=response.correct?
         '✓ 試玩回答正確！正式會員可保存成績。':
         '✕ 試玩回答錯誤。訪客不公開正確答案或解析，註冊會員可使用文昌星救援。';
       $('quizScore').textContent='試玩已答 '+response.used+'／5 題';
     }else{
       $('answerFeedback').textContent=response.reason==='already_answered'?
         '這題已在目前 IP 的試玩中作答，請換一題。':
         '此 IP 已用完 5 次試玩額度，請註冊／登入。';
     }
     showTrialBanner();
     if(trialInfo.locked){
       $('spinBtn').disabled=true;
       $('nextQuestionBtn').disabled=true;
       $('questionText').textContent='此 IP 的 5 次試玩已結束，請註冊／登入以繼續挑戰。';
       $('answerOptions').querySelectorAll('button').forEach(b=>b.disabled=true);
     }
   }catch(error){$('answerFeedback').textContent='試玩提交失敗（不計入答題）：'+error.message;}
   finally{busy=false;}
   return;
 }
 if(playerState?.locked){drawState();return;}
 if(!activeQuestion||questionAnswered||spinning)return;
 busy=true;
 try{
  const result=await endpoint('/rest/v1/rpc/quiz_submit_choice','POST',{
    p_question_id:activeQuestion.id,p_answer_index:index});
  playerState={wrong_count:result.wrong_count,locked:result.locked,locked_until:result.locked_until,total_attempts:result.total_attempts??playerState?.total_attempts??0,correct_attempts:result.correct_attempts??playerState?.correct_attempts??0,success_rate:result.success_rate??playerState?.success_rate??0};
  if(!result.accepted){if(result.reason==='already_correct'||result.reason==='already_answered'){completedIds.add(activeQuestion.id);$('answerFeedback').textContent='這一題您已答對過，不會再次出題或計分；請重新抽宿。';$('answerOptions').querySelectorAll('button').forEach(b=>b.disabled=true);}drawState();return;}
  if(result.correct){completedIds.add(activeQuestion.id);window.dispatchEvent(new Event('wenchang-points-changed'));}
  window.dispatchEvent(new CustomEvent('quiz-answer-graded',{detail:{correct:result.correct,questionId:activeQuestion.id}}));
  // Display server-checked result, not a locally guessed value.
  questionAnswered=true;answeredCount++;if(result.correct)correctCount++;
  [...$('answerOptions').children].forEach((b,i)=>{
    b.disabled=true;
    if(result.correct && i===index)b.classList.add('correct');
    else if(!result.correct && i===index)b.classList.add('wrong');
    else if(!result.correct && result.administrator_exempt && i===result.correct_answer)b.classList.add('correct');
  });
  if(result.correct){
    $('answerFeedback').textContent='✓ 回答正確！'+(result.explanation?'\n'+result.explanation:'');
  }else if(result.administrator_exempt && Number.isInteger(result.correct_answer) && result.correct_answer>=0 && result.correct_answer<4){
    $('answerFeedback').textContent='✕ 回答錯誤；正確答案：'+['A','B','C','D'][result.correct_answer]+'. '+activeQuestion.options[result.correct_answer]+(result.explanation?'\n'+result.explanation:'');
  }else{
    $('answerFeedback').textContent='✕ 回答錯誤。可花費 1 點答對累積的文昌點數查看解析，或保留點數稍後挑戰。';
    await offerWenchang(activeQuestion);
  }
  $('quizScore').textContent=`已答 ${answeredCount} 題 · 答對 ${correctCount} 題`;
  drawState();
  window.dispatchEvent(new CustomEvent('quiz-learning-answer-resolved',{detail:{accepted:true,questionId:activeQuestion.id,correct:result.correct,correctAnswer:result.correct_answer,explanation:result.explanation||'',administratorExempt:result.administrator_exempt}}));
 }catch(err){$('answerFeedback').textContent='提交失敗，未記入答題：'+err.message;}
 finally{busy=false;}
};
// Open questions are self-assessed: no objective automated grading is claimed.
window.challengeRecordOpen=async(q,mastered)=>{
 if(busy)return false;
 if(!playerToken){showDlg();return false;}
 if(playerState?.locked){drawState();return false;}
 busy=true;
 try{
  const result=await endpoint('/rest/v1/rpc/quiz_review_open','POST',{
    p_question_id:q.id,p_mastered:Boolean(mastered)});
  playerState={wrong_count:result.wrong_count,locked:result.locked,locked_until:result.locked_until};
  drawState();return !!result.accepted;
 }catch(err){$('answerFeedback').textContent='評量尚未儲存：'+err.message;return false;}
 finally{busy=false;}
};
const priorSelect=selectQuizForMansion;
selectQuizForMansion=function(index){
 activeMansion=index;
 if((playerToken&&playerState?.locked)||(!playerToken&&(!trialInfo||trialInfo.locked))){drawState();return;}
 priorSelect(index);
};
// The original spin handler was registered earlier; capture events before it executes.
for(const elem of [$('spinBtn'),$('polaris-trigger')]){
 if(!elem)continue;
 for(const eventName of ['click','keydown'])elem.addEventListener(eventName,e=>{
  if(eventName==='keydown'&&!['Enter',' '].includes(e.key))return;
  if((playerToken&&playerState?.locked)||(!playerToken&&(!trialInfo||trialInfo.locked))){e.preventDefault();e.stopImmediatePropagation();
    if(playerState?.locked)onLockedWheelClick();else{setDialogMode('login');showDlg();}}
 },true);
}
setDialogMode('login');
const oldStatus=drawState;oldStatus();void refreshTrial();
if(recoveryAccessToken){
  setDialogMode('reset');showDlg();password.focus();
}else if(isRecoveryLink||recoveryError){
  setDialogMode('recover');showDlg();
  showError('密碼重設連結無效或已過期。請重新輸入電子郵件申請新的重設信。');
}
// Keep no bearer token in GitHub, localStorage, cookies or URL; re-login after page refresh.
})();
