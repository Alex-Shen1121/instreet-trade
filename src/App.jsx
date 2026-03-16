import { useEffect, useMemo, useState } from 'react'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import './App.css'

const COLORS = ['#2563eb', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#14b8a6']

function fmtMoney(value) {
  if (value === null || value === undefined || Number.isNaN(Number(value))) return 'N/A'
  return Number(value).toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function fmtPct(value) {
  if (value === null || value === undefined || Number.isNaN(Number(value))) return 'N/A'
  return `${(Number(value) * 100).toFixed(2)}%`
}

function fmtTime(value) {
  if (!value) return 'N/A'
  return new Date(value).toLocaleString('zh-CN', { hour12: false })
}

function StatusBadge({ children, tone = 'slate' }) {
  return <span className={`badge badge-${tone}`}>{children}</span>
}

function Card({ title, extra, children }) {
  return (
    <section className="card">
      <div className="card-header">
        <h3>{title}</h3>
        {extra ? <div>{extra}</div> : null}
      </div>
      <div>{children}</div>
    </section>
  )
}

function Metric({ label, value, tone = 'default' }) {
  return (
    <div className={`metric metric-${tone}`}>
      <div className="metric-label">{label}</div>
      <div className="metric-value">{value}</div>
    </div>
  )
}

function App() {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let timer
    async function load() {
      try {
        const res = await fetch('/api/overview')
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        const json = await res.json()
        setData(json)
        setError('')
      } catch (err) {
        setError(err.message || '加载失败')
      } finally {
        setLoading(false)
      }
    }
    load()
    timer = setInterval(load, 30000)
    return () => clearInterval(timer)
  }, [])

  const exposures = useMemo(() => {
    const raw = data?.portfolio?.bucketExposures || {}
    return Object.entries(raw).map(([name, value]) => ({ name, value: Number(value) }))
  }, [data])

  const auditModes = useMemo(() => {
    const raw = data?.history?.validation?.counts || {}
    return Object.entries(raw).map(([name, value]) => ({ name, value }))
  }, [data])

  if (loading) {
    return <div className="page shell"><div className="loading">正在加载 dashboard...</div></div>
  }

  if (error || !data) {
    return <div className="page shell"><div className="error">加载失败：{error || '未知错误'}</div></div>
  }

  const { summary, portfolio, latestRun, history, links, completedFeatures } = data
  const holdings = portfolio?.holdings || []
  const news = latestRun?.news || []
  const focusStocks = latestRun?.dynamicFocus?.focus_stocks || latestRun?.dynamicFocus?.focusStocks || []
  const focusSectors = latestRun?.dynamicFocus?.focus_sectors || latestRun?.dynamicFocus?.focusSectors || []
  const avoidSectors = latestRun?.dynamicFocus?.avoid_sectors || latestRun?.dynamicFocus?.avoidSectors || []
  const signal = latestRun?.strategySignal || {}
  const latestAudit = latestRun?.audit || {}
  const latestPostContent = latestAudit?.outputs?.generated_post_content || latestRun?.state?.last_generated_post_content || ''

  return (
    <div className="page">
      <header className="hero">
        <div>
          <p className="eyebrow">InStreet Trade Dashboard</p>
          <h1>交易策略、验证链路、持仓与执行状态总览</h1>
          <p className="hero-copy">
            这个 dashboard 覆盖了当前自动交易流程的核心环节：策略状态、当前持仓、动态关注、
            审计快照、dry-run / replay 验证、日志、飞书知识库同步和社区分析帖链接。
          </p>
          <div className="hero-actions">
            {links.lastPostUrl ? <a href={links.lastPostUrl} target="_blank" rel="noreferrer">查看最新分析帖</a> : null}
            <a href={links.tradeLogWiki} target="_blank" rel="noreferrer">交易日志知识库</a>
            <a href={links.overviewWiki} target="_blank" rel="noreferrer">持仓与规划总览</a>
          </div>
        </div>
        <div className="hero-side">
          <div className="hero-panel">
            <div className="hero-panel-label">最近更新时间</div>
            <div className="hero-panel-value">{fmtTime(data.generatedAt)}</div>
          </div>
          <div className="hero-panel">
            <div className="hero-panel-label">当前策略</div>
            <div className="hero-panel-value">{summary.activeProfile || 'N/A'}</div>
          </div>
          <div className="hero-panel">
            <div className="hero-panel-label">本轮动作</div>
            <div className="hero-panel-value">{summary.latestAction}</div>
          </div>
        </div>
      </header>

      <section className="metrics-grid">
        <Metric label="总资产" value={fmtMoney(summary.totalValue)} tone="blue" />
        <Metric label="现金" value={fmtMoney(summary.cash)} tone="green" />
        <Metric label="持仓市值" value={fmtMoney(summary.holdingsValue)} tone="amber" />
        <Metric label="收益率" value={fmtPct(summary.returnRate)} tone="purple" />
        <Metric label="市场结构" value={summary.marketRegime} />
        <Metric label="状态机" value={summary.strategyState} />
      </section>

      <section className="grid two-col">
        <Card
          title="当前执行摘要"
          extra={<StatusBadge tone={summary.latestAction === 'hold' ? 'amber' : 'green'}>{summary.latestAction}</StatusBadge>}
        >
          <div className="list-block">
            <div><span>最近一轮：</span>{fmtTime(summary.lastRunAt)}</div>
            <div><span>运行模式：</span>{summary.lastMode || 'N/A'}</div>
            <div><span>当前策略：</span>{summary.activeProfile || 'N/A'}</div>
            <div><span>建议切换：</span>{summary.suggestedProfile || '无'}</div>
            <div><span>本轮原因：</span>{summary.latestReason || '暂无'}</div>
          </div>
        </Card>

        <Card title="验证情况（模拟盘验证）">
          <div className="validation-grid">
            <div>
              <StatusBadge tone={history.validation.hasLive ? 'green' : 'slate'}>live</StatusBadge>
            </div>
            <div>
              <StatusBadge tone={history.validation.hasDryRun ? 'green' : 'slate'}>dry-run</StatusBadge>
            </div>
            <div>
              <StatusBadge tone={history.validation.hasReplay ? 'green' : 'slate'}>replay</StatusBadge>
            </div>
          </div>
          <div className="chart-shell small-chart">
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={auditModes}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" />
                <YAxis allowDecimals={false} />
                <Tooltip />
                <Bar dataKey="value" fill="#2563eb" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </section>

      <section className="grid two-col">
        <Card title="当前持仓">
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>标的</th>
                  <th>Bucket</th>
                  <th>股数</th>
                  <th>成本</th>
                  <th>现价</th>
                  <th>盈亏</th>
                </tr>
              </thead>
              <tbody>
                {holdings.map((item) => (
                  <tr key={item.symbol}>
                    <td>
                      <strong>{item.name}</strong>
                      <div className="muted">{item.symbol}</div>
                    </td>
                    <td>{item.bucket || '—'}</td>
                    <td>{item.shares}</td>
                    <td>{fmtMoney(item.avg_cost)}</td>
                    <td>{fmtMoney(item.current_price)}</td>
                    <td>{fmtPct(item.profit_rate)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>

        <Card title="Bucket 暴露结构">
          <div className="chart-shell">
            <ResponsiveContainer width="100%" height={320}>
              <PieChart>
                <Pie data={exposures} dataKey="value" nameKey="name" innerRadius={70} outerRadius={110} paddingAngle={2}>
                  {exposures.map((entry, index) => (
                    <Cell key={entry.name} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={(value) => fmtPct(value)} />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="legend-list">
            {exposures.map((entry, index) => (
              <div key={entry.name} className="legend-item">
                <span className="dot" style={{ backgroundColor: COLORS[index % COLORS.length] }} />
                <span>{entry.name}</span>
                <strong>{fmtPct(entry.value)}</strong>
              </div>
            ))}
          </div>
        </Card>
      </section>

      <section className="grid two-col">
        <Card title="动态重点关注">
          <div className="chips-block">
            {(focusSectors || []).map((item) => <span key={item} className="chip chip-blue">{item}</span>)}
          </div>
          <div className="focus-list">
            {focusStocks.map((item) => (
              <div key={item.symbol} className="focus-item">
                <div className="focus-title">{item.name} <span>{item.symbol}</span></div>
                <div className="focus-desc">{item.reason}</div>
              </div>
            ))}
          </div>
        </Card>

        <Card title="策略切换状态机">
          <div className="signal-panel">
            <div className="signal-row"><span>当前状态</span><strong>{signal.state || 'N/A'}</strong></div>
            <div className="signal-row"><span>建议切换到</span><strong>{signal.last_suggested_profile || '无'}</strong></div>
            <div className="signal-row"><span>连续信号</span><strong>{signal.consecutive_same_suggestion || 0} / {signal.switch_signal_threshold || 0}</strong></div>
            <div className="signal-row"><span>置信度</span><strong>{signal.confidence || 'N/A'}</strong></div>
            <div className="signal-note">{signal.switch_reason || '暂无切换理由'}</div>
          </div>
          <div className="chips-block top-gap">
            {(avoidSectors || []).map((item) => <span key={item} className="chip chip-red">回避：{item}</span>)}
          </div>
        </Card>
      </section>

      <section className="grid two-col">
        <Card title="已完成能力覆盖">
          <div className="feature-grid">
            {completedFeatures.map((item) => (
              <div key={item.key} className="feature-card">
                <div className="feature-top">
                  <strong>{item.title}</strong>
                  <StatusBadge tone="green">已完成</StatusBadge>
                </div>
                <p>{item.desc}</p>
              </div>
            ))}
          </div>
        </Card>

        <Card title="主要新闻与最新发帖内容">
          <div className="news-list">
            {news.slice(0, 5).map((item, idx) => (
              <div key={`${item.link}-${idx}`} className="news-item">
                <div className="news-source">{item.source}</div>
                <div className="news-title">{item.title}</div>
              </div>
            ))}
          </div>
          <details className="content-preview">
            <summary>展开查看最新分析帖正文</summary>
            <pre>{latestPostContent || '暂无正文'}</pre>
          </details>
        </Card>
      </section>

      <section className="grid two-col">
        <Card title="最近审计记录">
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>时间</th>
                  <th>模式</th>
                  <th>动作</th>
                  <th>市场结构</th>
                  <th>状态机</th>
                </tr>
              </thead>
              <tbody>
                {history.audits.map((item) => (
                  <tr key={item.fileName}>
                    <td>{fmtTime(item.updatedAt)}</td>
                    <td>{item.mode}</td>
                    <td>{item.action}</td>
                    <td>{item.marketRegime}</td>
                    <td>{item.strategyState}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>

        <Card title="最近日志">
          <div className="log-meta-list">
            {history.logs.slice(0, 8).map((item) => (
              <div className="log-row" key={item.name}>
                <div>
                  <strong>{item.name}</strong>
                  <div className="muted">{fmtTime(item.updatedAt)}</div>
                </div>
                <div>{Math.round(item.size / 1024)} KB</div>
              </div>
            ))}
          </div>
          <details className="content-preview">
            <summary>展开查看最新日志尾部</summary>
            <pre>{latestRun.latestLogPreview || '暂无日志'}</pre>
          </details>
        </Card>
      </section>
    </div>
  )
}

export default App
