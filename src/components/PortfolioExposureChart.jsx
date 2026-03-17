import {
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
} from 'recharts'

function PortfolioExposureChart({ exposures, colors, fmtPct }) {
  return (
    <>
      <ResponsiveContainer width="100%" height={300}>
        <PieChart>
          <Pie data={exposures} dataKey="value" nameKey="name" innerRadius={60} outerRadius={104} paddingAngle={2}>
            {exposures.map((entry, index) => <Cell key={entry.name} fill={colors[index % colors.length]} />)}
          </Pie>
          <Tooltip formatter={(value) => fmtPct(value)} />
        </PieChart>
      </ResponsiveContainer>
      <div className="legend-grid">
        {exposures.map((entry, index) => (
          <div key={entry.rawName} className="legend-item">
            <span className="legend-dot" style={{ backgroundColor: colors[index % colors.length] }} />
            <span>{entry.name}</span>
            <strong>{fmtPct(entry.value)}</strong>
          </div>
        ))}
      </div>
    </>
  )
}

export default PortfolioExposureChart
