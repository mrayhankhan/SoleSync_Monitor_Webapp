import React from 'react';
import { Settings } from 'lucide-react';
import { Link, useLocation } from 'react-router-dom';

interface LayoutProps {
    children: React.ReactNode;
}

export const Layout: React.FC<LayoutProps> = ({ children }) => {
    const location = useLocation();

    return (
        <div className="flex h-screen bg-gray-900 text-white overflow-hidden">
            {/* Sidebar - Removed as per request, keeping only Settings button */}

            {/* Main Content */}
            <div className="flex-1 flex flex-col overflow-hidden relative">

                {/* Settings Button - Top Right Absolute */}
                <div className="absolute top-4 right-6 z-50">
                    <Link
                        to="/settings"
                        className={`p-2 rounded-lg transition-colors ${location.pathname === '/settings'
                                ? 'bg-blue-600 text-white'
                                : 'bg-gray-800 text-gray-400 hover:bg-gray-700 hover:text-white'
                            }`}
                        title="Settings"
                    >
                        <Settings size={20} />
                    </Link>
                </div>

                {/* Page Content */}
                <main className="flex-1 overflow-auto relative">
                    {children}
                </main>
            </div>
        </div>
    );
};
