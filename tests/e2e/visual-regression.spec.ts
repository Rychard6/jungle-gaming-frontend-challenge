import { expect, test } from '@playwright/test'
import {
  addEmeraldApeToCart,
  enterCheckoutAsGuest,
  resetApplication,
} from './helpers.js'

test.beforeEach(async ({ page }) => {
  await resetApplication(page)
})

test('snapshot visual da página inicial', async ({ page }) => {
  await expect(page.getByRole('heading', { name: 'Explore o mercado' })).toBeVisible()
  await expect(page).toHaveScreenshot('kurio-home.png', {
    fullPage: true,
    animations: 'disabled',
    caret: 'hide',
    maxDiffPixelRatio: 0.025,
  })
})

test('snapshot visual do detalhe de NFT', async ({ page }) => {
  await page.goto('/nfts/nft-1')
  await expect(page.getByRole('heading', { name: 'Emerald Ape #042' })).toBeVisible()
  await expect(page).toHaveScreenshot('kurio-nft-detail.png', {
    fullPage: true,
    animations: 'disabled',
    caret: 'hide',
    maxDiffPixelRatio: 0.025,
  })
})

test('snapshot visual do carrinho', async ({ page }) => {
  await addEmeraldApeToCart(page)
  await page.goto('/cart')
  await expect(page.getByRole('heading', { name: 'Carrinho de NFTs' })).toBeVisible()
  await expect(page).toHaveScreenshot('kurio-cart.png', {
    fullPage: true,
    animations: 'disabled',
    caret: 'hide',
    maxDiffPixelRatio: 0.025,
  })
})

test('snapshot visual do pagamento', async ({ page }) => {
  await enterCheckoutAsGuest(page)
  await expect(page.getByRole('heading', { name: 'Finalizar compra' })).toBeVisible()
  await expect(page).toHaveScreenshot('kurio-checkout.png', {
    fullPage: true,
    animations: 'disabled',
    caret: 'hide',
    maxDiffPixelRatio: 0.025,
  })
})
