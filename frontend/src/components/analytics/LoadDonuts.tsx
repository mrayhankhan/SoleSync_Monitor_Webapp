import React from 'react';
import { PieChart, Pie, Cell, Legend } from 'recharts';
import type { LoadMetrics } from '../../utils/analyticsHelper';

export function LoadDonuts({ load }: { load: LoadMetrics }) {
    const foreHeelData = [
        { name: 'Heel', value: load.heelPct },
        { name: 'Forefoot', value: load.forefootPct },
    ];
    const mlData = [
        { name: 'Medial', value: load.medialPct },
        { name: 'Lateral', value: load.lateralPct },
    ];

    const COLORS = ['#8884d8', '#82ca9d'];

    return (
        <div className="bg-zinc-900 rounded-2xl p-4 grid grid-cols-2 gap-4">
            <div>
                <div className="text-xs text-zinc-400 mb-1">Heel vs Forefoot</div>
                <PieChart width={200} height={200}>
                    <Pie
                        data={foreHeelData}
                        dataKey="value"
                        innerRadius={50}
                        outerRadius={80}
                        paddingAngle={3}
                    >
                        {foreHeelData.map((_, i) => (
                            <Cell key={i} fill={COLORS[i % COLORS.length]} />
                        ))}
                    </Pie>
                    <Legend />
                </PieChart>
            </div>
            <div>
                <div className="text-xs text-zinc-400 mb-1">Medial vs Lateral</div>
                <PieChart width={200} height={200}>
                    <Pie
                        data={mlData}
                        dataKey="value"
                        innerRadius={50}
                        outerRadius={80}
                        paddingAngle={3}
                    >
                        {mlData.map((_, i) => (
                            <Cell key={i} fill={COLORS[i % COLORS.length]} />
                        ))}
                    </Pie>
                    <Legend />
                </PieChart>
            </div>
        </div>
    );
}
