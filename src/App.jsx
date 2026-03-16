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
import './App.css'

const COLORS = ['#2563eb', '#10b981', '#f59e0b', '#8b5cf6', '#ef4444', '#14b8a6']
const NAV_ITEMS = [
  ['overview', '总览'],
  ['strategy', '策略'],
  ['portfolio', '持仓'],
  ['validation', '验证'],
  ['history', '历史'],
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

function toneForAction(action) {
  if (action === 'buy') return 'green'
  if (action === 'sell') return 'red'
  if (action === 'hold') return 'amber'
  return 'slate'
}

function Badge({ children, tone = 'slate' }) {
  return <span className={`badge badge-${tone}`}>{children}</span>
}

function Panel({ id, title, subtitle, extra, children }) {
  return (
    <section id={id} className="panel">
      <div className="panel-header">
        <div>
          <h2>{title}</h2>
          {subtitle ? <p>{subtitle}</p> : null}
        </div>
        {extra ? <div className="panel-extra">{extra}</div> : null}
      </div>
      {children}
    </section>
  )
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

function App() {
  const { localData, liveData, loading, liveLoading, error, liveError, refreshLive } = useDashboardData()

  const exposures = useMemo(() => {
    const raw = localData?.portfolio?.bucketExposures || {}
    return Object.entries(raw).map(([name, value]) => ({ name, value: Number(value) }))
  }, [localData])

  const auditModes = useMemo(() => {
    const raw = localData?.history?.validation?.counts || {}
    return Object.entries(raw).map(([name, value]) => ({ name, value }))
  }, [localData])

  const assetTrend = useMemo(() => {
    const audits = (localData?.history?.audits || []).slice().reverse()
    return audits.map((item) => ({
      name: item.runId?.slice(-4) || item.fileName,
      totalValue: item.totalValue || 0,
      returnRate: (item.returnRate || 0) * 100,
    }))
  }, [localData])

  if (loading) return <div className="screen-state">正在加载 dashboard...</div>
  if (error || !localData) return <div className="screen-state error-state">加载失败：{error || '未知错误'}</div>

  const { summary, portfolio, latestRun, history, links, completedFeatures } = localData
  const signal = latestRun?.strategySignal || {}
  const dynamicFocus = latestRun?.dynamicFocus || {}
  const latestAudit = latestRun?.audit || {}
  const latestPostContent = latestAudit?.outputs?.generated_post_content || latestRun?.state?.last_generated_post_content || ''
  const holdings = portfolio?.holdings || []
  const trades = portfolio?.trades || []
  const news = latestRun?.news || []
  const liveSummary = liveData?.summary || {}
  const liveHoldings = liveSummary?.holdings || []
  const liveTrades = liveSummary?.trades || []
  const localPending = summary.pendingTrades || 0
  const livePending = liveSummary?.tradeSummary?.pending || 0

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
          {NAV_ITEMS.map(([id, label]) => (
            <a key={id} href={`#${id}`}>
              {label}
            </a>
          ))}
        </nav>

        <div className="sidebar-card">
          <div className="sidebar-title">当前策略</div>
          <strong>{summary.activeProfile || 'N/A'}</strong>
          <div className="sidebar-meta">状态机：{summary.strategyState}</div>
          <div className="sidebar-meta">建议切换：{summary.suggestedProfile || '无'}</div>
        </div>

        <div className="sidebar-card dark">
          <div className="sidebar-title">实时模式</div>
          <p>本地快照负责完整策略链路，实时数据负责当前盘面与账户状态。</p>
          <button className="ghost-button" onClick={refreshLive} disabled={liveLoading}>
            {liveLoading ? '实时刷新中…' : '刷新 InStreet 实时数据'}
          </button>
          {liveError ? <div className="inline-error">{liveError}</div> : null}
        </div>
      </aside>

      <main className="main-content">
        <header id="overview" className="hero-v2">
          <div className="hero-copy-block">
            <div className="hero-eyebrow">策略控制台 / Mixed Mode</div>
            <h2>把“策略推演”与“盘面现实”放在一张大盘里看清楚</h2>
            <p>
              这版 dashboard 同时展示两套数据源：
              <strong>本地策略快照</strong>（完整决策链、审计、状态机）和
              <strong>实时 InStreet 拉取</strong>（当前账户、持仓、交易状态）。
            </p>
            <div className="hero-links">
              {links.lastPostUrl ? <a href={links.lastPostUrl} target="_blank" rel="noreferrer">最新分析帖</a> : null}
              <a href={links.tradeLogWiki} target="_blank" rel="noreferrer">交易日志</a>
              <a href={links.overviewWiki} target="_blank" rel="noreferrer">持仓规划</a>
            </div>
          </div>

          <div className="hero-status-grid">
            <div className="hero-status-card bright">
              <span>本地策略快照</span>
              <strong>{fmtAgo(summary.freshness)}</strong>
              <small>最近一轮：{fmtTime(summary.lastRunAt)}</small>
            </div>
            <div className="hero-status-card">
              <span>实时 InStreet</span>
              <strong>{liveSummary?.pulledAt ? fmtTime(liveSummary.pulledAt) : '未获取'}</strong>
              <small>{liveError ? liveError : '每 60 秒自动刷新，可手动刷新'}</small>
            </div>
            <div className="hero-status-card">
              <span>本轮动作</span>
              <strong>{summary.latestAction}</strong>
              <small>{summary.latestReason}</small>
            </div>
          </div>
        </header>

        <section className="stats-grid v2">
          <StatCard label="策略快照总资产" value={fmtMoney(summary.totalValue)} hint={`收益率 ${fmtPct(summary.returnRate)}`} tone="blue" />
          <StatCard label="策略快照现金" value={fmtMoney(summary.cash)} hint={`持仓市值 ${fmtMoney(summary.holdingsValue)}`} tone="cyan" />
          <StatCard label="实时总资产" value={fmtMoney(liveSummary?.portfolio?.total_value)} hint={`实时现金 ${fmtMoney(liveSummary?.portfolio?.cash)}`} tone="green" />
          <StatCard label="待成交订单" value={`${localPending} / ${livePending}`} hint="左：快照，右：实时" tone="amber" />
        </section>

        <div className="panel-grid top-layout">
          <Panel id="strategy" title="策略大脑" subtitle="决策、动态关注、状态机和风控约束放在一起看">
            <div className="brain-layout">
              <div className="brain-main">
                <div className="decision-banner">
                  <div>
                    <div className="banner-label">当前结论</div>
                    <div className="banner-value">{summary.latestAction}</div>
                  </div>
                  <Badge tone={toneForAction(summary.latestAction)}>{summary.latestAction}</Badge>
                </div>
                <p className="banner-reason">{summary.latestReason}</p>

                <div className="mini-grid">
                  <div className="mini-card">
                    <div className="mini-label">市场结构</div>
                    <strong>{summary.marketRegime}</strong>
                  </div>
                  <div className="mini-card">
                    <div className="mini-label">状态机</div>
                    <strong>{signal.state || 'N/A'}</strong>
                  </div>
                  <div className="mini-card">
                    <div className="mini-label">建议切换</div>
                    <strong>{signal.last_suggested_profile || '无'}</strong>
                  </div>
                  <div className="mini-card">
                    <div className="mini-label">连续信号</div>
                    <strong>{signal.consecutive_same_suggestion || 0} / {signal.switch_signal_threshold || 0}</strong>
                  </div>
                </div>

                <div className="chip-section">
                  <div className="section-kicker">重点关注板块</div>
                  <div className="chips">
                    {(dynamicFocus.focus_sectors || []).map((item) => <span key={item} className="chip chip-primary">{item}</span>)}
                  </div>
                </div>

                <div className="focus-stack">
                  {(dynamicFocus.focus_stocks || []).slice(0, 4).map((item) => (
                    <article key={item.symbol} className="focus-card">
                      <div className="focus-head">
                        <strong>{item.name}</strong>
                        <span>{item.symbol}</span>
                      </div>
                      <p>{item.reason}</p>
                    </article>
                  ))}
                </div>
              </div>

              <div className="brain-side">
                <div className="side-card emphasis">
                  <div className="section-kicker">策略切换理由</div>
                  <p>{signal.switch_reason || '暂无'}</p>
                  <div className="side-meta">置信度：{signal.confidence || 'N/A'}</div>
                </div>
                <div className="side-card">
                  <div className="section-kicker">回避方向</div>
                  <div className="chips vertical">
                    {(dynamicFocus.avoid_sectors || []).map((item) => <span key={item} className="chip chip-danger">{item}</span>)}
                  </div>
                </div>
                <div className="side-card">
                  <div className="section-kicker">风控约束</div>
                  <div className="kv-list">
                    <div><span>单一 bucket 上限</span><strong>{fmtPct(portfolio.riskControls?.max_bucket_exposure)}</strong></div>
                    <div><span>单一持仓上限</span><strong>{fmtPct(portfolio.riskControls?.max_single_position_exposure)}</strong></div>
                    <div><span>当前策略模式</span><strong>{summary.lastMode || 'N/A'}</strong></div>
                  </div>
                </div>
              </div>
            </div>
          </Panel>

          <Panel title="数据源对照" subtitle="本地快照负责完整策略链；实时拉取负责盘面真相" extra={<Badge tone="blue">Mixed Mode</Badge>}>
            <div className="source-compare">
              <div className="source-card local">
                <div className="source-title">本地快照</div>
                <div className="source-value">{fmtTime(summary.lastRunAt)}</div>
                <ul>
                  <li>完整审计 inputs / outputs</li>
                  <li>可追溯 llm review / dynamic focus</li>
                  <li>包含 dry-run / replay 结果</li>
                  <li>稳定，适合复盘和验证</li>
                </ul>
              </div>
              <div className="source-card live">
                <div className="source-title">实时 InStreet</div>
                <div className="source-value">{liveSummary?.pulledAt ? fmtTime(liveSummary.pulledAt) : '未获取'}</div>
                <ul>
                  <li>当前账户与持仓状态</li>
                  <li>当前 pending / executed 交易数量</li>
                  <li>排行榜与主页最新拉取</li>
                  <li>适合盯盘时快速确认现实状态</li>
                </ul>
              </div>
            </div>
          </Panel>
        </div>

        <div className="panel-grid">
          <Panel id="portfolio" title="当前持仓与仓位结构" subtitle="左侧看策略快照下的持仓结构，右侧看实时账户和成交状态">
            <div className="split two">
              <div>
                <div className="subsection-title">策略快照持仓</div>
                <div className="table-shell cardish">
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
                          <td><strong>{item.name}</strong><span className="subline">{item.symbol}</span></td>
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
              </div>
              <div>
                <div className="subsection-title">Bucket 暴露</div>
                <div className="chart-card">
                  <ResponsiveContainer width="100%" height={280}>
                    <PieChart>
                      <Pie data={exposures} dataKey="value" nameKey="name" innerRadius={60} outerRadius={100} paddingAngle={2}>
                        {exposures.map((entry, index) => <Cell key={entry.name} fill={COLORS[index % COLORS.length]} />)}
                      </Pie>
                      <Tooltip formatter={(value) => fmtPct(value)} />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="legend-grid">
                    {exposures.map((entry, index) => (
                      <div key={entry.name} className="legend-item">
                        <span className="legend-dot" style={{ backgroundColor: COLORS[index % COLORS.length] }} />
                        <span>{entry.name}</span>
                        <strong>{fmtPct(entry.value)}</strong>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            <div className="subsection-title top-space">实时 InStreet 账户</div>
            <div className="stats-grid compact">
              <StatCard label="实时总资产" value={fmtMoney(liveSummary?.portfolio?.total_value)} tone="green" />
              <StatCard label="实时现金" value={fmtMoney(liveSummary?.portfolio?.cash)} tone="cyan" />
              <StatCard label="实时持仓市值" value={fmtMoney(liveSummary?.portfolio?.holdings_value)} tone="blue" />
              <StatCard label="实时收益率" value={fmtPct(liveSummary?.portfolio?.return_rate)} tone="purple" />
            </div>

            <div className="table-shell cardish top-space">
              <table>
                <thead>
                  <tr>
                    <th>实时持仓</th>
                    <th>股数</th>
                    <th>成本</th>
                    <th>现价</th>
                    <th>盈亏</th>
                  </tr>
                </thead>
                <tbody>
                  {liveHoldings.map((item) => (
                    <tr key={`live-${item.symbol}`}>
                      <td><strong>{item.name}</strong><span className="subline">{item.symbol}</span></td>
                      <td>{item.shares}</td>
                      <td>{fmtMoney(item.avg_cost)}</td>
                      <td>{fmtMoney(item.current_price)}</td>
                      <td>{fmtPct(item.profit_rate)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Panel>

          <Panel id="validation" title="模拟盘验证与审计链路" subtitle="这部分不是看盘，而是看系统有没有把流程跑对">
            <div className="split two">
              <div className="chart-card">
                <div className="subsection-title">模式分布</div>
                <ResponsiveContainer width="100%" height={260}>
                  <BarChart data={auditModes}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="name" />
                    <YAxis allowDecimals={false} />
                    <Tooltip />
                    <Bar dataKey="value" radius={[8, 8, 0, 0]} fill="#2563eb" />
                  </BarChart>
                </ResponsiveContainer>
                <div className="mode-badges">
                  <Badge tone={history.validation.hasLive ? 'green' : 'slate'}>live</Badge>
                  <Badge tone={history.validation.hasDryRun ? 'green' : 'slate'}>dry-run</Badge>
                  <Badge tone={history.validation.hasReplay ? 'green' : 'slate'}>replay</Badge>
                </div>
              </div>
              <div className="chart-card">
                <div className="subsection-title">资产轨迹（审计样本）</div>
                <ResponsiveContainer width="100%" height={260}>
                  <AreaChart data={assetTrend}>
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
              </div>
            </div>

            <div className="audit-flow">
              <div className="flow-step"><span>1</span><div><strong>真实输入</strong><p>portfolio / trades / leaderboard / news / quotes</p></div></div>
              <div className="flow-step"><span>2</span><div><strong>规则提案</strong><p>base_bundle 输出初始动作与候选</p></div></div>
              <div className="flow-step"><span>3</span><div><strong>模型复核</strong><p>llm_review 决定 buy / sell / hold 是否保留</p></div></div>
              <div className="flow-step"><span>4</span><div><strong>审计留痕</strong><p>inputs / outputs / llm_audit / logs 全部保留</p></div></div>
            </div>
          </Panel>
        </div>

        <div className="panel-grid bottom-layout">
          <Panel id="history" title="交易记录 / 日志 / 新闻 / 最近发帖" subtitle="把排障、复盘和日常查看放在一起">
            <div className="triple-grid">
              <div className="cardish padded">
                <div className="subsection-title">最近审计记录</div>
                <div className="audit-list">
                  {history.audits.slice(0, 8).map((item) => (
                    <div key={item.fileName} className="audit-row">
                      <div>
                        <strong>{item.fileName}</strong>
                        <div className="subline">{fmtTime(item.updatedAt)} · {item.mode}</div>
                      </div>
                      <div className="audit-mini">
                        <Badge tone={toneForAction(item.action)}>{item.action}</Badge>
                        <span>{item.strategyState}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="cardish padded">
                <div className="subsection-title">最近交易</div>
                <div className="audit-list">
                  {[...liveTrades, ...trades].slice(0, 8).map((item, idx) => (
                    <div key={`${item.symbol || idx}-${idx}`} className="trade-row">
                      <div>
                        <strong>{item.name || item.symbol || '未知标的'}</strong>
                        <div className="subline">{item.symbol || '—'} · {item.status || 'unknown'}</div>
                      </div>
                      <div className="trade-side">
                        <Badge tone={toneForAction(item.action)}>{item.action || 'N/A'}</Badge>
                        <span>{item.shares || 0} 股</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="cardish padded">
                <div className="subsection-title">最近新闻</div>
                <div className="news-stack">
                  {news.slice(0, 6).map((item, idx) => (
                    <a className="news-card" key={`${item.link}-${idx}`} href={item.link} target="_blank" rel="noreferrer">
                      <span>{item.source}</span>
                      <strong>{item.title}</strong>
                    </a>
                  ))}
                </div>
              </div>
            </div>

            <div className="split two top-space">
              <div className="cardish padded">
                <div className="subsection-title">最新日志尾部</div>
                <pre className="console-block">{latestRun.latestLogPreview || '暂无日志'}</pre>
              </div>
              <div className="cardish padded">
                <div className="subsection-title">最新分析帖正文</div>
                <pre className="console-block">{latestPostContent || '暂无正文'}</pre>
              </div>
            </div>
          </Panel>

          <Panel title="已完成流程覆盖" subtitle="这版控制台目前已经覆盖到的自动化能力">
            <div className="feature-wall">
              {completedFeatures.map((item) => (
                <article key={item.key} className="feature-tile">
                  <div className="feature-title-row">
                    <strong>{item.title}</strong>
                    <Badge tone="green">已完成</Badge>
                  </div>
                  <p>{item.desc}</p>
                </article>
              ))}
            </div>
          </Panel>
        </div>
      </main>
    </div>
  )
}

export default App
