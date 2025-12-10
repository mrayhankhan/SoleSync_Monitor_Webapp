import React from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts';
import type { AnalyticsMetrics } from '../../utils/analyticsHelper';

interface Props {
    metrics: AnalyticsMetrics;
}

export const StepLengthChart: React.FC<Props> = ({ metrics }) => {
    const data = metrics.stepLengths.map((len, i) => ({
        step: i + 1,
        length: len
    }));

    return (
        <div className="bg-zinc-900 rounded-2xl p-4">
            <h3 className="text-lg font-semibold mb-4">Step Length Consistency</h3>
            <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={data}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#333" />
                        <XAxis
                            dataKey="step"
                            stroke="#666"
                            tick={{ fill: '#666' }}
                            label={{ value: 'Step Index', position: 'insideBottom', offset: -5, fill: '#666' }}
                        />
                        <YAxis
                            stroke="#666"
                            tick={{ fill: '#666' }}
                            label={{ value: 'Length (m)', angle: -90, position: 'insideLeft', fill: '#666' }}
                        />
                        <Tooltip
                            contentStyle={{ backgroundColor: '#18181b', border: '1px solid #333' }}
                            itemStyle={{ color: '#fff' }}
                            formatter={(value: number) => [value.toFixed(2) + ' m', 'Step Length']}
                        />
                        <ReferenceLine y={metrics.avgStepLength} stroke="#10b981" strokeDasharray="3 3" label="Avg" />
                        <Bar dataKey="length" fill="#8b5cf6" radius={[4, 4, 0, 0]} />
                    </BarChart>
                </ResponsiveContainer>
            </div>
        </div>
    );
};
