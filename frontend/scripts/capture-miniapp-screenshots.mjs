/**
 * Capture real Mini App screenshots from a running frontend (Playwright).
 *
 * Why:
 * - Farcaster + OG previews use PNGs served from `public/`.
 * - "Screenshot" should reflect the actual product UI (not a stylized mock).
 *
 * Usage:
 *   pnpm -C frontend add -D playwright
 *   pnpm -C frontend exec playwright install chromium
 *
 *   # With the dev server running (default http://localhost:5173):
 *   pnpm -C frontend run capture:miniapp-screens
 *
 * Env:
 *   MINIAPP_SCREENSHOT_BASE_URL=http://localhost:5173
 *   MINIAPP_HERO_PATH=/dashboard
 *   MINIAPP_PORTRAIT_PATH=/dashboard
 */
import path from 'path'
import { fileURLToPath } from 'url'

let chromium
try {
  // eslint-disable-next-line import/no-unresolved
  ;({ chromium } = await import('playwright'))
} catch (err) {
  // eslint-disable-next-line no-console
  console.error(
    '\nMissing dependency: playwright.\n' +
      'Install it and the Chromium browser:\n' +
      '  pnpm -C frontend add -D playwright\n' +
      '  pnpm -C frontend exec playwright install chromium\n',
  )
  process.exit(1)
}

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const OUT_DIR = path.resolve(__dirname, '../public')

const baseUrl = (process.env.MINIAPP_SCREENSHOT_BASE_URL || 'http://localhost:5173').replace(/\/$/, '')
const heroPath = process.env.MINIAPP_HERO_PATH || '/dashboard'
const portraitPath = process.env.MINIAPP_PORTRAIT_PATH || '/dashboard'

function urlFor(p) {
  if (p.startsWith('http://') || p.startsWith('https://')) return p
  return `${baseUrl}${p.startsWith('/') ? '' : '/'}${p}`
}

async function stabilizePage(page) {
  // Disable animations/transitions for deterministic screenshots.
  await page.addStyleTag({
    content: `
      *, *::before, *::after {
        animation-duration: 0s !important;
        animation-delay: 0s !important;
        transition-duration: 0s !important;
        transition-delay: 0s !important;
        caret-color: transparent !important;
      }
    `,
  })
  await page.evaluate(() => {
    window.scrollTo(0, 0)
  })
  // Allow layout to settle after data fetches / hydration.
  await page.waitForTimeout(800)
}

async function gotoApp(page, url) {
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 45_000 })
  // Ensure app shell exists.
  await page.waitForSelector('main', { timeout: 45_000 })
  await stabilizePage(page)
}

async function captureHero() {
  const browser = await chromium.launch()
  const context = await browser.newContext({
    viewport: { width: 1200, height: 630 },
    deviceScaleFactor: 1,
    reducedMotion: 'reduce',
  })
  const page = await context.newPage()

  await gotoApp(page, urlFor(heroPath))

  await page.screenshot({
    path: path.join(OUT_DIR, 'miniapp-hero.png'),
    type: 'png',
  })

  await browser.close()
}

async function capturePortrait() {
  const browser = await chromium.launch()
  const context = await browser.newContext({
    viewport: { width: 540, height: 960 },
    deviceScaleFactor: 2, // => 1080x1920 output
    isMobile: true,
    hasTouch: true,
    reducedMotion: 'reduce',
  })
  const page = await context.newPage()

  await gotoApp(page, urlFor(portraitPath))

  await page.screenshot({
    path: path.join(OUT_DIR, 'screenshot-portrait.png'),
    type: 'png',
  })

  await browser.close()
}

async function main() {
  // eslint-disable-next-line no-console
  console.log('Capturing Mini App screenshots from', baseUrl)
  // eslint-disable-next-line no-console
  console.log(' - hero:', heroPath)
  // eslint-disable-next-line no-console
  console.log(' - portrait:', portraitPath)

  await captureHero()
  // eslint-disable-next-line no-console
  console.log('wrote miniapp-hero.png')

  await capturePortrait()
  // eslint-disable-next-line no-console
  console.log('wrote screenshot-portrait.png')
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error(err)
  process.exit(1)
})

