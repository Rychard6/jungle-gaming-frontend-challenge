import { expect, test } from '@playwright/test'
import type { CreateOrderRequestDto } from '../../src/shared/api/types.js'
import {
  DEMO_USERS,
  addEmeraldApeToCart,
  closeDemoToolbar,
  demoToolbar,
  enterCheckoutAsGuest,
  expectPathname,
  openDemoToolbar,
  resetApplication,
  selectScenario,
  simulateNftUpdate,
  submitLoginForm,
  waitForSocketConnection,
} from './helpers.js'

test.beforeEach(async ({ page }) => {
  await resetApplication(page)
})

test('favoritos exigem login, persistem e revertem a alteração quando a API falha', async ({
  page,
}) => {
  // Visitante: o coração leva ao login e explica o motivo; nada é salvo anonimamente.
  await page.getByRole('button', { name: 'Favoritar Emerald Ape #042' }).first().click()
  await expect(page).toHaveURL(/\/login\?redirect=/)
  await expect(
    page.getByRole('alert').filter({
      hasText: 'Entre na sua conta para salvar NFTs nos favoritos.',
    }),
  ).toBeVisible()
  await submitLoginForm(page, 'nova')
  await expect(page.getByRole('heading', { name: 'Explore o mercado' })).toBeVisible()

  await page.getByRole('button', { name: 'Favoritar Emerald Ape #042' }).first().click()
  const favorite = page
    .getByRole('button', { name: 'Remover Emerald Ape #042 dos favoritos' })
    .first()
  await expect(favorite).toHaveAttribute('aria-pressed', 'true')
  await page.reload()
  await expect(favorite).toHaveAttribute('aria-pressed', 'true')

  await page.evaluate(() =>
    localStorage.setItem('kurio_mock_scenario', 'network-error'),
  )
  await favorite.click()
  await expect(
    page.getByRole('alert').filter({ hasText: 'A alteração foi revertida.' }),
  ).toBeVisible()
  await expect(favorite).toHaveAttribute('aria-pressed', 'true')
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
  // Exatamente um alerta: o erro aparece junto ao campo, não repetido no topo da página.
  await expect(page.getByRole('alert').filter({ hasText: 'expirou' })).toHaveCount(1)
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
  await waitForSocketConnection(page)
  await openDemoToolbar(page)
  await demoToolbar(page)
    .getByRole('button', { name: 'Simular mudança de preço e estoque no carrinho' })
    .click()
  await closeDemoToolbar(page)
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

  // Preço e estoque mudam depois da compra; o recibo guarda o valor da transação.
  await simulateNftUpdate(page, {
    nftId: 'emerald-ape-042',
    priceEth: '9.99',
    availableEditions: 40,
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
  await enterCheckoutAsGuest(page)
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
  const idempotencyKeys: string[] = []
  page.on('request', (request) => {
    if (
      request.method() === 'POST' &&
      new URL(request.url()).pathname === '/api/orders'
    ) {
      idempotencyKeys.push(request.headers()['idempotency-key'] ?? '')
    }
  })

  await enterCheckoutAsGuest(page)
  await selectScenario(page, 'order-timeout-recovery')
  await page.getByRole('button', { name: 'Confirmar compra' }).click()
  await expect(
    page.getByRole('alert').filter({ hasText: /demorou|tentar novamente/i }),
  ).toBeVisible()
  await page.getByRole('button', { name: 'Tentar novamente com segurança' }).click()
  await expect(page).toHaveURL(/\/orders\/order-/)
  await expect(page.getByText('THANK YOU')).toBeVisible()

  // Idempotência: duas tentativas, a mesma chave, um único pedido no servidor.
  expect(idempotencyKeys).toHaveLength(2)
  expect(idempotencyKeys[0]).not.toBe('')
  expect(idempotencyKeys[1]).toBe(idempotencyKeys[0])
})

test('duplo clique em Confirmar compra cria um único pedido', async ({ page }) => {
  let orderRequests = 0
  page.on('request', (request) => {
    if (
      request.method() === 'POST' &&
      new URL(request.url()).pathname === '/api/orders'
    ) {
      orderRequests += 1
    }
  })

  await enterCheckoutAsGuest(page)
  await page.getByRole('button', { name: 'Confirmar compra' }).dblclick()
  await expect(page).toHaveURL(/\/orders\/order-/)
  await expect(page.getByText('THANK YOU')).toBeVisible()
  expect(orderRequests).toBe(1)
})

test('API garante idempotência, valida o coletor e impede outro pedido pendente', async ({ page }) => {
  await enterCheckoutAsGuest(page)
  await selectScenario(page, 'order-pending')
  const requestStarted = page.waitForRequest((request) =>
    request.method() === 'POST' && new URL(request.url()).pathname === '/api/orders',
  )
  await page.getByRole('button', { name: 'Confirmar compra' }).click()
  const request = await requestStarted
  const input = request.postDataJSON() as CreateOrderRequestDto
  const headers = request.headers()
  await expect(page.getByRole('heading', { name: 'Compra em processamento' })).toBeVisible()
  const originalId = new URL(page.url()).pathname.split('/').at(-1)

  const result = await page.evaluate(async ({ input, token, key }) => {
    const send = async (body: typeof input, idempotencyKey: string) => {
      const response = await fetch('/api/orders', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: token,
          'Idempotency-Key': idempotencyKey,
          'x-mock-scenario': 'order-pending',
        },
        body: JSON.stringify(body),
      })
      return { status: response.status, body: await response.json() }
    }
    const stockBefore = await fetch('/api/nfts/nft-1').then((response) => response.json())
    const replay = await send(input, key)
    const conflict = await send({ ...input, collector: { ...input.collector, notes: 'Outro payload' } }, key)
    const invalid = await send({ ...input, collector: { ...input.collector, email: 'inválido' } }, `${key}-invalid`)
    const pending = await send(input, `${key}-new`)
    const orders = await fetch('/api/orders', { headers: { Authorization: token } }).then((response) => response.json())
    const stockAfter = await fetch('/api/nfts/nft-1').then((response) => response.json())
    const edition = await fetch('/api/cart/items', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: token },
      body: JSON.stringify({ nftId: 'emerald-ape-042', quantity: 1, editionType: '1/1' }),
    })
    return { replay, conflict, invalid, pending, orders, stockBefore, stockAfter, editionStatus: edition.status }
  }, { input, token: headers.authorization, key: headers['idempotency-key'] })

  expect(result.replay.status).toBe(200)
  expect(result.replay.body.order.id).toBe(originalId)
  expect(result.conflict).toMatchObject({ status: 409, body: { code: 'IDEMPOTENCY_CONFLICT' } })
  expect(result.invalid).toMatchObject({ status: 422, body: { code: 'VALIDATION_ERROR', fieldErrors: { email: expect.any(String) } } })
  expect(result.pending).toMatchObject({ status: 409, body: { code: 'ORDER_PENDING' } })
  expect(result.orders.orders).toHaveLength(1)
  expect(result.stockAfter.availableEditions).toBe(result.stockBefore.availableEditions)
  expect(result.editionStatus).toBe(409)
})

test('persistência corrompida é descartada sem bloquear catálogo e checkout', async ({ page }) => {
  await page.evaluate(() => {
    localStorage.setItem('kurio_mock_db_v1', JSON.stringify([{ id: 'inválido', priceEth: {}, version: 1 }]))
    localStorage.setItem('kurio_mock_auth_v2', JSON.stringify({ users: [{}], sessions: {} }))
    localStorage.setItem('kurio_mock_carts_v1', JSON.stringify({ invalid: { items: [{}], couponCode: null } }))
    localStorage.setItem('kurio_mock_orders_v2', JSON.stringify([{ payloadFingerprint: 'invalid', order: {} }]))
  })
  await page.reload()
  await expect(page.getByRole('heading', { name: 'Explore o mercado' })).toBeVisible()
  await enterCheckoutAsGuest(page)
  await page.getByRole('button', { name: 'Confirmar compra' }).click()
  await expect(page.getByText('THANK YOU')).toBeVisible()
})

test('preço que muda durante a compra exige revisão antes de confirmar', async ({ page }) => {
  await enterCheckoutAsGuest(page)
  await selectScenario(page, 'price-change-on-checkout')
  await page.getByRole('button', { name: 'Confirmar compra' }).click()

  await expect(
    page.getByRole('alert').filter({ hasText: 'mudou durante a compra' }),
  ).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Cotação desatualizada' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Confirmar compra' })).toBeDisabled()
  await expect(page.getByText('THANK YOU')).toHaveCount(0)

  await page.getByRole('button', { name: 'Revisar e confirmar novos valores' }).click()
  await expect(page.getByRole('button', { name: 'Confirmar compra' })).toBeEnabled()
  await page.getByRole('button', { name: 'Confirmar compra' }).click()
  await expect(page).toHaveURL(/\/orders\/order-/)
  await expect(page.getByText('THANK YOU')).toBeVisible()
})

test('edição esgotada durante a compra nunca gera pedido confirmado', async ({ page }) => {
  await enterCheckoutAsGuest(page)
  await selectScenario(page, 'edition-sold-out')
  await page.getByRole('button', { name: 'Confirmar compra' }).click()

  await expect(
    page.getByRole('alert').filter({ hasText: 'esgotou durante a compra' }),
  ).toBeVisible()
  await expect(page.getByRole('button', { name: 'Confirmar compra' })).toBeDisabled()
  await expect(page.getByText('THANK YOU')).toHaveCount(0)

  // Revisar remove o item sem estoque; sem itens, o checkout explica e oferece o catálogo.
  await page.getByRole('button', { name: 'Revisar e confirmar novos valores' }).click()
  await expect(page.getByRole('heading', { name: 'Seu carrinho está vazio' })).toBeVisible()
  await expect(page.getByRole('link', { name: 'Explorar catálogo' })).toBeVisible()
})

test('pedido pendente sobrevive à recarga e é concluído por evento do servidor', async ({
  page,
}) => {
  await enterCheckoutAsGuest(page)
  await selectScenario(page, 'order-pending')
  await page.getByRole('button', { name: 'Confirmar compra' }).click()
  await expect(page).toHaveURL(/\/orders\/order-/)
  await expect(page.getByRole('heading', { name: 'Compra em processamento' })).toBeVisible()
  const orderUrl = page.url()

  await page.reload()
  await expect(page.getByRole('heading', { name: 'Compra em processamento' })).toBeVisible()
  expect(page.url()).toBe(orderUrl)

  await page.goto('/checkout')
  await expect(page).toHaveURL(orderUrl)
  await expect(page.getByRole('heading', { name: 'Compra em processamento' })).toBeVisible()

  await waitForSocketConnection(page)
  await openDemoToolbar(page)
  await demoToolbar(page).getByRole('button', { name: 'Confirmar pedido pendente' }).click()
  await closeDemoToolbar(page)
  await expect(page.getByText('THANK YOU')).toBeVisible()
})

test('pedido pendente preserva o carrinho e confirmação remove somente a quantidade comprada', async ({ page }) => {
  await enterCheckoutAsGuest(page)
  await selectScenario(page, 'order-pending')
  await page.getByRole('button', { name: 'Confirmar compra' }).click()
  await expect(page.getByRole('heading', { name: 'Compra em processamento' })).toBeVisible()
  const orderUrl = page.url()
  await page.goto('/cart')
  await expect(page.locator('[aria-label="Quantidade de Emerald Ape #042"] output')).toHaveText('1')
  await page.getByRole('button', { name: 'Aumentar quantidade de Emerald Ape #042' }).click()
  await expect(page.locator('[aria-label="Quantidade de Emerald Ape #042"] output')).toHaveText('2')
  await openDemoToolbar(page)
  await demoToolbar(page).getByRole('button', { name: 'Confirmar pedido pendente' }).click()
  await closeDemoToolbar(page)
  await expect(page.locator('[aria-label="Quantidade de Emerald Ape #042"] output')).toHaveText('1')
  await page.goto(orderUrl)
  await expect(page.getByText('THANK YOU')).toBeVisible()
})

test('recusar pedido pendente não duplica os itens preservados no carrinho', async ({ page }) => {
  await enterCheckoutAsGuest(page)
  await selectScenario(page, 'order-pending')
  await page.getByRole('button', { name: 'Confirmar compra' }).click()
  await expect(page.getByRole('heading', { name: 'Compra em processamento' })).toBeVisible()
  await openDemoToolbar(page)
  await demoToolbar(page).getByRole('button', { name: 'Recusar pedido pendente' }).click()
  await closeDemoToolbar(page)
  await expect(page.getByRole('heading', { name: 'Pagamento recusado' })).toBeVisible()
  await page.goto('/cart')
  await expect(page.locator('[aria-label="Quantidade de Emerald Ape #042"] output')).toHaveText('1')
})

test('pedido de outro usuário responde 403 e não é exibido', async ({ page }) => {
  await enterCheckoutAsGuest(page)
  await page.getByRole('button', { name: 'Confirmar compra' }).click()
  await expect(page).toHaveURL(/\/orders\/order-/)
  const orderPath = new URL(page.url()).pathname

  await openDemoToolbar(page)
  await demoToolbar(page).getByRole('button', { name: 'Usuário 2' }).click()
  await expect(demoToolbar(page).getByText('Sessão de Kael Vance ativa.')).toBeVisible()
  await closeDemoToolbar(page)

  await page.goto(orderPath)
  await expect(page.getByRole('heading', { name: 'Acesso não autorizado' })).toBeVisible()
  await expect(
    page.getByRole('alert').filter({
      hasText: 'Você não tem permissão para acessar este pedido.',
    }),
  ).toBeVisible()
  await expect(page.getByText('THANK YOU')).toHaveCount(0)
})

test('evento nft.updated torna cotação obsoleta até o usuário revisar', async ({
  page,
}) => {
  await enterCheckoutAsGuest(page)
  await waitForSocketConnection(page)
  await openDemoToolbar(page)
  await demoToolbar(page).getByRole('button', { name: /Disparar nft.updated/ }).click()
  await closeDemoToolbar(page)
  await expect(page.getByRole('heading', { name: 'Cotação desatualizada' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Confirmar compra' })).toBeDisabled()
  await page.getByRole('button', { name: 'Revisar e confirmar novos valores' }).click()
  await expect(page.getByRole('button', { name: 'Confirmar compra' })).toBeEnabled()
})

test('toolbar ignora eventos Socket.IO duplicados e antigos', async ({ page }) => {
  await waitForSocketConnection(page)
  await openDemoToolbar(page)
  const toolbar = demoToolbar(page)
  await toolbar.getByRole('button', { name: /Disparar nft.updated/ }).click()
  await expect(toolbar.getByRole('status')).toContainText('Evento nft.updated emitido.')
  await toolbar.getByRole('button', { name: 'Testar evento duplicado/antigo' }).click()
  await expect(toolbar.getByRole('status')).toContainText(
    '2 evento(s) antigo(s)/duplicado(s) ignorado(s)',
  )
})

test('detalhe do NFT reflete eventos em tempo real e se recupera após queda do socket', async ({
  page,
}) => {
  await page.goto('/nfts/nft-1')
  await expect(page.getByRole('heading', { name: 'Emerald Ape #042' })).toBeVisible()
  await waitForSocketConnection(page)

  await simulateNftUpdate(page, {
    nftId: 'emerald-ape-042',
    priceEth: '1.19',
    availableEditions: 7,
  })
  await expect(page.getByText('7 disponíveis')).toBeVisible()

  // Evento perdido durante a queda: ao reconectar, o REST reconcilia o estado.
  await openDemoToolbar(page)
  await demoToolbar(page).getByRole('button', { name: 'Simular queda do Socket.IO' }).click()
  await closeDemoToolbar(page)
  await simulateNftUpdate(page, {
    nftId: 'emerald-ape-042',
    priceEth: '1.19',
    availableEditions: 3,
  })
  await expect(page.getByText('3 disponíveis')).toBeVisible({ timeout: 15_000 })
  await waitForSocketConnection(page)
})

test('navegação protegida do checkout volta ao login e retoma o caminho', async ({ page }) => {
  await page.goto('/checkout')
  await expect(page).toHaveURL(/\/login\?redirect=%2Fcheckout/)
  await submitLoginForm(page, 'nova')
  await expectPathname(page, '/checkout')
})
