'use client';

import { useState } from 'react';

export default function AdminDashboard() {
    const [loading] = useState(false);

    if (loading) return <div className="p-8 animate-pulse text-gray-500 uppercase tracking-widest font-black">Loading System Data...</div>;

    return (
        <div className="p-4 sm:p-8 space-y-8 animate-in fade-in duration-500">
            <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-black text-black dark:text-white tracking-tighter uppercase">Operations Command</h1>
                    <p className="text-xs font-bold text-gray-400 uppercase tracking-[0.2em] mt-1">Sam Software LLC Internal Dashboard</p>
                </div>
                <div className="flex items-center gap-2">
                    <div className="w-3 h-3 bg-green-500 rounded-full animate-pulse shadow-[0_0_10px_rgba(34,197,94,0.5)]" />
                    <span className="text-[10px] font-black uppercase tracking-widest text-green-600">Secure Link Active</span>
                </div>
            </header>

            <div className="bg-white dark:bg-[#1A1A1A] rounded-[2rem] border border-black/5 dark:border-white/10 p-8 shadow-2xl">
                <p className="text-sm text-gray-500">Admin dashboard will be available once the required database tables are set up.</p>
            </div>
        </div>
    );
}
