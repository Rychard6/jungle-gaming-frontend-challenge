import { expect, type Locator, type Page } from '@playwright/test'

export const DEMO_USERS = {
  nova: {
    email: 'contato@email.com',
    password: 'Kurio@2026',
    name: 'Nova Sato',
  },
  kael: {
    email: 'colecionador@kurio.io',
    password: 'Kurio@2026',
    name: 'Kael Vance',
  },
} as const

/** Abaixo de 640px o layout é o móvel (menu inferior, filtros em diálogo). */
export function isMobileViewport(page: Page): boolean {
  return (page.viewportSize()?.width ?? 1440) < 640
}

/** Abaixo do breakpoint `lg` (1024px) os filtros do catálogo ficam em diálogo, inclusive no tablet. */
export function usesFilterDialog(page: Page): boolean {
  return (page.viewportSize()?.width ?? 1440) < 1024
}

/**
 * A aplicação só renderiza depois que o MSW está respondendo e marca `data-kurio-mocks`.
 * Sem aguardar esse marcador, uma chamada `/api` feita cedo demais escapa para a rede real.
 */
export async function waitForMocks(page: Page): Promise<void> {
  await page.locator('html[data-kurio-mocks="ready"]').waitFor({ state: 'attached' })
}

export async function resetApplication(
  page: Page,
  scenario = 'default',
): Promise<void> {
  await page.addInitScript(() => {
    if (sessionStorage.getItem('__kurio_e2e_initialized') !== '1') {
      localStorage.clear()
      sessionStorage.setItem('__kurio_e2e_initialized', '1')
    }
  })
  await page.goto('/')
  await waitForMocks(page)
  const resetSucceeded = await page.evaluate(async () => {
    const response = await fetch('/api/__mock__/reset', { method: 'POST' })
    if (!response.ok) throw new Error('The MSW MockDB reset request failed.')
    return response.ok
  })
  expect(resetSucceeded).toBeTruthy()
  await page.evaluate((selectedScenario) => {
    localStorage.setItem('kurio_mock_scenario', selectedScenario)
  }, scenario)
  await page.reload()
  await waitForMocks(page)
  await expect(page.getByRole('heading', { name: 'Explore o mercado' })).toBeVisible()
}

/** A URL do catálogo sempre carrega `?tab=...&sort=...&page=...`; por isso comparamos só o caminho. */
export async function expectPathname(
  page: Page,
  pathname: string | RegExp,
): Promise<void> {
  const current = expect.poll(() => new URL(page.url()).pathname)
  if (typeof pathname === 'string') {
    await current.toBe(pathname)
  } else {
    await current.toMatch(pathname)
  }
}

/** Preenche e envia o formulário de login que já está aberto. */
export async function submitLoginForm(
  page: Page,
  user: keyof typeof DEMO_USERS = 'nova',
): Promise<void> {
  const account = DEMO_USERS[user]
  await page.getByLabel('E-mail').fill(account.email)
  await page.getByLabel('Senha', { exact: true }).fill(account.password)
  await page.getByRole('button', { name: 'Entrar', exact: true }).click()
}

export async function loginAs(
  page: Page,
  user: keyof typeof DEMO_USERS = 'nova',
  redirect?: string,
): Promise<void> {
  await page.goto(
    redirect ? `/login?redirect=${encodeURIComponent(redirect)}` : '/login',
  )
  await submitLoginForm(page, user)
  if (redirect) {
    await expectPathname(page, new URL(redirect, 'http://kurio.test').pathname)
  } else {
    await expect(page.getByRole('heading', { name: 'Explore o mercado' })).toBeVisible()
  }
}

export function demoToolbar(page: Page): Locator {
  return page.locator('details').filter({ hasText: 'Ferramentas de demonstração' })
}

async function isToolbarOpen(toolbar: Locator): Promise<boolean> {
  return toolbar.evaluate((element) => element.hasAttribute('open'))
}

/** Idempotente: chamar duas vezes não fecha a barra (o `<details>` alterna a cada clique). */
export async function openDemoToolbar(page: Page): Promise<void> {
  const toolbar = demoToolbar(page)
  if (!(await isToolbarOpen(toolbar))) {
    await toolbar.locator('summary').click()
  }
  await expect(toolbar.getByLabel('Cenário de rede')).toBeVisible()
}

/** A barra é fixa e, no celular, cobre botões da página; feche-a antes de continuar o fluxo. */
export async function closeDemoToolbar(page: Page): Promise<void> {
  const toolbar = demoToolbar(page)
  if (await isToolbarOpen(toolbar)) {
    await toolbar.locator('summary').click()
  }
}

export async function selectScenario(
  page: Page,
  scenario: string,
): Promise<void> {
  await openDemoToolbar(page)
  await demoToolbar(page).getByLabel('Cenário de rede').selectOption(scenario)
  await closeDemoToolbar(page)
}

export async function checkCatalogFilter(
  page: Page,
  filterName: 'Arte digital' | 'Ethereum',
): Promise<void> {
  if (usesFilterDialog(page)) {
    if (!(await page.getByRole('dialog').isVisible().catch(() => false))) {
      await page.getByRole('button', { name: 'Abrir filtros' }).click()
    }
    await page.getByRole('dialog').getByRole('checkbox', {
      name: new RegExp(filterName),
    }).check()
    if (filterName === 'Ethereum') {
      await page.getByRole('dialog').getByRole('button', {
        name: 'Ver resultados',
      }).click()
    }
    return
  }
  await page.getByRole('checkbox', { name: new RegExp(filterName) }).check()
}

export async function addEmeraldApeToCart(page: Page): Promise<void> {
  await page.getByRole('button', {
    name: 'Adicionar Emerald Ape #042 ao carrinho',
  }).first().click()
  await expect(page.getByRole('link', { name: /Carrinho, 1 edição/ })).toBeVisible()
}

export async function enterCheckoutAsGuest(page: Page): Promise<void> {
  await page.goto('/')
  await addEmeraldApeToCart(page)
  await page.getByRole('link', { name: /Carrinho/ }).click()
  await page.getByRole('button', { name: 'Conectar e finalizar' }).click()
  await expect(page).toHaveURL(/\/login\?redirect=/)
  await submitLoginForm(page, 'nova')
  await expect(page).toHaveURL(/\/checkout$/)
  await expect(page.getByRole('heading', { name: 'Finalizar compra' })).toBeVisible()
}

/** Abre o perfil pelo link do cabeçalho (desktop) ou pelo menu inferior (celular), sem recarregar. */
export async function openProfileFromShell(page: Page): Promise<void> {
  if (isMobileViewport(page)) {
    await page.getByRole('navigation', { name: 'Navegação inferior' })
      .getByRole('link', { name: 'Perfil', exact: true })
      .click()
  } else {
    await page.getByRole('link', { name: /^Perfil de / }).click()
  }
  await expectPathname(page, '/profile')
}

/** Atualiza um NFT pela API simulada (o servidor MSW emite `nft.updated` via Socket.IO). */
export async function simulateNftUpdate(
  page: Page,
  update: { nftId: string; priceEth: string; availableEditions: number },
): Promise<void> {
  await page.evaluate(async (body) => {
    const response = await fetch('/api/__mock__/simulate-nft-update', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    if (!response.ok) throw new Error('Could not update mock NFT')
  }, update)
}

/** Aguarda o cliente Socket.IO conectar (o indicador existe no DOM mesmo com a barra fechada). */
export async function waitForSocketConnection(page: Page): Promise<void> {
  await expect(page.getByTestId('socket-connection-status')).toContainText(
    /Socket\.IO: conectado/,
  )
}
