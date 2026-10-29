const { test, expect } = require('@playwright/test');

const initial = [
  { id:'mock-1', mansion:'角', category:'干支', knowledge_type:'命', difficulty:'中階', prompt:'隔離測試：第一題', options:['甲','乙','丙','丁'], answer:0, explanation:'測試資料' },
  { id:'mock-2', mansion:'角', category:'八卦', knowledge_type:'易學', difficulty:'中階', prompt:'隔離測試：第二題', options:['一','二','三','四'], answer:1, explanation:'測試資料' }
];

test.beforeEach(async ({ page }) => {
  const rows = structuredClone(initial);
  page.on('pageerror', err => console.error('Browser error:', err.message));
  await page.route(/^https:\/\/[^/]+\.supabase\.co\//, async route => {
    const req = route.request(), url = new URL(req.url());
    let body = [], status = 200;
    if (url.pathname.endsWith('/rpc/quiz_public_question_bank') || url.pathname.endsWith('/rpc/quiz_admin_question_bank')) body = rows;
    else if (url.pathname === '/rest/v1/quiz_questions' && req.method() === 'POST') {
      const incoming = JSON.parse(req.postData() || '[]');
      for (const q of incoming) {
        const idx=rows.findIndex(x=>x.id===q.id);
        if(idx>=0)rows[idx]=q; else rows.push(q);
      }
      status=204; body=null;
    } else if (url.pathname.startsWith('/rest/v1/quiz_questions') && req.method() === 'DELETE') {
      throw Error('Destructive request prohibited in taxonomy tests');
    }
    await route.fulfill({status, contentType:'application/json', body:body===null?'':JSON.stringify(body)});
  });
  await page.goto('/');
  await page.evaluate(() => { adminAccessToken='mock-admin-token'; adminEmail='mock@example.test'; openBank(); });
  await expect(page.locator('#bankDialog')).toBeVisible();
});

test('新增題目：僅顯示數術類型並以其保存', async ({ page }) => {
  await expect(page.getByText('數術分類',{exact:true})).toHaveCount(0);
  await page.locator('#newQuestionBtn').click();
  await page.locator('#editMansion').selectOption('角');
  await page.locator('#editKnowledgeType').selectOption('命');
  await page.locator('#editPrompt').fill('隔離測試：新增題目');
  for(let i=0;i<4;i++)await page.locator('#editOption'+i).fill('選項'+i);
  await page.locator('#editAnswer').selectOption('0');
  await page.locator('#saveQuestionBtn').click();
  await expect(page.locator('#bankToast')).toContainText('題目已儲存');
  await page.locator('#bankSearch').fill('隔離測試：新增題目');
  await expect(page.locator('#bankList .bank-item')).toHaveCount(1);
  await expect(page.locator('#bankList .bank-item-top')).toContainText('命');
});

test('修改數術類型：保留既有 category 與題目 ID', async ({ page }) => {
  await page.locator('#bankSearch').fill('隔離測試：第一題');
  await page.locator('#bankList .bank-item-actions button').first().click();
  await expect(page.locator('#editKnowledgeType')).toHaveValue('命');
  await page.locator('#editKnowledgeType').selectOption('易學');
  page.once('dialog', dialog=>dialog.accept());
  await page.locator('#saveQuestionBtn').click();
  await expect(page.locator('#bankToast')).toContainText('題目已儲存');
  await expect(page.locator('#bankList .bank-item-top')).toContainText('易學');
  const data=await page.evaluate(()=>questionBank.find(q=>q.id==='mock-1'));
  expect(data).toMatchObject({id:'mock-1',category:'干支',knowledge_type:'易學'});
});

test('分類篩選：依數術類型顯示題目', async ({ page }) => {
  await page.locator('#bankKnowledgeType').selectOption('命');
  await expect(page.locator('#bankList .bank-item:visible')).toHaveCount(1);
  await expect(page.locator('#bankList .bank-item:visible')).toContainText('第一題');
  await page.locator('#bankKnowledgeType').selectOption('易學');
  await expect(page.locator('#bankList .bank-item:visible')).toHaveCount(1);
  await expect(page.locator('#bankList .bank-item:visible')).toContainText('第二題');
});
