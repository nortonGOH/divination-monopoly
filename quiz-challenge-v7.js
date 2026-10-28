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
let playerToken=null, playerEmail='', playerState=null, busy=false;
let unlockTimer=null, unlockAt='';
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
const plabel=node('label','密碼（至少 8 個字元）'),password=node('input');password.type='password';password.minLength=8;password.required=true;password.autocomplete='current-password';plabel.append(password);
const buttons=node('div','','account-actions');
const loginBtn=node('button','登入','player-main');loginBtn.type='submit';
const registerBtn=node('button','建立新帳號');registerBtn.type='button';
const closeBtn=node('button','關閉');closeBtn.type='button';
buttons.append(loginBtn,registerBtn,closeBtn);form.append(elabel,plabel,buttons);
const notice=node('p','密碼僅傳送至 Supabase Auth；網站原始碼不儲存密碼。');notice.setAttribute('role','status');
dialog.append(heading,intro,form,notice);document.body.append(dialog);
const showDlg=()=>{if(!dialog.open)dialog.showModal();};
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
 summary.textContent=playerToken?`${playerEmail}｜答錯 ${playerState?.wrong_count??0}/5${locked?'｜暫停至 '+dateText(playerState.locked_until):''}`:'請註冊或登入，才能開始數術問答挑戰。';
 logoutBtn.hidden=!playerToken;signInBtn.hidden=!!playerToken;
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
 drawState();
}
function showError(msg){notice.textContent=msg;}
form.addEventListener('submit',async e=>{
 e.preventDefault();if(busy)return;busy=true;
 try{
  const data=await endpoint('/auth/v1/token?grant_type=password','POST',{email:email.value.trim(),password:password.value,gotrue_meta_security:{captcha_token:window.quizCaptcha.token(form)}});
  if(!data.access_token)throw Error('未取得有效登入憑證。若啟用了郵件確認，請先驗證電子郵件。');
  playerToken=data.access_token;playerEmail=email.value.trim();password.value='';
  await refresh();dialog.close();selectQuizForMansion(activeMansion);
 }catch(err){playerToken=null;playerState=null;showError('登入失敗：'+err.message);drawState();}
 finally{window.quizCaptcha.reset(form);busy=false;}
});
registerBtn.addEventListener('click',async()=>{
 if(busy)return;if(!email.reportValidity()||!password.reportValidity())return;
 busy=true;
 try{await endpoint('/auth/v1/signup','POST',{email:email.value.trim(),password:password.value,gotrue_meta_security:{captcha_token:window.quizCaptcha.token(form)}});
  showError('註冊請求已送出。若已啟用電子郵件驗證，請先到信箱點擊確認連結，再使用「登入」。');
 }catch(err){showError('註冊失敗：'+err.message);}finally{window.quizCaptcha.reset(form);busy=false;}
});
closeBtn.addEventListener('click',()=>{password.value='';dialog.close();});
signInBtn.addEventListener('click',showDlg);
logoutBtn.addEventListener('click',async()=>{
 const old=playerToken;playerToken=null;playerEmail='';playerState=null;drawState();
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
  playerState={wrong_count:result.wrong_count,locked:result.locked,locked_until:result.locked_until};
  if(!result.accepted){drawState();return;}
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
const oldStatus=drawState;oldStatus();
// Keep no bearer token in GitHub, localStorage, cookies or URL; re-login after page refresh.
})();
