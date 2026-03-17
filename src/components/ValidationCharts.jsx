import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'

function ValidationCharts({ auditModes, assetTrend, fmtMoney }) {
  return (
    <>
      <section className="card">
        <div className="section-header">
          <div>
            <h2>最近运行模式统计</h2>
            <p>最近几次记录里，实盘 / 模拟 / 回放各有多少次</p>
          </div>
        </div>
        <ResponsiveContainer width="100%" height={280}>
          <BarChart data={auditModes}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} />
            <XAxis dataKey="name" />
            <YAxis allowDecimals={false} />
            <Tooltip />
            <Bar dataKey="value" radius={[8, 8, 0, 0]} fill="#2563eb" />
          </BarChart>
        </ResponsiveContainer>
        <div className="mode-badges">
          {auditModes.map((item) => <span key={item.rawName} className="badge badge-blue">{item.name}</span>)}
        </div>
      </section>

      <section className="card">
        <div className="section-header">
          <div>
            <h2>最近审计记录里的总资产变化</h2>
            <p>横轴是审计时间，纵轴是当时总资产；这不是实时收益曲线</p>
          </div>
        </div>
        <ResponsiveContainer width="100%" height={280}>
          <AreaChart data={assetTrend}>
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
      </section>
    </>
  )
}

export default ValidationCharts
