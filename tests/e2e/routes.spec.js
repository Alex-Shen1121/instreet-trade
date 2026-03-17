import { test, expect } from '@playwright/test'

const routes = [
  { path: '/', url: /\/overview$/, text: '今日概况' },
  { path: '/overview', text: '今日概况' },
  { path: '/strategy', text: '策略大脑' },
  { path: '/portfolio', text: '当前持仓' },
  { path: '/validation', text: '最近运行模式统计' },
  { path: '/history', text: '最近审计记录' },
  { path: '/config', text: '量化大策略切换' },
]

test.describe('dashboard routes smoke', () => {
  for (const route of routes) {
    test(`route ${route.path} renders`, async ({ page }) => {
      const pageErrors = []
      page.on('pageerror', (error) => pageErrors.push(error.message))

      await page.goto(route.path)

      if (route.url) {
        await expect(page).toHaveURL(route.url)
      }

      await expect(page.getByRole('link', { name: /总览\s*今日概况/ })).toBeVisible()
      await expect(page.getByRole('button', { name: /刷新当前页面|刷新中/ })).toBeVisible()
      await expect(page.getByRole('heading', { name: route.text })).toBeVisible()
      await expect(page.locator('.screen-state')).toHaveCount(0)
      expect(pageErrors).toEqual([])
    })
  }

  test('sidebar navigation does not white-screen between tabs', async ({ page }) => {
    const pageErrors = []
    page.on('pageerror', (error) => pageErrors.push(error.message))

    await page.goto('/overview')
    await expect(page.getByRole('button', { name: /刷新当前页面|刷新中/ })).toBeVisible({ timeout: 15000 })
    await expect(page.locator('.screen-state')).toHaveCount(0, { timeout: 15000 })

    await page.getByRole('link', { name: /策略页\s*信号与状态机/ }).click()
    await expect(page).toHaveURL(/\/strategy$/)
    await expect(page.locator('.screen-state')).toHaveCount(0, { timeout: 15000 })
    await expect(page.getByRole('heading', { name: '策略大脑' })).toBeVisible({ timeout: 15000 })

    await page.getByRole('link', { name: /持仓页\s*当前持仓\s*\/\s*仓位/ }).click()
    await expect(page).toHaveURL(/\/portfolio$/)
    await expect(page.locator('.screen-state')).toHaveCount(0, { timeout: 15000 })
    await expect(page.getByRole('heading', { name: '当前持仓' })).toBeVisible({ timeout: 15000 })

    await page.getByRole('link', { name: /历史页\s*审计\s*\/\s*日志\s*\/\s*新闻/ }).click()
    await expect(page).toHaveURL(/\/history$/)
    await expect(page.locator('.screen-state')).toHaveCount(0, { timeout: 15000 })
    await expect(page.getByRole('heading', { name: '最近审计记录' })).toBeVisible({ timeout: 15000 })

    await expect(page.locator('#root')).not.toBeEmpty()
    expect(pageErrors).toEqual([])
  })
})
