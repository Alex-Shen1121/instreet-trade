import test from 'node:test'
import assert from 'node:assert/strict'

const baseUrl = process.env.CONTRACT_BASE_URL || 'http://127.0.0.1:33210'

async function getJson(path) {
  const res = await fetch(`${baseUrl}${path}`)
  assert.equal(res.ok, true, `expected ${path} to return 2xx, got ${res.status}`)
  return res.json()
}

test('GET /api/overview returns stable core shape', async () => {
  const data = await getJson('/api/overview')

  assert.equal(typeof data, 'object')
  assert.equal(typeof data.generatedAt, 'string')
  assert.equal(typeof data.workspace, 'string')

  assert.ok(data.links)
  assert.equal(typeof data.links, 'object')
  assert.ok('latestAuditPath' in data.links)
  assert.ok('latestLogPath' in data.links)

  assert.ok(data.summary)
  assert.equal(typeof data.summary, 'object')
  assert.ok('activeProfile' in data.summary)
  assert.ok('latestAction' in data.summary)
  assert.ok('strategyState' in data.summary)
  assert.ok('marketRegime' in data.summary)
  assert.ok('pendingTrades' in data.summary)

  assert.ok(data.portfolio)
  assert.equal(typeof data.portfolio, 'object')
  assert.ok(Array.isArray(data.portfolio.holdings))
  assert.ok(typeof data.portfolio.bucketExposures === 'object')
  assert.ok(typeof data.portfolio.riskControls === 'object')

  assert.ok(data.latestRun)
  assert.equal(typeof data.latestRun, 'object')
  assert.ok(typeof data.latestRun.state === 'object')
  assert.ok(typeof data.latestRun.dynamicFocus === 'object')
  assert.ok(typeof data.latestRun.strategySignal === 'object')
  assert.ok(typeof data.latestRun.diagnostics === 'object')

  assert.ok(data.history)
  assert.equal(typeof data.history, 'object')
  assert.ok(Array.isArray(data.history.audits))
  assert.ok(Array.isArray(data.history.logs))
  assert.ok(typeof data.history.validation === 'object')

  assert.ok(Array.isArray(data.completedFeatures))
})

test('GET /api/health returns service heartbeat', async () => {
  const data = await getJson('/api/health')
  assert.equal(data.ok, true)
  assert.equal(data.service, 'instreet-trade-dashboard')
  assert.equal(typeof data.time, 'string')
})
