import { Bar, BarChart as ReBarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'

export function BarChart({
  data,
  xKey,
  bars,
  height = 260,
}: {
  data: Record<string, string | number>[]
  xKey: string
  bars: { key: string; name: string; color: string }[]
  height?: number
}) {
  return (
    <div style={{ height }} className="min-w-0 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <ReBarChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -18 }} barGap={4}>
          <CartesianGrid stroke="#E3E5DC" strokeDasharray="4 6" vertical={false} />
          <XAxis dataKey={xKey} tickLine={false} axisLine={false} tick={{ fill: '#777E73', fontSize: 11 }} dy={8} />
          <YAxis tickLine={false} axisLine={false} tick={{ fill: '#777E73', fontSize: 11 }} width={52} />
          <Tooltip
            cursor={{ fill: '#E6EBDD', fillOpacity: 0.5 }}
            contentStyle={{ borderRadius: 16, border: '1px solid #E3E5DC', fontSize: 12 }}
            labelStyle={{ color: '#263328', fontWeight: 700 }}
          />
          {bars.map((bar) => (
            <Bar
              key={bar.key}
              dataKey={bar.key}
              name={bar.name}
              fill={bar.color}
              radius={[8, 8, 0, 0]}
              maxBarSize={22}
              animationDuration={850}
            />
          ))}
        </ReBarChart>
      </ResponsiveContainer>
    </div>
  )
}
