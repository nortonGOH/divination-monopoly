const { test, expect } = require('@playwright/test');

const today={
 date:'2026-10-30',
 assigned:3,done:1,mastered:10,recovered:2,days:3,streak:2,
 daily:[
  {slot:1,id:'q1',correct:true},
  {slot:2,id:'q2',correct:false},
  {slot:3,id:'q3',correct:false}
 ],
 wrong:[{id:'q4',attempts:2}]
};
const sampleQuestions=['q1','q2','q3','q4'].map((id,i)=>({
 id,mansion:'角木蛟',difficulty:'初階',category:'天文',knowledge_type:'天文曆法',
 prompt:'測試題 '+id,options:['甲','乙','丙','丁']
}));
async function setup(page,{authenticated=true,record=today}={}){
 await page.route('https://example.supabase.co/**', async route=>{
  if(!authenticated)throw new Error('Anonymous browser must not call private dashboard');
  const auth=route.request().headers().authorization;
  expect(auth).toBe('Bearer demo-member-token');
  await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(record)});
 });
 await page.setContent(`<!doctype html><html lang="zh-Hant"><head></head><body>
 <button id="playerSignInBtn">登入</button><div class="information">
 <section class="quiz-section"><div class="quiz-heading"><h3 id="quizTitle">數術問答</h3></div>
 <p class="v8-empty-note">請抽宿</p>
 <div class="quiz-panel" hidden>
 <span id="quizScope"></span><span id="quizAvailable"></span><span id="quizCategory"></span>
 <p id="questionText"></p><div id="answerOptions"></div><p id="answerFeedback"></p>
 </div></section></div></body></html>`);
 await page.evaluate(({authenticated,questions})=>{
  window.QUIZ_AUTH_CONFIG={supabaseUrl:'https://example.supabase.co',publishableKey:'test-publishable-key'};
  window._token=authenticated?'demo-member-token':null;
  window.quizMemberToken=()=>window._token;
  window.quizPlayerMayChallenge=()=>true;
  window.questionBank=questions;
  window.spinning=false;
  window._opened=null;
  window.showQuestion=(q)=>{window._opened=q.id;
   document.getElementById('questionText').textContent=q.prompt;};
  window._loginClicks=0;
  document.getElementById('playerSignInBtn').addEventListener('click',()=>window._loginClicks++);
 },{authenticated,questions:sampleQuestions});
 await page.addScriptTag({path:'../../challenge-learning.js'});
}

test.describe('Learning hub',()=>{
 test('anonymous sessions cannot access protected progress',async({page})=>{
  await setup(page,{authenticated:false});
  await expect(page.locator('.learning-hub')).toContainText('請登入會員');
  await page.getByRole('button',{name:/每日挑戰/}).click();
  expect(await page.evaluate(()=>window._loginClicks)).toBe(1);
  await expect(page.locator('.learning-list button')).toHaveCount(0);
 });
 test('daily questions are stable and cannot be reopened once completed',async({page})=>{
  await setup(page);
  await page.getByRole('button',{name:'更新進度'}).click();
  await expect(page.locator('.learning-list button')).toHaveCount(3);
  await expect(page.locator('.learning-list button').first()).toBeDisabled();
  await page.locator('.learning-list button').nth(1).click();
  expect(await page.evaluate(()=>window._opened)).toBe('q2');
  await expect(page.locator('.quiz-panel')).toBeVisible();
  await expect(page.locator('#quizScope')).toContainText('今日挑戰');
 });
 test('wrong answers use the same question interface and respect lock',async({page})=>{
  await setup(page);
  await page.getByRole('button',{name:'更新進度'}).click();
  await page.getByRole('button',{name:/錯題複習/}).click();
  await expect(page.locator('.learning-list button')).toHaveCount(1);
  await page.evaluate(()=>window.quizPlayerMayChallenge=()=>false);
  await page.locator('.learning-list button').click();
  expect(await page.evaluate(()=>window._opened)).toBe(null);
  await expect(page.locator('.learning-status')).toContainText('已鎖定');
  await page.evaluate(()=>window.quizPlayerMayChallenge=()=>true);
  await page.locator('.learning-list button').click();
  expect(await page.evaluate(()=>window._opened)).toBe('q4');
 });
 test('knowledge card does not leak a wrong answer prior to a valid rescue',async({page})=>{
  await setup(page);
  await page.getByRole('button',{name:'更新進度'}).click();
  await page.getByRole('button',{name:/知識解析卡/}).click();
  await page.evaluate(()=>window.dispatchEvent(new CustomEvent('quiz-learning-answer-resolved',
   {detail:{accepted:true,questionId:'q2',correct:false,correctAnswer:null,explanation:''}})));
  await expect(page.locator('.learning-knowledge')).toContainText('尚未解鎖');
  await expect(page.locator('.learning-knowledge')).not.toContainText('正確答案：B');
  await page.evaluate(()=>window.dispatchEvent(new CustomEvent('quiz-learning-answer-revealed',
   {detail:{questionId:'q2',correctAnswer:1,explanation:'供測試的原始題庫解析。'}})));
  await expect(page.locator('.learning-knowledge')).toContainText('正確答案：B');
  await expect(page.locator('.learning-knowledge')).toContainText('供測試的原始題庫解析');
 });
 test('badges are derived only from server-recorded counts',async({page})=>{
  await setup(page);
  await page.getByRole('button',{name:'更新進度'}).click();
  await page.getByRole('button',{name:/成就徽章/}).click();
  await expect(page.locator('.learning-badge')).toHaveCount(6);
  await expect(page.locator('.learning-badge.earned')).toHaveCount(4);
  await expect(page.locator('.learning-status')).toContainText('4／6');
 });
 test('a verified correct answer displays only server-supplied explanation',async({page})=>{
  await setup(page);
  await page.getByRole('button',{name:'更新進度'}).click();
  await page.evaluate(()=>window.dispatchEvent(new CustomEvent('quiz-learning-answer-resolved',
   {detail:{accepted:true,questionId:'q3',correct:true,correctAnswer:2,
            explanation:'正確答案來自伺服器，非公開題庫占位值。'}})));
  await expect(page.locator('.learning-knowledge')).toContainText('正確答案：C');
  await expect(page.locator('.learning-knowledge')).toContainText('正確答案來自伺服器');
 });
});
