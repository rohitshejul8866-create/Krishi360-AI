import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { CHART_COLORS } from '../../data/analytics'

export function TrendChart({
  data,
  xKey,
  yKey,
  color = CHART_COLORS.sage,
  name,
  height = 250,
}: {
  data: Record<string, string | number>[]
  xKey: string
  yKey: string
  color?: string
  name: string
  height?: number
}) {
  return (
    <div style={{ height }} className="min-w-0 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 8, right: 6, bottom: 0, left: -18 }}>
          <defs>
            <linearGradient id={`fill-${yKey}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity={0.42} />
              <stop offset="100%" stopColor={color} stopOpacity={0.02} />
            </linearGradient>
          </defs>
          <CartesianGrid stroke="#E3E5DC" strokeDasharray="4 6" vertical={false} />
          <XAxis dataKey={xKey} tickLine={false} axisLine={false} tick={{ fill: '#777E73', fontSize: 11 }} dy={8} />
          <YAxis tickLine={false} axisLine={false} tick={{ fill: '#777E73', fontSize: 11 }} width={56} />
          <Tooltip
            contentStyle={{ borderRadius: 16, border: '1px solid #E3E5DC', fontSize: 12 }}
            labelStyle={{ color: '#263328', fontWeight: 700 }}
          />
          <Area
            type="monotone"
            dataKey={yKey}
            name={name}
            stroke={color}
            strokeWidth={2.5}
            fill={`url(#fill-${yKey})`}
            activeDot={{ r: 5, fill: color, stroke: '#FFFFFF', strokeWidth: 2 }}
            animationDuration={900}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  )
}
