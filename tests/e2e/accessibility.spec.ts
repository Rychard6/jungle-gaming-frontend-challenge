import AxeBuilder from '@axe-core/playwright'
import { expect, test } from '@playwright/test'
import { enterCheckoutAsGuest, resetApplication } from './helpers.js'

test.beforeEach(async ({ page }) => {
  await resetApplication(page)
})

for (const path of ['/', '/nfts/nft-1', '/cart', '/login', '/register']) {
  test(`acessibilidade WCAG da tela ${path}`, async ({ page }) => {
    await page.goto(path)
    await expect(page.locator('main h1').first()).toBeVisible()
    await expect(page.locator('main [aria-busy="true"]')).toHaveCount(0)
    const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze()
    expect(results.violations).toEqual([])
  })
}

test('acessibilidade WCAG de checkout, perfil e carteiras', async ({ page }) => {
  test.setTimeout(60_000)
  await enterCheckoutAsGuest(page)
  for (const path of ['/checkout', '/profile', '/wallets']) {
    await page.goto(path)
    await expect(page.locator('main form').first()).toBeVisible()
    const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze()
    expect(results.violations).toEqual([])
  }
})