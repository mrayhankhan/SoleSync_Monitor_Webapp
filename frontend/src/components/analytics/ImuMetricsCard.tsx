import React from 'react';
import { Zap, Wind, Activity } from 'lucide-react';
import type { AnalyticsMetrics } from '../../utils/analyticsHelper';

interface Props {
    metrics: AnalyticsMetrics;
}

export const ImuMetricsCard: React.FC<Props> = ({ metrics }) => {
    return (
        <div className="bg-zinc-900 rounded-2xl p-6">
            <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <Activity className="text-blue-400" size={20} />
                IMU Performance
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {/* Impact / Shock */}
                <div className="bg-zinc-800/50 rounded-xl p-4">
                    <div className="flex items-center gap-2 mb-2 text-zinc-400">
                        <Zap size={16} />
                        <span className="text-sm font-medium">Avg Impact (Shock)</span>
                    </div>
                    <div className="flex items-baseline gap-2">
                        <span className="text-2xl font-bold text-white">
                            {metrics.imu.avgPeakShock.toFixed(2)}
                        </span>
                        <span className="text-sm text-zinc-500">g</span>
                    </div>
                    <div className="text-xs text-zinc-500 mt-1">
                        Peak Accel during Stance
                    </div>
                </div>

                {/* Swing Speed */}
                <div className="bg-zinc-800/50 rounded-xl p-4">
                    <div className="flex items-center gap-2 mb-2 text-zinc-400">
                        <Wind size={16} />
                        <span className="text-sm font-medium">Avg Swing Speed</span>
                    </div>
                    <div className="flex items-baseline gap-2">
                        <span className="text-2xl font-bold text-white">
                            {metrics.imu.avgSwingSpeed.toFixed(0)}
                        </span>
                        <span className="text-sm text-zinc-500">°/s</span>
                    </div>
                    <div className="text-xs text-zinc-500 mt-1">
                        Peak Gyro during Swing
                    </div>
                </div>

                {/* Shock Consistency */}
                <div className="bg-zinc-800/50 rounded-xl p-4">
                    <div className="flex items-center gap-2 mb-2 text-zinc-400">
                        <Activity size={16} />
                        <span className="text-sm font-medium">Impact Consistency</span>
                    </div>
                    <div className="flex items-baseline gap-2">
                        <span className={`text-2xl font-bold ${metrics.imu.peakShockCV < 15 ? 'text-green-400' : 'text-yellow-400'}`}>
                            {metrics.imu.peakShockCV.toFixed(1)}%
                        </span>
                        <span className="text-sm text-zinc-500">CV</span>
                    </div>
                    <div className="text-xs text-zinc-500 mt-1">
                        Lower is better
                    </div>
                </div>
            </div>
        </div>
    );
};
