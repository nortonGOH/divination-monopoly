/* Beginner nickname mode: no registration, server-graded answers, ranked scores. */
(()=>{
 'use strict';
 const cfg=window.QUIZ_AUTH_CONFIG||{};
 const base=String(cfg.supabaseUrl||'').replace(/\/$/,'');
 const apikey=String(cfg.publishableKey||'');
 const host=document.querySelector('.quiz-heading');
 if(!host||!base||!apikey)return;
 const sessionKey='quiz_beginner_nickname_token_v1';
 const validNickname=n=>/^[\p{L}\p{N}_-]{2,18}$/u.test(String(n||'').trim());
 let profile=null,token='',pending=false;
 try{token=localStorage.getItem(sessionKey)||'';}catch(_){}
 if(!/^[a-f0-9]{64}$/.test(token))token='';
 const box=document.createElement('div');box.className='nickname-beginner-box';
 box.style.cssText='display:flex;align-items:center;gap:8px;flex-wrap:wrap;width:100%;margin:6px 0';
 const label=document.createElement('label');label.textContent='初階暱稱（免註冊） ';
 const input=document.createElement('input');input.id='nicknameBeginnerInput';
 input.placeholder='2–18 字中英文、數字';input.maxLength=18;input.autocomplete='nickname';
 input.style.cssText='min-height:40px;border:1px solid #bba981;border-radius:8px;padding:8px';
 label.append(input);
 const join=document.createElement('button');join.type='button';join.textContent='用暱稱挑戰初階';
 const leave=document.createElement('button');leave.type='button';leave.textContent='退出暱稱模式';leave.hidden=true;
 const status=document.createElement('span');status.id='nicknameBeginnerStatus';status.setAttribute('role','alert');status.setAttribute('aria-live','assertive');
 status.style.cssText='font-size:.83rem;width:100%;line-height:1.6';
 box.append(label,join,leave,status);host.append(box);
 const emit=()=>window.dispatchEvent(new Event('quiz-nickname-state-changed'));
 const active=()=>Boolean(profile?.nickname)&&!window.quizMemberToken?.();
 window.quizNicknameActive=active;
 window.quizNicknameProfile=()=>profile;
 window.quizNicknameFocus=()=>{input.focus();status.textContent='輸入暱稱，即可參與初階排行；中、高階須註冊會員。';};
 async function request(action,options={}){
  if(!token)throw Error('請先設定暱稱。');
  const r=await fetch(base+'/functions/v1/quiz-nickname-beginner',{
   method:'POST',headers:{apikey,'Content-Type':'application/json'},
   body:JSON.stringify({action,token,...options}),cache:'no-store'
  });
  const data=await r.json().catch(()=>({}));
  if(!r.ok){const error=Error(data.error||'暱稱服務暫時無法使用');error.code=data.code||'';throw error;}
  return data;
 }
 function controls(){
  const signedIn=Boolean(window.quizMemberToken?.());
  box.hidden=signedIn;
  leave.hidden=!profile;
  join.textContent=profile?'更新暱稱':'用暱稱挑戰初階';
  const difficulty=document.getElementById('quizDifficulty');
  if(difficulty){
   for(const option of difficulty.options)option.disabled=!signedIn&&option.value!=='初階';
   if(!signedIn&&difficulty.value!=='初階'){
    difficulty.value='初階';difficulty.dispatchEvent(new Event('change',{bubbles:true}));
   }
  }
  if(profile)status.textContent='暱稱 '+profile.nickname+'｜答對 '+profile.correct_attempts+
   '／'+profile.total_attempts+' 題｜成績列入前五名競賽；相同來源 IP 僅供管理員觀測。';
  else status.textContent='初階可用暱稱直接挑戰；中、高階需註冊登入。';
 }
 async function joinNickname(){
  if(pending)return;
  const nickname=input.value.trim();
  if(!validNickname(nickname)){status.textContent='暱稱需要 2–18 字，限中英文、數字、底線或連字號。';return;}
  pending=true;join.disabled=true;
  const original=token;
  if(!token)token=Array.from(crypto.getRandomValues(new Uint8Array(32)),
   x=>x.toString(16).padStart(2,'0')).join('');
  try{
   profile=await request('join',{nickname});
   input.removeAttribute('aria-invalid');
   try{localStorage.setItem(sessionKey,token);}catch(_){}
   emit();controls();window.dispatchEvent(new Event('quiz-leaderboard-refresh'));
  }catch(e){
   token=original;
   if(e.code==='nickname_taken'){
    input.setAttribute('aria-invalid','true');
    status.textContent='⚠ 暱名「'+nickname+'」已有人使用，請更換其他名稱。';
    input.focus();
   }else status.textContent='加入暱稱模式失敗：'+e.message;
  }
  finally{pending=false;join.disabled=false;}
 }
 window.quizNicknameSubmit=async(question_id,answer_index)=>{
  if(!active())throw Error('請先用暱稱加入初階挑戰。');
  const result=await request('answer',{question_id,answer_index});
  if(result.accepted){profile={...profile,...result};emit();window.dispatchEvent(new Event('quiz-leaderboard-refresh'));}
  return result;
 };
 join.addEventListener('click',()=>void joinNickname());
 input.addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();void joinNickname();}});
 input.addEventListener('input',()=>{
  input.removeAttribute('aria-invalid');
  if(status.textContent.includes('已有人使用'))status.textContent='請輸入其他暱名後重新登錄。';
 });
 leave.addEventListener('click',()=>{
  profile=null;token='';input.value='';
  try{localStorage.removeItem(sessionKey);}catch(_){}
  emit();controls();
 });
 window.addEventListener('quiz-member-session-changed',controls);
 // No locally calculated score is written to the leaderboard.
 const previousAnswer=answerQuestion;
 answerQuestion=async function(index){
  if(!active()||window.quizMemberToken?.())return previousAnswer(index);
  if(pending||!activeQuestion||questionAnswered||spinning)return;
  pending=true;
  try{
   const result=await window.quizNicknameSubmit(activeQuestion.id,index);
   if(result.accepted){
    questionAnswered=true;answeredCount++;if(result.correct)correctCount++;
    [...document.getElementById('answerOptions').children].forEach((button,i)=>{
     button.disabled=true;if(i===index)button.classList.add(result.correct?'correct':'wrong');
    });
    document.getElementById('answerFeedback').textContent=result.correct?
     '✓ 初階答對！已計入暱稱排行榜。':'✕ 初階答錯。此模式不提供文昌星救援。';
    document.getElementById('quizScore').textContent=
     '暱稱已答 '+result.total_attempts+' 題 · 答對 '+result.correct_attempts+' 題';
   }else if(result.reason==='already_answered'){
    document.getElementById('answerFeedback').textContent='這題已用此暱稱作答，不能重複計分；請重新抽宿。';
    questionAnswered=true;
    [...document.getElementById('answerOptions').children].forEach(b=>b.disabled=true);
   }
  }catch(e){document.getElementById('answerFeedback').textContent='暱稱答題未計分：'+e.message;}
  finally{pending=false;}
 };
 controls();
 if(token)request('status').then(result=>{profile=result;input.value=result.nickname||'';emit();controls();})
  .catch(()=>{profile=null;controls();});
})();
