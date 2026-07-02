import { chromium } from 'playwright'
import { readFileSync } from 'fs'

const plan = JSON.parse(readFileSync('/tmp/realplan.json', 'utf8'))
const browser = await chromium.launch()
const ctx = await browser.newContext({ viewport: { width: 430, height: 920 }, deviceScaleFactor: 2 })
await ctx.addInitScript(() => { try { localStorage.setItem('ab-v2-setup-done', '1') } catch {} })
const page = await ctx.newPage()
const errors = []
page.on('console', m => { if (m.type() === 'error') errors.push(m.text()) })
page.on('pageerror', e => errors.push(String(e)))

await page.goto('https://appsabaloo.com/allotment/', { waitUntil: 'networkidle' })
await page.waitForSelector('.stage', { timeout: 15000 })

// Inject the real plan into IndexedDB with a future timestamp so it loads as "latest".
await page.evaluate(p => new Promise((resolve, reject) => {
  const req = indexedDB.open('AllotmentBuddyDB')
  req.onsuccess = () => {
    const db = req.result
    const tx = db.transaction('gardens', 'readwrite')
    tx.objectStore('gardens').put(p)
    tx.oncomplete = () => resolve('ok')
    tx.onerror = () => reject(tx.error)
  }
  req.onerror = () => reject(req.error)
}), plan)

await page.reload({ waitUntil: 'networkidle' })
await page.waitForSelector('.stage', { timeout: 15000 })
await page.waitForTimeout(2500)
await page.screenshot({ path: '/tmp/real-plot.png' })

// Confirm the real plan loaded + the nesting migration result.
const stats = await page.evaluate(async name => {
  const req = indexedDB.open('AllotmentBuddyDB')
  const db = await new Promise((res, rej) => { req.onsuccess = () => res(req.result); req.onerror = () => rej(req.error) })
  const all = await new Promise((res, rej) => { const r = db.transaction('gardens').objectStore('gardens').getAll(); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error) })
  const g = all.find(x => x.name === name) || all.sort((a, b) => (b.updated_at || '').localeCompare(a.updated_at || ''))[0]
  return {
    name: g.name, beds: g.beds.length, plants: g.plants.length,
    nestedBeds: g.beds.filter(b => b.parentId).length,
    nestedPlants: g.plants.filter(p => p.parentId).length,
    onScreenBeds: document.querySelectorAll('.scene .bed, .scene .structure').length,
  }
}, plan.name)
console.log(JSON.stringify(stats, null, 2))
console.log('console errors:', errors.length, errors.slice(0, 6))
await browser.close()
