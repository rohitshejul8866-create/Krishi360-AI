import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts'
import { Card, CardHeader } from '../ui/Card'
import { Sprout, TrendingUp } from 'lucide-react'
import { useApp } from '../../services/store'

export function GrowthProjectionChart() {
  const { farms } = useApp()
  const plots = farms.flatMap((farm) => farm.plots)

  const growthData = plots.map((plot) => {
    const totalDays = plot.crop === 'Wheat' ? 120 : plot.crop === 'Grapes' ? 140 : plot.crop === 'Tomato' ? 75 : 110
    const moisture = plot.soilMoisture ?? 35
    const daysElapsed = Math.round((moisture / 100) * totalDays * 0.8) + 15
    const daysRemaining = Math.max(10, totalDays - daysElapsed)
    return {
      cropPlot: `${plot.name} (${plot.crop})`,
      crop: plot.crop,
      plotName: plot.name,
      progress: moisture > 40 ? 65 : 45,
      daysElapsed,
      daysRemaining,
      totalDays,
      stage: plot.growthStage,
    }
  })

  return (
    <Card className="shadow-lg border-sage/40">
      <CardHeader
        title="Crop Growth Projection & Development Timeline"
        description="Expected timeline and progress breakdown for active plots across your farm."
        icon={<TrendingUp className="text-forest" size={19} />}
      />
      {growthData.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-10 text-center">
          <span className="flex size-11 items-center justify-center rounded-2xl bg-soft-sage text-forest">
            <Sprout size={20} />
          </span>
          <p className="mt-3 text-sm font-bold text-ink">No farm plots added yet</p>
          <p className="mt-1 text-xs text-muted">Add your plots and crops in My Farm to see crop growth timelines here.</p>
        </div>
      ) : (
        <div className="p-2 sm:p-4">
          <div className="h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={growthData} layout="vertical" margin={{ top: 10, right: 30, left: 30, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e3e5dc" />
                <XAxis type="number" domain={[0, 150]} unit=" days" stroke="#777e73" fontSize={11} />
                <YAxis dataKey="cropPlot" type="category" stroke="#263328" fontSize={12} width={130} />
                <Tooltip
                  content={({ active, payload }) => {
                    if (active && payload && payload.length) {
                      const data = payload[0].payload
                      return (
                        <div className="rounded-2xl border border-line bg-white p-3 shadow-lg text-xs">
                          <p className="font-extrabold text-ink">{data.cropPlot}</p>
                          <p className="mt-1 text-forest">Growth Stage: <strong>{data.stage}</strong></p>
                          <p className="text-muted">Days Elapsed: <strong>{data.daysElapsed} days</strong></p>
                          <p className="text-muted">Days to Harvest: <strong>{data.daysRemaining} days</strong></p>
                          <p className="text-muted">Total Crop Cycle: <strong>{data.totalDays} days</strong></p>
                        </div>
                      )
                    }
                    return null
                  }}
                />
                <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '10px' }} />
                <Bar dataKey="daysElapsed" name="Days Elapsed" stackId="a" fill="#344b35" radius={[4, 0, 0, 4]} />
                <Bar dataKey="daysRemaining" name="Days to Harvest" stackId="a" fill="#9caf88" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {growthData.map((item) => (
              <div key={item.cropPlot} className="rounded-2xl border border-line/70 bg-white/70 p-3.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-extrabold text-ink">{item.crop}</span>
                  <span className="rounded-full bg-soft-sage px-2 py-0.5 text-[10px] font-bold text-forest">{item.stage}</span>
                </div>
                <p className="mt-2 text-[11px] text-muted">{item.plotName}</p>
                <div className="mt-2 flex items-center justify-between text-xs font-bold text-forest">
                  <span>{item.daysElapsed} / {item.totalDays} days</span>
                  <span>{item.daysRemaining}d left</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </Card>
  )
}
