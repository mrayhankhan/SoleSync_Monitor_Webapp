import React, { useState } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import type { Sample } from '../../utils/analyticsHelper';

interface Props {
    samples: Sample[];
}

export const RawImuChart: React.FC<Props> = ({ samples }) => {
    const [mode, setMode] = useState<'accel' | 'gyro'>('accel');

    // Downsample for performance (1 in 5)
    const startTime = samples.length > 0 ? new Date(samples[0].time).getTime() : 0;
    const data = samples.filter((_, i) => i % 5 === 0).map(s => ({
        time: (new Date(s.time).getTime() - startTime) / 1000,
        ax: s.accel.x,
        ay: s.accel.y,
        az: s.accel.z,
        gx: s.gyro.x,
        gy: s.gyro.y,
        gz: s.gyro.z
    }));

    return (
        <div className="bg-zinc-900 rounded-2xl p-4">
            <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-semibold">Raw Sensor Data</h3>
                <div className="flex bg-zinc-800 rounded-lg p-1">
                    <button
                        onClick={() => setMode('accel')}
                        className={`px-3 py-1 rounded-md text-sm font-medium transition-colors ${mode === 'accel' ? 'bg-zinc-700 text-white' : 'text-zinc-400 hover:text-white'}`}
                    >
                        Accelerometer
                    </button>
                    <button
                        onClick={() => setMode('gyro')}
                        className={`px-3 py-1 rounded-md text-sm font-medium transition-colors ${mode === 'gyro' ? 'bg-zinc-700 text-white' : 'text-zinc-400 hover:text-white'}`}
                    >
                        Gyroscope
                    </button>
                </div>
            </div>

            <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={data}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#333" />
                        <XAxis
                            dataKey="time"
                            stroke="#666"
                            tick={{ fill: '#666' }}
                            unit="s"
                        />
                        <YAxis
                            stroke="#666"
                            tick={{ fill: '#666' }}
                            label={{
                                value: mode === 'accel' ? 'Accel (g)' : 'Gyro (°/s)',
                                angle: -90,
                                position: 'insideLeft',
                                fill: '#666'
                            }}
                        />
                        <Tooltip
                            contentStyle={{ backgroundColor: '#18181b', border: '1px solid #333' }}
                            itemStyle={{ color: '#fff' }}
                            labelFormatter={(v) => `${Number(v).toFixed(1)}s`}
                        />
                        <Legend />
                        {mode === 'accel' ? (
                            <>
                                <Line type="monotone" dataKey="ax" stroke="#ef4444" dot={false} strokeWidth={1} name="X" />
                                <Line type="monotone" dataKey="ay" stroke="#22c55e" dot={false} strokeWidth={1} name="Y" />
                                <Line type="monotone" dataKey="az" stroke="#3b82f6" dot={false} strokeWidth={1} name="Z" />
                            </>
                        ) : (
                            <>
                                <Line type="monotone" dataKey="gx" stroke="#ef4444" dot={false} strokeWidth={1} name="X" />
                                <Line type="monotone" dataKey="gy" stroke="#22c55e" dot={false} strokeWidth={1} name="Y" />
                                <Line type="monotone" dataKey="gz" stroke="#3b82f6" dot={false} strokeWidth={1} name="Z" />
                            </>
                        )}
                    </LineChart>
                </ResponsiveContainer>
            </div>
        </div>
    );
};
