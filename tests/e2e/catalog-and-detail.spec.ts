import { expect, test } from '@playwright/test'
import { checkCatalogFilter, resetApplication } from './helpers.js'

test.beforeEach(async ({ page }) => {
  await resetApplication(page)
})

test('busca e filtros combinados atualizam o catálogo e retornam à página 1', async ({
  page,
}) => {
  const search = page.locator(
    'input[placeholder="Buscar NFTs, coleções..."]:visible, input[placeholder="Explorar coleções"]:visible',
  ).first()
  await search.fill('ape')
  await expect(page).toHaveURL(/q=ape/)

  if (await page.getByRole('button', { name: 'Próxima página' }).isVisible()) {
    await page.getByRole('button', { name: 'Próxima página' }).click()
  }

  await checkCatalogFilter(page, 'Arte digital')
  await checkCatalogFilter(page, 'Ethereum')
  await expect(page).toHaveURL(/categories=Arte(\+|%20)digital/)
  await expect(page).toHaveURL(/networks=Ethereum/)
  await expect(page).toHaveURL(/page=1/)
  await expect(page.getByRole('heading', { name: 'Explore o mercado' })).toBeVisible()
})

test('ordenação e paginação refletem a seleção e reiniciam após nova busca', async ({
  page,
}) => {
  const order = page.getByLabel('Ordenar')
  await order.selectOption('price_asc')
  await expect(page).toHaveURL(/sort=price_asc/)
  await expect(page.getByRole('navigation', { name: 'Paginação do catálogo' })).toBeVisible()
  await page.getByRole('button', { name: 'Próxima página' }).click()
  await expect(page).toHaveURL(/page=2/)

  const search = page.locator(
    'input[placeholder="Buscar NFTs, coleções..."]:visible, input[placeholder="Explorar coleções"]:visible',
  ).first()
  await search.fill('Emerald Ape')
  await expect(page).toHaveURL(/page=1/)
  await expect(page.getByRole('heading', { name: 'Emerald Ape #042' })).toBeVisible()
})

test('browser Back restaura o estado anterior do catálogo', async ({ page }) => {
  const search = page.locator(
    'input[placeholder="Buscar NFTs, coleções..."]:visible, input[placeholder="Explorar coleções"]:visible',
  ).first()
  await search.fill('Emerald')
  await expect(page).toHaveURL(/q=Emerald/)
  await page.getByLabel('Ordenar').selectOption('price_desc')
  await expect(page).toHaveURL(/sort=price_desc/)

  await page.goBack()

  await expect(page).toHaveURL(/q=Emerald/)
  await expect(page.getByLabel('Ordenar')).toHaveValue('recent')
})

test('modal de filtros contém foco e Escape devolve foco ao acionador', async ({
  page,
}, testInfo) => {
  test.skip(
    testInfo.project.name !== 'mobile-chromium',
    'O diálogo de filtros existe no layout móvel.',
  )
  const trigger = page.getByRole('button', { name: 'Abrir filtros' })
  await trigger.click()
  const dialog = page.getByRole('dialog')
  await expect(dialog.getByRole('button', { name: 'Fechar filtros' })).toBeFocused()
  await dialog.getByRole('button', { name: 'Ver resultados' }).focus()
  await page.keyboard.press('Tab')
  await expect(dialog.getByRole('button', { name: 'Fechar filtros' })).toBeFocused()
  await page.keyboard.press('Escape')
  await expect(trigger).toBeFocused()
})

test('abre detalhe direto por alias de fixture e apresenta 404 para NFT inexistente', async ({
  page,
}) => {
  await page.goto('/nfts/nft-1')
  await expect(page.getByRole('heading', { name: 'Emerald Ape #042' })).toBeVisible()

  await page.goto('/nfts/inexistente-999')
  await expect(
    page.getByRole('heading', { name: 'Esta peça não está disponível.' }),
  ).toBeVisible()
  await expect(page.getByText('404 · NFT não encontrado')).toBeVisible()
})

test('exibe skeleton durante rede lenta e recupera de erro 500 ao retomar rede normal', async ({
  page,
}) => {
  const catalogResponse = page.waitForResponse((response) =>
    response.url().includes('/api/nfts?') &&
    response.request().headers()['x-mock-scenario'] === 'slow-network',
  )
  await page.evaluate(() =>
    localStorage.setItem('kurio_mock_scenario', 'slow-network'),
  )
  await page.reload()
  await expect(page.locator('.skeleton-shimmer').first()).toBeVisible()
  await catalogResponse
  await expect(page.getByRole('heading', { name: 'Explore o mercado' })).toBeVisible({
    timeout: 10_000,
  })

  await page.evaluate(() =>
    localStorage.setItem('kurio_mock_scenario', 'server-error-500'),
  )
  await page.reload()
  await expect(
    page.getByText('Não foi possível carregar os NFTs.'),
  ).toBeVisible()
  await expect(page.getByRole('button', { name: 'Tentar novamente' })).toBeVisible()

  await page.evaluate(() =>
    localStorage.setItem('kurio_mock_scenario', 'default'),
  )
  await page.getByRole('button', { name: 'Tentar novamente' }).click()
  await expect(page.getByRole('heading', { name: 'Emerald Ape #042' })).toBeVisible()
})
