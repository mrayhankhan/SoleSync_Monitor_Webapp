import React from 'react';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceDot, CartesianGrid } from 'recharts';
import { type Sample, type StepEvent } from '../../utils/analyticsHelper';

interface StepsTimelineProps {
    samples: Sample[];
    steps: StepEvent[];
}

export const StepsTimeline: React.FC<StepsTimelineProps> = ({ samples, steps }) => {
    // Downsample for performance and readability (1 in 5 samples)
    const startTime = samples.length > 0 ? new Date(samples[0].time).getTime() : 0;
    const chartData = samples.filter((_, i) => i % 5 === 0).map(s => ({
        time: (new Date(s.time).getTime() - startTime) / 1000,
        force: s.fsr.reduce((a, b) => a + b, 0) + (s.heelraw || 0)
    }));

    return (
        <div className="bg-gray-800 rounded-xl p-4 h-64 border border-gray-700">
            <h3 className="text-sm font-semibold mb-2 text-gray-300">FSR Timeline with Steps</h3>
            <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData}>
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
                        label={{ value: 'Force (raw)', angle: -90, position: 'insideLeft', fill: '#666' }}
                    />
                    <Tooltip
                        contentStyle={{ backgroundColor: '#18181b', border: '1px solid #333' }}
                        itemStyle={{ color: '#fff' }}
                        labelFormatter={(v) => `${Number(v).toFixed(1)} s`}
                    />
                    <Line type="monotone" dataKey="force" stroke="#3b82f6" dot={false} strokeWidth={2} />
                    {steps.map((s, i) => (
                        <ReferenceDot
                            key={i}
                            x={s.peakTime}
                            y={0}
                            r={4}
                            fill="#EF4444"
                            stroke="none"
                            ifOverflow="discard"
                        />
                    ))}
                </LineChart>
            </ResponsiveContainer>
        </div>
    );
};
