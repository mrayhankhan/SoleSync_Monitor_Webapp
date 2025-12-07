import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
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
    // const [searchParams, setSearchParams] = useSearchParams();
    // const foot = searchParams.get('foot') || 'left'; // 'left' | 'right'

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
    // const currentSamples = foot === 'left' ? leftSamples : rightSamples;
    // const currentMetrics = foot === 'left' ? leftMetrics : rightMetrics;

    if (loading) return <div className="p-8 text-white">Loading analytics...</div>;

    return (
        <div className="min-h-screen bg-gray-50 dark:bg-black text-gray-900 dark:text-white p-6 pb-24 transition-colors duration-200">
            <div className="max-w-7xl mx-auto space-y-6">
                {/* Header */}
                <div className="flex items-center gap-4">
                    <Link to="/" className="p-2 hover:bg-gray-200 dark:hover:bg-zinc-800 rounded-full transition-colors text-gray-600 dark:text-zinc-400">
                        <ArrowLeft size={24} />
                    </Link>
                    <div>
                        <h1 className="text-2xl font-bold bg-gradient-to-r from-purple-600 to-blue-500 dark:from-purple-400 dark:to-blue-400 bg-clip-text text-transparent">Session Analytics</h1>
                        <p className="text-gray-500 dark:text-zinc-400 text-sm">{sessionId}</p>
                    </div>
                </div>

                {/* Asymmetry Card (Visible if both feet have data) */}
                {asymmetry && (
                    <AsymmetryCard asym={asymmetry} />
                )}

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                    {/* Left Foot Column */}
                    <div className="space-y-6">
                        <div className="flex items-center gap-2 pb-2 border-b border-gray-200 dark:border-zinc-800">
                            <div className="w-3 h-3 rounded-full bg-blue-500"></div>
                            <h2 className="text-xl font-semibold">Left Foot</h2>
                        </div>

                        {leftMetrics ? (
                            <>
                                <BasicSummaryCard basic={leftMetrics.basic} />
                                <LoadDonuts load={leftMetrics.load} />
                                <InsightsStrip insights={leftMetrics.insights} />
                                <OrientationSummary ori={leftMetrics.orientation} />
                                <div className="bg-white dark:bg-zinc-900 rounded-2xl p-4 border border-gray-200 dark:border-zinc-800 shadow-sm">
                                    <h3 className="text-lg font-semibold mb-4">Step Force Timeline</h3>
                                    <div className="h-48">
                                        <StepsTimeline samples={leftSamples} steps={leftMetrics.steps} />
                                    </div>
                                </div>
                                <OrientationChart samples={leftSamples} />
                            </>
                        ) : (
                            <div className="p-8 text-center text-gray-500 dark:text-zinc-500 bg-white dark:bg-zinc-900 rounded-2xl border border-gray-200 dark:border-zinc-800 border-dashed">
                                No data for Left Foot
                            </div>
                        )}
                    </div>

                    {/* Right Foot Column */}
                    <div className="space-y-6">
                        <div className="flex items-center gap-2 pb-2 border-b border-gray-200 dark:border-zinc-800">
                            <div className="w-3 h-3 rounded-full bg-purple-500"></div>
                            <h2 className="text-xl font-semibold">Right Foot</h2>
                        </div>

                        {rightMetrics ? (
                            <>
                                <BasicSummaryCard basic={rightMetrics.basic} />
                                <LoadDonuts load={rightMetrics.load} />
                                <InsightsStrip insights={rightMetrics.insights} />
                                <OrientationSummary ori={rightMetrics.orientation} />
                                <div className="bg-white dark:bg-zinc-900 rounded-2xl p-4 border border-gray-200 dark:border-zinc-800 shadow-sm">
                                    <h3 className="text-lg font-semibold mb-4">Step Force Timeline</h3>
                                    <div className="h-48">
                                        <StepsTimeline samples={rightSamples} steps={rightMetrics.steps} />
                                    </div>
                                </div>
                                <OrientationChart samples={rightSamples} />
                            </>
                        ) : (
                            <div className="p-8 text-center text-gray-500 dark:text-zinc-500 bg-white dark:bg-zinc-900 rounded-2xl border border-gray-200 dark:border-zinc-800 border-dashed">
                                No data for Right Foot
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};
