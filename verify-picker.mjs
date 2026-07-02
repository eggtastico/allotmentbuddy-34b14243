import { chromium } from 'playwright'

const VERIFY = process.env.VERIFY_URL
if (!VERIFY) { console.error('no VERIFY_URL'); process.exit(2) }

const browser = await chromium.launch()
const ctx = await browser.newContext({ viewport: { width: 430, height: 920 }, deviceScaleFactor: 2 })
await ctx.addInitScript(() => { try { localStorage.setItem('ab-v2-setup-done', '1') } catch {} })
const page = await ctx.newPage()
const errors = []
page.on('console', m => { if (m.type() === 'error') errors.push(m.text()) })
page.on('pageerror', e => errors.push(String(e)))

// Visiting the verify link establishes a session and redirects to /allotment/.
await page.goto(VERIFY, { waitUntil: 'domcontentloaded' }).catch(e => console.log('goto err:', String(e).slice(0, 120)))
await page.waitForTimeout(4000)
console.log('landed URL:', page.url())
console.log('body head:', (await page.evaluate(() => document.body.innerText).catch(() => '')).slice(0, 200).replace(/\n/g, ' | '))
await page.screenshot({ path: '/tmp/picker-landing.png' }).catch(() => {})
const ok = await page.waitForSelector('.stage', { timeout: 15000 }).then(() => true).catch(() => false)
console.log('reached .stage:', ok)
if (!ok) { console.log('console errors:', errors.slice(0, 8)); await browser.close(); process.exit(0) }
await page.waitForTimeout(3000) // let cloud plans load

// Go to the You tab where the plan picker lives. READ ONLY — do not tap any plan.
await page.locator('nav.nav button', { hasText: 'You' }).click()
await page.waitForTimeout(1500)
await page.screenshot({ path: '/tmp/picker.png', fullPage: true })

const info = await page.evaluate(() => {
  const rows = [...document.querySelectorAll('.accountrow')]
    .map(r => r.querySelector('b')?.textContent || '')
    .filter(Boolean)
  const signedIn = document.body.innerText.includes('@')
  return { rows, signedIn, hasYourPlots: document.body.innerText.includes('Your plots') }
})
console.log(JSON.stringify(info, null, 2))
console.log('console errors:', errors.length, errors.slice(0, 6))
await browser.close()
