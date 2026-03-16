import { test, expect } from '@playwright/test'

const routes = [
  { path: '/', url: /\/overview$/, text: '今日概况' },
  { path: '/overview', text: '今日概况' },
  { path: '/strategy', text: '策略大脑' },
  { path: '/portfolio', text: '策略快照持仓' },
  { path: '/validation', text: '验证模式分布' },
  { path: '/history', text: '最近审计记录' },
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
      await expect(page.getByRole('button', { name: /刷新 InStreet 实时数据|实时刷新中/ })).toBeVisible()
      await expect(page.getByRole('heading', { name: route.text })).toBeVisible()
      await expect(page.locator('.screen-state')).toHaveCount(0)
      expect(pageErrors).toEqual([])
    })
  }
})
