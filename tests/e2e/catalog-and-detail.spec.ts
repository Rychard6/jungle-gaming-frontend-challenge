import { expect, test, type Page } from '@playwright/test'
import {
  checkCatalogFilter,
  expectPathname,
  resetApplication,
  selectScenario,
  simulateNftUpdate,
  usesFilterDialog,
} from './helpers.js'

test.beforeEach(async ({ page }) => {
  await resetApplication(page)
})

function visibleSearchInput(page: Page) {
  return page
    .locator(
      'input[placeholder="Buscar NFTs, coleções..."]:visible, input[placeholder="Explorar coleções"]:visible',
    )
    .first()
}

test('busca e filtros combinados atualizam o catálogo e retornam à página 1', async ({
  page,
}) => {
  await page.getByRole('button', { name: 'Próxima página' }).click()
  await expect(page).toHaveURL(/page=2/)
  await visibleSearchInput(page).fill('ape')
  await expect(page).toHaveURL(/q=ape/)
  await expect(page).toHaveURL(/page=1/)

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

  await visibleSearchInput(page).fill('Emerald Ape')
  await expect(page).toHaveURL(/page=1/)
  await expect(page.getByRole('heading', { name: 'Emerald Ape #042' })).toBeVisible()
})

test('digitar na busca ocupa um único passo do histórico', async ({ page }) => {
  const historyBefore = await page.evaluate(() => window.history.length)
  await visibleSearchInput(page).pressSequentially('Emerald', { delay: 40 })
  await expect(page).toHaveURL(/q=Emerald/)
  const historyAfter = await page.evaluate(() => window.history.length)
  // `replace` evita uma entrada por letra: Voltar não "desdigita" a busca caractere a caractere.
  expect(historyAfter).toBe(historyBefore)
})

test('browser Back restaura o estado anterior do catálogo', async ({ page }) => {
  await visibleSearchInput(page).fill('Emerald')
  await expect(page).toHaveURL(/q=Emerald/)
  await page.getByLabel('Ordenar').selectOption('price_desc')
  await expect(page).toHaveURL(/sort=price_desc/)

  await page.goBack()

  await expect(page).toHaveURL(/q=Emerald/)
  await expect(page.getByLabel('Ordenar')).toHaveValue('recent')
})

test('faixa de preço inválida mostra erro inline e não altera a URL', async ({ page }) => {
  if (usesFilterDialog(page)) {
    await page.getByRole('button', { name: 'Abrir filtros' }).click()
  }
  const filters = usesFilterDialog(page)
    ? page.getByRole('dialog')
    : page.getByRole('complementary', { name: 'Filtros do catálogo' })

  await filters.getByLabel('Mínimo ETH').fill('5')
  await filters.getByLabel('Máximo ETH').fill('1')
  await filters.getByRole('button', { name: 'Aplicar' }).click()
  await expect(
    filters.getByText('O preço máximo deve ser maior ou igual ao mínimo.'),
  ).toBeVisible()
  await expect(filters.getByLabel('Máximo ETH')).toHaveAttribute('aria-invalid', 'true')
  expect(page.url()).not.toContain('minPrice=')

  await filters.getByLabel('Mínimo ETH').fill('0.5')
  await filters.getByLabel('Máximo ETH').fill('1.5')
  await filters.getByRole('button', { name: 'Aplicar' }).click()
  await expect(page).toHaveURL(/minPrice=0\.5/)
  await expect(page).toHaveURL(/maxPrice=1\.5/)
  if (usesFilterDialog(page)) {
    await expect(page.getByRole('button', { name: 'Abrir filtros' })).toBeFocused()
  }
})

test('página fora do intervalo volta para a última página válida', async ({ page }) => {
  await page.goto('/?tab=all&sort=recent&page=99')
  await expect(page.getByRole('heading', { name: 'Explore o mercado' })).toBeVisible()
  await expect
    .poll(() => Number(new URL(page.url()).searchParams.get('page')))
    .toBeLessThan(99)
  await expect(page.getByRole('navigation', { name: 'Paginação do catálogo' })).toBeVisible()
})

test('resultado vazio oferece caminho de volta e a rede normal restaura o catálogo', async ({
  page,
}) => {
  await selectScenario(page, 'empty-results')
  await expect(page.getByRole('heading', { name: 'Nenhum NFT encontrado' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Limpar filtros' })).toBeVisible()

  await selectScenario(page, 'default')
  await expect(page.getByRole('heading', { name: 'Emerald Ape #042' })).toBeVisible()
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

test('evento de preço reordena o catálogo e respeita o filtro ativo', async ({ page }) => {
  await page.goto('/?sort=price_asc&maxPrice=2')
  const results = page.getByRole('region', { name: 'Resultados do catálogo' })
  await expect(results.locator('article').first()).toBeVisible()
  await simulateNftUpdate(page, { nftId: 'emerald-ape-042', priceEth: '0.01', availableEditions: 50 })
  await expect(results.locator('article h3').first()).toHaveText('Emerald Ape #042')
  await simulateNftUpdate(page, { nftId: 'emerald-ape-042', priceEth: '9.99', availableEditions: 50 })
  await expect(results.getByRole('heading', { name: 'Emerald Ape #042' })).toHaveCount(0)
})

test('NFT esgotado fica indisponível no catálogo e no detalhe', async ({ page }) => {
  await simulateNftUpdate(page, {
    nftId: 'emerald-ape-042',
    priceEth: '1.19',
    availableEditions: 0,
  })

  await page.goto('/nfts/nft-1')
  await expect(
    page.getByText('Edição esgotada: esta peça não está mais disponível para compra.'),
  ).toBeVisible()
  await expect(page.getByRole('button', { name: 'Comprar agora' })).toBeDisabled()
  await expect(page.getByRole('button', { name: 'Adicionar ao carrinho' })).toBeDisabled()

  await page.goto('/')
  await expect(page.getByRole('button', { name: 'Emerald Ape #042 esgotado' })).toBeDisabled()
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

test('rede lenta mostra skeleton também no detalhe e no carrinho', async ({ page }) => {
  await selectScenario(page, 'slow-network')
  await page.goto('/nfts/nft-1')
  await expect(page.locator('.skeleton-shimmer').first()).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Emerald Ape #042' })).toBeVisible({
    timeout: 10_000,
  })

  await page.goto('/cart')
  await expect(page.locator('.skeleton-shimmer').first()).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Carrinho de NFTs' })).toBeVisible({
    timeout: 10_000,
  })
})

test('"Pular para o conteúdo" é o primeiro foco e leva ao conteúdo principal', async ({
  page,
}) => {
  await page.keyboard.press('Tab')
  const skipLink = page.getByRole('link', { name: 'Pular para o conteúdo' })
  await expect(skipLink).toBeFocused()
  await page.keyboard.press('Enter')
  await expect(page.locator('#conteudo')).toBeFocused()
})

test('o título do documento acompanha a rota', async ({ page }) => {
  await expect(page).toHaveTitle('KURIO — Marketplace de NFTs')
  await page.goto('/nfts/nft-1')
  await expect(page).toHaveTitle('Emerald Ape #042 — KURIO')
  await page.goto('/cart')
  await expect(page).toHaveTitle('Carrinho de NFTs — KURIO')
})

test('fontes e imagens são servidas localmente, sem CDN', async ({ page }) => {
  const externalRequests: string[] = []
  page.on('request', (request) => {
    const url = new URL(request.url())
    const isHttp = url.protocol === 'http:' || url.protocol === 'https:'
    if (isHttp && url.hostname !== '127.0.0.1' && url.hostname !== 'localhost') {
      externalRequests.push(request.url())
    }
  })

  await page.reload()
  await expect(page.getByRole('heading', { name: 'Explore o mercado' })).toBeVisible()
  await page.evaluate(() => document.fonts.ready)
  const plexLoaded = await page.evaluate(() =>
    document.fonts.check('400 16px "IBM Plex Mono"'),
  )
  expect(plexLoaded).toBe(true)
  expect(externalRequests).toEqual([])
})

test('a página inicial não cria rolagem horizontal', async ({ page }) => {
  await expect(page.getByRole('heading', { name: 'Explore o mercado' })).toBeVisible()
  await expectPathname(page, '/')
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  )
  expect(overflow).toBeLessThanOrEqual(1)
})
