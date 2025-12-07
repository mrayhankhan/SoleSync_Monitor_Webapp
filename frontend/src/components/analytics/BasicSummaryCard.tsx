import React from 'react';
import { type BasicMetrics } from '../../utils/analyticsHelper';

interface BasicSummaryCardProps {
    basic: BasicMetrics;
}

export const BasicSummaryCard: React.FC<BasicSummaryCardProps> = ({ basic }) => {
    return (
        <div className="bg-gradient-to-br from-gray-800 to-gray-900 rounded-xl p-4 flex flex-col justify-between border border-gray-700">
            <div className="text-xs uppercase tracking-wide text-gray-400 mb-4 font-semibold">
                Gait Summary
            </div>
            <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                    <div className="text-gray-500 text-xs mb-1">Step Count</div>
                    <div className="text-2xl font-bold text-white">{basic.stepCount}</div>
                </div>
                <div>
                    <div className="text-gray-500 text-xs mb-1">Cadence</div>
                    <div className="text-2xl font-bold text-white">
                        {basic.cadence.toFixed(0)} <span className="text-xs font-normal text-gray-400">spm</span>
                    </div>
                </div>
                <div>
                    <div className="text-gray-500 text-xs mb-1">Contact Time</div>
                    <div className="text-2xl font-bold text-white">
                        {(basic.avgContactTime / 1000).toFixed(2)} <span className="text-xs font-normal text-gray-400">s</span>
                    </div>
                </div>
                <div>
                    <div className="text-gray-500 text-xs mb-1">Stance</div>
                    <div className="text-2xl font-bold text-white">
                        {basic.stancePercent.toFixed(0)}<span className="text-xs font-normal text-gray-400">%</span>
                    </div>
                </div>
            </div>
        </div>
    );
};
