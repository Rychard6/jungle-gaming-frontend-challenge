import { expect, test } from '@playwright/test'
import {
  DEMO_USERS,
  expectPathname,
  loginAs,
  openDemoToolbar,
  openProfileFromShell,
  closeDemoToolbar,
  demoToolbar,
  resetApplication,
  submitLoginForm,
} from './helpers.js'

// PNG 1×1 válido, suficiente para exercitar o redimensionamento do avatar no navegador.
const TINY_PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64',
)

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
  await expect(
    page.getByRole('alert').filter({ hasText: 'Este e-mail já está cadastrado.' }),
  ).toBeVisible()
  await expect(page.getByLabel('E-mail')).toHaveAttribute('aria-invalid', 'true')
})

test('cadastro valida os campos no cliente antes de chamar a API', async ({ page }) => {
  await page.goto('/register')
  await page.getByLabel('Nome de usuário').fill('ab')
  await page.getByLabel('E-mail').fill('sem-arroba')
  await page.getByLabel('Senha', { exact: true }).fill('curta')
  await page.getByLabel('Confirmar senha').fill('diferente')
  await page.getByRole('button', { name: 'Criar perfil' }).click()

  await expect(page.getByText('O nome de usuário deve ter pelo menos 3 caracteres.')).toBeVisible()
  await expect(page.getByText('Informe um e-mail válido.')).toBeVisible()
  await expect(page.getByText('A senha deve ter pelo menos 8 caracteres.')).toBeVisible()
  await expect(page.getByText('As senhas não coincidem.')).toBeVisible()
  // O foco vai para o primeiro campo inválido.
  await expect(page.getByLabel('Nome de usuário')).toBeFocused()
  await expectPathname(page, '/register')
})

test('login protegido, expiração 401 e retomada do caminho após autenticar', async ({
  page,
}) => {
  await page.goto('/wallets')
  await expect(page).toHaveURL(/\/login\?redirect=/)
  await expect(page).toHaveURL(/redirect=%2Fwallets/)

  await submitLoginForm(page, 'nova')
  await expectPathname(page, '/wallets')
  await expect(page.getByRole('heading', { name: 'Carteira principal' })).toBeVisible()

  await page.evaluate(() =>
    localStorage.setItem('kurio_mock_scenario', 'session-expired'),
  )
  await page.reload()
  await expect(page).toHaveURL(/\/login\?redirect=/, { timeout: 10_000 })
  await expect(
    page.getByRole('alert').filter({
      hasText: 'Sua sessão expirou. Faça login novamente para continuar.',
    }),
  ).toBeVisible()
  await submitLoginForm(page, 'nova')
  await expectPathname(page, '/wallets')
})

test('redirect externo no login é ignorado (sem open redirect)', async ({ page }) => {
  await page.goto('/login?redirect=%2F%2Fevil.example')
  await submitLoginForm(page, 'nova')
  await expect(page.getByRole('heading', { name: 'Explore o mercado' })).toBeVisible()
  expect(new URL(page.url()).hostname).toBe('127.0.0.1')
  await expectPathname(page, '/')
})

test('logout e troca entre contas isolam perfil e sessão', async ({ page }) => {
  await loginAs(page, 'nova')
  await page.goto('/profile')
  await expect(page.getByLabel('E-mail')).toHaveValue(DEMO_USERS.nova.email)

  await openDemoToolbar(page)
  await demoToolbar(page).getByRole('button', { name: 'Usuário 2' }).click()
  await expect(demoToolbar(page).getByText('Sessão de Kael Vance ativa.')).toBeVisible()
  await closeDemoToolbar(page)
  await page.goto('/profile')
  await expect(page.getByLabel('E-mail')).toHaveValue(DEMO_USERS.kael.email)

  await page.getByRole('navigation', { name: 'Navegação da conta' })
    .getByRole('button', { name: 'Sair', exact: true })
    .click()
  await expect(page.getByRole('dialog')).toBeVisible()
  await page.goto('/profile')
  await expect(page).toHaveURL(/\/login\?redirect=/)
})

test('trocar de usuário sem recarregar não reaproveita dados privados em cache', async ({
  page,
}) => {
  await loginAs(page, 'nova')
  await openProfileFromShell(page)
  await expect(page.getByLabel('E-mail')).toHaveValue(DEMO_USERS.nova.email)

  await openDemoToolbar(page)
  await demoToolbar(page).getByRole('button', { name: 'Usuário 2' }).click()
  await expect(demoToolbar(page).getByText('Sessão de Kael Vance ativa.')).toBeVisible()
  await closeDemoToolbar(page)

  // O formulário é remontado com os dados do novo usuário; nunca exibe os do anterior.
  await expect(page.getByLabel('E-mail')).toHaveValue(DEMO_USERS.kael.email)
  await expect(page.getByLabel('E-mail')).not.toHaveValue(DEMO_USERS.nova.email)
})

test('resposta atrasada de perfil não sobrescreve outra conta', async ({ page }) => {
  await loginAs(page, 'nova')
  await page.goto('/profile')
  await page.getByLabel('Nome de exibição *').fill('Perfil anterior não deve vazar')
  await page.evaluate(() => localStorage.setItem('kurio_mock_scenario', 'slow-network'))
  const requestStarted = page.waitForRequest((request) => request.method() === 'PATCH' && request.url().endsWith('/api/profile'))
  const responseFinished = page.waitForResponse((response) => response.request().method() === 'PATCH' && response.url().endsWith('/api/profile'))
  await page.getByRole('button', { name: 'Salvar', exact: true }).click()
  await requestStarted
  await openDemoToolbar(page)
  await demoToolbar(page).getByRole('button', { name: 'Usuário 2' }).click()
  await expect(demoToolbar(page).getByText('Sessão atual: Kael Vance')).toBeVisible()
  await responseFinished
  await closeDemoToolbar(page)
  await expect(page.getByLabel('E-mail')).toHaveValue(DEMO_USERS.kael.email)
  await expect(page.getByLabel('Nome de exibição *')).toHaveValue(DEMO_USERS.kael.name)
  await page.reload()
  await expect(page.getByLabel('Nome de exibição *')).toHaveValue(DEMO_USERS.kael.name)
})

test('avatar não salvo não é reaproveitado na troca de usuário', async ({ page }) => {
  await loginAs(page, 'nova')
  await page.goto('/profile')
  await page.getByLabel('Selecionar avatar').selectOption('/mock-assets/nfts/ape-cosmic.png')
  await openDemoToolbar(page)
  await demoToolbar(page).getByRole('button', { name: 'Usuário 2' }).click()
  await expect(demoToolbar(page).getByText('Sessão atual: Kael Vance')).toBeVisible()
  await closeDemoToolbar(page)
  await expect(page.getByLabel('Selecionar avatar')).toHaveValue('')
})

test('logout em outra aba remove dados privados da aba aberta', async ({ page, context }) => {
  await loginAs(page, 'nova')
  await page.goto('/profile')
  await expect(page.getByLabel('E-mail')).toHaveValue(DEMO_USERS.nova.email)
  const otherTab = await context.newPage()
  await otherTab.goto('/')
  await otherTab.evaluate(() => {
    localStorage.removeItem('kurio_auth_token')
    localStorage.removeItem('kurio_user_id')
  })
  await expect(page).toHaveURL(/\/login\?redirect=/)
  await expect(page.getByRole('heading', { name: 'Dados do perfil' })).toHaveCount(0)
  await otherTab.close()
})

test('edita perfil, avatar e senha com validação de credenciais', async ({ page }) => {
  await loginAs(page, 'nova')
  await page.goto('/profile')
  await expect(page.getByRole('heading', { name: 'Dados do perfil' })).toBeVisible()

  await page.getByLabel('Nome de exibição *').fill('Nova Sato E2E')
  await page.getByLabel('Selecionar avatar').selectOption('/mock-assets/nfts/ape-cosmic.png')
  await page.getByLabel('Senha atual').fill('senha-incorreta')
  await page.getByLabel('Nova senha', { exact: true }).fill('NovaSenha2026')
  await page.getByLabel('Confirmar nova senha').fill('NovaSenha2026')
  await page.getByRole('button', { name: 'Salvar' }).click()
  // O perfil é salvo mesmo quando a senha falha; o usuário é informado das duas coisas.
  await expect(
    page.getByRole('alert').filter({ hasText: /senha atual/i }),
  ).toBeVisible()
  await expect(
    page.getByRole('status').filter({ hasText: 'Perfil atualizado. A senha não foi alterada.' }),
  ).toBeVisible()

  await page.getByLabel('Senha atual').fill(DEMO_USERS.nova.password)
  await page.getByRole('button', { name: 'Salvar' }).click()
  await expect(
    page.getByRole('status').filter({ hasText: 'Perfil e senha atualizados com sucesso.' }),
  ).toBeVisible()
  await page.reload()
  await expect(page.getByLabel('Nome de exibição *')).toHaveValue('Nova Sato E2E')
  await expect(page.getByLabel('Selecionar avatar')).toHaveValue(
    '/mock-assets/nfts/ape-cosmic.png',
  )
})

test('perfil valida campos no cliente e associa os erros aos controles', async ({ page }) => {
  await loginAs(page, 'nova')
  await page.goto('/profile')
  await page.getByLabel('Nome de exibição *').fill('A')
  await page.getByLabel('E-mail').fill('invalido')
  await page.getByRole('button', { name: 'Salvar' }).click()

  await expect(page.getByLabel('Nome de exibição *')).toHaveAttribute('aria-invalid', 'true')
  await expect(page.getByLabel('E-mail')).toHaveAttribute('aria-invalid', 'true')
  await expect(page.getByText('Informe um e-mail válido.')).toBeVisible()
  await expect(page.getByLabel('Nome de exibição *')).toBeFocused()
})

test('avatar enviado é validado, reduzido e persistido', async ({ page }) => {
  await loginAs(page, 'nova')
  await page.goto('/profile')

  await page.getByLabel('Enviar imagem de avatar').setInputFiles({
    name: 'nota.txt',
    mimeType: 'text/plain',
    buffer: Buffer.from('não sou uma imagem'),
  })
  await expect(page.getByText('Envie uma imagem PNG, JPEG ou WebP.').first()).toBeVisible()

  await page.getByLabel('Enviar imagem de avatar').setInputFiles({
    name: 'avatar.png',
    mimeType: 'image/png',
    buffer: TINY_PNG,
  })
  await expect(page.getByAltText('Prévia do avatar')).toHaveAttribute(
    'src',
    /^data:image\/jpeg;base64,/,
  )
  await page.getByRole('button', { name: 'Salvar' }).click()
  await expect(
    page.getByRole('status').filter({ hasText: 'Perfil atualizado com sucesso.' }),
  ).toBeVisible()
  await page.reload()
  await expect(page.getByAltText('Prévia do avatar')).toHaveAttribute(
    'src',
    /^data:image\/jpeg;base64,/,
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
  await expect(page.getByPlaceholder('Endereço 0x da carteira').first()).toHaveAttribute(
    'aria-invalid',
    'true',
  )

  await page.getByPlaceholder('Endereço 0x da carteira').first().fill(
    '0x1111111111111111111111111111111111111111',
  )
  await page.getByRole('button', { name: 'Salvar carteira' }).first().click()
  await expect(
    page.getByRole('status').filter({ hasText: 'Carteira salva com sucesso.' }),
  ).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Carteira secundária' })).toBeVisible()
  await page.getByLabel('Igual à carteira principal').check()
  await expect(page.getByText('Mesmo endereço da principal')).toBeVisible()
  await page.reload()
  await expect(page.getByText('Mesmo endereço da principal')).toBeVisible()
})

test('remover carteira pede confirmação e devolve o foco ao acionador', async ({ page }) => {
  await loginAs(page, 'nova')
  await page.goto('/wallets')
  await page.getByLabel('Igual à carteira principal').check()
  await expect(page.getByText('Mesmo endereço da principal')).toBeVisible()
  await page.getByRole('button', { name: 'Usar endereço diferente' }).click()

  // Há um "Remover" em cada formulário; o escopo evita ambiguidade com a carteira principal.
  const remove = page
    .getByRole('region', { name: 'Carteira secundária' })
    .getByRole('button', { name: 'Remover', exact: true })
  await remove.click()
  const dialog = page.getByRole('dialog', { name: 'Remover carteira?' })
  await expect(dialog).toBeVisible()
  await expect(dialog.getByRole('button', { name: 'Cancelar' })).toBeFocused()

  await page.keyboard.press('Escape')
  await expect(dialog).toBeHidden()
  await expect(remove).toBeFocused()

  await remove.click()
  await dialog.getByRole('button', { name: 'Remover carteira' }).click()
  await expect(page.getByRole('status').filter({ hasText: 'Carteira removida.' })).toBeVisible()
  await expect(page.getByText('Você ainda não adicionou uma carteira secundária.')).toBeVisible()
})

test('modal de login inicia foco, contém navegação por teclado e fecha com Escape', async ({
  page,
}) => {
  await page.goto('/login')
  const dialog = page.getByRole('dialog')
  await expect(dialog).toBeVisible()
  await expect(page.getByLabel('E-mail')).toBeFocused()

  // Tab no último controle volta ao primeiro; Shift+Tab no primeiro vai ao último.
  const close = page.getByRole('button', { name: 'Fechar autenticação' })
  const lastLink = page.getByRole('link', { name: 'Criar perfil', exact: true })
  await lastLink.focus()
  await page.keyboard.press('Tab')
  await expect(close).toBeFocused()
  await page.keyboard.press('Shift+Tab')
  await expect(lastLink).toBeFocused()

  await page.keyboard.press('Escape')
  await expectPathname(page, '/')
})
