import React, { useEffect, useState } from 'react';
import { X, Trash2, Calendar } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

interface SessionSummary {
    sessionid: string;
    foot: string;
    start_time: string;
    end_time: string;
    sample_count: string;
}

interface SessionsModalProps {
    isOpen: boolean;
    onClose: () => void;
}

export const SessionsModal: React.FC<SessionsModalProps> = ({ isOpen, onClose }) => {
    const [sessions, setSessions] = useState<SessionSummary[]>([]);
    const navigate = useNavigate();

    useEffect(() => {
        if (!isOpen) return;
        const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';
        fetch(`${API_URL}/api/sessions`)
            .then(res => res.json())
            .then(setSessions)
            .catch(err => console.error("Failed to fetch sessions:", err));
    }, [isOpen]);

    const handleDelete = async (sessionId: string) => {
        if (!confirm('Are you sure you want to delete this session?')) return;

        try {
            const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';
            await fetch(`${API_URL}/api/sessions/${sessionId}`, { method: 'DELETE' });
            setSessions(prev => prev.filter(s => s.sessionid !== sessionId));
        } catch (err) {
            console.error("Failed to delete session:", err);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 z-50">
            <div className="bg-white dark:bg-zinc-900 rounded-2xl w-full max-w-2xl max-h-[80vh] flex flex-col border border-gray-200 dark:border-zinc-800 shadow-xl">
                <div className="p-6 border-b border-gray-200 dark:border-zinc-800 flex justify-between items-center bg-gray-50/50 dark:bg-black/20 rounded-t-2xl">
                    <h2 className="text-xl font-bold text-gray-900 dark:text-white">Recorded Sessions</h2>
                    <button
                        onClick={onClose}
                        className="p-2 hover:bg-gray-200 dark:hover:bg-zinc-800 rounded-lg transition-colors text-gray-500 dark:text-zinc-400"
                    >
                        <X size={20} />
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto p-6 space-y-4">
                    {sessions.length === 0 ? (
                        <div className="text-center py-8 text-gray-500 dark:text-zinc-500">No sessions found</div>
                    ) : (
                        sessions.map((session) => (
                            <div
                                key={session.sessionid}
                                className="bg-gray-50 dark:bg-black/40 rounded-xl p-4 border border-gray-200 dark:border-zinc-800 hover:border-purple-500/50 transition-colors group"
                            >
                                <div className="flex justify-between items-start mb-3">
                                    <div>
                                        <div className="font-medium text-gray-900 dark:text-white mb-1">{session.sessionid}</div>
                                        <div className="text-xs text-gray-500 dark:text-zinc-500 flex items-center gap-2">
                                            <Calendar size={12} />
                                            {new Date(session.start_time).toLocaleString()}
                                        </div>
                                    </div>
                                    <div className="text-right">
                                        <div className="text-xs font-medium text-gray-900 dark:text-zinc-300">
                                            {((new Date(session.end_time).getTime() - new Date(session.start_time).getTime()) / 1000).toFixed(1)}s
                                        </div>
                                        <div className="text-[10px] text-gray-500 dark:text-zinc-600 uppercase tracking-wider mt-0.5">Duration</div>
                                    </div>
                                </div>

                                <div className="flex gap-2 mt-4">
                                    <button
                                        onClick={() => {
                                            navigate(`/analytics/${session.sessionid}?foot=${session.foot}`);
                                            onClose();
                                        }}
                                        className="flex-1 bg-purple-600 hover:bg-purple-700 text-white py-2 rounded-lg text-sm font-medium transition-colors flex items-center justify-center gap-2"
                                    >
                                        View Analytics
                                    </button>
                                    <button
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            handleDelete(session.sessionid);
                                        }}
                                        className="p-2 bg-red-100 dark:bg-red-900/20 text-red-600 dark:text-red-400 hover:bg-red-200 dark:hover:bg-red-900/40 rounded-lg transition-colors"
                                        title="Delete Session"
                                    >
                                        <Trash2 size={18} />
                                    </button>
                                </div>
                            </div>
                        ))
                    )}
                </div>
            </div>
        </div>
    );
};
