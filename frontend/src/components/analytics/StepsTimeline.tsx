import React from 'react';
import { LineChart, Line, XAxis, YAxis, Tooltip, ReferenceDot, ResponsiveContainer } from 'recharts';
import { type Sample, type StepEvent } from '../../utils/analyticsHelper';

interface StepsTimelineProps {
    samples: Sample[];
    steps: StepEvent[];
}

export const StepsTimeline: React.FC<StepsTimelineProps> = ({ samples, steps }) => {
    const data = samples.map(s => ({
        t: new Date(s.time).getTime(),
        fsrSum: s.fsr.reduce((a, b) => a + b, 0) + (s.heelraw || 0),
    }));

    return (
        <div className="bg-gray-800 rounded-xl p-4 h-64 border border-gray-700">
            <h3 className="text-sm font-semibold mb-2 text-gray-300">FSR Timeline with Steps</h3>
            <ResponsiveContainer width="100%" height="100%">
                <LineChart data={data}>
                    <XAxis
                        dataKey="t"
                        tickFormatter={v => new Date(v).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                        stroke="#9CA3AF"
                        tick={{ fontSize: 10 }}
                    />
                    <YAxis stroke="#9CA3AF" tick={{ fontSize: 10 }} />
                    <Tooltip
                        contentStyle={{ backgroundColor: '#1F2937', border: 'none', borderRadius: '8px' }}
                        labelFormatter={v => new Date(v).toLocaleTimeString()}
                    />
                    <Line type="monotone" dataKey="fsrSum" stroke="#8B5CF6" dot={false} strokeWidth={2} />
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
