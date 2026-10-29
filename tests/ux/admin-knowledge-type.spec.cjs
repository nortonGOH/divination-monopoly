const {test,expect}=require('@playwright/test');

const MOCK='https://mock-ux.supabase.co';
function choice(id,type,mansion='角木蛟',prompt='相同題幹的隔離測試題目'){
  return {id,knowledge_type:type,category:'二十八宿',difficulty:'初階',mansion,prompt,options:['甲','乙','丙','丁'],answer:1,explanation:'隔離測試解析'};
}
const fixture=()=>[
  choice('mock-choice-a','山'),
  choice('mock-choice-b','命'),
  choice('mock-choice-c','天文曆法','斗木獬','獨立的曆法隔離題目')
];
async function prepare(page,{open=[]}={}){
  const store=fixture(),writes=[],remote=[];
  await page.route('**/*',async route=>{
    const request=route.request(),url=new URL(request.url());
    if(url.hostname==='127.0.0.1'){
      if(url.pathname==='/config.js')return route.fulfill({status:200,contentType:'application/javascript',
        body:`window.QUIZ_AUTH_CONFIG={supabaseUrl:'${MOCK}',publishableKey:'mock-12345678901234567890',turnstileSiteKey:''};`});
      return route.continue();
    }
    remote.push(url.hostname);
    if(url.hostname!=='mock-ux.supabase.co')return route.abort();
    const h={'access-control-allow-origin':'*','access-control-allow-methods':'GET,POST,OPTIONS,DELETE',
      'access-control-allow-headers':'*'};
    const reply=(status,data)=>route.fulfill({status,contentType:'application/json',headers:h,body:status===204?'':JSON.stringify(data)});
    if(request.method()==='OPTIONS')return route.fulfill({status:204,headers:h,body:''});
    const path=url.pathname;
    if(path.endsWith('/rpc/quiz_public_question_bank'))
      return reply(200,store.map(({answer,explanation,...q})=>({...q})));
    if(path.endsWith('/rpc/quiz_admin_question_bank'))return reply(200,store);
    if(path.endsWith('/rpc/quiz_admin_open_question_bank'))return reply(200,open);
    if(path.endsWith('/quiz_open_questions')&&request.method()==='GET')
      return reply(200,open.map(({reference_answer,...q})=>q));
    if(path.endsWith('/quiz_questions')&&request.method()==='POST'){
      const data=JSON.parse(request.postData());
      writes.push(data);
      for(const changed of data){
        const idx=store.findIndex(q=>q.id===changed.id);
        if(idx>=0)store[idx]={...store[idx],...changed};else store.push(changed);
      }
      return reply(204,null);
    }
    return reply(200,[]);
  });
  await page.goto('/');
  await expect.poll(()=>page.evaluate(()=>questionSource)).toContain('Supabase');
  await page.evaluate(data=>{
    adminAccessToken='mock-only-admin-token';
    questionBank=data;
    refreshBankInterface();
    openBank();
  },store);
  await page.evaluate(()=>window.quizRefreshOpenBank());
  await expect(page.locator('#bankDialog')).toBeVisible();
  await expect(page.locator('#bankList .bank-item')).toHaveCount(store.length+open.length);
  return {store,writes,remote};
}
async function ids(page){
  return page.locator('#bankList .bank-item').evaluateAll(items=>items.map(x=>x.dataset.questionId));
}
test('single knowledge-type filter uses IDs, not duplicate prompt text',async({page})=>{
  const state=await prepare(page);
  await expect(page.locator('#editCategory')).toHaveAttribute('type','hidden');
  await expect(page.getByText('數術分類',{exact:true})).toHaveCount(0);
  await page.locator('#bankKnowledgeType').selectOption('山');
  await expect.poll(()=>ids(page)).toEqual(['mock-choice-a']);
  await expect(page.locator('#bankListCount')).toContainText('1 / 3 題');
  await page.locator('#bankKnowledgeType').selectOption('命');
  await expect.poll(()=>ids(page)).toEqual(['mock-choice-b']);
  await page.locator('#bankKnowledgeType').selectOption('all');
  await expect.poll(()=>ids(page)).toEqual(['mock-choice-a','mock-choice-b','mock-choice-c']);
  expect(state.writes).toHaveLength(0);
  expect(state.remote.every(host=>host==='mock-ux.supabase.co')).toBe(true);
});
test('statistics category and difficulty shortcuts apply exact filters',async({page})=>{
  await prepare(page);
  const button=page.locator('.bank-inventory .bank-type-link').filter({hasText:'山'}).first();
  await expect(button).toBeVisible();
  await button.click();
  await expect(page.locator('#bankKnowledgeType')).toHaveValue('山');
  await expect.poll(()=>ids(page)).toEqual(['mock-choice-a']);
  await page.getByRole('button',{name:'命／初階：1題，點擊篩選'}).click();
  await expect(page.locator('#bankKnowledgeType')).toHaveValue('命');
  await expect(page.locator('#bankDifficulty')).toHaveValue('初階');
  await expect.poll(()=>ids(page)).toEqual(['mock-choice-b']);
});
test('editing choice knowledge type persists via mock upsert and server re-read',async({page})=>{
  const state=await prepare(page);
  await page.locator('#bankList .bank-item[data-question-id="mock-choice-a"] button').filter({hasText:'修改題目'}).click();
  await expect(page.locator('#editKnowledgeType')).toHaveValue('山');
  await expect(page.locator('#editKnowledgeType')).toBeEnabled();
  await expect(page.locator('#editCategory')).toHaveValue('二十八宿');
  await page.locator('#editKnowledgeType').selectOption('命');
  page.once('dialog',dialog=>dialog.accept());
  await page.locator('#saveQuestionBtn').click();
  await expect.poll(()=>state.writes.length).toBe(1);
  expect(state.writes[0][0].id).toBe('mock-choice-a');
  expect(state.writes[0][0].knowledge_type).toBe('命');
  expect(state.writes[0][0].category).toBe('二十八宿');
  await expect.poll(()=>page.evaluate(()=>questionBank.find(q=>q.id==='mock-choice-a')?.knowledge_type)).toBe('命');
  await page.locator('#bankKnowledgeType').selectOption('命');
  await expect.poll(()=>ids(page)).toEqual(['mock-choice-a','mock-choice-b']);
  await page.locator('#bankKnowledgeType').selectOption('山');
  await expect.poll(()=>ids(page)).toEqual([]);
  expect(state.store).toHaveLength(3);
  expect(state.remote.every(host=>host==='mock-ux.supabase.co')).toBe(true);
});
test('open Q&A retains source category and cannot claim to persist unsupported type',async({page})=>{
  await prepare(page,{open:[{id:'mock-open-x',mansion:'角木蛟',difficulty:'初階',category:'干支',
    prompt:'隔離開放問答題',reference_answer:'僅測試參考答案',review_status:'待考',source_title:'Mock',source_question_no:1}]});
  await page.locator('#bankList .bank-item[data-question-id="mock-open-x"] button').filter({hasText:'修改題目'}).click();
  await expect(page.locator('#editQuestionType')).toHaveValue('open');
  await expect(page.locator('#editKnowledgeType')).toBeDisabled();
  await expect(page.locator('#editCategory')).toHaveValue('干支');
  await page.locator('#bankKnowledgeType').selectOption('待分類');
  await expect.poll(()=>ids(page)).toEqual([]);
  await page.locator('#bankKnowledgeType').selectOption('all');
  await expect.poll(()=>ids(page)).toContain('mock-open-x');
});
