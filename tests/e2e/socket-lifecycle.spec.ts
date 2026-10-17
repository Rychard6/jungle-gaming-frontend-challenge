import { expect, test } from '@playwright/test'
import {
  resetApplication,
  simulateNftUpdate,
  waitForSocketConnection,
} from './helpers.js'

test.beforeEach(async ({ page }) => {
  await resetApplication(page)
})

test('ocultar a página encerra o socket e eventos posteriores não alteram a tela', async ({
  page,
}) => {
  await page.goto('/nfts/nft-1')
  await expect(page.getByRole('heading', { name: 'Emerald Ape #042' })).toBeVisible()
  await waitForSocketConnection(page)

  // `pagehide` sem `persisted` é o encerramento real da página: o cliente deve desligar o socket.
  await page.evaluate(() => window.dispatchEvent(new Event('pagehide')))
  await expect(page.getByTestId('socket-connection-status')).toContainText(
    /Socket\.IO: desconectado/,
  )

  // O servidor continua emitindo eventos, mas nenhum listener deve permanecer registrado.
  await simulateNftUpdate(page, {
    nftId: 'emerald-ape-042',
    priceEth: '1.19',
    availableEditions: 1,
  })
  await expect(page.getByTestId('socket-connection-status')).toContainText(
    /Socket\.IO: desconectado/,
  )
})

test('restauração do cache bfcache (persisted) mantém o socket ativo', async ({ page }) => {
  await page.goto('/nfts/nft-1')
  await expect(page.getByRole('heading', { name: 'Emerald Ape #042' })).toBeVisible()
  await waitForSocketConnection(page)

  await page.evaluate(() => {
    const event = new Event('pagehide') as Event & { persisted: boolean }
    Object.defineProperty(event, 'persisted', { value: true })
    window.dispatchEvent(event)
  })

  await expect(page.getByTestId('socket-connection-status')).toContainText(
    /Socket\.IO: conectado/,
  )
})
