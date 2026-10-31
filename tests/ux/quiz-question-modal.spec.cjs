const {test,expect}=require('@playwright/test');
const MOCK='https://mock-quiz-modal.supabase.co';
const questions=[
  {id:'modal-q1',mansion:'角木蛟',category:'天文曆法',knowledge_type:'天文曆法',
    difficulty:'初階',prompt:'角宿的示意測試題目為何？',options:['一','二','三','四']},
  {id:'modal-q2',mansion:'角木蛟',category:'天文曆法',knowledge_type:'天文曆法',
    difficulty:'初階',prompt:'第二道角宿示意測試題目？',options:['東','南','西','北']}
];

async function boot(page){
 const calls=[];let used=0;
 await page.route('**/*',async route=>{
  const req=route.request(),url=new URL(req.url());
  if(url.hostname==='127.0.0.1'){
   if(url.pathname==='/config.js')return route.fulfill({
    status:200,contentType:'application/javascript',
    body:"window.QUIZ_AUTH_CONFIG={supabaseUrl:'"+MOCK+"',publishableKey:'isolated-mock-key-123456789',turnstileSiteKey:''};"
   });
   return route.continue();
  }
  if(url.hostname!=='mock-quiz-modal.supabase.co')return route.abort();
  const headers={'access-control-allow-origin':'*','access-control-allow-headers':'*','access-control-allow-methods':'POST,GET,OPTIONS'};
  if(req.method()==='OPTIONS')return route.fulfill({status:204,headers});
  const path=url.pathname,body=JSON.parse(req.postData()||'{}');
  calls.push({path,body});
  let data=[],status=200;
  if(path.endsWith('/rpc/quiz_public_question_bank'))data=questions;
  else if(path==='/functions/v1/quiz-nickname-beginner'){
   if(body.action==='join')data={accepted:true,nickname:body.nickname,total_attempts:0,correct_attempts:0};
   else if(body.action==='answer'){
    used++;
    data={accepted:true,correct:false,nickname:'模態測試者',total_attempts:used,correct_attempts:0};
   }else data={accepted:true,nickname:'模態測試者',total_attempts:used,correct_attempts:0};
  }else if(path.endsWith('/rpc/quiz_public_leaderboard'))data=[];
  else if(path.endsWith('/rpc/quiz_public_registration_count'))data={registered_count:0};
  return route.fulfill({status,headers,contentType:'application/json',body:JSON.stringify(data)});
 });
 await page.goto('/');
 await expect.poll(()=>page.evaluate(()=>questionBank.length)).toBe(2);
 await page.locator('#nicknameBeginnerInput').fill('模態測試者');
 await page.getByRole('button',{name:'用暱稱挑戰初階'}).click();
 // The banner also mentions nickname mode before the async join has succeeded.
 // Wait for the server-acknowledged session and enabled wheel before spinning.
 await expect(page.locator('#nicknameBeginnerStatus')).toContainText('暱稱 模態測試者');
 await expect(page.locator('#spinBtn')).toBeEnabled();
 await expect(page.locator('#trialBanner')).toContainText('暱稱挑戰');
 return {calls};
}

const mansionSpin=page=>page.evaluate(()=>{
 const target=BOARD_SLOTS.findIndex(s=>s.type==='mansion'&&s.mansionIndex===0);
 if(target<0)throw Error('No mansion wheel sector');
 finishSpin(target);
});

test('finishing a mansion spin opens the question as an in-page modal',async({page})=>{
 const {calls}=await boot(page);
 const original=page.url();
 await expect(page.locator('#quizQuestionDialog')).toBeHidden();
 await mansionSpin(page);
 const dialog=page.locator('#quizQuestionDialog');
 await expect(dialog).toBeVisible();
 await expect(dialog).toHaveAttribute('open','');
 await expect(dialog.locator('#questionText')).toContainText('角宿');
 await expect(dialog.locator('#answerOptions .answer-btn')).toHaveCount(4);
 await expect(dialog.locator('#quizQuestionDialogSubtitle')).toContainText('角木蛟');
 expect(page.url()).toBe(original);
 await expect(page.locator('#skyWheel')).toBeVisible();
 expect(calls.filter(x=>x.path==='/functions/v1/quiz-nickname-beginner'&&x.body.action==='answer')).toHaveLength(0);
});

test('close, Escape and return to same ungraded question do not double-score',async({page})=>{
 const {calls}=await boot(page);
 await mansionSpin(page);
 const dialog=page.locator('#quizQuestionDialog');
 const question=await dialog.locator('#questionText').textContent();
 await page.locator('#quizQuestionDialogClose').click();
 await expect(dialog).toBeHidden();
 await expect(page.locator('#quizQuestionResume')).toBeVisible();
 await expect(page.locator('#quizScore')).toContainText('已答 0 題');
 await page.locator('#quizQuestionResume').click();
 await expect(dialog).toBeVisible();
 await expect(dialog.locator('#questionText')).toHaveText(question);
 await page.keyboard.press('Escape');
 await expect(dialog).toBeHidden();
 await page.locator('#quizQuestionResume').click();
 await dialog.locator('#answerOptions .answer-btn').first().click();
 await expect(dialog.locator('#answerFeedback')).toContainText('初階答錯');
 await expect(page.locator('#quizScore')).toContainText('暱稱已答 1 題');
 await expect(dialog.locator('#answerOptions .answer-btn').first()).toBeDisabled();
 await page.locator('#quizQuestionDialogClose').click();
 await page.locator('#quizQuestionResume').click();
 await expect(dialog.locator('#answerOptions .answer-btn').first()).toBeDisabled();
 expect(calls.filter(x=>x.path==='/functions/v1/quiz-nickname-beginner'&&x.body.action==='answer')).toHaveLength(1);
});

test('special wheel square does not open question modal, and clears resume',async({page})=>{
 await boot(page);
 await mansionSpin(page);
 await page.locator('#quizQuestionDialogClose').click();
 await expect(page.locator('#quizQuestionResume')).toBeVisible();
 await page.evaluate(()=>{
  const target=BOARD_SLOTS.findIndex(s=>s.type!=='mansion');
  if(target<0)throw Error('No special square');
  finishSpin(target);
 });
 await expect(page.locator('#quizQuestionDialog')).toBeHidden();
 await expect(page.locator('#quizQuestionResume')).toBeHidden();
 await expect(page.locator('.v8-empty-note')).toContainText('特殊格不計分');
});

test('mobile question dialog is usable, stays in same page and supports backdrop close',async({page})=>{
 await page.setViewportSize({width:375,height:780});
 await boot(page);
 const initialURL=page.url();
 await mansionSpin(page);
 const dialog=page.locator('#quizQuestionDialog');
 await expect(dialog).toBeVisible();
 const metrics=await page.evaluate(()=>{
  const dlg=document.getElementById('quizQuestionDialog');
  const box=dlg.getBoundingClientRect();
  return {viewport:innerWidth,left:box.left,right:box.right,
   top:box.top,bottom:box.bottom,availableHeight:innerHeight,
   buttonHeight:document.getElementById('quizQuestionDialogClose').getBoundingClientRect().height};
 });
 expect(metrics.left).toBeGreaterThanOrEqual(0);
 expect(metrics.right).toBeLessThanOrEqual(metrics.viewport+1);
 expect(metrics.top).toBeGreaterThanOrEqual(0);
 expect(metrics.bottom).toBeLessThanOrEqual(metrics.availableHeight+1);
 expect(metrics.buttonHeight).toBeGreaterThanOrEqual(44);
 await page.locator('#quizQuestionDialogClose').click();
 await expect(dialog).toBeHidden();
 await expect(page.locator('#quizQuestionResume')).toBeVisible();
 expect(page.url()).toBe(initialURL);
});
