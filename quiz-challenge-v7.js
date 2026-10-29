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
let playerToken=null, playerEmail='', playerNickname='', playerState=null, busy=false;
window.quizMemberToken=()=>playerToken;
let lastAnnouncedMemberToken;
let unlockTimer=null, unlockAt='';
let completedIds=new Set();window.quizCompletedIds=completedIds;
window.quizPlayerMayChallenge=()=>Boolean(playerToken&&!playerState?.locked);
async function reloadCompleted(){completedIds=new Set(await endpoint('/rest/v1/rpc/quiz_answered_question_ids','POST',{}));window.quizCompletedIds=completedIds;}
const loginReady=Boolean(base&&key);
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
const intro=node('p','請使用自己的電子郵件註冊。同一帳號累計答錯五次，將暫停挑戰三十分鐘；期滿歸零。\n\n✦ 文昌星救援：答錯時，可自行選擇是否使用 1 次救援，查看正確答案與解析。每位會員起始有 3 次救援機會，每兩小時補充 3 次，最多累積 10 次。救援不會抵銷答錯次數，也不會提前解除挑戰鎖定。');
const form=node('form');form.id='playerAuthForm';
const elabel=node('label','電子郵件'),email=node('input');email.type='email';email.required=true;email.autocomplete='username';elabel.append(email);
const nicknameLabel=node('label','暱稱（2–18字，可使用中英文、數字、底線、連字號）'),nickname=node('input');nickname.type='text';nickname.id='playerNickname';nickname.maxLength=18;nickname.autocomplete='nickname';nicknameLabel.append(nickname);
const privacyLabel=node('label','公開排行設定'),privacyCheck=node('input');privacyCheck.type='checkbox';privacyCheck.checked=false;privacyLabel.append(privacyCheck,document.createTextNode(' 我同意公開暱稱與答題成績（可隨時取消）'));
const plabel=node('label','密碼（至少 8 個字元）'),password=node('input');password.type='password';password.minLength=8;password.required=true;password.autocomplete='current-password';plabel.append(password);
const buttons=node('div','','account-actions');
const loginBtn=node('button','登入','player-main');loginBtn.type='submit';
const registerBtn=node('button','建立新帳號');registerBtn.type='button';
const saveProfileBtn=node('button','儲存暱稱與排行設定');saveProfileBtn.type='button';saveProfileBtn.hidden=true;
const backBtn=node('button','返回登入');backBtn.type='button';backBtn.hidden=true;
const closeBtn=node('button','關閉');closeBtn.type='button';
buttons.append(loginBtn,registerBtn,saveProfileBtn,backBtn,closeBtn);form.append(elabel,plabel,nicknameLabel,privacyLabel,buttons);
const notice=node('p','密碼僅傳送至 Supabase Auth；網站原始碼不儲存密碼。');notice.setAttribute('role','status');
dialog.append(heading,intro,form,notice);document.body.append(dialog);
const showDlg=()=>{if(!dialog.open)dialog.showModal();};
let dialogMode='login';
function setDialogMode(mode,preserveNotice=false){
  dialogMode=mode;
  const editing=mode==='profile',signup=mode==='signup';
  elabel.hidden=editing;plabel.hidden=editing;
  nicknameLabel.hidden=!(editing||signup);
  privacyLabel.hidden=!(editing||signup);
  loginBtn.hidden=mode!=='login';registerBtn.hidden=editing;
  registerBtn.textContent=signup?'確認建立新帳號':'建立新帳號';
  saveProfileBtn.hidden=!editing;backBtn.hidden=!signup;
  email.required=!editing;password.required=!editing;
  heading.textContent=editing?'暱稱與排行榜公開設定':signup?'建立數術挑戰帳號':'數術知識挑戰・帳號登入';
  if(!preserveNotice)notice.textContent=editing?'設定一次即可保存，下次登入會自動讀取。':
    signup?'請填寫電子郵件、密碼與暱稱；公開排行榜為自願選項。':
    '登入不需要重填暱稱；系統會自動載入已儲存的設定。';
}
const validNick=value=>/^[\p{L}\p{N}_-]{2,18}$/u.test(String(value||'').trim());
async function loadNickname(){
  if(!playerToken)return false;
  // A failed RPC is not equivalent to an account with no nickname.
  const p=await endpoint('/rest/v1/rpc/quiz_my_profile','POST',{});
  playerNickname=typeof p.nickname==='string'?p.nickname.trim():'';
  nickname.value=playerNickname;
  privacyCheck.checked=!!p.leaderboard_opt_in;
  drawState();
  return Boolean(playerNickname);
}
async function updateNickname(){const name=nickname.value.trim();if(!validNick(name))throw Error('暱稱需為2–18字，限中英文、數字、底線或連字號。');const p=await endpoint('/rest/v1/rpc/quiz_set_player_profile','POST',{p_nickname:name,p_leaderboard_opt_in:privacyCheck.checked});playerNickname=p.nickname;drawState();window.dispatchEvent(new Event('quiz-leaderboard-refresh'));}
const tokenHeaders=()=>({'apikey':key,'Content-Type':'application/json',...(playerToken?{'Authorization':'Bearer '+playerToken}:{})});
window.quizRevealOpenAnswer=(questionId)=>endpoint('/rest/v1/rpc/quiz_reveal_open_answer','POST',{p_question_id:questionId});
async function endpoint(path,method='GET',obj=null){
 if(!loginReady)throw Error('請先在 config.js 設定 Supabase URL 與 Publishable Key。');
 const r=await fetch(base+path,{method,headers:tokenHeaders(),body:obj==null?undefined:JSON.stringify(obj),cache:'no-store'});
 const text=await r.text();let data={};try{data=text?JSON.parse(text):{};}catch(e){}
 if(!r.ok)throw Error(data.msg||data.error_description||data.message||data.error||'HTTP '+r.status);
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
 summary.textContent=playerToken?`${playerNickname||'尚未設定暱稱'}｜參戰 ${playerState?.total_attempts??0} 次｜答對 ${playerState?.correct_attempts??0} 次｜成功率 ${Number(playerState?.success_rate??0).toFixed(1)}%｜當期答錯 ${playerState?.wrong_count??0}/5${locked?'｜暫停至 '+dateText(playerState.locked_until):''}`:'請註冊或登入，才能開始數術問答挑戰。';
 logoutBtn.hidden=!playerToken;signInBtn.hidden=!!playerToken;profileBtn.hidden=!playerToken;
 if(locked){alertBox.hidden=false;}else{alertBox.hidden=true;alertBox.textContent='';}
 renderCooldown();
 const allowed=!!playerToken && !locked;
 if(!spinning){
   $('spinBtn').disabled=!playerToken;
   if(locked){$('spinBtn').textContent='🔒 挑戰暫停・查看解鎖時間';$('spinBtn').title='點擊可查看解鎖倒數與原因';}
   else if($('spinBtn').textContent.startsWith('🔒')){$('spinBtn').textContent='✦　再次抽宿挑戰';$('spinBtn').title='';}
   $('nextQuestionBtn').disabled=!allowed || $('nextQuestionBtn').disabled;
 }
 if(!allowed && !spinning){
  $('answerOptions').replaceChildren();
  $('questionText').textContent=locked?'本次挑戰已達五次答錯，請於解鎖後繼續。':'請登入或註冊帳號，再開始抽宿挑戰。';
  $('quizCategory').textContent=locked?'挑戰暫停':'會員模式';
 }
}
async function refresh(){
 if(!playerToken){playerState=null;drawState();return;}
 playerState=await endpoint('/rest/v1/rpc/quiz_player_status','POST',{});
 await reloadCompleted();
 drawState();
}
function showError(msg){notice.textContent=msg;}
form.addEventListener('submit',async e=>{
 e.preventDefault();if(busy)return;busy=true;
 try{
  const data=await endpoint('/auth/v1/token?grant_type=password','POST',{email:email.value.trim(),password:password.value,gotrue_meta_security:{captcha_token:window.quizCaptcha.token(form)}});
  if(!data.access_token)throw Error('未取得有效登入憑證。若啟用了郵件確認，請先驗證電子郵件。');
  playerToken=data.access_token;playerEmail=email.value.trim();password.value='';
  // Log this verified Auth session once. Failure must not block a valid login.
  try{await endpoint('/rest/v1/rpc/quiz_record_member_login','POST',{});}catch(error){console.warn('登入計次未寫入',error.message);}
  await refresh();
  const hasNickname=await loadNickname();
  if(!hasNickname){
    setDialogMode('profile');
    showError('登入成功。此帳號尚未儲存暱稱，請設定一次；電子郵件不會在排行榜公開。');
    nickname.focus();
  } else {
    dialog.close();
    setDialogMode('login');
    selectQuizForMansion(activeMansion);
  }
 }catch(err){playerToken=null;playerState=null;showError('登入失敗：'+err.message);drawState();}
 finally{window.quizCaptcha.reset(form);busy=false;}
});
registerBtn.addEventListener('click',async()=>{
 if(busy)return;
 if(dialogMode!=='signup'){setDialogMode('signup');nickname.focus();return;}
 if(!email.reportValidity()||!password.reportValidity())return;
 busy=true;
 try{if(!validNick(nickname.value))throw Error('請輸入2–18字的暱稱（中英文、數字、底線或連字號）。');
  await endpoint('/auth/v1/signup','POST',{email:email.value.trim(),password:password.value,data:{nickname:nickname.value.trim(),leaderboard_opt_in:privacyCheck.checked},gotrue_meta_security:{captcha_token:window.quizCaptcha.token(form)}});
  password.value='';setDialogMode('login');
  showError('註冊請求已送出。若需郵件驗證，請先到信箱完成確認，再登入；暱稱會在登入後自動載入。');
 }catch(err){showError('註冊失敗：'+err.message);}finally{window.quizCaptcha.reset(form);busy=false;}
});
closeBtn.addEventListener('click',()=>{password.value='';dialog.close();setDialogMode('login');});
backBtn.addEventListener('click',()=>setDialogMode('login'));
signInBtn.addEventListener('click',()=>{setDialogMode('login');showDlg();});
const profileBtn=node('button','修改暱稱');profileBtn.type='button';profileBtn.hidden=true;actions.append(profileBtn);
profileBtn.addEventListener('click',()=>{setDialogMode('profile');showDlg();nickname.focus();});
saveProfileBtn.addEventListener('click',async()=>{
  if(busy)return;busy=true;saveProfileBtn.disabled=true;
  try{
    await updateNickname();
    showError('暱稱與排行榜公開設定已儲存。');
    dialog.close();setDialogMode('login');
    selectQuizForMansion(activeMansion);
  }catch(e){showError('儲存失敗：'+(/Nickname already taken|unique|duplicate/i.test(e.message)?'此暱稱已有人使用，請改用其他暱稱。':e.message));}
  finally{saveProfileBtn.disabled=false;busy=false;}
});
logoutBtn.addEventListener('click',async()=>{
 const old=playerToken;playerToken=null;playerEmail='';playerNickname='';playerState=null;completedIds=new Set();window.quizCompletedIds=completedIds;
 nickname.value='';privacyCheck.checked=false;setDialogMode('login');closeWenchang();drawState();
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
const wenchangInfo=node('p','本題回答錯誤。是否使用 1 次文昌星救援，查看正確答案與解析？');
const wenchangCredits=node('p','正在查詢救援次數…','wenchang-credit');
const wenchangAnswer=node('div','','wenchang-answer');wenchangAnswer.hidden=true;
const wenchangActions=node('div','','wenchang-actions');
const wenchangYes=node('button','使用 1 次文昌星救援','wenchang-primary');wenchangYes.type='button';
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
  wenchangInfo.textContent='本題回答錯誤。是否使用 1 次「文昌星救援」查看正確答案與解析？';
  wenchangNo.textContent='暫不使用';
  wenchangYes.hidden=false;wenchangYes.disabled=true;
  wenchangCredits.textContent='正在查詢救援次數…';
  if(!wenchangDialog.open)wenchangDialog.showModal();
  try{
    const status=await endpoint('/rest/v1/rpc/quiz_wenchang_status','POST',{});
    if(wenchangPendingId!==question.id)return;
    const credits=Number(status.credits||0);
    wenchangCredits.textContent='目前可用：'+credits+' / 10 次。每兩小時補充 3 次（累計上限 10 次）。';
    wenchangYes.disabled=credits<1;
    if(credits<1)wenchangInfo.textContent='本題回答錯誤，救援次數目前不足；可以等候下次補充，之後再嘗試。';
  }catch(err){if(wenchangPendingId===question.id){wenchangCredits.textContent='救援次數查詢失敗：'+err.message;wenchangYes.disabled=true;}}
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
    wenchangInfo.textContent=result.used_credit?'已扣除 1 次文昌星救援；下次仍可重新挑戰這道題目。':'本題答案已解鎖，不重複扣除救援次數。';
    if(playerState?.locked)wenchangInfo.textContent+='\n您已累計五次答錯，目前仍須等候三十分鐘鎖定期結束；救援不會解除鎖定。';
    wenchangCredits.textContent='目前剩餘：'+Number(result.status?.credits??0)+' / 10 次';
    wenchangYes.hidden=true;wenchangNo.textContent='關閉';
    if(activeQuestion?.id===id)$('answerFeedback').textContent='✕ 回答錯誤。已使用「文昌星救援」查看解析。'+(playerState?.locked?'\n本次已達五次答錯，請等待解鎖；點北極星可查看倒數。':'');
  }catch(err){wenchangInfo.textContent='救援失敗：'+err.message;wenchangYes.disabled=false;}
  finally{wenchangBusy=false;wenchangNo.disabled=false;}
});
const previousAnswer=answerQuestion;
answerQuestion=async function(index){
 if(busy)return;
 if(!playerToken){showDlg();return;}
 if(playerState?.locked){drawState();return;}
 if(!activeQuestion||questionAnswered||spinning)return;
 busy=true;
 try{
  const result=await endpoint('/rest/v1/rpc/quiz_submit_choice','POST',{
    p_question_id:activeQuestion.id,p_answer_index:index});
  playerState={wrong_count:result.wrong_count,locked:result.locked,locked_until:result.locked_until,total_attempts:result.total_attempts??playerState?.total_attempts??0,correct_attempts:result.correct_attempts??playerState?.correct_attempts??0,success_rate:result.success_rate??playerState?.success_rate??0};
  if(!result.accepted){if(result.reason==='already_correct'||result.reason==='already_answered'){completedIds.add(activeQuestion.id);$('answerFeedback').textContent='這一題您已答對過，不會再次出題或計分；請重新抽宿。';$('answerOptions').querySelectorAll('button').forEach(b=>b.disabled=true);}drawState();return;}
  if(result.correct)completedIds.add(activeQuestion.id);
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
    $('answerFeedback').textContent='✕ 回答錯誤。可以選擇使用「文昌星救援」查看答案及解析，或保留次數稍後再挑戰。';
    await offerWenchang(activeQuestion);
  }
  $('quizScore').textContent=`已答 ${answeredCount} 題 · 答對 ${correctCount} 題`;
  drawState();
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
 if(!playerToken||playerState?.locked){drawState();return;}
 priorSelect(index);
};
// The original spin handler was registered earlier; capture events before it executes.
for(const elem of [$('spinBtn'),$('polaris-trigger')]){
 if(!elem)continue;
 for(const eventName of ['click','keydown'])elem.addEventListener(eventName,e=>{
  if(eventName==='keydown'&&!['Enter',' '].includes(e.key))return;
  if(!playerToken||playerState?.locked){e.preventDefault();e.stopImmediatePropagation();
    if(playerState?.locked)onLockedWheelClick();else{setDialogMode('login');showDlg();}}
 },true);
}
setDialogMode('login');
const oldStatus=drawState;oldStatus();
// Keep no bearer token in GitHub, localStorage, cookies or URL; re-login after page refresh.
})();
