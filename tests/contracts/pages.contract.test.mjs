import test from 'node:test'
import assert from 'node:assert/strict'

const baseUrl = process.env.CONTRACT_BASE_URL || 'http://127.0.0.1:33210'

async function getJson(path) {
  const res = await fetch(`${baseUrl}${path}`)
  assert.equal(res.ok, true, `expected ${path} to return 2xx, got ${res.status}`)
  return res.json()
}

test('GET /api/pages/overview returns overview-only payload', async () => {
  const data = await getJson('/api/pages/overview')

  assert.ok(data.summary)
  assert.ok(data.links)
  assert.equal('signal' in data, false)
  assert.equal('history' in data, false)
  assert.equal('holdings' in data, false)
})

test('GET /api/pages/strategy returns strategy payload', async () => {
  const data = await getJson('/api/pages/strategy')

  assert.ok(data.summary)
  assert.ok(typeof data.signal === 'object')
  assert.ok(typeof data.dynamicFocus === 'object')
  assert.ok(typeof data.diagnostics === 'object')
  assert.ok(typeof data.portfolio === 'object')
  assert.ok(typeof data.portfolio.riskControls === 'object')
  assert.equal('history' in data, false)
})

test('GET /api/pages/portfolio returns portfolio payload', async () => {
  const data = await getJson('/api/pages/portfolio')

  assert.ok(data.summary)
  assert.ok(Array.isArray(data.holdings))
  assert.ok(Array.isArray(data.trades))
  assert.ok(Array.isArray(data.exposures))
  assert.equal('signal' in data, false)
})

test('GET /api/pages/validation returns validation payload', async () => {
  const data = await getJson('/api/pages/validation')

  assert.ok(data.summary)
  assert.ok(Array.isArray(data.auditModes))
  assert.ok(Array.isArray(data.assetTrend))
  assert.equal('history' in data, false)
})

test('GET /api/pages/history returns history payload', async () => {
  const data = await getJson('/api/pages/history')

  assert.ok(data.summary)
  assert.ok(typeof data.history === 'object')
  assert.ok(Array.isArray(data.trades))
  assert.ok(Array.isArray(data.news))
  assert.equal(typeof data.latestPostContent, 'string')
  assert.equal(typeof data.latestLogPreview, 'string')
})

test('GET /api/pages/config returns lightweight config-page payload', async () => {
  const data = await getJson('/api/pages/config')

  assert.ok(data.summary)
  assert.equal(Object.keys(data).sort().join(','), 'summary')
})
