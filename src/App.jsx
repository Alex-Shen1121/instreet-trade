import { useEffect, useMemo, useState } from 'react'
import {
  Area,
  AreaChart,
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
import { NavLink, Navigate, Route, Routes, useLocation } from 'react-router-dom'
import './App.css'

const COLORS = ['#2563eb', '#10b981', '#f59e0b', '#8b5cf6', '#ef4444', '#14b8a6']

const LABELS = {
  action: {
    buy: '买入',
    sell: '卖出',
    hold: '继续观察',
  },
  mode: {
    live: '实盘执行',
    'dry-run': '模拟演练',
    replay: '回放复盘',
  },
  profile: {
    'steady-triangle-v1': '稳健三角轮动 v1',
    'dividend-defense-v1': '红利防守 v1',
    'growth-rotation-v1': '成长轮动 v1',
    'balanced-barbell-v1': '均衡杠铃 v1',
  },
  strategyState: {
    maintain: '维持当前策略',
    observe_switch: '观察切换信号',
    switch_ready: '切换条件已满足',
    rollback_watch: '切换后回看期',
    switched: '已完成切换',
  },
  regime: {
    risk_off: '偏防守市场',
    balanced: '均衡市场',
    risk_on: '偏进攻市场',
  },
  status: {
    pending: '待成交',
    executed: '已成交',
    failed: '失败',
    cancelled: '已取消',
  },
  bucket: {
    energy_dividend: '能源红利',
    insurance: '保险金融',
    technology_manufacturing: '科技制造',
    other: '其他',
  },
}

const NAV_ITEMS = [
  { to: '/overview', label: '总览', desc: '今日概况' },
  { to: '/strategy', label: '策略页', desc: '信号与状态机' },
  { to: '/portfolio', label: '持仓页', desc: '快照 vs 实时' },
  { to: '/validation', label: '验证页', desc: 'dry-run / replay' },
  { to: '/history', label: '历史页', desc: '审计 / 日志 / 新闻' },
]

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

function fmtAgo(freshness) {
  if (!freshness) return '未知'
  if (freshness.minutes < 1) return `${freshness.seconds}s 前`
  return `${freshness.minutes} 分钟前`
}

function mapLabel(group, value, fallback = '未知') {
  if (value === null || value === undefined || value === '') return fallback
  return LABELS[group]?.[value] || value
}

function toneForAction(action) {
  if (action === 'buy') return 'green'
  if (action === 'sell') return 'red'
  if (action === 'hold') return 'amber'
  return 'slate'
}

function toneForState(state) {
  if (state === 'switch_ready') return 'green'
  if (state === 'observe_switch') return 'amber'
  if (state === 'rollback_watch') return 'red'
  return 'blue'
}

function Badge({ children, tone = 'slate' }) {
  return <span className={`badge badge-${tone}`}>{children}</span>
}

function StatCard({ label, value, hint, tone = 'blue' }) {
  return (
    <div className={`stat-card stat-card-${tone}`}>
      <div className="stat-label">{label}</div>
      <div className="stat-value">{value}</div>
      {hint ? <div className="stat-hint">{hint}</div> : null}
    </div>
  )
}

function SectionHeader({ title, subtitle, extra }) {
  return (
    <div className="section-header">
      <div>
        <h2>{title}</h2>
        {subtitle ? <p>{subtitle}</p> : null}
      </div>
      {extra ? <div>{extra}</div> : null}
    </div>
  )
}

function Card({ children, className = '' }) {
  return <section className={`card ${className}`.trim()}>{children}</section>
}

function Table({ columns, rows, rowKey }) {
  return (
    <div className="table-shell">
      <table>
        <thead>
          <tr>
            {columns.map((col) => <th key={col.key}>{col.title}</th>)}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, idx) => (
            <tr key={rowKey ? row[rowKey] ?? idx : idx}>
              {columns.map((col) => <td key={col.key}>{col.render ? col.render(row) : row[col.key]}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function useDashboardData() {
  const [localData, setLocalData] = useState(null)
  const [liveData, setLiveData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [liveLoading, setLiveLoading] = useState(false)
  const [error, setError] = useState('')
  const [liveError, setLiveError] = useState('')

  useEffect(() => {
    let timer
    async function loadLocal() {
      try {
        const res = await fetch('/api/overview')
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        const json = await res.json()
        setLocalData(json)
        setError('')
      } catch (err) {
        setError(err.message || '加载本地快照失败')
      } finally {
        setLoading(false)
      }
    }
    loadLocal()
    timer = setInterval(loadLocal, 30000)
    return () => clearInterval(timer)
  }, [])

  async function refreshLive() {
    try {
      setLiveLoading(true)
      const res = await fetch('/api/live')
      const json = await res.json()
      if (!res.ok) throw new Error(json?.error || `HTTP ${res.status}`)
      setLiveData(json)
      setLiveError('')
    } catch (err) {
      setLiveError(err.message || '实时拉取失败')
    } finally {
      setLiveLoading(false)
    }
  }

  useEffect(() => {
    refreshLive()
    const timer = setInterval(refreshLive, 60000)
    return () => clearInterval(timer)
  }, [])

  return { localData, liveData, loading, liveLoading, error, liveError, refreshLive }
}

function useViewModel(localData, liveData) {
  return useMemo(() => {
    if (!localData) return null
    const { summary, portfolio, latestRun, history, links, completedFeatures } = localData
    const signal = latestRun?.strategySignal || {}
    const dynamicFocus = latestRun?.dynamicFocus || {}
    const latestAudit = latestRun?.audit || {}
    const latestPostContent = latestAudit?.outputs?.generated_post_content || latestRun?.state?.last_generated_post_content || ''
    const holdings = portfolio?.holdings || []
    const trades = portfolio?.trades || []
    const news = latestRun?.news || []
    const exposures = Object.entries(localData?.portfolio?.bucketExposures || {}).map(([name, value]) => ({
      name: mapLabel('bucket', name, name),
      rawName: name,
      value: Number(value),
    }))
    const auditModes = Object.entries(localData?.history?.validation?.counts || {}).map(([name, value]) => ({
      name: mapLabel('mode', name, name),
      rawName: name,
      value,
    }))
    const assetTrend = (localData?.history?.audits || []).slice().reverse().map((item) => ({
      name: item.runId?.slice(-4) || item.fileName,
      totalValue: item.totalValue || 0,
      returnRate: (item.returnRate || 0) * 100,
    }))
    const liveSummary = liveData?.summary || {}
    return {
      summary,
      portfolio,
      latestRun,
      history,
      links,
      completedFeatures,
      signal,
      dynamicFocus,
      latestAudit,
      latestPostContent,
      holdings,
      trades,
      news,
      exposures,
      auditModes,
      assetTrend,
      liveSummary,
      liveHoldings: liveSummary?.holdings || [],
      liveTrades: liveSummary?.trades || [],
      localPending: summary.pendingTrades || 0,
      livePending: liveSummary?.tradeSummary?.pending || 0,
    }
  }, [localData, liveData])
}

function Layout({ vm, liveLoading, liveError, refreshLive, children }) {
  const location = useLocation()
  return (
    <div className="app-shell grain">
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-mark">IT</div>
          <div>
            <h1>InStreet Console</h1>
            <p>Trade Ops v2</p>
          </div>
        </div>

        <nav className="sidebar-nav">
          {NAV_ITEMS.map((item) => (
            <NavLink key={item.to} to={item.to} className={({ isActive }) => (isActive ? 'active' : '')}>
              <strong>{item.label}</strong>
              <span>{item.desc}</span>
            </NavLink>
          ))}
        </nav>

        <div className="sidebar-card">
          <div className="sidebar-title">当前策略</div>
          <strong>{mapLabel('profile', vm.summary.activeProfile, vm.summary.activeProfile)}</strong>
          <div className="sidebar-meta">状态：{mapLabel('strategyState', vm.summary.strategyState, vm.summary.strategyState)}</div>
          <div className="sidebar-meta">建议切换：{mapLabel('profile', vm.summary.suggestedProfile, vm.summary.suggestedProfile || '无')}</div>
        </div>

        <div className="sidebar-card dark">
          <div className="sidebar-title">实时模式</div>
          <p>本地快照负责完整策略链路，实时数据负责当前盘面与账户状态。</p>
          <button className="ghost-button" onClick={refreshLive} disabled={liveLoading}>
            {liveLoading ? '实时刷新中…' : '刷新 InStreet 实时数据'}
          </button>
          {liveError ? <div className="inline-error">{liveError}</div> : null}
        </div>

        <div className="sidebar-footnote">当前页面：{NAV_ITEMS.find((item) => item.to === location.pathname)?.label || '总览'}</div>
      </aside>
      <main className="main-content">{children}</main>
    </div>
  )
}

function OverviewPage({ vm, liveError }) {
  return (
    <>
      <header className="hero-v2">
        <div className="hero-copy-block">
          <div className="hero-eyebrow">策略控制台 / Mixed Mode</div>
          <h2>把“策略推演”与“盘面现实”分开看，也能一起看清楚</h2>
          <p>
            这版 dashboard 已拆成多个页面。你可以分别查看总览、策略、持仓、验证和历史，
            同时前端已经把关键枚举值转成人能理解的词，不再直接暴露内部代码名。
          </p>
          <div className="hero-links">
            {vm.links.lastPostUrl ? <a href={vm.links.lastPostUrl} target="_blank" rel="noreferrer">最新分析帖</a> : null}
            <a href={vm.links.tradeLogWiki} target="_blank" rel="noreferrer">交易日志</a>
            <a href={vm.links.overviewWiki} target="_blank" rel="noreferrer">持仓规划</a>
          </div>
        </div>

        <div className="hero-status-grid">
          <div className="hero-status-card bright">
            <span>本地策略快照</span>
            <strong>{fmtAgo(vm.summary.freshness)}</strong>
            <small>最近一轮：{fmtTime(vm.summary.lastRunAt)}</small>
          </div>
          <div className="hero-status-card">
            <span>实时 InStreet</span>
            <strong>{vm.liveSummary?.pulledAt ? fmtTime(vm.liveSummary.pulledAt) : '未获取'}</strong>
            <small>{liveError || '每 60 秒自动刷新，可手动刷新'}</small>
          </div>
          <div className="hero-status-card">
            <span>本轮结论</span>
            <strong>{mapLabel('action', vm.summary.latestAction, vm.summary.latestAction)}</strong>
            <small>{vm.summary.latestReason}</small>
          </div>
        </div>
      </header>

      <section className="stats-grid v2">
        <StatCard label="策略快照总资产" value={fmtMoney(vm.summary.totalValue)} hint={`收益率 ${fmtPct(vm.summary.returnRate)}`} tone="blue" />
        <StatCard label="策略快照现金" value={fmtMoney(vm.summary.cash)} hint={`持仓市值 ${fmtMoney(vm.summary.holdingsValue)}`} tone="cyan" />
        <StatCard label="实时总资产" value={fmtMoney(vm.liveSummary?.portfolio?.total_value)} hint={`实时现金 ${fmtMoney(vm.liveSummary?.portfolio?.cash)}`} tone="green" />
        <StatCard label="待成交订单" value={`${vm.localPending} / ${vm.livePending}`} hint="左：快照，右：实时" tone="amber" />
      </section>

      <div className="page-grid two-col">
        <Card>
          <SectionHeader title="今日概况" subtitle="先看结论，再看细节" extra={<Badge tone={toneForAction(vm.summary.latestAction)}>{mapLabel('action', vm.summary.latestAction)}</Badge>} />
          <div className="kv-list compact">
            <div><span>当前策略</span><strong>{mapLabel('profile', vm.summary.activeProfile, vm.summary.activeProfile)}</strong></div>
            <div><span>市场结构</span><strong>{mapLabel('regime', vm.summary.marketRegime, vm.summary.marketRegime)}</strong></div>
            <div><span>策略状态</span><strong>{mapLabel('strategyState', vm.summary.strategyState, vm.summary.strategyState)}</strong></div>
            <div><span>运行模式</span><strong>{mapLabel('mode', vm.summary.lastMode, vm.summary.lastMode)}</strong></div>
          </div>
        </Card>

        <Card>
          <SectionHeader title="数据源对照" subtitle="两套视角解决两个问题" />
          <div className="source-compare">
            <div className="source-card local">
              <div className="source-title">本地快照</div>
              <div className="source-value">{fmtTime(vm.summary.lastRunAt)}</div>
              <ul>
                <li>完整审计链路</li>
                <li>模型复核与状态机</li>
                <li>适合复盘、验证、排障</li>
              </ul>
            </div>
            <div className="source-card live">
              <div className="source-title">实时拉取</div>
              <div className="source-value">{vm.liveSummary?.pulledAt ? fmtTime(vm.liveSummary.pulledAt) : '未获取'}</div>
              <ul>
                <li>当前账户与持仓</li>
                <li>当前 pending / executed</li>
                <li>适合盯盘时快速确认</li>
              </ul>
            </div>
          </div>
        </Card>
      </div>
    </>
  )
}

function StrategyPage({ vm }) {
  return (
    <div className="stack-page">
      <Card>
        <SectionHeader title="策略大脑" subtitle="决策、信号、风控和关注方向" extra={<Badge tone={toneForState(vm.signal.state)}>{mapLabel('strategyState', vm.signal.state, vm.signal.state)}</Badge>} />
        <div className="decision-banner">
          <div>
            <div className="banner-label">当前结论</div>
            <div className="banner-value smallish">{mapLabel('action', vm.summary.latestAction, vm.summary.latestAction)}</div>
          </div>
          <Badge tone={toneForAction(vm.summary.latestAction)}>{mapLabel('action', vm.summary.latestAction)}</Badge>
        </div>
        <p className="banner-reason">{vm.summary.latestReason}</p>
        <div className="mini-grid top-space">
          <div className="mini-card"><div className="mini-label">市场结构</div><strong>{mapLabel('regime', vm.summary.marketRegime, vm.summary.marketRegime)}</strong></div>
          <div className="mini-card"><div className="mini-label">当前策略</div><strong>{mapLabel('profile', vm.summary.activeProfile, vm.summary.activeProfile)}</strong></div>
          <div className="mini-card"><div className="mini-label">建议切换</div><strong>{mapLabel('profile', vm.signal.last_suggested_profile, vm.signal.last_suggested_profile || '无')}</strong></div>
          <div className="mini-card"><div className="mini-label">连续信号</div><strong>{vm.signal.consecutive_same_suggestion || 0} / {vm.signal.switch_signal_threshold || 0}</strong></div>
        </div>
      </Card>

      <div className="page-grid two-col">
        <Card>
          <SectionHeader title="重点关注方向" subtitle="这部分告诉你当前最该看什么" />
          <div className="chips">{(vm.dynamicFocus.focus_sectors || []).map((item) => <span key={item} className="chip chip-primary">{item}</span>)}</div>
          <div className="focus-stack top-space">
            {(vm.dynamicFocus.focus_stocks || []).map((item) => (
              <article key={item.symbol} className="focus-card">
                <div className="focus-head"><strong>{item.name}</strong><span>{item.symbol}</span></div>
                <p>{item.reason}</p>
              </article>
            ))}
          </div>
        </Card>

        <Card>
          <SectionHeader title="切换与回避" subtitle="什么时候换策略，哪些方向暂时别碰" />
          <div className="side-card emphasis no-shadow">
            <div className="section-kicker">切换理由</div>
            <p>{vm.signal.switch_reason || '暂无'}</p>
            <div className="side-meta">置信度：{vm.signal.confidence || 'N/A'}</div>
          </div>
          <div className="chips vertical top-space">
            {(vm.dynamicFocus.avoid_sectors || []).map((item) => <span key={item} className="chip chip-danger">{item}</span>)}
          </div>
          <div className="kv-list top-space compact">
            <div><span>单一 bucket 上限</span><strong>{fmtPct(vm.portfolio.riskControls?.max_bucket_exposure)}</strong></div>
            <div><span>单一持仓上限</span><strong>{fmtPct(vm.portfolio.riskControls?.max_single_position_exposure)}</strong></div>
          </div>
        </Card>
      </div>
    </div>
  )
}

function PortfolioPage({ vm }) {
  const columns = [
    { key: 'name', title: '标的', render: (row) => <><strong>{row.name}</strong><span className="subline">{row.symbol}</span></> },
    { key: 'bucket', title: '分类', render: (row) => mapLabel('bucket', row.bucket, row.bucket || '其他') },
    { key: 'shares', title: '股数' },
    { key: 'avg_cost', title: '成本', render: (row) => fmtMoney(row.avg_cost) },
    { key: 'current_price', title: '现价', render: (row) => fmtMoney(row.current_price) },
    { key: 'profit_rate', title: '盈亏', render: (row) => fmtPct(row.profit_rate) },
  ]
  const liveColumns = [
    { key: 'name', title: '标的', render: (row) => <><strong>{row.name}</strong><span className="subline">{row.symbol}</span></> },
    { key: 'shares', title: '股数' },
    { key: 'avg_cost', title: '成本', render: (row) => fmtMoney(row.avg_cost) },
    { key: 'current_price', title: '现价', render: (row) => fmtMoney(row.current_price) },
    { key: 'profit_rate', title: '盈亏', render: (row) => fmtPct(row.profit_rate) },
  ]
  return (
    <div className="stack-page">
      <div className="page-grid two-col">
        <Card>
          <SectionHeader title="策略快照持仓" subtitle="用于复盘与策略解释" />
          <Table columns={columns} rows={vm.holdings} rowKey="symbol" />
        </Card>
        <Card>
          <SectionHeader title="实时 InStreet 持仓" subtitle="用于确认盘面真实状态" />
          <Table columns={liveColumns} rows={vm.liveHoldings} rowKey="symbol" />
        </Card>
      </div>

      <div className="page-grid two-col">
        <Card>
          <SectionHeader title="仓位结构" subtitle="当前 bucket 暴露分布" />
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie data={vm.exposures} dataKey="value" nameKey="name" innerRadius={60} outerRadius={104} paddingAngle={2}>
                {vm.exposures.map((entry, index) => <Cell key={entry.name} fill={COLORS[index % COLORS.length]} />)}
              </Pie>
              <Tooltip formatter={(value) => fmtPct(value)} />
            </PieChart>
          </ResponsiveContainer>
          <div className="legend-grid">
            {vm.exposures.map((entry, index) => (
              <div key={entry.rawName} className="legend-item"><span className="legend-dot" style={{ backgroundColor: COLORS[index % COLORS.length] }} /><span>{entry.name}</span><strong>{fmtPct(entry.value)}</strong></div>
            ))}
          </div>
        </Card>
        <Card>
          <SectionHeader title="账户对照" subtitle="快照账户 vs 实时账户" />
          <div className="stats-grid compact two-up">
            <StatCard label="快照总资产" value={fmtMoney(vm.summary.totalValue)} tone="blue" />
            <StatCard label="实时总资产" value={fmtMoney(vm.liveSummary?.portfolio?.total_value)} tone="green" />
            <StatCard label="快照现金" value={fmtMoney(vm.summary.cash)} tone="cyan" />
            <StatCard label="实时现金" value={fmtMoney(vm.liveSummary?.portfolio?.cash)} tone="amber" />
          </div>
        </Card>
      </div>
    </div>
  )
}

function ValidationPage({ vm }) {
  return (
    <div className="stack-page">
      <div className="page-grid two-col">
        <Card>
          <SectionHeader title="验证模式分布" subtitle="系统有没有认真做模拟与回放" />
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={vm.auditModes}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="name" />
              <YAxis allowDecimals={false} />
              <Tooltip />
              <Bar dataKey="value" radius={[8, 8, 0, 0]} fill="#2563eb" />
            </BarChart>
          </ResponsiveContainer>
          <div className="mode-badges">
            {vm.auditModes.map((item) => <Badge key={item.rawName} tone="blue">{item.name}</Badge>)}
          </div>
        </Card>
        <Card>
          <SectionHeader title="审计样本资产轨迹" subtitle="按最近审计样本看资产变化" />
          <ResponsiveContainer width="100%" height={280}>
            <AreaChart data={vm.assetTrend}>
              <defs>
                <linearGradient id="assetFill" x1="0" x2="0" y1="0" y2="1">
                  <stop offset="5%" stopColor="#2563eb" stopOpacity={0.35} />
                  <stop offset="95%" stopColor="#2563eb" stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="name" />
              <YAxis />
              <Tooltip formatter={(value) => fmtMoney(value)} />
              <Area type="monotone" dataKey="totalValue" stroke="#2563eb" fill="url(#assetFill)" strokeWidth={3} />
            </AreaChart>
          </ResponsiveContainer>
        </Card>
      </div>

      <Card>
        <SectionHeader title="验证链路说明" subtitle="系统是怎么从输入走到结论的" />
        <div className="audit-flow">
          <div className="flow-step"><span>1</span><div><strong>真实输入</strong><p>组合、交易、榜单、新闻、行情</p></div></div>
          <div className="flow-step"><span>2</span><div><strong>规则提案</strong><p>规则层先给出初始动作与候选</p></div></div>
          <div className="flow-step"><span>3</span><div><strong>模型复核</strong><p>模型只做复核，不绕过硬风控</p></div></div>
          <div className="flow-step"><span>4</span><div><strong>审计留痕</strong><p>inputs / outputs / llm audit / logs 全保留</p></div></div>
        </div>
      </Card>
    </div>
  )
}

function HistoryPage({ vm }) {
  return (
    <div className="stack-page">
      <div className="page-grid three-col">
        <Card>
          <SectionHeader title="最近审计记录" subtitle="最近 8 条" />
          <div className="audit-list">
            {vm.history.audits.slice(0, 8).map((item) => (
              <div key={item.fileName} className="audit-row">
                <div>
                  <strong>{item.fileName}</strong>
                  <div className="subline">{fmtTime(item.updatedAt)} · {mapLabel('mode', item.mode, item.mode)}</div>
                </div>
                <div className="audit-mini">
                  <Badge tone={toneForAction(item.action)}>{mapLabel('action', item.action, item.action)}</Badge>
                  <span>{mapLabel('strategyState', item.strategyState, item.strategyState)}</span>
                </div>
              </div>
            ))}
          </div>
        </Card>

        <Card>
          <SectionHeader title="最近交易" subtitle="快照 + 实时合并显示" />
          <div className="audit-list">
            {[...vm.liveTrades, ...vm.trades].slice(0, 10).map((item, idx) => (
              <div key={`${item.symbol || idx}-${idx}`} className="trade-row">
                <div>
                  <strong>{item.name || item.symbol || '未知标的'}</strong>
                  <div className="subline">{item.symbol || '—'} · {mapLabel('status', item.status, item.status || '未知')}</div>
                </div>
                <div className="trade-side">
                  <Badge tone={toneForAction(item.action)}>{mapLabel('action', item.action, item.action)}</Badge>
                  <span>{item.shares || 0} 股</span>
                </div>
              </div>
            ))}
          </div>
        </Card>

        <Card>
          <SectionHeader title="最近新闻" subtitle="当前策略引用的新闻样本" />
          <div className="news-stack">
            {vm.news.slice(0, 8).map((item, idx) => (
              <a className="news-card" key={`${item.link}-${idx}`} href={item.link} target="_blank" rel="noreferrer">
                <span>{item.source}</span>
                <strong>{item.title}</strong>
              </a>
            ))}
          </div>
        </Card>
      </div>

      <div className="page-grid two-col">
        <Card>
          <SectionHeader title="最新日志尾部" subtitle="适合快速排查问题" />
          <pre className="console-block">{vm.latestRun.latestLogPreview || '暂无日志'}</pre>
        </Card>
        <Card>
          <SectionHeader title="最新分析帖正文" subtitle="用于复核对外输出是否一致" />
          <pre className="console-block">{vm.latestPostContent || '暂无正文'}</pre>
        </Card>
      </div>
    </div>
  )
}

function App() {
  const { localData, liveData, loading, liveLoading, error, liveError, refreshLive } = useDashboardData()
  const vm = useViewModel(localData, liveData)

  if (loading) return <div className="screen-state">正在加载 dashboard...</div>
  if (error || !vm) return <div className="screen-state error-state">加载失败：{error || '未知错误'}</div>

  return (
    <Layout vm={vm} liveLoading={liveLoading} liveError={liveError} refreshLive={refreshLive}>
      <Routes>
        <Route path="/" element={<Navigate to="/overview" replace />} />
        <Route path="/overview" element={<OverviewPage vm={vm} liveError={liveError} />} />
        <Route path="/strategy" element={<StrategyPage vm={vm} />} />
        <Route path="/portfolio" element={<PortfolioPage vm={vm} />} />
        <Route path="/validation" element={<ValidationPage vm={vm} />} />
        <Route path="/history" element={<HistoryPage vm={vm} />} />
      </Routes>
    </Layout>
  )
}

export default App
