
import { LineChart, XAxis, YAxis, Tooltip, Line, ResponsiveContainer } from 'recharts';
import type { Sample } from '../../utils/analyticsHelper';

export function OrientationChart({ samples }: { samples: Sample[] }) {
    // We need to re-calculate pitch/roll for the chart data since it's not stored on Sample directly yet
    // Or we can just do it on the fly here as per the user's snippet
    const data = samples.map(s => {
        const pitch = Math.atan2(s.accel.x, Math.sqrt(s.accel.y * s.accel.y + s.accel.z * s.accel.z)) * (180 / Math.PI);
        const roll = Math.atan2(s.accel.y, s.accel.z) * (180 / Math.PI);
        return {
            t: new Date(s.time).getTime(),
            pitch,
            roll,
        };
    });

    return (
        <div className="bg-zinc-900 rounded-2xl p-4 h-64">
            <div className="text-xs text-zinc-400 mb-2">Foot Orientation (Pitch & Roll)</div>
            <ResponsiveContainer width="100%" height="100%">
                <LineChart data={data}>
                    <XAxis
                        dataKey="t"
                        tickFormatter={v => new Date(v).toLocaleTimeString([], { minute: '2-digit', second: '2-digit' })}
                        stroke="#52525b"
                        tick={{ fill: '#71717a', fontSize: 10 }}
                    />
                    <YAxis
                        stroke="#52525b"
                        tick={{ fill: '#71717a', fontSize: 10 }}
                    />
                    <Tooltip
                        contentStyle={{ backgroundColor: '#18181b', border: '1px solid #27272a' }}
                        itemStyle={{ color: '#e4e4e7' }}
                        labelFormatter={v => new Date(v).toLocaleTimeString()}
                    />
                    <Line type="monotone" dataKey="pitch" stroke="#8884d8" dot={false} strokeWidth={2} />
                    <Line type="monotone" dataKey="roll" stroke="#82ca9d" dot={false} strokeWidth={2} />
                </LineChart>
            </ResponsiveContainer>
        </div>
    );
}
