import React from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

interface ChartProps {
    data: any[];
    lines: { key: string, color: string }[];
    height?: number;
}

export const SensorChart: React.FC<ChartProps> = ({ data, lines, height = 200 }) => {
    return (
        <div style={{ width: '100%', height }}>
            <ResponsiveContainer>
                <LineChart data={data}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                    <XAxis dataKey="timestamp" hide />
                    <YAxis domain={['auto', 'auto']} stroke="#9CA3AF" tick={{ fontSize: 12 }} />
                    <Tooltip
                        contentStyle={{ backgroundColor: '#1F2937', border: 'none', color: '#F3F4F6' }}
                        itemStyle={{ fontSize: 12 }}
                        labelStyle={{ display: 'none' }}
                    />
                    {lines.map(line => (
                        <Line
                            key={line.key}
                            type="monotone"
                            dataKey={line.key}
                            stroke={line.color}
                            strokeWidth={2}
                            dot={false}
                            isAnimationActive={false} // Disable animation for performance
                        />
                    ))}
                </LineChart>
            </ResponsiveContainer>
        </div>
    );
};
