const {test,expect}=require('@playwright/test');

test('home footer links to the privacy and traffic notice',async({page})=>{
 await page.goto('/');
 const link=page.getByRole('link',{name:'閱讀個資與流量告知'});
 await expect(link).toBeVisible();
 await expect(link).toHaveAttribute('href','./privacy.html');
 await link.click();
 await expect(page).toHaveURL(/\/privacy\.html$/);
 await expect(page.getByRole('heading',{name:'個資與流量告知'})).toBeVisible();
 await expect(page.locator('main')).toContainText('不會因來源 IP 而封鎖');
 await expect(page.locator('main')).toContainText('30 天');
});

test('atlas footer also links to the privacy and traffic notice',async({page})=>{
 await page.goto('/mansions-atlas.html');
 const link=page.getByRole('link',{name:'閱讀個資與流量告知'});
 await expect(link).toBeVisible();
 await expect(link).toHaveAttribute('href','./privacy.html');
 await link.click();
 await expect(page).toHaveURL(/\/privacy\.html$/);
 await expect(page.getByRole('heading',{name:'個資與流量告知'})).toBeVisible();
});
