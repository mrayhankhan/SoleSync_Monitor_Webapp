import React from 'react';
import { Activity, MoveHorizontal, TrendingUp } from 'lucide-react';
import type { AnalyticsMetrics } from '../../utils/analyticsHelper';

interface Props {
    metrics: AnalyticsMetrics;
}

export const AdvancedMetricsCard: React.FC<Props> = ({ metrics }) => {
    return (
        <div className="bg-zinc-900 rounded-2xl p-6">
            <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <Activity className="text-purple-400" size={20} />
                Advanced Kinematics
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {/* Gait Speed */}
                <div className="bg-zinc-800/50 rounded-xl p-4">
                    <div className="flex items-center gap-2 mb-2 text-zinc-400">
                        <TrendingUp size={16} />
                        <span className="text-sm font-medium">Gait Speed</span>
                    </div>
                    <div className="flex items-baseline gap-2">
                        <span className="text-2xl font-bold text-white">
                            {metrics.gaitSpeed.toFixed(2)}
                        </span>
                        <span className="text-sm text-zinc-500">m/s</span>
                    </div>
                    <div className="text-xs text-zinc-500 mt-1">
                        {(metrics.gaitSpeed * 3.6).toFixed(1)} km/h
                    </div>
                </div>

                {/* Step Length */}
                <div className="bg-zinc-800/50 rounded-xl p-4">
                    <div className="flex items-center gap-2 mb-2 text-zinc-400">
                        <MoveHorizontal size={16} />
                        <span className="text-sm font-medium">Avg Step Length</span>
                    </div>
                    <div className="flex items-baseline gap-2">
                        <span className="text-2xl font-bold text-white">
                            {metrics.avgStepLength.toFixed(2)}
                        </span>
                        <span className="text-sm text-zinc-500">m</span>
                    </div>
                    <div className="text-xs text-zinc-500 mt-1">
                        Est. from ZUPT
                    </div>
                </div>

                {/* Variability */}
                <div className="bg-zinc-800/50 rounded-xl p-4">
                    <div className="flex items-center gap-2 mb-2 text-zinc-400">
                        <Activity size={16} />
                        <span className="text-sm font-medium">Variability (CV)</span>
                    </div>
                    <div className="space-y-2">
                        <div className="flex justify-between items-center">
                            <span className="text-xs text-zinc-400">Contact Time</span>
                            <span className={`text-sm font-mono ${metrics.variability.contactTimeCV < 5 ? 'text-green-400' : 'text-yellow-400'}`}>
                                {metrics.variability.contactTimeCV.toFixed(1)}%
                            </span>
                        </div>
                        <div className="flex justify-between items-center">
                            <span className="text-xs text-zinc-400">Peak Force</span>
                            <span className={`text-sm font-mono ${metrics.variability.peakForceCV < 10 ? 'text-green-400' : 'text-yellow-400'}`}>
                                {metrics.variability.peakForceCV.toFixed(1)}%
                            </span>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};
