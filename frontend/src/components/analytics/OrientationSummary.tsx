
import type { OrientationMetrics } from '../../utils/analyticsHelper';

export function OrientationSummary({ ori }: { ori: OrientationMetrics }) {
    return (
        <div className="bg-zinc-900 rounded-2xl p-4">
            <div className="text-xs uppercase text-zinc-400 mb-2">Orientation</div>
            <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                    <div className="text-xs text-zinc-400">Pitch Range</div>
                    <div className="text-lg font-semibold text-white">
                        {ori.pitchRangeDeg.toFixed(1)}°
                    </div>
                    <div className="text-xs text-zinc-500">
                        Variability: {ori.pitchStdDeg.toFixed(1)}°
                    </div>
                </div>
                <div>
                    <div className="text-xs text-zinc-400">Roll Range</div>
                    <div className="text-lg font-semibold text-white">
                        {ori.rollRangeDeg.toFixed(1)}°
                    </div>
                    <div className="text-xs text-zinc-500">
                        Variability: {ori.rollStdDeg.toFixed(1)}°
                    </div>
                </div>
            </div>
        </div>
    );
}
