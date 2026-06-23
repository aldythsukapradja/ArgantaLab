const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 460, height: 812 } });
  
  try {
    console.log('Opening app...');
    await page.goto('http://localhost:5180/', { waitUntil: 'networkidle', timeout: 30000 }).catch(() => {});
    await page.waitForTimeout(3000);
    
    console.log('Capturing Today page...');
    await page.screenshot({ path: '/tmp/today-page.png' });
    
    // Try to find and click Me tab
    const navButtons = await page.$$('.nav-btn');
    console.log(`Found ${navButtons.length} nav buttons`);
    if (navButtons.length > 0) {
      await navButtons[navButtons.length - 1].click();
      await page.waitForTimeout(1500);
    }
    
    console.log('Capturing Me page...');
    await page.screenshot({ path: '/tmp/me-page.png' });
    
    console.log('Screenshots saved!');
  } catch (e) {
    console.error('Error:', e.message);
  } finally {
    await browser.close();
  }
})();
