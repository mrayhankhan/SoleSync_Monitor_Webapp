import { useEffect, useState } from 'react';
import { useParams, useSearchParams, Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { type Sample, type AnalyticsMetrics, computeAnalytics, generateDemoData, computeAsymmetry, type AsymmetryMetrics } from '../utils/analyticsHelper';
import { BasicSummaryCard } from './analytics/BasicSummaryCard';
import { StepsTimeline } from './analytics/StepsTimeline';
import { LoadDonuts } from './analytics/LoadDonuts';
import { AsymmetryCard } from './analytics/AsymmetryCard';
import { OrientationSummary } from './analytics/OrientationSummary';
import { OrientationChart } from './analytics/OrientationChart';
import { InsightsStrip } from './analytics/InsightsStrip';

export function AnalyticsPage() {
    const { sessionId } = useParams();
    const [searchParams, setSearchParams] = useSearchParams();
    const foot = searchParams.get('foot') || 'left'; // 'left' | 'right'

    const [leftSamples, setLeftSamples] = useState<Sample[]>([]);
    const [rightSamples, setRightSamples] = useState<Sample[]>([]);

    const [leftMetrics, setLeftMetrics] = useState<AnalyticsMetrics | null>(null);
    const [rightMetrics, setRightMetrics] = useState<AnalyticsMetrics | null>(null);
    const [asymmetry, setAsymmetry] = useState<AsymmetryMetrics | null>(null);

    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (!sessionId) return;

        setLoading(true);

        if (sessionId === 'demo') {
            const data = generateDemoData();
            processData(data);
            setLoading(false);
            return;
        }

        const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';
        // Fetch ALL samples for the session
        fetch(`${API_URL}/api/sessions/${sessionId}/samples`)
            .then(res => res.json())
            .then((data: Sample[]) => {
                processData(data);
                setLoading(false);
            })
            .catch(err => {
                console.error("Failed to fetch samples:", err);
                setLoading(false);
            });
    }, [sessionId]);

    const processData = (data: Sample[]) => {
        const left = data.filter(s => s.foot === 'left');
        const right = data.filter(s => s.foot === 'right');

        setLeftSamples(left);
        setRightSamples(right);

        const lMetrics = left.length > 0 ? computeAnalytics(left) : null;
        const rMetrics = right.length > 0 ? computeAnalytics(right) : null;

        setLeftMetrics(lMetrics);
        setRightMetrics(rMetrics);

        if (lMetrics && rMetrics) {
            setAsymmetry(computeAsymmetry(lMetrics, rMetrics));
        } else {
            setAsymmetry(null);
        }
    };

    // Derived state for current view
    const currentSamples = foot === 'left' ? leftSamples : rightSamples;
    const currentMetrics = foot === 'left' ? leftMetrics : rightMetrics;

    if (loading) return <div className="p-8 text-white">Loading analytics...</div>;

    return (
        <div className="min-h-screen bg-black text-white p-6 pb-24">
            <div className="max-w-4xl mx-auto space-y-6">
                {/* Header */}
                <div className="flex items-center gap-4">
                    <Link to="/" className="p-2 hover:bg-zinc-800 rounded-full transition-colors">
                        <ArrowLeft size={24} />
                    </Link>
                    <div>
                        <h1 className="text-2xl font-bold">Session Analytics</h1>
                        <p className="text-zinc-400 text-sm">{sessionId}</p>
                    </div>
                </div>

                {/* Foot Toggle */}
                <div className="flex bg-zinc-900 p-1 rounded-lg w-fit">
                    <button
                        onClick={() => setSearchParams({ foot: 'left' })}
                        className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${foot === 'left' ? 'bg-zinc-700 text-white' : 'text-zinc-400 hover:text-white'}`}
                    >
                        Left Foot
                    </button>
                    <button
                        onClick={() => setSearchParams({ foot: 'right' })}
                        className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${foot === 'right' ? 'bg-zinc-700 text-white' : 'text-zinc-400 hover:text-white'}`}
                    >
                        Right Foot
                    </button>
                </div>

                {/* Asymmetry Card (Visible if both feet have data) */}
                {asymmetry && (
                    <AsymmetryCard asym={asymmetry} />
                )}

                {currentMetrics ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {/* Left Column */}
                        <div className="space-y-6">
                            <BasicSummaryCard basic={currentMetrics.basic} />
                            <LoadDonuts load={currentMetrics.load} />
                            <InsightsStrip insights={currentMetrics.insights} />
                            <OrientationSummary ori={currentMetrics.orientation} />
                        </div>

                        {/* Right Column */}
                        <div className="space-y-6">
                            <div className="bg-zinc-900 rounded-2xl p-4">
                                <h3 className="text-lg font-semibold mb-4">Step Force Timeline</h3>
                                <div className="h-64">
                                    <StepsTimeline samples={currentSamples} steps={currentMetrics.steps} />
                                </div>
                            </div>
                            <OrientationChart samples={currentSamples} />
                        </div>
                    </div>
                ) : (
                    <div className="text-center py-12 text-zinc-500">
                        No data available for {foot} foot.
                    </div>
                )}
            </div>
        </div>
    );
};
