const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const OUTPUT_DIR = path.resolve(__dirname, '../recordings');
if (!fs.existsSync(OUTPUT_DIR)) {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}

// Helper to wait
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function setupPage(page) {
  await page.goto('http://localhost:5173');
  await page.evaluate(async () => {
    const { db } = await import('/src/core/db/database.ts');
    const { hashCredential } = await import('/src/utils/cryptoUtils.ts');
    const contractorId = 'contractor-test-owner';
    await db.seedDemoData(contractorId);
    const hashed = await hashCredential('1234');
    const acc = {
      id: contractorId,
      name: 'Rajesh Contractor',
      phone: '9876543210',
      companyName: 'Rajesh Infra Build',
      trade: 'construction',
      role: 'owner',
      password: hashed,
      pinLock: hashed,
      isPinLockEnabled: false,
      isAntiDeleteEnabled: false,
      language: 'en',
      themeMode: 'light',
      createdAt: new Date().toISOString(),
    };
    await db.account.put(acc);
    localStorage.setItem('sitesaathi_active_user_id', contractorId);
  });
  await page.goto('http://localhost:5173');
  await sleep(1500);
}

async function recordClip(name, actions) {
  console.log(`\n▶ Starting recording: ${name}...`);
  const tempDir = path.join(OUTPUT_DIR, `temp_${Date.now()}`);
  fs.mkdirSync(tempDir, { recursive: true });

  const browser = await chromium.launch({ channel: 'msedge', headless: true });
  const context = await browser.newContext({
    viewport: { width: 440, height: 920 },
    recordVideo: { dir: tempDir, size: { width: 440, height: 920 } },
  });

  const page = await context.newPage();
  await setupPage(page);

  try {
    await actions(page);
  } catch (err) {
    console.error(`Error during ${name}:`, err.message);
  }

  await sleep(1000);
  await page.close();
  await context.close();
  await browser.close();

  // Rename recorded file to clean name
  const recordedFiles = fs.readdirSync(tempDir).filter((f) => f.endsWith('.webm'));
  if (recordedFiles.length > 0) {
    const finalPath = path.join(OUTPUT_DIR, `${name}.webm`);
    if (fs.existsSync(finalPath)) {
      fs.unlinkSync(finalPath);
    }
    fs.renameSync(path.join(tempDir, recordedFiles[0]), finalPath);
    console.log(`✓ Saved: ${name}.webm (${Math.round(fs.statSync(finalPath).size / 1024)} KB)`);
  }
  try {
    fs.rmdirSync(tempDir, { recursive: true });
  } catch {}
}

async function run() {
  console.log('==================================================');
  console.log('🎥 Starting Screen Recording of All Features');
  console.log('==================================================');

  // Clip 1: Owner Dashboard & KPIs
  await recordClip('01_owner_dashboard', async (page) => {
    await sleep(1500);
    // Scroll down to view operational alerts
    await page.evaluate(() => window.scrollBy({ top: 350, behavior: 'smooth' }));
    await sleep(2000);
    await page.evaluate(() => window.scrollBy({ top: 400, behavior: 'smooth' }));
    await sleep(2000);
    await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'smooth' }));
    await sleep(2000);
  });

  // Clip 2: Multi-Site Management & Budget
  await recordClip('02_multi_site_management', async (page) => {
    await sleep(1000);
    // Click Sites tab
    const sitesTab = await page.$('button:has-text("Sites"), [title="Sites"]');
    if (sitesTab) await sitesTab.click();
    await sleep(2000);
    // Scroll through sites
    await page.evaluate(() => window.scrollBy({ top: 300, behavior: 'smooth' }));
    await sleep(1500);
    // Click on the first site card to inspect details
    const siteCard = await page.$('.cursor-pointer, button:has-text("Details"), h3');
    if (siteCard) await siteCard.click();
    await sleep(3000);
  });

  // Clip 3: Supervisor DPR Flow (3-Tap Status, Geotag, Voice Note)
  await recordClip('03_supervisor_dpr_flow', async (page) => {
    await sleep(1000);
    // Open Quick Add (+) or header to trigger Supervisor DPR
    await page.evaluate(() => {
      const btn = document.querySelector('header button[title*="DPR"], header button[title*="Daily"]');
      if (btn) btn.click();
    });
    // Or click DPR button
    const dprBtn = await page.$('button[title*="DPR"], button:has-text("DPR"), button:has-text("Log Today")');
    if (dprBtn) await dprBtn.click();
    await sleep(2500);
    // Interact with Full Day / Half Day / Work Stopped buttons
    const halfDay = await page.$('button:has-text("Half Day"), button:has-text("आधा दिन")');
    if (halfDay) {
      await halfDay.click();
      await sleep(1500);
    }
    const fullDay = await page.$('button:has-text("Full Day"), button:has-text("पूरे दिन")');
    if (fullDay) {
      await fullDay.click();
      await sleep(2000);
    }
  });

  // Clip 4: Owner DPR Review Feed & Anti-Fake Badges
  await recordClip('04_owner_dpr_review_feed', async (page) => {
    await sleep(1000);
    // Click Daily Reports Feed icon in header
    const feedBtn = await page.$('header button[title*="Daily Reports"], header button[title*="दैनिक रिपोर्ट"]');
    if (feedBtn) await feedBtn.click();
    await sleep(3000);
    // Scroll through feed
    await page.evaluate(() => {
      const modal = document.querySelector('.overflow-y-auto');
      if (modal) modal.scrollBy({ top: 300, behavior: 'smooth' });
    });
    await sleep(2500);
  });

  // Clip 5: Labour Attendance & Muster Rolls
  await recordClip('05_labour_muster_attendance', async (page) => {
    await sleep(1000);
    // Click Labour tab
    const labourTab = await page.$('button:has-text("Labour"), [title="Labour"]');
    if (labourTab) await labourTab.click();
    await sleep(2500);
    // Scroll labour muster
    await page.evaluate(() => window.scrollBy({ top: 350, behavior: 'smooth' }));
    await sleep(2500);
  });

  // Clip 6: Material Purchase Requests & GRN
  await recordClip('06_material_requests_grn', async (page) => {
    await sleep(1000);
    // Click Material Requests icon in header
    const matBtn = await page.$('header button[title*="Material"], header button[title*="सामान"]');
    if (matBtn) await matBtn.click();
    await sleep(3000);
    // Scroll tracker
    await page.evaluate(() => {
      const modal = document.querySelector('.overflow-y-auto');
      if (modal) modal.scrollBy({ top: 300, behavior: 'smooth' });
    });
    await sleep(2500);
  });

  // Clip 7: Site Punch List Tasks & Photo Proof
  await recordClip('07_site_tasks_punchlist', async (page) => {
    await sleep(1000);
    // Click Punch List Tasks icon in header
    const taskBtn = await page.$('header button[title*="Punch List"], header button[title*="टास्क"]');
    if (taskBtn) await taskBtn.click();
    await sleep(3000);
    // Scroll tasks
    await page.evaluate(() => {
      const modal = document.querySelector('.overflow-y-auto');
      if (modal) modal.scrollBy({ top: 300, behavior: 'smooth' });
    });
    await sleep(2500);
  });

  // Clip 8: Automated Site Escalations
  await recordClip('08_automated_escalations', async (page) => {
    await sleep(1000);
    // Click Bell icon in header for alerts & reminders
    const bellBtn = await page.$('header button[title*="Alerts"], header button:has(svg.lucide-bell), button:has-text("Manage Tools"), button:has-text("Alert")');
    if (bellBtn) await bellBtn.click();
    await sleep(3000);
  });

  // Clip 9: AI Voice Automation & Confirmation Safeguard
  await recordClip('09_ai_voice_action_extraction', async (page) => {
    await sleep(1000);
    // Click Voice Log button in hero banner
    const voiceBtn = await page.$('button:has-text("Voice Log"), button:has-text("Voice")');
    if (voiceBtn) await voiceBtn.click();
    await sleep(3500);
  });

  // Clip 10: WhatsApp Daily Digest (8:30 PM IST)
  await recordClip('10_daily_whatsapp_digest', async (page) => {
    await sleep(1000);
    // Open DPR feed first
    const feedBtn = await page.$('header button[title*="Daily Reports"], header button[title*="दैनिक रिपोर्ट"]');
    if (feedBtn) await feedBtn.click();
    await sleep(1500);
    // Click WhatsApp Digest button inside feed
    const waBtn = await page.$('button:has-text("WhatsApp"), button:has-text("Digest")');
    if (waBtn) await waBtn.click();
    await sleep(3500);
  });

  console.log('\n==================================================');
  console.log('🎉 All screen recordings completed successfully!');
  console.log(`Clips saved in: ${OUTPUT_DIR}`);
  console.log('==================================================');
}

run().catch((err) => {
  console.error('Fatal execution error:', err);
  process.exit(1);
});
