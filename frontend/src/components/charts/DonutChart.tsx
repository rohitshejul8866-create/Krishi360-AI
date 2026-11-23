import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts'

export function DonutChart({
  data,
  height = 240,
  centerLabel,
  centerValue,
}: {
  data: { name: string; value: number; color: string }[]
  height?: number
  centerLabel?: string
  centerValue?: string
}) {
  return (
    <div className="relative min-w-0 w-full" style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={data}
            dataKey="value"
            nameKey="name"
            innerRadius="62%"
            outerRadius="86%"
            paddingAngle={3}
            stroke="none"
            animationDuration={850}
          >
            {data.map((entry) => (
              <Cell key={entry.name} fill={entry.color} />
            ))}
          </Pie>
          <Tooltip contentStyle={{ borderRadius: 16, border: '1px solid #E3E5DC', fontSize: 12 }} />
        </PieChart>
      </ResponsiveContainer>
      {centerValue ? (
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-2xl font-extrabold tracking-tight text-ink">{centerValue}</span>
          {centerLabel ? <span className="mt-1 text-[11px] font-semibold text-muted">{centerLabel}</span> : null}
        </div>
      ) : null}
    </div>
  )
}
