import { expect, test } from '@playwright/test'
import {
  DEMO_USERS,
  loginAs,
  openDemoToolbar,
  resetApplication,
} from './helpers.js'

test.beforeEach(async ({ page }) => {
  await resetApplication(page)
})

test('cadastro cria conta e conflito de e-mail é associado ao formulário', async ({
  page,
}) => {
  const email = `e2e-${Date.now()}@kurio.test`
  await page.goto('/register')
  await page.getByLabel('Nome de usuário').fill('e2ecollector')
  await page.getByLabel('E-mail').fill(email)
  await page.getByLabel('Senha', { exact: true }).fill('SecurePass2026')
  await page.getByLabel('Confirmar senha').fill('SecurePass2026')
  await page.getByRole('button', { name: 'Criar perfil' }).click()
  await expect(page.getByRole('heading', { name: 'Explore o mercado' })).toBeVisible()

  await page.goto('/register')
  await page.getByLabel('Nome de usuário').fill('anothercollector')
  await page.getByLabel('E-mail').fill(DEMO_USERS.nova.email)
  await page.getByLabel('Senha', { exact: true }).fill('SecurePass2026')
  await page.getByLabel('Confirmar senha').fill('SecurePass2026')
  await page.getByRole('button', { name: 'Criar perfil' }).click()
  await expect(page.getByRole('alert')).toContainText(
    'Este e-mail já está cadastrado.',
  )
  await expect(page.getByLabel('E-mail')).toHaveAttribute('aria-invalid', 'true')
})

test('login protegido, expiração 401 e retomada do caminho após autenticar', async ({
  page,
}) => {
  await page.goto('/wallets')
  await expect(page).toHaveURL(/\/login\?redirect=/)
  await expect(page).toHaveURL(/redirect=%2Fwallets/)

  await page.getByLabel('E-mail').fill(DEMO_USERS.nova.email)
  await page.getByLabel('Senha', { exact: true }).fill(DEMO_USERS.nova.password)
  await page.getByRole('button', { name: 'Entrar', exact: true }).click()
  await expect(page).toHaveURL(/\/wallets$/)
  await expect(page.getByRole('heading', { name: 'Carteira principal' })).toBeVisible()

  await page.evaluate(() =>
    localStorage.setItem('kurio_mock_scenario', 'session-expired'),
  )
  await page.reload()
  await expect(page).toHaveURL(/\/login\?redirect=/, { timeout: 10_000 })
  await expect(page.getByRole('alert')).toContainText(
    'Sua sessão expirou. Faça login novamente para continuar.',
  )
  await page.getByLabel('E-mail').fill(DEMO_USERS.nova.email)
  await page.getByLabel('Senha', { exact: true }).fill(DEMO_USERS.nova.password)
  await page.getByRole('button', { name: 'Entrar', exact: true }).click()
  await expect(page).toHaveURL(/\/wallets$/)
})

test('logout e troca entre contas isolam perfil e sessão', async ({ page }) => {
  await loginAs(page, 'nova')
  await page.goto('/profile')
  await expect(page.getByLabel('E-mail')).toHaveValue(DEMO_USERS.nova.email)

  await openDemoToolbar(page)
  await page.getByRole('button', { name: 'Usuário 2' }).click()
  await expect(page.getByText('Sessão de Kael Vance ativa.')).toBeVisible()
  await page.reload()
  await page.goto('/profile')
  await expect(page.getByLabel('E-mail')).toHaveValue(DEMO_USERS.kael.email)

  await page.getByRole('navigation', { name: 'Navegação da conta' })
    .getByRole('button', { name: 'Sair', exact: true })
    .click()
  await expect(page.getByRole('link', { name: 'Entrar' })).toBeVisible()
  await page.goto('/profile')
  await expect(page).toHaveURL(/\/login\?redirect=/)
})

test('edita perfil, avatar e senha com validação de credenciais', async ({ page }) => {
  await loginAs(page, 'nova')
  await page.goto('/profile')
  await expect(page.getByRole('heading', { name: 'Dados do perfil' })).toBeVisible()

  await page.getByLabel('Nome de exibição *').fill('Nova Sato E2E')
  await page.getByLabel('Selecionar avatar').selectOption('/mock-assets/nfts/ape-cosmic.png')
  await page.getByLabel('Senha atual').fill('senha-incorreta')
  await page.getByLabel('Nova senha').fill('NovaSenha2026')
  await page.getByLabel('Confirmar nova senha').fill('NovaSenha2026')
  await page.getByRole('button', { name: 'Salvar' }).click()
  await expect(page.getByRole('alert')).toContainText(/senha atual/i)

  await page.getByLabel('Senha atual').fill(DEMO_USERS.nova.password)
  await page.getByRole('button', { name: 'Salvar' }).click()
  await expect(page.getByRole('status')).toContainText(
    'Perfil e senha atualizados com sucesso.',
  )
  await page.reload()
  await expect(page.getByLabel('Nome de exibição *')).toHaveValue('Nova Sato E2E')
  await expect(page.getByLabel('Selecionar avatar')).toHaveValue(
    '/mock-assets/nfts/ape-cosmic.png',
  )
})

test('carteiras validam endereço e preservam alterações da carteira secundária', async ({
  page,
}) => {
  await loginAs(page, 'nova')
  await page.goto('/wallets')
  await expect(page.getByRole('heading', { name: 'Carteira principal' })).toBeVisible()
  await page.getByPlaceholder('Endereço 0x da carteira').first().fill('not-a-wallet')
  await page.getByRole('button', { name: 'Salvar carteira' }).first().click()
  await expect(page.getByText(/endereço 0x válido/i)).toBeVisible()

  await page.getByPlaceholder('Endereço 0x da carteira').first().fill(
    '0x1111111111111111111111111111111111111111',
  )
  await page.getByRole('button', { name: 'Salvar carteira' }).first().click()
  await expect(page.getByRole('heading', { name: 'Carteira secundária' })).toBeVisible()
  await page.getByLabel('Igual à carteira principal').check()
  await expect(page.getByText('Mesmo endereço da principal')).toBeVisible()
  await page.reload()
  await expect(page.getByText('Mesmo endereço da principal')).toBeVisible()
})

test('modal de login inicia foco, contém navegação por teclado e fecha com Escape', async ({
  page,
}) => {
  await page.goto('/login')
  const dialog = page.getByRole('dialog')
  await expect(dialog).toBeVisible()
  await expect(page.getByLabel('E-mail')).toBeFocused()
  await page.getByRole('link', { name: 'Criar perfil', exact: true }).focus()
  await page.keyboard.press('Tab')
  await expect(page.getByRole('button', { name: 'Fechar autenticação' })).toBeFocused()
  await page.keyboard.press('Escape')
  await expect(page).toHaveURL('/')
})
