import { chromium } from 'playwright'
import { dirname, join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
const here = dirname(fileURLToPath(import.meta.url))
const browser = await chromium.launch({ args: ['--hide-scrollbars', '--force-device-scale-factor=1'] })
const page = await browser.newPage({ viewport: { width: 1280, height: 640 } })
await page.goto(pathToFileURL(join(here, 'social.html')).href, { waitUntil: 'networkidle' })
await page.evaluate(() => window.ready)
await page.screenshot({ path: join(here, '..', 'docs', 'social.png') })
await browser.close()
console.log('social.png written')
