const {test,expect}=require('@playwright/test');

test.beforeEach(async({page})=>{
  // This feature is static. Prevent ALL external requests, notably production Supabase.
  await page.route('**/*',route=>{
    const u=new URL(route.request().url());
    if(u.hostname==='127.0.0.1')return route.continue();
    return route.abort();
  });
  await page.goto('/mansions-atlas.html');
});

test('renders all 28 houses in four groups with sourced context',async({page})=>{
  await expect(page).toHaveTitle(/二十八宿互動圖鑑/);
  await expect(page.locator('#mansionList button')).toHaveCount(28);
  await expect(page.locator('#wheelSectors .sector')).toHaveCount(28);
  await expect(page.locator('#detailTitle')).toHaveText('角宿');
  await expect(page.locator('#detailSource')).toHaveAttribute('href','https://zh.wikisource.org/zh-hant/%E5%8F%B2%E8%A8%98/%E5%8D%B7027');
  await expect(page.locator('.history-card').first().locator('a')).toHaveAttribute('href','https://zh.wikisource.org/zh-hant/%E5%8F%B2%E8%A8%98/%E5%8D%B7027');
  await expect(page.locator('.history-card')).toHaveCount(3);
  await expect(page.getByText(/不代表實際宿度相等/)).toBeVisible();
});

test('filter, search and direct mansion selection work together',async({page})=>{
  await page.getByRole('button',{name:'南 · 朱雀'}).click();
  await expect(page.locator('#mansionList button')).toHaveCount(7);
  await page.locator('#mansionSearch').fill('東井');
  await expect(page.locator('#mansionList button')).toHaveCount(1);
  await page.locator('#mansionList button').click();
  await expect(page.locator('#detailTitle')).toHaveText('井宿');
  await expect(page.locator('#detailOfficer')).toHaveText('東井');
  await expect.poll(()=>new URL(page.url()).searchParams.get('m')).toBe('井');
  await page.locator('#mansionSearch').fill('無此星宿');
  await expect(page.locator('#searchEmpty')).toBeVisible();
  await expect(page.locator('#mansionList button')).toHaveCount(0);
  await page.locator('#mansionSearch').fill('');
  await expect(page.locator('#mansionList button')).toHaveCount(7);
});

test('SVG star sectors are keyboard operable and deep links restore selection',async({page})=>{
  const heart=page.locator('#wheelSectors .sector[data-name="心"]');
  await heart.focus();
  await page.keyboard.press('Enter');
  await expect(page.locator('#detailTitle')).toHaveText('心宿');
  await expect(heart).toHaveAttribute('aria-pressed','true');
  await page.goto('/mansions-atlas.html?m=壁');
  await expect(page.locator('#detailTitle')).toHaveText('壁宿');
  await expect(page.locator('#detailEvidence')).toContainText('未核得');
});

test('local quiz grades an answer and never posts membership results',async({page})=>{
  const requests=[];
  page.on('request',r=>{if(r.method()!=='GET')requests.push(r.url());});
  await expect(page.locator('#quizOptions button')).toHaveCount(4);
  await page.locator('#quizOptions button').filter({hasText:/左角為李、右角為將/}).click();
  await expect(page.locator('#quizFeedback')).toContainText('答對了');
  await expect(page.locator('#quizScore')).toContainText('1 / 1');
  await expect(page.locator('#quizOptions button:disabled')).toHaveCount(4);
  await page.locator('#nextQuiz').click();
  await expect(page.locator('#quizOptions button:not(:disabled)')).toHaveCount(4);
  expect(requests).toEqual([]);
});

test('mobile atlas remains usable without horizontal overflow',async({page})=>{
  await page.setViewportSize({width:375,height:812});
  await page.reload();
  await expect(page.locator('#mansionList button')).toHaveCount(28);
  await page.locator('#mansionList button').filter({hasText:/^軫$/}).click();
  await expect(page.locator('#detailTitle')).toHaveText('軫宿');
  const size=await page.evaluate(()=>({
    scroll:document.documentElement.scrollWidth,client:document.documentElement.clientWidth
  }));
  expect(size.scroll).toBeLessThanOrEqual(size.client+2);
});
