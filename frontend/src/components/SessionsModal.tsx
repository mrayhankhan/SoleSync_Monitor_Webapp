import React, { useEffect, useState } from 'react';
import { X, Trash2, Calendar, Clock, Activity } from 'lucide-react';
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
        fetch('http://localhost:3000/api/sessions')
            .then(res => res.json())
            .then(setSessions)
            .catch(err => console.error("Failed to fetch sessions:", err));
    }, [isOpen]);

    const handleDelete = async (sessionId: string) => {
        if (!confirm('Are you sure you want to delete this session?')) return;

        try {
            await fetch(`http://localhost:3000/api/sessions/${sessionId}`, { method: 'DELETE' });
            setSessions(prev => prev.filter(s => s.sessionid !== sessionId));
        } catch (err) {
            console.error("Failed to delete session:", err);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-gray-900 rounded-2xl w-full max-w-2xl border border-gray-700 shadow-2xl flex flex-col max-h-[80vh]">
                <div className="flex justify-between items-center p-6 border-b border-gray-800">
                    <h2 className="text-xl font-bold text-white flex items-center gap-2">
                        <Activity className="text-purple-500" />
                        Recordings
                    </h2>
                    <button onClick={onClose} className="text-gray-400 hover:text-white transition-colors">
                        <X size={24} />
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto p-4 space-y-3">
                    {sessions.length === 0 ? (
                        <div className="text-center text-gray-500 py-10">No recordings found.</div>
                    ) : (
                        sessions.map(s => (
                            <div
                                key={`${s.sessionid}-${s.foot}`}
                                className="flex items-center justify-between bg-gray-800/50 hover:bg-gray-800 rounded-xl p-4 cursor-pointer transition-all border border-transparent hover:border-gray-600 group"
                                onClick={() => {
                                    navigate(`/analytics/${s.sessionid}?foot=${s.foot}`);
                                    onClose();
                                }}
                            >
                                <div>
                                    <div className="text-sm font-bold text-white mb-1 flex items-center gap-2">
                                        {s.sessionid}
                                        <span className={`text-[10px] px-2 py-0.5 rounded-full uppercase ${s.foot === 'left' ? 'bg-blue-900/50 text-blue-400' : 'bg-green-900/50 text-green-400'}`}>
                                            {s.foot}
                                        </span>
                                    </div>
                                    <div className="text-xs text-gray-400 flex items-center gap-3">
                                        <span className="flex items-center gap-1"><Calendar size={12} /> {new Date(s.start_time).toLocaleDateString()}</span>
                                        <span className="flex items-center gap-1"><Clock size={12} /> {new Date(s.start_time).toLocaleTimeString()}</span>
                                    </div>
                                </div>
                                <div className="flex items-center gap-4">
                                    <div className="text-right">
                                        <div className="text-xs text-gray-400">{s.sample_count} samples</div>
                                        <div className="text-xs text-gray-500">
                                            {((new Date(s.end_time).getTime() - new Date(s.start_time).getTime()) / 1000).toFixed(1)}s
                                        </div>
                                    </div>
                                    <button
                                        onClick={e => {
                                            e.stopPropagation();
                                            handleDelete(s.sessionid);
                                        }}
                                        className="p-2 text-gray-500 hover:text-red-400 hover:bg-red-900/20 rounded-lg transition-colors opacity-0 group-hover:opacity-100"
                                        title="Delete"
                                    >
                                        <Trash2 size={16} />
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
