import { expect, test } from '@playwright/test'
import {
  DEMO_USERS,
  addEmeraldApeToCart,
  enterCheckoutAsGuest,
  openDemoToolbar,
  resetApplication,
  selectScenario,
} from './helpers.js'

test.beforeEach(async ({ page }) => {
  await resetApplication(page)
})

test('favoritos otimizam a interação e revertem a alteração quando a API falha', async ({
  page,
}) => {
  await page.getByRole('button', { name: 'Favoritar Emerald Ape #042' }).click()
  const favorite = page.getByRole('button', {
    name: 'Remover Emerald Ape #042 dos favoritos',
  })
  await expect(favorite).toHaveAttribute('aria-pressed', 'true')

  await page.evaluate(() =>
    localStorage.setItem('kurio_mock_scenario', 'network-error'),
  )
  await favorite.click()
  await expect(page.getByRole('alert')).toContainText(
    'A alteração foi revertida.',
  )
  await expect(
    page.getByRole('button', { name: 'Remover Emerald Ape #042 dos favoritos' }),
  ).toHaveAttribute('aria-pressed', 'true')
})

test('carrinho atualiza quantidade, aplica cupom e remove itens', async ({ page }) => {
  await addEmeraldApeToCart(page)
  await page.getByRole('link', { name: /Carrinho/ }).click()
  await expect(page.getByRole('heading', { name: 'Carrinho de NFTs' })).toBeVisible()
  await page.getByRole('button', { name: 'Aumentar quantidade de Emerald Ape #042' }).click()
  await expect(
    page.locator('[aria-label="Quantidade de Emerald Ape #042"] output'),
  ).toHaveText('2')

  await page.getByLabel('Código promocional').fill('KURIO10')
  await page.getByRole('button', { name: 'Aplicar', exact: true }).click()
  await expect(page.getByText('KURIO10', { exact: true })).toBeVisible()
  await expect(page.getByText(/Desconto do lançamento \(KURIO10/)).toBeVisible()

  await page.getByRole('button', { name: 'Remover Emerald Ape #042 do carrinho' }).first().click()
  await expect(page.getByText('Seu carrinho está vazio')).toBeVisible()
})

test('cupom expirado apresenta erro sem perder o carrinho', async ({ page }) => {
  await addEmeraldApeToCart(page)
  await page.getByRole('link', { name: /Carrinho/ }).click()
  await page.getByLabel('Código promocional').fill('EXPIRADO20')
  await page.getByRole('button', { name: 'Aplicar', exact: true }).click()
  await expect(page.getByRole('alert')).toContainText('expirou')
  await expect(page.getByRole('link', { name: 'Emerald Ape #042', exact: true })).toBeVisible()
})

test('mergeia carrinho visitante ao autenticar e finalizar compra', async ({ page }) => {
  await enterCheckoutAsGuest(page)
  await expect(page.getByText('Emerald Ape #042')).toBeVisible()
  await expect(page.getByLabel('E-mail')).toHaveValue(DEMO_USERS.nova.email)
})

test('mudança de estoque via nft.updated bloqueia a finalização do carrinho', async ({
  page,
}) => {
  await addEmeraldApeToCart(page)
  await page.goto('/cart')
  await openDemoToolbar(page)
  await page.getByRole('button', {
    name: 'Simular mudança de preço e estoque no carrinho',
  }).click()
  await expect(
    page.getByRole('heading', { name: 'Alguns itens mudaram em tempo real' }),
  ).toBeVisible()
  await expect(page.getByRole('button', { name: 'Conectar e finalizar' })).toBeDisabled()
  await page.getByRole('button', { name: 'Confirmar novos valores' }).click()
  await expect(page.getByText('Seu carrinho está vazio')).toBeVisible()
})

test('compra completa mostra recibo com snapshot imutável', async ({ page }) => {
  await enterCheckoutAsGuest(page)
  await page.getByRole('button', { name: 'Confirmar compra' }).click()
  await expect(page).toHaveURL(/\/orders\/order-/)
  await expect(page.getByText('THANK YOU')).toBeVisible()
  await expect(
    page.getByRole('heading', { name: 'Seus NFTs agora estão na sua carteira' }),
  ).toBeVisible()
  const totalBefore = await page.locator('dd').filter({ hasText: 'ETH' }).last().textContent()

  await page.evaluate(async () => {
    const response = await fetch('/api/__mock__/simulate-nft-update', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        nftId: 'emerald-ape-042',
        priceEth: '9.99',
        availableEditions: 40,
      }),
    })
    if (!response.ok) throw new Error('Could not update mock NFT')
  })
  await page.reload()
  await expect(page.getByText('THANK YOU')).toBeVisible()
  await expect(page.locator('dd').filter({ hasText: 'ETH' }).last()).toHaveText(
    totalBefore ?? '',
  )
})

test('recusa de pagamento conserva os itens e nunca mostra recibo de sucesso', async ({
  page,
}) => {
  await addEmeraldApeToCart(page)
  await page.getByRole('link', { name: /Carrinho/ }).click()
  await page.getByRole('button', { name: 'Conectar e finalizar' }).click()
  await expect(page).toHaveURL(/\/login\?redirect=/)
  await page.getByLabel('E-mail').fill(DEMO_USERS.nova.email)
  await page.getByLabel('Senha', { exact: true }).fill(DEMO_USERS.nova.password)
  await page.getByRole('button', { name: 'Entrar', exact: true }).click()
  await expect(page).toHaveURL(/\/checkout$/)
  await selectScenario(page, 'payment-declined')
  await page.getByRole('button', { name: 'Confirmar compra' }).click()
  await expect(page.getByRole('heading', { name: 'Pagamento recusado' })).toBeVisible()
  await expect(page.getByText('THANK YOU')).toHaveCount(0)
  await page.getByRole('link', { name: 'Voltar ao checkout' }).click()
  await page.goto('/cart')
  await expect(page.getByRole('link', { name: 'Emerald Ape #042', exact: true })).toBeVisible()
})

test('timeout recupera o mesmo pedido ao tentar novamente com a mesma chave', async ({
  page,
}) => {
  await enterCheckoutAsGuest(page)
  await selectScenario(page, 'order-timeout-recovery')
  await page.getByRole('button', { name: 'Confirmar compra' }).click()
  await expect(page.getByRole('alert')).toContainText(/demorou|tentar novamente/i)
  await page.getByRole('button', { name: 'Tentar novamente com segurança' }).click()
  await expect(page).toHaveURL(/\/orders\/order-/)
  await expect(page.getByText('THANK YOU')).toBeVisible()
})

test('evento nft.updated torna cotação obsoleta até o usuário revisar', async ({
  page,
}) => {
  await enterCheckoutAsGuest(page)
  await openDemoToolbar(page)
  await page.getByRole('button', { name: /Disparar nft.updated/ }).click()
  await expect(page.getByRole('heading', { name: 'Cotação desatualizada' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Confirmar compra' })).toBeDisabled()
  await page.getByRole('button', { name: 'Revisar e confirmar novos valores' }).click()
  await expect(page.getByRole('button', { name: 'Confirmar compra' })).toBeEnabled()
})

test('toolbar ignora eventos Socket.IO duplicados e antigos', async ({ page }) => {
  await openDemoToolbar(page)
  await page.getByRole('button', { name: /Disparar nft.updated/ }).click()
  await expect(page.getByRole('status')).toContainText('Evento nft.updated emitido.')
  await page.getByRole('button', { name: 'Testar evento duplicado/antigo' }).click()
  await expect(page.getByRole('status')).toContainText(
    '2 evento(s) antigo(s)/duplicado(s) ignorado(s)',
  )
})

test('modal mantém navegação por teclado e fecha com Escape', async ({ page }) => {
  await page.goto('/login')
  await expect(page.getByLabel('E-mail')).toBeFocused()
  await page.keyboard.press('Shift+Tab')
  await expect(page.getByRole('button', { name: 'Fechar autenticação' })).toBeFocused()
  await page.keyboard.press('Escape')
  await expect(page).toHaveURL('/')
})
