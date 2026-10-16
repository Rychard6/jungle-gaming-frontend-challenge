import { expect, type Page } from '@playwright/test'

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
  await expect(page.getByRole('heading', { name: 'Explore o mercado' })).toBeVisible()
}

export async function loginAs(
  page: Page,
  user: keyof typeof DEMO_USERS = 'nova',
  redirect?: string,
): Promise<void> {
  const account = DEMO_USERS[user]
  const url = redirect
    ? `/login?redirect=${encodeURIComponent(redirect)}`
    : '/login'
  await page.goto(url)
  await page.getByLabel('E-mail').fill(account.email)
  await page.getByLabel('Senha', { exact: true }).fill(account.password)
  await page.getByRole('button', { name: 'Entrar', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Explore o mercado' })).toBeVisible()
}

export async function openDemoToolbar(page: Page): Promise<void> {
  await page.getByText('Ferramentas de demonstração').click()
}

export async function selectScenario(
  page: Page,
  scenario: string,
): Promise<void> {
  await openDemoToolbar(page)
  await page.getByLabel('Cenário de rede').selectOption(scenario)
}

export async function checkCatalogFilter(
  page: Page,
  filterName: 'Arte digital' | 'Ethereum',
): Promise<void> {
  if ((page.viewportSize()?.width ?? 1440) <= 640) {
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
  }).click()
  await expect(page.getByRole('link', { name: /Carrinho, 1 edição/ })).toBeVisible()
}

export async function enterCheckoutAsGuest(page: Page): Promise<void> {
  await page.goto('/')
  await addEmeraldApeToCart(page)
  await page.getByRole('link', { name: /Carrinho/ }).click()
  await page.getByRole('button', { name: 'Conectar e finalizar' }).click()
  await expect(page).toHaveURL(/\/login\?redirect=/)
  await page.getByLabel('E-mail').fill(DEMO_USERS.nova.email)
  await page.getByLabel('Senha', { exact: true }).fill(DEMO_USERS.nova.password)
  await page.getByRole('button', { name: 'Entrar', exact: true }).click()
  await expect(page).toHaveURL(/\/checkout$/)
  await expect(page.getByRole('heading', { name: 'Finalizar compra' })).toBeVisible()
}
