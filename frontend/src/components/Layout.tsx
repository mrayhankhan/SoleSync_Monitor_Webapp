import React from 'react';
// Sidebar removed as per request

interface LayoutProps {
    children: React.ReactNode;
}

export const Layout: React.FC<LayoutProps> = ({ children }) => {
    return (
        <div className="flex h-screen bg-gray-900 text-white overflow-hidden">
            {/* Main Content */}
            <div className="flex-1 flex flex-col overflow-hidden relative">
                {/* Page Content */}
                <main className="flex-1 overflow-auto relative">
                    {children}
                </main>
            </div>
        </div>
    );
};


