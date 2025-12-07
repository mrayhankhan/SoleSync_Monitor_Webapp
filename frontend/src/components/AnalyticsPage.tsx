import React, { useEffect, useState } from 'react';
import { useParams, useSearchParams, Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { type Sample, type AnalyticsMetrics, computeAnalytics, generateDemoData } from '../utils/analyticsHelper';
import { BasicSummaryCard } from './analytics/BasicSummaryCard';
import { StepsTimeline } from './analytics/StepsTimeline';

export const AnalyticsPage: React.FC = () => {
    const { sessionId } = useParams<{ sessionId: string }>();
    const [searchParams] = useSearchParams();
    const foot = searchParams.get('foot') || 'left';

    const [samples, setSamples] = useState<Sample[]>([]);
    const [metrics, setMetrics] = useState<AnalyticsMetrics | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!sessionId) return;

        setLoading(true);

        if (sessionId === 'demo') {
            const data = generateDemoData();
            setSamples(data);
            setMetrics(computeAnalytics(data));
            setLoading(false);
            return;
        }

        const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';
        fetch(`${API_URL}/api/sessions/${sessionId}/samples?foot=${foot}`)
            .then(res => res.json())
            .then((data: Sample[]) => {
                setSamples(data);
                if (data.length > 0) {
                    setMetrics(computeAnalytics(data));
                }
                setLoading(false);
            })
            .catch(err => {
                console.error("Failed to fetch samples:", err);
                setLoading(false);
            });
    }, [sessionId, foot]);

    if (loading) {
        return (
            <div className="min-h-screen bg-gray-900 text-white flex items-center justify-center">
                <div className="animate-pulse text-purple-400">Loading analytics...</div>
            </div>
        );
    }

    if (!metrics || samples.length === 0) {
        return (
            <div className="min-h-screen bg-gray-900 text-white p-6">
                <Link to="/" className="inline-flex items-center text-gray-400 hover:text-white mb-6">
                    <ArrowLeft size={20} className="mr-2" /> Back to Dashboard
                </Link>
                <div className="text-center text-gray-500 mt-20">No data found for this session.</div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gray-900 text-white p-6">
            <div className="max-w-7xl mx-auto">
                {/* Header */}
                <div className="flex items-center justify-between mb-8">
                    <div className="flex items-center gap-4">
                        <Link to="/" className="p-2 bg-gray-800 rounded-lg hover:bg-gray-700 transition-colors">
                            <ArrowLeft size={20} />
                        </Link>
                        <div>
                            <h1 className="text-2xl font-bold">Session Analytics</h1>
                            <div className="text-sm text-gray-400 font-mono mt-1">
                                ID: {sessionId} <span className="mx-2">•</span>
                                <span className="uppercase text-purple-400">{foot} Foot</span>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Grid Layout */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    {/* Left Column: Metrics */}
                    <div className="space-y-6">
                        <BasicSummaryCard basic={metrics.basic} />

                        {/* Load Distribution (Simple Text for now) */}
                        <div className="bg-gray-800 rounded-xl p-4 border border-gray-700">
                            <h3 className="text-xs uppercase tracking-wide text-gray-400 mb-4 font-semibold">Load Distribution</h3>
                            <div className="space-y-3">
                                <div>
                                    <div className="flex justify-between text-sm mb-1">
                                        <span className="text-gray-400">Heel</span>
                                        <span className="font-bold">{metrics.load.heelPct.toFixed(1)}%</span>
                                    </div>
                                    <div className="h-2 bg-gray-700 rounded-full overflow-hidden">
                                        <div className="h-full bg-blue-500" style={{ width: `${metrics.load.heelPct}%` }} />
                                    </div>
                                </div>
                                <div>
                                    <div className="flex justify-between text-sm mb-1">
                                        <span className="text-gray-400">Forefoot</span>
                                        <span className="font-bold">{metrics.load.forefootPct.toFixed(1)}%</span>
                                    </div>
                                    <div className="h-2 bg-gray-700 rounded-full overflow-hidden">
                                        <div className="h-full bg-green-500" style={{ width: `${metrics.load.forefootPct}%` }} />
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Right Column: Charts */}
                    <div className="lg:col-span-2 space-y-6">
                        <StepsTimeline samples={samples} steps={metrics.steps} />

                        {/* Placeholder for future charts */}
                        <div className="bg-gray-800 rounded-xl p-4 h-64 border border-gray-700 flex items-center justify-center text-gray-500 text-sm">
                            More charts coming soon (Orientation, Gait Phase, etc.)
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};
