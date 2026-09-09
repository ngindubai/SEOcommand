import { chromium } from "playwright";

// Fail the image build before a browser/dependency mismatch reaches queued jobs.
const browser = await chromium.launch({ headless: true, args: ["--no-sandbox", "--disable-dev-shm-usage"] });
try {
  const page = await browser.newPage();
  await page.setContent("<h1>Browser runtime ready</h1>");
  if (await page.locator("h1").innerText() !== "Browser runtime ready") throw new Error("Browser runtime check failed.");
  console.log(`[orwell-operations] Browser runtime verified: ${browser.version()}`);
} finally { await browser.close(); }
