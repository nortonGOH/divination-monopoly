/* v7 player registrations & account-based 5 wrong answers -> 4 hour cooldown.
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
const signInBtn=node('button','註冊／登入','player-main');signInBtn.type='button';
const logoutBtn=node('button','登出');logoutBtn.type='button';logoutBtn.hidden=true;
actions.append(signInBtn,logoutBtn);strip.append(summary,actions);
$('quizTitle').closest('.quiz-heading').after(strip);
const alertBox=node('p','','player-lock');alertBox.hidden=true;alertBox.id='playerLockAlert';
$('quizAvailable').closest('.quiz-panel').prepend(alertBox);
const dialog=node('dialog','','player-dialog');
const heading=node('h2','數術知識挑戰・帳號登入');
const intro=node('p','請使用自己的電子郵件註冊。同一帳號累計答錯五次，將暫停挑戰四小時；期滿歸零。');
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
async function endpoint(path,method='GET',obj=null){
 if(!loginReady)throw Error('請先在 config.js 設定 Supabase URL 與 Publishable Key。');
 const r=await fetch(base+path,{method,headers:tokenHeaders(),body:obj==null?undefined:JSON.stringify(obj),cache:'no-store'});
 const text=await r.text();let data={};try{data=text?JSON.parse(text):{};}catch(e){}
 if(!r.ok)throw Error(data.msg||data.error_description||data.message||data.error||'HTTP '+r.status);
 return data;
}
function dateText(value){return value?new Date(value).toLocaleString('zh-TW',{hour12:false}):'';}
function drawState(){
 const locked=Boolean(playerState?.locked);
 const nextUnlock=locked?String(playerState.locked_until||''):'';
 if(nextUnlock!==unlockAt){
   if(unlockTimer)clearTimeout(unlockTimer);unlockTimer=null;unlockAt=nextUnlock;
   if(locked && nextUnlock){
     const remaining=Math.max(1000,new Date(nextUnlock).getTime()-Date.now()+500);
     if(Number.isFinite(remaining))unlockTimer=setTimeout(()=>{
       if(!playerToken)return;refresh().then(()=>{if(!playerState?.locked)selectQuizForMansion(activeMansion);}).catch(console.error);
     },Math.min(remaining,2147483647));
   }
 }
 summary.textContent=playerToken?`${playerNickname||'尚未設定暱稱'}｜參戰 ${playerState?.total_attempts??0} 次｜答對 ${playerState?.correct_attempts??0} 次｜成功率 ${Number(playerState?.success_rate??0).toFixed(1)}%｜當期答錯 ${playerState?.wrong_count??0}/5${locked?'｜暫停至 '+dateText(playerState.locked_until):''}`:'請註冊或登入，才能開始數術問答挑戰。';
 logoutBtn.hidden=!playerToken;signInBtn.hidden=!!playerToken;profileBtn.hidden=!playerToken;
 if(locked){alertBox.hidden=false;alertBox.textContent=`已累計五次答錯，暫停挑戰至 ${dateText(playerState.locked_until)}。四小時後自動歸零。`;
 }else{alertBox.hidden=true;alertBox.textContent='';}
 const allowed=!!playerToken && !locked;
 if(!spinning){$('spinBtn').disabled=!allowed;$('nextQuestionBtn').disabled=!allowed || $('nextQuestionBtn').disabled;}
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
 nickname.value='';privacyCheck.checked=false;setDialogMode('login');drawState();
 if(old)try{await fetch(base+'/auth/v1/logout',{method:'POST',headers:{'apikey':key,'Authorization':'Bearer '+old}});}catch(e){}
});
// The old site had local-only scoring. Intercept it, validate and count on the server first.
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
  if(!result.accepted){if(result.reason==='already_answered'){completedIds.add(activeQuestion.id);$('answerFeedback').textContent='這一題您已作答，不會再次出題或計分；請重新抽宿。';$('answerOptions').querySelectorAll('button').forEach(b=>b.disabled=true);}drawState();return;}
  completedIds.add(activeQuestion.id);
  // Display server-checked result, not a locally guessed value.
  questionAnswered=true;answeredCount++;if(result.correct)correctCount++;
  [...$('answerOptions').children].forEach((b,i)=>{
    b.disabled=true;if(i===result.correct_answer)b.classList.add('correct');
    else if(i===index)b.classList.add('wrong');
  });
  $('answerFeedback').textContent=result.correct?'✓ 回答正確！':'✕ 回答錯誤；正確答案：'+['A','B','C','D'][result.correct_answer]+'. '+activeQuestion.options[result.correct_answer];
  if(result.explanation)$('answerFeedback').textContent+='\n'+result.explanation;
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
    if(playerState?.locked)drawState();else showDlg();}
 },true);
}
setDialogMode('login');
const oldStatus=drawState;oldStatus();
// Keep no bearer token in GitHub, localStorage, cookies or URL; re-login after page refresh.
})();
