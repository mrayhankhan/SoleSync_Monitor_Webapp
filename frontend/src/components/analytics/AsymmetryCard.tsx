
import type { AsymmetryMetrics } from '../../utils/analyticsHelper';

export function AsymmetryCard({ asym }: { asym: AsymmetryMetrics }) {
    const severity =
        Math.abs(asym.contactTimeSI) > 15 ? 'High' :
            Math.abs(asym.contactTimeSI) > 8 ? 'Moderate' :
                'Low';

    return (
        <div className="bg-gradient-to-br from-zinc-900 via-zinc-800 to-zinc-900 rounded-2xl p-4">
            <div className="flex justify-between items-center mb-2">
                <div className="text-xs uppercase text-zinc-400">Left–Right Asymmetry</div>
                <span className={`text-xs px-2 py-1 rounded-full ${severity === 'Low' ? 'bg-green-900 text-green-300' : severity === 'Moderate' ? 'bg-yellow-900 text-yellow-300' : 'bg-red-900 text-red-300'}`}>
                    {severity}
                </span>
            </div>
            <div className="grid grid-cols-3 gap-3 text-sm">
                <div>
                    <div className="text-xs text-zinc-400">Step Count Δ</div>
                    <div className="text-lg font-semibold text-white">
                        {asym.stepCountDiff > 0 ? '+' : ''}
                        {asym.stepCountDiff}
                    </div>
                </div>
                <div>
                    <div className="text-xs text-zinc-400">Contact Time SI</div>
                    <div className="text-lg font-semibold text-white">
                        {asym.contactTimeSI.toFixed(1)}%
                    </div>
                </div>
                <div>
                    <div className="text-xs text-zinc-400">Load SI</div>
                    <div className="text-lg font-semibold text-white">
                        {asym.loadSI.toFixed(1)}%
                    </div>
                </div>
            </div>
        </div>
    );
}
