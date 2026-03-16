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
    coal_dividend: '煤炭红利',
    power_dividend: '电力红利',
    hydro_dividend: '水电红利',
    bank_dividend: '银行红利',
    telecom_dividend: '通信红利',
    finance: '金融',
    insurance: '保险金融',
    tech_manufacturing: '科技制造',
    consumer_electronics: '消费电子',
    electronics: '电子',
    ict_equipment: '通信设备',
    digital_security: '数字安防',
    new_energy: '新能源',
    new_energy_auto: '新能源车',
    energy_growth: '能源成长',
    infra_power: '基建电力',
    other: '其他',
  },
  layer: {
    core: '核心池',
    watch: '观察池',
    event: '事件池',
  },
  preferred: {
    true: '是',
    false: '否',
  },
}

const NAV_ITEMS = [
  { to: '/overview', label: '总览', desc: '今日概况' },
  { to: '/strategy', label: '策略页', desc: '信号与状态机' },
  { to: '/portfolio', label: '持仓页', desc: '快照 vs 实时' },
  { to: '/validation', label: '验证页', desc: 'dry-run / replay' },
  { to: '/history', label: '历史页', desc: '审计 / 日志 / 新闻' },
  { to: '/config', label: '配置页', desc: '策略参数 / 大策略' },
]

const MANIFEST_SECTION_DEFS = [
  {
    key: 'dynamic_focus',
    title: '动态关注层',
    subtitle: '控制重点板块、重点股票和切换信号的灵敏度。',
    fields: [
      { path: 'enabled', label: '启用动态关注', type: 'boolean' },
      { path: 'max_focus_sectors', label: '最多关注板块数', type: 'number' },
      { path: 'max_focus_stocks', label: '最多关注股票数', type: 'number' },
      { path: 'max_avoid_sectors', label: '最多回避方向数', type: 'number' },
      { path: 'switch_signal_threshold', label: '切换信号阈值', type: 'number', help: '连续多少轮都指向同一大策略，才算切换信号足够强。' },
      { path: 'confidence_required', label: '最低置信度', type: 'select', options: ['low', 'medium', 'high'], help: '动态关注层只有达到这个置信等级，才允许推进切换判断。' },
    ],
  },
  {
    key: 'llm_review',
    title: 'LLM 最终复核',
    subtitle: '控制模型复核是否开启、多久超时，以及能否绕过硬风控。',
    fields: [
      { path: 'enabled', label: '启用模型复核', type: 'boolean' },
      { path: 'timeout_seconds', label: '超时秒数', type: 'number' },
      { path: 'hard_constraints_cannot_override', label: '禁止绕过硬风控', type: 'boolean', help: '开启后，模型只能复核，不能推翻程序化硬限制。' },
    ],
  },
  {
    key: 'news_filter',
    title: '新闻过滤',
    subtitle: '控制进入策略上下文的新闻质量。',
    fields: [
      { path: 'enabled', label: '启用新闻过滤', type: 'boolean' },
      { path: 'min_score', label: '最低新闻分数', type: 'number' },
      { path: 'max_items', label: '最多保留新闻数', type: 'number' },
      { path: 'dedupe', label: '去重', type: 'boolean' },
    ],
  },
  {
    key: 'community_signal',
    title: '社区信号',
    subtitle: '控制社区帖子进入上下文的范围与权重。',
    fields: [
      { path: 'include_in_llm_review', label: '进入最终复核上下文', type: 'boolean' },
      { path: 'prefer_watchlist_hits', label: '只偏好观察池命中', type: 'boolean', help: '开启后，社区帖子只有命中观察池标的才更容易进入上下文。' },
      { path: 'max_posts_dynamic_focus', label: '动态关注层最多帖子数', type: 'number' },
      { path: 'max_posts_post', label: '发帖层最多帖子数', type: 'number' },
    ],
  },
  {
    key: 'execution_hygiene',
    title: '执行卫生',
    subtitle: '控制交易冷静期与来回反手约束。',
    fields: [
      { path: 'buy_cooldown_minutes', label: '买入冷静期（分钟）', type: 'number', help: '同一标的刚买完后，多长时间内不再继续追买。' },
      { path: 'sell_cooldown_minutes', label: '卖出冷静期（分钟）', type: 'number' },
      { path: 'avoid_same_day_roundtrip', label: '避免当日反手', type: 'boolean' },
    ],
  },
  {
    key: 'strategy_state_machine',
    title: '策略状态机',
    subtitle: '控制大策略切换的推进方式。',
    fields: [
      { path: 'auto_switch', label: '自动切换大策略', type: 'boolean' },
      { path: 'manual_confirmation_required', label: '需要人工确认', type: 'boolean', help: '开启后，即使达到 switch_ready，也先通知而不自动切换。' },
      { path: 'notify_on_switch_ready', label: 'switch_ready 时通知', type: 'boolean' },
      { path: 'rollback_watch_rounds', label: '切换后回看轮数', type: 'number' },
      { path: 'switch_signal_threshold', label: '状态机切换阈值', type: 'number' },
    ],
  },
  {
    key: 'review_policy',
    title: '复核评分阈值',
    subtitle: '让模型更像评分器，而不是自由裁判。',
    fields: [
      { path: 'veto_risk_score_min', label: '否决风险阈值', type: 'number', help: '风险分超过这个值，直接否决交易。' },
      { path: 'min_candidate_score_to_allow_buy', label: '允许买入的最低候选分', type: 'number' },
      { path: 'min_position_score_to_allow_sell', label: '允许卖出的最低持仓分', type: 'number' },
    ],
  },
]

const PROFILE_SECTION_DEFS = [
  {
    key: 'core_text',
    title: '策略说明',
    subtitle: '给人看的大策略描述，会影响理解和人工复核。',
    fields: [
      { path: 'thesis', label: '投资主线 thesis', type: 'textarea' },
      { path: 'style', label: '执行风格 style', type: 'textarea' },
    ],
  },
  {
    key: 'trade_constraints',
    title: '交易约束',
    subtitle: '控制整体仓位、单次交易比例和交易频率。',
    fields: [
      { path: 'max_total_exposure', label: '总仓位上限', type: 'number', help: '组合允许实际持仓占总资产的最高比例。' },
      { path: 'target_trade_fraction', label: '单次目标交易比例', type: 'number', help: '每次买卖计划动用的目标资金比例。' },
      { path: 'lot_size', label: '最小交易手数', type: 'number' },
      { path: 'skip_if_pending', label: '有 pending 时跳过', type: 'boolean' },
      { path: 'max_daily_turnover_rate', label: '单日最大换手率', type: 'number' },
      { path: 'sell_observe_minutes', label: '卖出观察期（分钟）', type: 'number', help: '卖出后多长时间内禁止重新追入。' },
    ],
  },
  {
    key: 'risk_controls',
    title: '风险控制',
    subtitle: '控制单一 bucket、单票和再平衡触发带宽。',
    fields: [
      { path: 'max_bucket_exposure', label: '单一 bucket 上限', type: 'number', help: '同一类风格或行业在组合中的最高占比。' },
      { path: 'max_single_position_exposure', label: '单票上限', type: 'number' },
      { path: 'rebalance_band', label: '再平衡带宽', type: 'number', help: '偏离目标超过这条带宽，才触发再平衡。' },
    ],
  },
  {
    key: 'sell_rules',
    title: '卖出规则',
    subtitle: '控制止盈、止损和再平衡的敏感度。',
    fields: [
      { path: 'take_profit_profit_rate', label: '止盈收益率阈值', type: 'number' },
      { path: 'take_profit_day_change', label: '止盈日涨幅阈值', type: 'number' },
      { path: 'stop_loss_profit_rate', label: '止损收益率阈值', type: 'number' },
      { path: 'stop_loss_day_change', label: '止损日跌幅阈值', type: 'number' },
      { path: 'trim_fraction', label: '默认减仓比例', type: 'number' },
      { path: 'rebalance_trim_fraction', label: '再平衡减仓比例', type: 'number' },
    ],
  },
  {
    key: 'candidate_pool',
    title: '候选池与打分',
    subtitle: '控制候选分数门槛与候选池分层权重。',
    fields: [
      { path: 'scoring.min_score_to_buy', label: '最低买入分数', type: 'number' },
      { path: 'candidate_pool.require_whitelist_for_new', label: '新增标的需要白名单', type: 'boolean' },
      { path: 'candidate_pool.layer_weights.core', label: '核心池权重', type: 'number', help: '核心池 / 观察池 / 事件池的额外加分。' },
      { path: 'candidate_pool.layer_weights.watch', label: '观察池权重', type: 'number' },
      { path: 'candidate_pool.layer_weights.event', label: '事件池权重', type: 'number' },
    ],
  },
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

function fmtClock(value) {
  if (!value) return '未知时间'
  return new Date(value).toLocaleTimeString('zh-CN', {
    hour12: false,
    hour: '2-digit',
    minute: '2-digit',
  })
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

function InfoHint({ text }) {
  return <span className="info-hint" title={text}>!</span>
}

function getIn(obj, path) {
  return path.split('.').reduce((acc, key) => (acc == null ? acc : acc[key]), obj)
}

function setIn(obj, path, value) {
  const parts = path.split('.')
  const next = structuredClone(obj || {})
  let cursor = next
  for (let i = 0; i < parts.length - 1; i += 1) {
    const key = parts[i]
    if (!cursor[key] || typeof cursor[key] !== 'object' || Array.isArray(cursor[key])) cursor[key] = {}
    cursor = cursor[key]
  }
  cursor[parts.at(-1)] = value
  return next
}

function castValue(raw, type) {
  if (type === 'number') {
    if (raw === '' || raw === null || raw === undefined) return 0
    return Number(raw)
  }
  if (type === 'boolean') return Boolean(raw)
  return raw
}

async function readApiResponse(res) {
  const text = await res.text()
  const contentType = res.headers.get('content-type') || ''
  const isJson = contentType.includes('application/json')

  if (isJson) {
    const json = text ? JSON.parse(text) : null
    if (!res.ok) throw new Error(json?.error || `HTTP ${res.status}`)
    return json
  }

  const snippet = text.replace(/\s+/g, ' ').slice(0, 160)
  if (!res.ok) throw new Error(`HTTP ${res.status}${snippet ? `: ${snippet}` : ''}`)
  throw new Error(`接口没有返回 JSON，实际返回了 ${contentType || '未知类型'}：${snippet || 'empty response'}`)
}

function useDashboardData() {
  const [localData, setLocalData] = useState(null)
  const [liveData, setLiveData] = useState(null)
  const [configData, setConfigData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [liveLoading, setLiveLoading] = useState(false)
  const [configLoading, setConfigLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [liveError, setLiveError] = useState('')
  const [configError, setConfigError] = useState('')
  const [saveMessage, setSaveMessage] = useState('')

  async function loadLocal() {
    try {
      const res = await fetch('/api/overview')
      const json = await readApiResponse(res)
      setLocalData(json)
      setError('')
    } catch (err) {
      setError(err.message || '加载本地快照失败')
    } finally {
      setLoading(false)
    }
  }

  async function loadConfig() {
    try {
      setConfigLoading(true)
      const res = await fetch('/api/config')
      const json = await readApiResponse(res)
      setConfigData(json)
      setConfigError('')
    } catch (err) {
      setConfigError(err.message || '加载策略配置失败')
    } finally {
      setConfigLoading(false)
    }
  }

  useEffect(() => {
    let timer
    loadLocal()
    loadConfig()
    timer = setInterval(loadLocal, 30000)
    return () => clearInterval(timer)
  }, [])

  async function refreshLive() {
    try {
      setLiveLoading(true)
      const res = await fetch('/api/live')
      const json = await readApiResponse(res)
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

  async function saveConfig(url, payload, successText) {
    try {
      setSaving(true)
      setSaveMessage('')
      const res = await fetch(url, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const json = await readApiResponse(res)
      setConfigData(json)
      setConfigError('')
      setSaveMessage(successText)
      await loadLocal()
      return json
    } catch (err) {
      setConfigError(err.message || '保存配置失败')
      throw err
    } finally {
      setSaving(false)
    }
  }

  function updateManifest(patch) {
    return saveConfig('/api/config/manifest', { patch }, '全局策略参数已保存')
  }

  function updateProfile(profileId, patch) {
    return saveConfig(`/api/config/profiles/${profileId}`, { patch }, `策略 ${profileId} 参数已保存`)
  }

  function updateActiveProfile(profileId) {
    return saveConfig('/api/config/active-profile', { profileId }, `已切换量化大策略到 ${profileId}`)
  }

  return {
    localData,
    liveData,
    configData,
    loading,
    liveLoading,
    configLoading,
    saving,
    error,
    liveError,
    configError,
    saveMessage,
    refreshLive,
    refreshConfig: loadConfig,
    updateManifest,
    updateProfile,
    updateActiveProfile,
  }
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
      name: fmtClock(item.updatedAt || item.createdAt),
      totalValue: item.totalValue || 0,
      returnRate: (item.returnRate || 0) * 100,
      modeLabel: mapLabel('mode', item.mode, item.mode),
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
          <div className="sidebar-title">策略状态</div>
          <strong>下次运行将使用：{mapLabel('profile', vm.summary.configuredProfile, vm.summary.configuredProfile)}</strong>
          <div className="sidebar-meta">上次运行实际使用：{mapLabel('profile', vm.summary.lastRunProfile, vm.summary.lastRunProfile || '无')}</div>
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
            <div><span>下次运行将使用</span><strong>{mapLabel('profile', vm.summary.configuredProfile, vm.summary.configuredProfile)}</strong></div>
            <div><span>上次运行实际使用</span><strong>{mapLabel('profile', vm.summary.lastRunProfile, vm.summary.lastRunProfile || '无')}</strong></div>
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
          <div className="mini-card"><div className="mini-label">下次运行将使用</div><strong>{mapLabel('profile', vm.summary.configuredProfile, vm.summary.configuredProfile)}</strong></div>
          <div className="mini-card"><div className="mini-label">上次运行实际使用</div><strong>{mapLabel('profile', vm.summary.lastRunProfile, vm.summary.lastRunProfile || '无')}</strong></div>
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
          <SectionHeader title="最近运行模式统计" subtitle="最近几次记录里，实盘 / 模拟 / 回放各有多少次" />
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
          <SectionHeader title="最近审计记录里的总资产变化" subtitle="横轴是审计时间，纵轴是当时总资产；这不是实时收益曲线" />
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
              <YAxis tickFormatter={(value) => `${(Number(value) / 10000).toFixed(0)}万`} />
              <Tooltip
                formatter={(value) => fmtMoney(value)}
                labelFormatter={(label, payload) => {
                  const modeLabel = payload?.[0]?.payload?.modeLabel
                  return modeLabel ? `审计时间 ${label} · ${modeLabel}` : `审计时间 ${label}`
                }}
              />
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

function ConfigSectionCard({ title, subtitle, source, fields, onSave, saving }) {
  const [draft, setDraft] = useState({})

  useEffect(() => {
    const next = {}
    fields.forEach((field) => {
      const value = getIn(source || {}, field.path)
      next[field.path] = value ?? (field.type === 'boolean' ? false : '')
    })
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setDraft(next)
  }, [source, fields])

  async function handleSave() {
    let patch = {}
    fields.forEach((field) => {
      patch = setIn(patch, field.path, castValue(draft[field.path], field.type))
    })
    await onSave(patch)
  }

  return (
    <Card>
      <SectionHeader title={title} subtitle={subtitle} />
      <div className="config-grid">
        {fields.map((field) => (
          <label key={field.path} className={`config-field ${field.type === 'textarea' ? 'config-field-full' : ''}`}>
            <span className="config-label">{field.label}{field.help ? <InfoHint text={field.help} /> : null}</span>
            {field.type === 'boolean' ? (
              <input type="checkbox" checked={Boolean(draft[field.path])} onChange={(e) => setDraft((prev) => ({ ...prev, [field.path]: e.target.checked }))} />
            ) : field.type === 'select' ? (
              <select value={draft[field.path] ?? ''} onChange={(e) => setDraft((prev) => ({ ...prev, [field.path]: e.target.value }))}>
                {field.options.map((option) => <option key={option} value={option}>{option}</option>)}
              </select>
            ) : field.type === 'textarea' ? (
              <textarea value={draft[field.path] ?? ''} onChange={(e) => setDraft((prev) => ({ ...prev, [field.path]: e.target.value }))} rows={4} />
            ) : (
              <input type="number" step="0.01" value={draft[field.path] ?? ''} onChange={(e) => setDraft((prev) => ({ ...prev, [field.path]: e.target.value }))} />
            )}
          </label>
        ))}
      </div>
      <button className="save-button" onClick={handleSave} disabled={saving}>{saving ? '保存中…' : '保存这一组参数'}</button>
    </Card>
  )
}

function ObjectNumberCard({ title, subtitle, source, helpMap = {}, onSave, saving }) {
  const [draft, setDraft] = useState({})

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setDraft(source || {})
  }, [source])

  async function handleSave() {
    const patch = {}
    Object.entries(draft || {}).forEach(([key, value]) => {
      patch[key] = Number(value)
    })
    await onSave(patch)
  }

  return (
    <Card>
      <SectionHeader title={title} subtitle={subtitle} />
      <div className="config-grid">
        {Object.entries(draft || {}).map(([key, value]) => (
          <label key={key} className="config-field">
            <span className="config-label">{mapLabel('bucket', key, key)}{helpMap[key] ? <InfoHint text={helpMap[key]} /> : null}</span>
            <input type="number" step="0.01" value={value ?? ''} onChange={(e) => setDraft((prev) => ({ ...prev, [key]: e.target.value }))} />
          </label>
        ))}
      </div>
      <button className="save-button" onClick={handleSave} disabled={saving}>{saving ? '保存中…' : '保存这一组参数'}</button>
    </Card>
  )
}

function WatchlistCard({ title, subtitle, source, onSave, saving }) {
  const [draft, setDraft] = useState([])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setDraft(source || [])
  }, [source])

  const bucketOptions = [
    'energy_dividend', 'coal_dividend', 'power_dividend', 'hydro_dividend',
    'bank_dividend', 'telecom_dividend', 'finance', 'insurance',
    'tech_manufacturing', 'consumer_electronics', 'electronics', 'ict_equipment',
    'digital_security', 'new_energy', 'new_energy_auto', 'energy_growth',
    'infra_power', 'other',
  ]
  const layerOptions = ['core', 'watch', 'event']

  function updateRow(index, field, value) {
    setDraft((prev) => {
      const next = prev.slice()
      next[index] = { ...next[index], [field]: value }
      return next
    })
  }

  function addRow() {
    setDraft((prev) => [
      ...prev,
      { symbol: '', name: '', bucket: 'other', preferred: false, layer: 'watch' },
    ])
  }

  function deleteRow(index) {
    setDraft((prev) => prev.filter((_, i) => i !== index))
  }

  async function handleSave() {
    await onSave(draft)
  }

  return (
    <Card>
      {title ? <SectionHeader title={title} subtitle={subtitle} /> : null}
      <div className="watchlist-table">
        <div className="watchlist-header">
          <span>Symbol</span>
          <span>名称</span>
          <span>分类 Bucket</span>
          <span>偏好</span>
          <span>层级</span>
          <span>操作</span>
        </div>
        {draft.map((row, idx) => (
          <div key={idx} className="watchlist-row">
            <input
              type="text"
              value={row.symbol || ''}
              onChange={(e) => updateRow(idx, 'symbol', e.target.value)}
              placeholder="sh600000"
            />
            <input
              type="text"
              value={row.name || ''}
              onChange={(e) => updateRow(idx, 'name', e.target.value)}
              placeholder="股票名称"
            />
            <select value={row.bucket || 'other'} onChange={(e) => updateRow(idx, 'bucket', e.target.value)}>
              {bucketOptions.map((b) => <option key={b} value={b}>{mapLabel('bucket', b, b)}</option>)}
            </select>
            <select value={String(row.preferred)} onChange={(e) => updateRow(idx, 'preferred', e.target.value === 'true')}>
              <option value="true">是</option>
              <option value="false">否</option>
            </select>
            <select value={row.layer || 'watch'} onChange={(e) => updateRow(idx, 'layer', e.target.value)}>
              {layerOptions.map((l) => <option key={l} value={l}>{mapLabel('layer', l, l)}</option>)}
            </select>
            <button className="delete-button" onClick={() => deleteRow(idx)} title="删除此行">×</button>
          </div>
        ))}
        <button className="add-row-button" onClick={addRow}>+ 添加一行</button>
      </div>
      <button className="save-button" onClick={handleSave} disabled={saving}>{saving ? '保存中…' : '保存 Watchlist'}</button>
    </Card>
  )
}

function ConfigPage({ configData, configLoading, configError, saveMessage, saving, onRefresh, onUpdateManifest, onUpdateProfile, onUpdateActiveProfile }) {
  if (configLoading && !configData) return <div className="screen-state">正在加载策略配置…</div>
  if (!configData) return <div className="screen-state error-state">配置加载失败：{configError || '未知错误'}</div>

  const activeProfile = configData.profiles.find((item) => item.profile_id === configData.activeProfileId) || configData.profiles[0]

  return (
    <div className="stack-page config-page">
      <header className="hero-v2 config-hero">
        <div className="hero-copy-block">
          <div className="hero-eyebrow">策略配置中心 / Live Editable</div>
          <h2>看清每套量化策略的关键参数，也能直接在线调整</h2>
          <p>
            这里会直接读取真实策略配置文件。你可以切换量化大策略，也可以在线调整阈值、仓位、卖出规则和候选池权重。
            带感叹号的地方是容易误解的概念解释。
          </p>
        </div>
        <div className="hero-status-grid">
          <div className="hero-status-card bright">
            <span>下次运行将使用</span>
            <strong>{mapLabel('profile', configData.activeProfileId, activeProfile?.label || configData.activeProfileId)}</strong>
            <small>{activeProfile?.thesis || '暂无策略说明'}</small>
          </div>
          <div className="hero-status-card">
            <span>配置源</span>
            <strong>{configData.strategyRoot}</strong>
            <small>修改后会直接写回 JSON 配置文件</small>
          </div>
          <div className="hero-status-card">
            <span>保存状态</span>
            <strong>{saveMessage || '尚未修改'}</strong>
            <small>{configError || '你也可以手动刷新配置数据'}</small>
          </div>
        </div>
      </header>

      <Card>
        <SectionHeader title="量化大策略切换" subtitle="切换 active profile，影响下一轮策略运行所采用的大策略模板。" extra={<button className="ghost-inline-button" onClick={onRefresh}>刷新配置</button>} />
        <div className="profile-switch-grid">
          {configData.profileOptions.map((profile) => (
            <article key={profile.profile_id} className={`profile-switch-card ${configData.activeProfileId === profile.profile_id ? 'active' : ''}`}>
              <div>
                <strong>{profile.label}</strong>
                <div className="subline">{profile.profile_id}</div>
              </div>
              <p>{profile.thesis}</p>
              <button className="save-button slim" disabled={saving || configData.activeProfileId === profile.profile_id} onClick={() => onUpdateActiveProfile(profile.profile_id)}>
                {configData.activeProfileId === profile.profile_id ? '当前策略' : '切到这套策略'}
              </button>
            </article>
          ))}
        </div>
      </Card>

      <div className="page-grid two-col">
        {MANIFEST_SECTION_DEFS.map((section) => (
          <ConfigSectionCard
            key={section.key}
            title={section.title}
            subtitle={section.subtitle}
            source={configData.manifest?.[section.key]}
            fields={section.fields}
            saving={saving}
            onSave={(patch) => onUpdateManifest({ [section.key]: patch })}
          />
        ))}
      </div>

      {activeProfile ? (
        <>
          <Card>
            <SectionHeader title={`当前编辑策略：${activeProfile.label}`} subtitle="下面这部分是 active profile 的核心参数，改完会直接写回对应 profile JSON。" />
            <div className="kv-list compact">
              <div><span>profile_id</span><strong>{activeProfile.profile_id}</strong></div>
              <div><span>当前 thesis</span><strong>{activeProfile.thesis}</strong></div>
            </div>
          </Card>

          <div className="page-grid two-col">
            {PROFILE_SECTION_DEFS.map((section) => (
              <ConfigSectionCard
                key={section.key}
                title={section.title}
                subtitle={section.subtitle}
                source={activeProfile}
                fields={section.fields}
                saving={saving}
                onSave={(patch) => onUpdateProfile(activeProfile.profile_id, patch)}
              />
            ))}
            <ObjectNumberCard
              title="目标 bucket 配比"
              subtitle="系统希望长期维持的理想结构。"
              source={activeProfile.bucket_targets}
              saving={saving}
              onSave={(patch) => onUpdateProfile(activeProfile.profile_id, { bucket_targets: patch })}
            />
            <ObjectNumberCard
              title="bucket 最低配置"
              subtitle="某些关键方向至少要保留的底仓比例。"
              source={activeProfile.bucket_minimums}
              saving={saving}
              onSave={(patch) => onUpdateProfile(activeProfile.profile_id, { bucket_minimums: patch })}
            />
          </div>

          <Card>
            <SectionHeader
              title="固定股票池 (Watchlist)"
              subtitle="该策略的固定关注股票列表，包含 symbol、名称、分类、是否偏好、所在层级。"
            />
            <WatchlistCard
              source={activeProfile.watchlist || []}
              saving={saving}
              onSave={(patch) => onUpdateProfile(activeProfile.profile_id, { watchlist: patch })}
            />
          </Card>
        </>
      ) : null}
    </div>
  )
}

function App() {
  const {
    localData,
    liveData,
    configData,
    loading,
    liveLoading,
    configLoading,
    saving,
    error,
    liveError,
    configError,
    saveMessage,
    refreshLive,
    refreshConfig,
    updateManifest,
    updateProfile,
    updateActiveProfile,
  } = useDashboardData()
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
        <Route path="/config" element={<ConfigPage configData={configData} configLoading={configLoading} configError={configError} saveMessage={saveMessage} saving={saving} onRefresh={refreshConfig} onUpdateManifest={updateManifest} onUpdateProfile={updateProfile} onUpdateActiveProfile={updateActiveProfile} />} />
      </Routes>
    </Layout>
  )
}

export default App
