import { Component, lazy, Suspense, useCallback, useEffect, useMemo, useState } from 'react'
import './App.css'

const COLORS = ['#2563eb', '#10b981', '#f59e0b', '#8b5cf6', '#ef4444', '#14b8a6']

const PortfolioExposureChart = lazy(() => import('./components/PortfolioExposureChart.jsx'))
const ValidationCharts = lazy(() => import('./components/ValidationCharts.jsx'))

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
  sellState: {
    idle: '空闲',
    observe_exit: '观察卖出信号',
    ready_to_trim: '已满足减仓条件',
    ready_to_exit: '已满足清仓条件',
    recovering: '恢复观察中',
  },
  alertLevel: {
    critical: '高危预警',
    warning: '重点预警',
    info: '观察提醒',
  },
  alertDirection: {
    risk: '风险',
    opportunity: '机会',
    mixed: '分化',
    bearish: '风险',
    bullish: '机会',
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
  { to: '/portfolio', label: '持仓页', desc: '当前持仓 / 仓位' },
  { to: '/validation', label: '验证页', desc: '历史验证' },
  { to: '/history', label: '历史页', desc: '审计 / 日志 / 新闻' },
  { to: '/config', label: '配置页', desc: '策略参数 / 大策略' },
]

function normalizeTabPath(pathname) {
  return NAV_ITEMS.find((item) => item.to === pathname)?.to || '/overview'
}

function getTabLabel(pathname) {
  return NAV_ITEMS.find((item) => item.to === pathname)?.label || '总览'
}

const TAB_STORAGE_KEY = 'instreet.console.tabs.v2'

function getDefaultTabs() {
  const initialPath = normalizeTabPath(window.location.pathname)
  return [{ path: initialPath, label: getTabLabel(initialPath) }]
}

function loadStoredTabs() {
  try {
    const raw = window.localStorage.getItem(TAB_STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw)
    if (!parsed || !Array.isArray(parsed.tabs) || !parsed.activeTab) return null
    const activeTab = normalizeTabPath(parsed.activeTab)
    const tabs = parsed.tabs
      .map((tab) => ({ path: normalizeTabPath(tab?.path), label: getTabLabel(tab?.path) }))
      .filter((tab, index, arr) => arr.findIndex((item) => item.path === tab.path) === index)
    if (!tabs.find((tab) => tab.path === activeTab)) {
      tabs.push({ path: activeTab, label: getTabLabel(activeTab) })
    }
    if (!tabs.length) return null
    return {
      tabs,
      activeTab,
    }
  } catch {
    return null
  }
}

function persistTabs(tabs, activeTab) {
  window.localStorage.setItem(TAB_STORAGE_KEY, JSON.stringify({ tabs, activeTab }))
}

function ensureSerializable(value, path = 'patch') {
  if (value === undefined) throw new Error(`${path} 里存在 undefined，不能保存`)
  if (typeof value === 'number' && !Number.isFinite(value)) throw new Error(`${path} 里存在非法数字`)
  if (Array.isArray(value)) {
    value.forEach((item, index) => ensureSerializable(item, `${path}[${index}]`))
    return
  }
  if (value && typeof value === 'object') {
    Object.entries(value).forEach(([key, item]) => ensureSerializable(item, `${path}.${key}`))
  }
}

class TabErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { error: null }
  }

  static getDerivedStateFromError(error) {
    return { error }
  }

  componentDidUpdate(prevProps) {
    if (prevProps.resetKey !== this.props.resetKey && this.state.error) {
      this.setState({ error: null })
    }
  }

  render() {
    if (this.state.error) {
      return (
        <div className="content-error-state">
          <strong>这个标签页加载失败了</strong>
          <p>{this.state.error.message || '渲染过程中发生未知错误'}</p>
          <button type="button" className="ghost-inline-button" onClick={() => {
            this.setState({ error: null })
            this.props.onRetry?.()
          }}>
            重试当前标签
          </button>
        </div>
      )
    }
    return this.props.children
  }
}

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
    key: 'alert_layer',
    title: '预警层引擎',
    subtitle: '控制持仓 + 候选池预警的冷却、展示上限、共振门槛，以及对卖出保护动作的耦合。',
    fields: [
      { path: 'enabled', label: '启用预警层', type: 'boolean' },
      { path: 'cooldown_minutes', label: '冷却去重分钟数', type: 'number', help: '同一标的相同类型预警在冷却期内不重复提醒。' },
      { path: 'top_candidate_count', label: '纳入重点预警扫描的候选数', type: 'number' },
      { path: 'max_items', label: '预警总展示上限', type: 'number' },
      { path: 'max_alerts_per_scope', label: '每个范围最多展示预警数', type: 'number', help: '持仓和候选池分别保留多少条预警。' },
      { path: 'min_resonance_count', label: '最少共振条件数', type: 'number', help: '至少命中多少条规则后，才视为多条件共振。' },
      { path: 'resonance_warning_score', label: 'Warning 共振分阈值', type: 'number' },
      { path: 'resonance_critical_score', label: 'Critical 共振分阈值', type: 'number' },
      { path: 'candidate_min_score_floor', label: '候选池预警最低分地板', type: 'number' },
      { path: 'profit_protect_trigger', label: '利润保护启动阈值', type: 'number' },
      { path: 'profit_drawdown_warning', label: '利润回撤 Warning 阈值', type: 'number' },
      { path: 'profit_drawdown_critical', label: '利润回撤 Critical 阈值', type: 'number' },
      { path: 'allow_protective_trim', label: '允许预警层触发保护性减仓', type: 'boolean', help: '开启后，critical 持仓风险预警可在规则层直接提出保护性减仓。' },
      { path: 'protective_trim_fraction', label: '保护性减仓比例', type: 'number' },
      { path: 'protective_trim_profit_floor', label: '保护性减仓最低浮盈要求', type: 'number', help: '除非是回撤保护型预警，否则至少达到这个浮盈后才触发保护性减仓。' },
      { path: 'notify_in_summary', label: '在巡检摘要中展示预警统计', type: 'boolean' },
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
  {
    key: 'candidate_pool',
    title: '动态发现池',
    subtitle: '控制固定白名单外的事件池候选如何被发现和加权。',
    fields: [
      { path: 'enable_dynamic_discovery', label: '启用动态发现', type: 'boolean' },
      { path: 'max_dynamic_candidates', label: '最多动态候选数', type: 'number' },
      { path: 'leader_discovery_weight', label: '榜单发现权重', type: 'number' },
      { path: 'recent_trade_discovery_weight', label: '近期交易发现权重', type: 'number' },
      { path: 'news_discovery_weight', label: '新闻发现权重', type: 'number' },
      { path: 'event_discovery_bonus', label: '事件池额外加分', type: 'number' },
    ],
  },
  {
    key: 'sell_state_machine',
    title: '卖出状态机',
    subtitle: '控制减仓 / 清仓需要连续满足几轮条件。',
    fields: [
      { path: 'confirm_runs_trim', label: '减仓确认轮数', type: 'number' },
      { path: 'confirm_runs_exit', label: '清仓确认轮数', type: 'number' },
      { path: 'recovery_reset_threshold', label: '恢复后重置阈值', type: 'number' },
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
  {
    key: 'alert_rules',
    title: '预警阈值模板',
    subtitle: '控制涨跌幅、量能、回撤保护、均线偏离和候选池触发门槛。',
    fields: [
      { path: 'alert_rules.holding_price_up', label: '持仓上冲阈值', type: 'number' },
      { path: 'alert_rules.holding_price_down', label: '持仓下跌阈值', type: 'number' },
      { path: 'alert_rules.candidate_price_up', label: '候选池突破阈值', type: 'number' },
      { path: 'alert_rules.candidate_price_down', label: '候选池走弱阈值', type: 'number' },
      { path: 'alert_rules.volume_ratio_hot', label: '放量阈值', type: 'number' },
      { path: 'alert_rules.volume_ratio_cold', label: '缩量阈值', type: 'number' },
      { path: 'alert_rules.drawdown_activation_profit', label: '回撤保护启动浮盈', type: 'number' },
      { path: 'alert_rules.drawdown_from_peak', label: '浮盈回撤保护阈值', type: 'number', help: '持仓相对阶段峰值回撤超过这个比例时触发保护预警。' },
      { path: 'alert_rules.price_drawdown_from_peak', label: '价格回撤保护阈值', type: 'number' },
      { path: 'alert_rules.candidate_min_score', label: '候选池最低分', type: 'number', help: '候选股至少达到这个分数，技术预警才进入重点展示。' },
      { path: 'alert_rules.ma_negative_bias_pct', label: '均线负乖离阈值', type: 'number' },
      { path: 'alert_rules.ma_positive_bias_pct', label: '均线正乖离阈值', type: 'number' },
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

function toneForAlert(level) {
  if (level === 'critical') return 'red'
  if (level === 'warning') return 'amber'
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

function ChartFallback({ height = 300, text = '图表加载中…' }) {
  return <div className="chart-fallback" style={{ minHeight: `${height}px` }}>{text}</div>
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

function AlertFeed({ alerts = [], emptyText = '当前没有预警' }) {
  if (!alerts.length) return <div className="subline">{emptyText}</div>
  return (
    <div className="focus-stack">
      {alerts.map((item, idx) => (
        <article key={`${item.symbol || idx}-${idx}`} className="focus-card">
          <div className="focus-head">
            <strong>{item.name}</strong>
            <div className="alert-badges-inline">
              <Badge tone={toneForAlert(item.level)}>{mapLabel('alertLevel', item.level, item.level)}</Badge>
              <Badge tone={item.direction === 'risk' || item.direction === 'bearish' ? 'red' : item.direction === 'opportunity' || item.direction === 'bullish' ? 'green' : 'blue'}>
                {mapLabel('alertDirection', item.direction, item.direction)}
              </Badge>
            </div>
          </div>
          <p>{item.headline || item.summary}</p>
          <div className="subline">{item.symbol} / {item.scope === 'holding' ? '持仓' : '候选池'} / 共振 {item.resonance_count ?? '—'} 项</div>
          {item.conditions?.length ? (
            <div className="chips vertical top-space">
              {item.conditions.slice(0, 4).map((condition, conditionIdx) => (
                <span key={`${item.symbol}-${conditionIdx}`} className={`chip ${condition.direction === 'risk' || condition.direction === 'bearish' ? 'chip-danger' : 'chip-primary'}`}>
                  {condition.text}
                </span>
              ))}
            </div>
          ) : null}
        </article>
      ))}
    </div>
  )
}

function InfoHint({ text }) {
  return (
    <span className="info-hint" tabIndex={0} aria-label={text}>
      <span className="info-hint-icon" aria-hidden="true">?</span>
      <span className="info-tooltip" role="tooltip">{text}</span>
    </span>
  )
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

function routeToPageKey(pathname) {
  if (pathname === '/strategy') return 'strategy'
  if (pathname === '/portfolio') return 'portfolio'
  if (pathname === '/validation') return 'validation'
  if (pathname === '/history') return 'history'
  if (pathname === '/config') return 'config'
  return 'overview'
}

function useDashboardData(pathname) {
  const pageKey = routeToPageKey(pathname)
  const [pageCache, setPageCache] = useState({})
  const [shellData, setShellData] = useState(null)
  const [configData, setConfigData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [pageLoading, setPageLoading] = useState(false)
  const [configLoading, setConfigLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [configError, setConfigError] = useState('')
  const [saveMessage, setSaveMessage] = useState('')

  const loadShell = useCallback(async (initial = false) => {
    try {
      if (initial) setLoading(true)
      const res = await fetch('/api/shell')
      const json = await readApiResponse(res)
      setShellData(json)
      setError('')
      return json
    } catch (err) {
      setError(err.message || '壳层数据加载失败')
      throw err
    } finally {
      if (initial) setLoading(false)
    }
  }, [])

  const loadPage = useCallback(async (currentPage, initial = false) => {
    try {
      if (initial) setLoading(true)
      else setPageLoading(true)
      const res = await fetch(`/api/pages/${currentPage}`)
      const json = await readApiResponse(res)
      setPageCache((prev) => ({ ...prev, [currentPage]: json }))
      setError('')
      return json
    } catch (err) {
      setError(err.message || '页面数据加载失败')
      throw err
    } finally {
      setLoading(false)
      setPageLoading(false)
    }
  }, [])

  const loadConfig = useCallback(async () => {
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
  }, [])

  const activePageData = pageCache[pageKey] || null

  useEffect(() => {
    if (!shellData) {
      loadShell(true).catch(() => {})
    }
    const timer = setInterval(() => loadShell().catch(() => {}), 30000)
    return () => clearInterval(timer)
  }, [loadShell, shellData])

  useEffect(() => {
    if (!activePageData) {
      loadPage(pageKey, !shellData).catch(() => {})
    }
    const timer = setInterval(() => loadPage(pageKey).catch(() => {}), 30000)
    return () => clearInterval(timer)
  }, [pageKey, loadPage, activePageData, shellData])

  useEffect(() => {
    if (pageKey === 'config') loadConfig()
  }, [pageKey, loadConfig])

  async function saveConfig(url, payload, successText) {
    try {
      ensureSerializable(payload)
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
      await Promise.all([loadPage('config'), loadShell()])
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
    pageData: activePageData,
    shellData,
    configData,
    loading,
    pageLoading,
    configLoading,
    saving,
    error,
    configError,
    saveMessage,
    refreshPage: () => Promise.all([loadPage(pageKey), loadShell()]),
    refreshConfig: loadConfig,
    updateManifest,
    updateProfile,
    updateActiveProfile,
  }
}

function Layout({ vm, tabs, activeTab, onOpenTab, onCloseTab, onCloseOtherTabs, onCloseRightTabs, pageLoading, pageError, refreshPage, children }) {
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
            <button
              key={item.to}
              type="button"
              className={`sidebar-nav-item ${activeTab === item.to ? 'active' : ''}`}
              onClick={() => onOpenTab(item.to, item.label)}
            >
              <strong>{item.label}</strong>
              <span>{item.desc}</span>
            </button>
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
          <div className="sidebar-title">数据刷新</div>
          <p>页面优先展示当前可用数据；如果实时接口失败，才回退到最近一次可用结果。</p>
          <button className="ghost-button" onClick={refreshPage} disabled={pageLoading}>
            {pageLoading ? '刷新中…' : '刷新当前页面'}
          </button>
          {pageError ? <div className="inline-error">{pageError}</div> : null}
        </div>

        <div className="sidebar-footnote">当前页面：{tabs.find((t) => t.path === activeTab)?.label || '总览'}</div>
      </aside>
      <main className="main-content">
        <div className="tab-strip-shell">
          <div className="tab-strip">
            {tabs.map((tab) => (
              <div
                key={tab.path}
                className={`tab-item ${activeTab === tab.path ? 'active' : ''}`}
                onClick={() => onOpenTab(tab.path, tab.label)}
              >
                <span className="tab-label">{tab.label}</span>
                <button
                  type="button"
                  className="tab-close"
                  onClick={(e) => onCloseTab(tab.path, e)}
                  aria-label={`关闭 ${tab.label}`}
                >
                  ×
                </button>
              </div>
            ))}
          </div>
          <div className="tab-strip-tools">
            <button type="button" className="ghost-inline-button compact" onClick={refreshPage} disabled={pageLoading}>刷新当前标签</button>
            <button type="button" className="ghost-inline-button compact" onClick={onCloseOtherTabs} disabled={tabs.length <= 1}>关闭其他</button>
            <button type="button" className="ghost-inline-button compact" onClick={onCloseRightTabs} disabled={tabs.findIndex((tab) => tab.path === activeTab) === tabs.length - 1}>关闭右侧</button>
          </div>
        </div>
        <div className="tab-status-bar">
          <span>当前标签：{tabs.find((tab) => tab.path === activeTab)?.label || '总览'}</span>
          <span>数据时间：{vm.summary?.asOf ? fmtTime(vm.summary.asOf) : fmtTime(vm.summary?.lastRunAt)}</span>
          <span>{pageLoading ? '右侧内容刷新中…' : '仅右侧内容区刷新'}</span>
        </div>
        <div className="tab-content">{children}</div>
      </main>
    </div>
  )
}

function OverviewPage({ vm }) {
  const alertLayer = vm.alertLayer || {}
  const alertSummary = alertLayer.summary || {}

  return (
    <>
      <header className="hero-v2">
        <div className="hero-copy-block">
          <div className="hero-eyebrow">策略控制台</div>
          <h2>先看当前状态，再看策略细节</h2>
          <p>
            这版 dashboard 已按页面拆分接口。你可以分别查看总览、策略、持仓、验证和历史，
            页面优先展示当前可用数据，接口失败时才回退到最近一次可用结果。
          </p>
          <div className="hero-links">
            {vm.links.lastPostUrl ? <a href={vm.links.lastPostUrl} target="_blank" rel="noreferrer">最新分析帖</a> : null}
            <a href={vm.links.tradeLogWiki} target="_blank" rel="noreferrer">本轮交易日志</a>
            <a href={vm.links.tradeLogRootWiki} target="_blank" rel="noreferrer">交易日志目录</a>
            <a href={vm.links.overviewWiki} target="_blank" rel="noreferrer">持仓规划</a>
          </div>
        </div>

        <div className="hero-status-grid">
          <div className="hero-status-card bright">
            <span>数据时间</span>
            <strong>{fmtTime(vm.summary.asOf)}</strong>
            <small>{vm.summary.fallbackReason || '当前页面已完成刷新'}</small>
          </div>
          <div className="hero-status-card">
            <span>最新决策</span>
            <strong>{mapLabel('action', vm.summary.latestDecisionAction, vm.summary.latestDecisionAction)}</strong>
            <small>{vm.summary.latestDecisionReason || '暂无'}</small>
          </div>
          <div className="hero-status-card">
            <span>执行结果</span>
            <strong>{vm.summary.latestExecutionLabel || '暂无'}</strong>
            <small>{vm.summary.latestExecutionDetail || '暂无'}</small>
          </div>
          {vm.summary.alertTotal > 0 ? (
            <div className="hero-status-card">
              <span>预警</span>
              <strong className={vm.summary.criticalAlerts > 0 ? 'text-red' : (vm.summary.warningAlerts > 0 ? 'text-amber' : '')}>{vm.summary.alertTotal} 条</strong>
              <small>Critical {vm.summary.criticalAlerts} / Warning {vm.summary.warningAlerts}</small>
            </div>
          ) : null}
        </div>
      </header>

      <section className="stats-grid v2">
        <StatCard label="总资产" value={fmtMoney(vm.summary.totalValue)} hint={`收益率 ${fmtPct(vm.summary.returnRate)}`} tone="blue" />
        <StatCard label="可用现金" value={fmtMoney(vm.summary.cash)} hint={`持仓市值 ${fmtMoney(vm.summary.holdingsValue)}`} tone="cyan" />
        <StatCard label="持仓市值" value={fmtMoney(vm.summary.holdingsValue)} hint={`当前待成交 ${vm.summary.pendingTrades || 0} 笔`} tone="green" />
        <StatCard label="待成交订单" value={vm.summary.pendingTrades || 0} hint="仅在接口失败时回退到最近一次可用结果" tone="amber" />
        <StatCard label="当前预警数" value={vm.summary.alertTotal || 0} hint={`高危 ${vm.summary.criticalAlerts || 0} / 重点 ${vm.summary.warningAlerts || 0}`} tone="red" />
        <StatCard label="共振预警" value={alertSummary.resonance_count || 0} hint={`冷却去重压掉 ${alertSummary.suppressed_count || 0} 条`} tone="purple" />
      </section>

      <div className="page-grid two-col">
        <Card>
          <SectionHeader title="今日概况" subtitle="先看结论，再看细节" extra={<Badge tone={toneForAction(vm.summary.latestDecisionAction)}>{mapLabel('action', vm.summary.latestDecisionAction)}</Badge>} />
          <div className="kv-list compact">
            <div><span>下次运行将使用</span><strong>{mapLabel('profile', vm.summary.configuredProfile, vm.summary.configuredProfile)}</strong></div>
            <div><span>上次运行实际使用</span><strong>{mapLabel('profile', vm.summary.lastRunProfile, vm.summary.lastRunProfile || '无')}</strong></div>
            <div><span>最新决策</span><strong>{mapLabel('action', vm.summary.latestDecisionAction, vm.summary.latestDecisionAction)}</strong></div>
            <div><span>实际执行</span><strong>{vm.summary.latestExecutionLabel}</strong></div>
            <div><span>执行细节</span><strong>{vm.summary.latestExecutionDetail}</strong></div>
            <div><span>市场结构</span><strong>{mapLabel('regime', vm.summary.marketRegime, vm.summary.marketRegime)}</strong></div>
            <div><span>策略状态</span><strong>{mapLabel('strategyState', vm.summary.strategyState, vm.summary.strategyState)}</strong></div>
            <div><span>数据时间</span><strong>{fmtTime(vm.summary.asOf)}</strong></div>
          </div>
        </Card>

        <Card>
          <SectionHeader title="系统链路" subtitle="页面按接口拆分，展示优先取当前可用数据" />
          <div className="source-compare">
            <div className="source-card local">
              <div className="source-title">页面接口</div>
              <div className="source-value">按 Tab 单独返回</div>
              <ul>
                <li>总览、策略、持仓、验证、历史分别取数</li>
                <li>避免一个接口返回整站全部数据</li>
                <li>每个页面可以独立刷新</li>
              </ul>
            </div>
            <div className="source-card live">
              <div className="source-title">数据策略</div>
              <div className="source-value">当前可用优先</div>
              <ul>
                <li>实时接口可用时优先展示当前数据</li>
                <li>接口失败时自动回退到最近一次可用结果</li>
                <li>不再在页面上强调“快照 / 实时”对照</li>
              </ul>
            </div>
          </div>
        </Card>
      </div>

      <div className="page-grid two-col">
        <Card>
          <SectionHeader title="盘中 / 巡检预警摘要" subtitle="这一层先报警，再温和影响扩仓与保护动作" extra={<Badge tone={toneForAlert(vm.summary.criticalAlerts ? 'critical' : vm.summary.warningAlerts ? 'warning' : 'info')}>{vm.summary.alertTotal || 0} 条</Badge>} />
          <div className="kv-list compact">
            <div><span>高危预警</span><strong>{vm.summary.criticalAlerts || 0}</strong></div>
            <div><span>重点预警</span><strong>{vm.summary.warningAlerts || 0}</strong></div>
            <div><span>观察提醒</span><strong>{vm.summary.infoAlerts || 0}</strong></div>
            <div><span>持仓预警</span><strong>{alertSummary.holding_count || 0}</strong></div>
            <div><span>候选池预警</span><strong>{alertSummary.candidate_count || 0}</strong></div>
            <div><span>冷却去重压掉</span><strong>{alertSummary.suppressed_count || 0}</strong></div>
          </div>
        </Card>

        <Card>
          <SectionHeader title="预警高亮" subtitle="优先展示最近一轮最值得盯的几条" />
          <AlertFeed alerts={(alertLayer.alerts || []).slice(0, 3)} emptyText="当前没有高优先级预警" />
        </Card>
      </div>
    </>
  )
}

function StrategyPage({ vm }) {
  const pendingContext = vm.diagnostics?.pendingContext || {}
  const regimeFeatures = vm.diagnostics?.regimeFeatures || {}
  const candidateUniverse = vm.diagnostics?.candidateUniverse || []
  const scoredCandidates = vm.diagnostics?.scoredCandidates || []
  const exitCandidates = vm.diagnostics?.exitCandidates || []
  const sellStateRows = Object.entries(vm.diagnostics?.sellState?.symbols || {}).map(([symbol, row]) => ({ symbol, ...row }))
  const protectionWatchlist = vm.diagnostics?.protectionWatchlist || []
  const protectiveSellCandidate = vm.diagnostics?.protectiveSellCandidate || null
  const technicalOverlay = vm.diagnostics?.technicalOverlay || {}
  const marketSentimentOverlay = vm.diagnostics?.marketSentimentOverlay || {}
  const alertLayer = vm.alertLayer || vm.diagnostics?.alertLayer || {}
  const alertSummary = alertLayer.summary || {}
  const overlaySourceRunAt = vm.diagnostics?.overlaySourceRunAt || vm.summary?.lastRunAt

  return (
    <div className="stack-page">
      <Card>
        <SectionHeader title="策略大脑" subtitle="决策、信号、风控和关注方向" extra={<Badge tone={toneForState(vm.signal.state)}>{mapLabel('strategyState', vm.signal.state, vm.signal.state)}</Badge>} />
        <div className="decision-banner">
          <div>
            <div className="banner-label">最新决策</div>
            <div className="banner-value smallish">{mapLabel('action', vm.summary.latestDecisionAction, vm.summary.latestDecisionAction)}</div>
          </div>
          <Badge tone={toneForAction(vm.summary.latestDecisionAction)}>{mapLabel('action', vm.summary.latestDecisionAction)}</Badge>
        </div>
        <p className="banner-reason">{vm.summary.latestDecisionReason}</p>
        <p className="banner-reason">实际执行：{vm.summary.latestExecutionLabel}；{vm.summary.latestExecutionDetail}</p>
        <div className="mini-grid top-space">
          <div className="mini-card"><div className="mini-label">市场结构</div><strong>{mapLabel('regime', vm.summary.marketRegime, vm.summary.marketRegime)}</strong></div>
          <div className="mini-card"><div className="mini-label">下次运行将使用</div><strong>{mapLabel('profile', vm.summary.configuredProfile, vm.summary.configuredProfile)}</strong></div>
          <div className="mini-card"><div className="mini-label">上次运行实际使用</div><strong>{mapLabel('profile', vm.summary.lastRunProfile, vm.summary.lastRunProfile || '无')}</strong></div>
          <div className="mini-card"><div className="mini-label">建议切换</div><strong>{mapLabel('profile', vm.signal.last_suggested_profile, vm.signal.last_suggested_profile || '无')}</strong></div>
          <div className="mini-card"><div className="mini-label">连续信号</div><strong>{vm.signal.consecutive_same_suggestion || 0} / {vm.signal.switch_signal_threshold || 0}</strong></div>
          <div className="mini-card"><div className="mini-label">Pending 资金冻结</div><strong>{fmtMoney(pendingContext.reserved_cash)}</strong></div>
          <div className="mini-card"><div className="mini-label">预警总数</div><strong>{vm.summary.alertTotal || 0}</strong></div>
          <div className="mini-card"><div className="mini-label">高危 / 重点</div><strong>{vm.summary.criticalAlerts || 0} / {vm.summary.warningAlerts || 0}</strong></div>
        </div>
        {protectiveSellCandidate ? (
          <div className="side-card emphasis top-space no-shadow">
            <div className="section-kicker">预警保护动作</div>
            <p>{protectiveSellCandidate.name} 已进入保护性减仓候选，计划减 {protectiveSellCandidate.shares} 股。</p>
            <div className="side-meta">{protectiveSellCandidate.alert?.headline} / 预计换手 {fmtPct(protectiveSellCandidate.projected_turnover)}</div>
          </div>
        ) : null}
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
            <div><span>上涨广度</span><strong>{fmtPct(regimeFeatures.breadth_positive)}</strong></div>
            <div><span>下跌广度</span><strong>{fmtPct(regimeFeatures.breadth_negative)}</strong></div>
          </div>
        </Card>
      </div>

      <div className="page-grid two-col">
        <Card>
          <SectionHeader title="Pending 订单上下文" subtitle="现在不会再因为一笔 pending 全局停机，而是按标的和冻结资金细分处理" />
          <div className="kv-list compact">
            <div><span>Pending 数量</span><strong>{pendingContext.pending_count || 0}</strong></div>
            <div><span>冻结资金</span><strong>{fmtMoney(pendingContext.reserved_cash)}</strong></div>
            <div><span>Pending 买入标的</span><strong>{(pendingContext.pending_buy_symbols || []).join(', ') || '无'}</strong></div>
            <div><span>Pending 卖出标的</span><strong>{(pendingContext.pending_sell_symbols || []).join(', ') || '无'}</strong></div>
          </div>
        </Card>

        <Card>
          <SectionHeader title="动态候选池" subtitle="固定白名单之外，被榜单 / 近期交易 / 新闻补出来的事件池候选" />
          <div className="focus-stack">
            {candidateUniverse.filter((item) => item.layer === 'event').slice(0, 6).map((item) => (
              <article key={item.symbol} className="focus-card">
                <div className="focus-head"><strong>{item.name}</strong><span>{item.symbol}</span></div>
                <p>{mapLabel('bucket', item.bucket, item.bucket)} / 发现原因：{(item.discovery_reasons || []).join('、') || '暂无'}</p>
              </article>
            ))}
            {!candidateUniverse.some((item) => item.layer === 'event') ? <div className="subline">当前没有新增事件池候选</div> : null}
          </div>
        </Card>
      </div>

      <div className="page-grid two-col">
        <Card>
          <SectionHeader title="持仓预警" subtitle="先盯持仓里的风险 / 机会共振" extra={<Badge tone={toneForAlert(vm.summary.criticalAlerts ? 'critical' : vm.summary.warningAlerts ? 'warning' : 'info')}>{alertSummary.holding_count || 0} 条</Badge>} />
          <AlertFeed alerts={(alertLayer.holding_alerts || []).slice(0, 6)} emptyText="当前持仓没有新的预警" />
        </Card>

        <Card>
          <SectionHeader title="候选池预警" subtitle="这些票先报警，并轻微影响买入打分与拦截逻辑" extra={<Badge tone="blue">{alertSummary.candidate_count || 0} 条</Badge>} />
          <AlertFeed alerts={(alertLayer.candidate_alerts || []).slice(0, 6)} emptyText="当前候选池没有新的预警" />
        </Card>
      </div>

      <div className="page-grid two-col">
        <Card>
          <SectionHeader title="候选归因 Top 3" subtitle="为什么系统认为这些股票值得买；预警层现在会对候选分数做轻微校准" />
          <div className="focus-stack">
            {scoredCandidates.slice(0, 3).map((item) => (
              <article key={item.symbol} className="focus-card">
                <div className="focus-head"><strong>{item.name}</strong><span>{item.symbol} / 总分 {item.score}</span></div>
                <p>{mapLabel('bucket', item.bucket, item.bucket)} · {mapLabel('layer', item.layer, item.layer)}</p>
                {item.raw_score !== undefined ? <p className="subline">原始分 {item.raw_score} / 预警层调整 {item.alert_adjustment > 0 ? '+' : ''}{item.alert_adjustment || 0}</p> : null}
                {item.alert_adjustment_reasons?.length ? <div className="chips">{item.alert_adjustment_reasons.map((reason, idx) => <span key={`${item.symbol}-alert-${idx}`} className={`chip ${(item.alert_adjustment || 0) >= 0 ? 'chip-primary' : 'chip-danger'}`}>{reason}</span>)}</div> : null}
                <div className="chips vertical">
                  {(item.score_breakdown || []).slice(0, 5).map((part, idx) => (
                    <span key={`${item.symbol}-${idx}`} className={`chip ${part.delta >= 0 ? 'chip-primary' : 'chip-danger'}`}>{part.label}: {part.delta > 0 ? '+' : ''}{part.delta}</span>
                  ))}
                </div>
              </article>
            ))}
            {!scoredCandidates.length ? <div className="subline">当前没有可展示的候选归因</div> : null}
          </div>
        </Card>

        <Card>
          <SectionHeader title="卖出状态机 / 保护观察" subtitle="高危持仓预警会优先进入保护观察，先限制扩仓，再决定是否推进卖出链路" />
          <div className="focus-stack">
            {protectionWatchlist.slice(0, 4).map((item) => (
              <article key={`protect-${item.symbol}`} className="focus-card">
                <div className="focus-head"><strong>{item.name}</strong><Badge tone="red">保护观察</Badge></div>
                <p>{item.headline}</p>
                <div className="subline">{item.summary}</div>
              </article>
            ))}
            {sellStateRows.slice(0, 6).map((item) => (
              <article key={item.symbol} className="focus-card">
                <div className="focus-head"><strong>{item.symbol}</strong><Badge tone={item.state?.includes('ready') ? 'red' : 'amber'}>{mapLabel('sellState', item.state, item.state)}</Badge></div>
                <p>主因：{item.primary_reason_kind || '暂无'} / 连续触发：{item.trigger_streak || 0} / 要求：{item.required_runs || 0}</p>
              </article>
            ))}
            {!protectionWatchlist.length && !sellStateRows.length ? <div className="subline">当前没有处于卖出观察链路的标的</div> : null}
          </div>
        </Card>
      </div>

      {(technicalOverlay?.items && Object.keys(technicalOverlay.items).length > 0) || (marketSentimentOverlay?.items && Object.keys(marketSentimentOverlay.items).length > 0) || (vm.diagnostics?.alertLayer?.alerts?.length > 0) ? (
        <Card>
          <SectionHeader title="技术面 / 资金流 / 预警层" subtitle={`多条件共振预警层${overlaySourceRunAt ? ` · ${fmtTime(overlaySourceRunAt)}` : ''}`} />
          <div className="page-grid two-col">
            {technicalOverlay?.items && Object.keys(technicalOverlay.items).length > 0 ? (
              <div>
                <h4>技术面（趋势/MACD/RSI/量能）</h4>
                <div className="focus-stack">
                  {Object.values(technicalOverlay.items).slice(0, 5).map((item) => (
                    <article key={item.symbol} className="focus-card">
                      <div className="focus-head"><strong>{item.name}</strong><span>{item.symbol}</span></div>
                      <p>{item.summary}</p>
                      {item.signal_reasons?.length ? <div className="chips">{item.signal_reasons.slice(0,2).map((r,i)=><span key={i} className="chip chip-primary">{r}</span>)}</div> : null}
                      {item.risk_factors?.length ? <div className="chips">{item.risk_factors.slice(0,2).map((r,i)=><span key={i} className="chip chip-danger">{r}</span>)}</div> : null}
                    </article>
                  ))}
                </div>
              </div>
            ) : null}
            {marketSentimentOverlay?.items && Object.keys(marketSentimentOverlay.items).length > 0 ? (
              <div>
                <h4>资金流 / 龙虎榜</h4>
                <div className="focus-stack">
                  {Object.values(marketSentimentOverlay.items).slice(0, 5).map((item) => (
                    <article key={item.symbol} className="focus-card">
                      <div className="focus-head"><strong>{item.name}</strong><span>{item.symbol}</span></div>
                      <p>{item.summary}</p>
                      {item.positive_factors?.length ? <div className="chips">{item.positive_factors.slice(0,2).map((r,i)=><span key={i} className="chip chip-primary">{r}</span>)}</div> : null}
                      {item.risk_factors?.length ? <div className="chips">{item.risk_factors.slice(0,2).map((r,i)=><span key={i} className="chip chip-danger">{r}</span>)}</div> : null}
                    </article>
                  ))}
                </div>
              </div>
            ) : null}
          </div>
          {vm.diagnostics?.alertLayer?.alerts?.length > 0 ? (
            <div className="page-grid two-col top-space">
              <div>
                <h4>🔔 预警层（多条件共振 / 冷却去重）</h4>
                <div className="stats-grid compact two-up top-space">
                  <StatCard label="Critical" value={vm.diagnostics?.alertLayer?.summary?.critical || 0} tone="red" />
                  <StatCard label="Warning" value={vm.diagnostics?.alertLayer?.summary?.warning || 0} tone="amber" />
                </div>
                <div className="focus-stack top-space">
                  {vm.diagnostics.alertLayer.alerts.slice(0, 6).map((item) => (
                    <article key={`${item.scope}-${item.symbol}`} className="focus-card">
                      <div className="focus-head"><strong>{item.name}</strong><span>{item.symbol} / {item.scope}</span><Badge tone={item.level === 'critical' ? 'red' : (item.level === 'warning' ? 'amber' : 'blue')}>{item.level}</Badge></div>
                      <p>{item.summary}</p>
                      {item.conditions?.length ? <div className="chips vertical">{item.conditions.slice(0, 3).map((c, i) => <span key={i} className={`chip ${c.direction === 'bullish' ? 'chip-primary' : (c.direction === 'bearish' ? 'chip-danger' : '')}`}>{c.text}</span>)}</div> : null}
                    </article>
                  ))}
                </div>
              </div>
            </div>
          ) : null}
        </Card>
      ) : null}

      {exitCandidates.length ? (
        <Card>
          <SectionHeader title="当前卖出候选" subtitle="已经满足执行条件的减仓 / 清仓候选" />
          <div className="focus-stack">
            {exitCandidates.slice(0, 4).map((item) => (
              <article key={item.symbol} className="focus-card">
                <div className="focus-head"><strong>{item.name}</strong><span>{item.symbol}</span></div>
                <p>{item.decision_reason}</p>
              </article>
            ))}
          </div>
        </Card>
      ) : null}
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
  const tradeColumns = [
    { key: 'name', title: '标的', render: (row) => <><strong>{row.name || row.symbol}</strong><span className="subline">{row.symbol || '—'}</span></> },
    { key: 'action', title: '动作', render: (row) => mapLabel('action', row.action, row.action || '未知') },
    { key: 'status', title: '状态', render: (row) => mapLabel('status', row.status, row.status || '未知') },
    { key: 'shares', title: '股数', render: (row) => row.shares || 0 },
  ]
  return (
    <div className="stack-page">
      <div className="page-grid two-col">
        <Card>
          <SectionHeader title="当前持仓" subtitle="页面优先展示当前可用的持仓结果" />
          <Table columns={columns} rows={vm.holdings} rowKey="symbol" />
        </Card>
        <Card>
          <SectionHeader title="账户概况" subtitle="当前资产与仓位结构" />
          <div className="stats-grid compact two-up">
            <StatCard label="总资产" value={fmtMoney(vm.summary.totalValue)} tone="blue" />
            <StatCard label="可用现金" value={fmtMoney(vm.summary.cash)} tone="green" />
            <StatCard label="持仓市值" value={fmtMoney(vm.summary.holdingsValue)} tone="cyan" />
            <StatCard label="待成交" value={vm.summary.pendingTrades || 0} tone="amber" />
          </div>
        </Card>
      </div>

      <div className="page-grid two-col">
        <Card>
          <SectionHeader title="仓位结构" subtitle="当前 bucket 暴露分布" />
          <Suspense fallback={<ChartFallback height={300} />}>
            <PortfolioExposureChart exposures={vm.exposures} colors={COLORS} fmtPct={fmtPct} />
          </Suspense>
        </Card>
        <Card>
          <SectionHeader title="最近交易" subtitle="当前页面优先展示当前可用交易结果" />
          <Table columns={tradeColumns} rows={(vm.trades || []).slice(0, 8)} rowKey="id" />
        </Card>
      </div>
    </div>
  )
}

function ValidationPage({ vm }) {
  return (
    <div className="stack-page">
      <div className="page-grid two-col">
        <Suspense fallback={<ChartFallback height={320} />}>
          <ValidationCharts auditModes={vm.auditModes} assetTrend={vm.assetTrend} fmtMoney={fmtMoney} />
        </Suspense>
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
          <SectionHeader title="最近交易" subtitle="优先展示当前可用交易结果" />
          <div className="audit-list">
            {(vm.trades || []).slice(0, 10).map((item, idx) => (
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

      <div className="page-grid three-col">
        <Card>
          <SectionHeader title="最近预警" subtitle="保留最新一轮预警快照，便于复盘" />
          <AlertFeed alerts={(vm.alertLayer?.alerts || []).slice(0, 6)} emptyText="当前没有预警快照" />
        </Card>
        <Card>
          <SectionHeader title="最新日志尾部" subtitle="适合快速排查问题" />
          <pre className="console-block">{vm.latestLogPreview || '暂无日志'}</pre>
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
  const [activeTab, setActiveTab] = useState('engine')

  if (configLoading && !configData) return <div className="screen-state">正在加载策略配置…</div>
  if (!configData) return <div className="screen-state error-state">配置加载失败：{configError || '未知错误'}</div>

  const activeProfile = configData.profiles.find((item) => item.profile_id === configData.activeProfileId) || configData.profiles[0]
  const tabItems = [
    { key: 'engine', label: '全局引擎', desc: `${MANIFEST_SECTION_DEFS.length} 组运行参数` },
    { key: 'profile', label: '当前策略模板', desc: activeProfile ? activeProfile.label : '暂无 active profile' },
    { key: 'watchlist', label: '固定股票池', desc: `${activeProfile?.watchlist?.length || 0} 个标的` },
  ]

  return (
    <div className="stack-page config-page">
      <header className="config-command-bar">
        <div className="config-command-copy">
          <div className="hero-eyebrow">策略配置中心 / Live Editable</div>
          <h2>把配置页改成真正可读、可调、可解释的控制台</h2>
          <p>
            这版不再把所有内容都挤成一长串卡片，而是拆成“全局引擎 / 当前策略模板 / 固定股票池”三块。
            感叹号也改成了前端自带 tooltip，鼠标移上去或键盘聚焦时可以直接看到解释文字。
          </p>
        </div>

        <div className="config-command-side">
          <div className="command-metric active">
            <span>下次运行将使用</span>
            <strong>{mapLabel('profile', configData.activeProfileId, activeProfile?.label || configData.activeProfileId)}</strong>
            <small>{activeProfile?.thesis || '暂无策略说明'}</small>
          </div>
          <div className="command-metric">
            <span>配置源</span>
            <strong>{configData.strategyRoot}</strong>
            <small>修改后会直接写回 JSON 配置文件</small>
          </div>
          <div className="command-metric">
            <span>保存状态</span>
            <strong>{saveMessage || '尚未修改'}</strong>
            <small>{configError || '需要时可以手动刷新配置数据'}</small>
          </div>
        </div>
      </header>

      <section className="config-toolbar-shell">
        <div className="config-tabs" role="tablist" aria-label="配置分区切换">
          {tabItems.map((tab) => (
            <button
              key={tab.key}
              type="button"
              role="tab"
              aria-selected={activeTab === tab.key}
              className={`config-tab ${activeTab === tab.key ? 'active' : ''}`}
              onClick={() => setActiveTab(tab.key)}
            >
              <strong>{tab.label}</strong>
              <span>{tab.desc}</span>
            </button>
          ))}
        </div>
        <div className="config-toolbar-actions">
          <Badge tone={saving ? 'amber' : 'blue'}>{saving ? '保存中' : '可编辑'}</Badge>
          <button className="ghost-inline-button" onClick={onRefresh}>刷新配置</button>
        </div>
      </section>

      {activeTab === 'engine' ? (
        <div className="config-stage stack-page">
          <Card className="card-flat card-highlight">
            <SectionHeader title="量化大策略切换" subtitle="先决定下一轮策略运行用哪一套模板，再细调参数。" />
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

          <div className="page-grid two-col config-section-grid">
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
        </div>
      ) : null}

      {activeTab === 'profile' && activeProfile ? (
        <div className="config-stage stack-page">
          <Card className="card-flat card-highlight">
            <SectionHeader title={`当前编辑策略：${activeProfile.label}`} subtitle="这一页只展示 active profile 的核心模板参数，方便集中调这一套策略。" />
            <div className="stats-grid compact two-up profile-summary-grid">
              <StatCard label="profile_id" value={activeProfile.profile_id} hint="修改时会直接写回对应 profile JSON" tone="purple" />
              <StatCard label="固定股票池" value={`${activeProfile.watchlist?.length || 0} 个`} hint="包含 symbol / bucket / layer / preferred" tone="blue" />
            </div>
          </Card>

          <div className="page-grid two-col config-section-grid">
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
        </div>
      ) : null}

      {activeTab === 'watchlist' && activeProfile ? (
        <div className="config-stage stack-page">
          <WatchlistCard
            title="固定股票池 (Watchlist)"
            subtitle="把 symbol、分类、偏好和层级放到一个更像表格编辑器的区域里，而不是继续塞进竖向卡片流。"
            source={activeProfile.watchlist || []}
            saving={saving}
            onSave={(patch) => onUpdateProfile(activeProfile.profile_id, { watchlist: patch })}
          />
        </div>
      ) : null}
    </div>
  )
}

function App() {
  const storedTabsState = useMemo(() => loadStoredTabs(), [])
  const [tabs, setTabs] = useState(() => storedTabsState?.tabs || getDefaultTabs())
  const [activeTab, setActiveTab] = useState(() => storedTabsState?.activeTab || normalizeTabPath(window.location.pathname))

  const {
    pageData,
    shellData,
    configData,
    loading,
    pageLoading,
    configLoading,
    saving,
    error,
    configError,
    saveMessage,
    refreshPage,
    refreshConfig,
    updateManifest,
    updateProfile,
    updateActiveProfile,
  } = useDashboardData(activeTab)

  const activeTabIndex = useMemo(() => tabs.findIndex((tab) => tab.path === activeTab), [tabs, activeTab])

  const openTab = useCallback((path, label) => {
    const normalizedPath = normalizeTabPath(path)
    const normalizedLabel = label || getTabLabel(normalizedPath)
    setTabs((prev) => {
      const existing = prev.find((t) => t.path === normalizedPath)
      if (existing) return prev
      return [...prev, { path: normalizedPath, label: normalizedLabel }]
    })
    setActiveTab(normalizedPath)
    window.history.replaceState(null, '', normalizedPath)
  }, [])

  const closeTab = useCallback((path, e) => {
    e?.stopPropagation()
    setTabs((prev) => {
      if (prev.length === 1) return prev
      const newTabs = prev.filter((t) => t.path !== path)
      if (activeTab === path && newTabs.length > 0) {
        const idx = prev.findIndex((t) => t.path === path)
        const newActive = newTabs[Math.max(0, idx - 1)]?.path || newTabs[0]?.path
        setActiveTab(newActive)
        window.history.replaceState(null, '', newActive)
      }
      return newTabs
    })
  }, [activeTab])

  const closeOtherTabs = useCallback(() => {
    setTabs((prev) => prev.filter((tab) => tab.path === activeTab))
  }, [activeTab])

  const closeRightTabs = useCallback(() => {
    setTabs((prev) => prev.filter((_, index) => index <= activeTabIndex))
  }, [activeTabIndex])

  useEffect(() => {
    persistTabs(tabs, activeTab)
  }, [tabs, activeTab])

  useEffect(() => {
    if (window.location.pathname === '/' && activeTab === '/overview') {
      window.history.replaceState(null, '', '/overview')
    }
  }, [activeTab])

  if (loading && !shellData) return <div className="screen-state">正在加载 dashboard...</div>

  const shellVm = shellData || pageData
  if (!shellVm) return <div className="screen-state error-state">加载失败：{error || '未知错误'}</div>

  const renderPage = () => {
    if (activeTab === '/config') {
      return <ConfigPage configData={configData} configLoading={configLoading} configError={configError} saveMessage={saveMessage} saving={saving} onRefresh={refreshConfig} onUpdateManifest={updateManifest} onUpdateProfile={updateProfile} onUpdateActiveProfile={updateActiveProfile} />
    }

    if (!pageData) {
      return <div className="content-loading-state">正在加载 {getTabLabel(activeTab)}…</div>
    }

    switch (activeTab) {
      case '/overview':
        return <OverviewPage vm={pageData} />
      case '/strategy':
        return <StrategyPage vm={pageData} />
      case '/portfolio':
        return <PortfolioPage vm={pageData} />
      case '/validation':
        return <ValidationPage vm={pageData} />
      case '/history':
        return <HistoryPage vm={pageData} />
      default:
        return <OverviewPage vm={pageData} />
    }
  }

  return (
    <Layout
      vm={shellVm}
      tabs={tabs}
      activeTab={activeTab}
      onOpenTab={openTab}
      onCloseTab={closeTab}
      onCloseOtherTabs={closeOtherTabs}
      onCloseRightTabs={closeRightTabs}
      pageLoading={pageLoading}
      pageError={pageData?.summary?.fallbackReason || shellVm.summary?.fallbackReason || error}
      refreshPage={refreshPage}
    >
      <TabErrorBoundary resetKey={activeTab} onRetry={refreshPage}>
        {renderPage()}
      </TabErrorBoundary>
    </Layout>
  )
}

export default App
