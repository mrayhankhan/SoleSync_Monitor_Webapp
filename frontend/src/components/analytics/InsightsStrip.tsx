
import type { Insight } from '../../utils/analyticsHelper';

export function InsightsStrip({ insights }: { insights: Insight[] }) {
    if (!insights.length) return null;

    return (
        <div className="bg-zinc-900 rounded-2xl p-3 flex flex-wrap gap-2">
            {insights.map((i, idx) => (
                <span
                    key={idx}
                    className={`
            text-xs px-3 py-1 rounded-full border
            ${i.severity === 'warn'
                            ? 'bg-amber-500/10 text-amber-300 border-amber-500/40'
                            : 'bg-emerald-500/10 text-emerald-300 border-emerald-500/40'}
          `}
                >
                    {i.label}
                </span>
            ))}
        </div>
    );
}
