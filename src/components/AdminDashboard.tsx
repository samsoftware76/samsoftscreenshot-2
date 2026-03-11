'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { LayoutDashboard, Users, Receipt, AlertTriangle, LogOut } from 'lucide-react';

export default function AdminDashboard() {
    const [stats, setStats] = useState({ totalUsers: 0, totalTransactions: 0, activeSubs: 0 });
    const [transactions, setTransactions] = useState<any[]>([]);
    const [alerts, setAlerts] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchStats = async () => {
            try {
                const { count: userCount } = await supabase.from('profiles').select('*', { count: 'exact', head: true });
                const { count: txCount } = await supabase.from('pesapal_transactions').select('*', { count: 'exact', head: true });
                const { count: orgCount } = await supabase.from('organizations').select('*', { count: 'exact', head: true }).eq('billing_status', 'active');

                const { data: txData } = await supabase.from('pesapal_transactions').select('*').order('created_at', { ascending: false }).limit(5);
                const { data: notifData } = await supabase.from('notifications').select('*').order('created_at', { ascending: false }).limit(5);

                setStats({
                    totalUsers: userCount || 0,
                    totalTransactions: txCount || 0,
                    activeSubs: orgCount || 0
                });
                setTransactions(txData || []);
                setAlerts(notifData || []);
            } catch (err) {
                console.error('Failed to fetch admin stats:', err);
            } finally {
                setLoading(false);
            }
        };
        fetchStats();
    }, []);

    if (loading) return <div className="p-8 animate-pulse text-gray-500 uppercase tracking-widest font-black">Loading Operations Data...</div>;

    return (
        <div className="p-4 sm:p-8 space-y-8 animate-in fade-in duration-500 max-w-7xl mx-auto">
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

            {/* Quick Stats */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {[
                    { label: 'Total Users', value: stats.totalUsers, icon: Users, color: 'text-blue-500' },
                    { label: 'Transactions', value: stats.totalTransactions, icon: Receipt, color: 'text-emerald-500' },
                    { label: 'Active Seats', value: stats.activeSubs, icon: LayoutDashboard, color: 'text-purple-500' },
                ].map((s, i) => (
                    <div key={i} className="bg-white dark:bg-[#1A1A1A] border border-black/5 dark:border-white/10 p-6 rounded-[2rem] shadow-sm">
                        <div className="flex items-center justify-between">
                            <s.icon className={`w-8 h-8 ${s.color}`} />
                            <span className="text-3xl font-black tabular-nums tracking-tighter">{s.value}</span>
                        </div>
                        <p className="text-[10px] font-black uppercase tracking-widest text-gray-400 mt-4">{s.label}</p>
                    </div>
                ))}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* Recent Billing */}
                <div className="bg-white dark:bg-[#1A1A1A] rounded-[2.5rem] border border-black/5 dark:border-white/10 overflow-hidden shadow-xl">
                    <div className="px-8 py-6 border-b border-black/5 dark:border-white/10 bg-gray-50/50 dark:bg-black/20 flex items-center justify-between">
                        <h3 className="text-sm font-black uppercase tracking-widest flex items-center gap-2">
                            <Receipt className="w-4 h-4" /> Recent Transactions
                        </h3>
                    </div>
                    <div className="p-4 overflow-x-auto">
                        <table className="w-full text-left text-xs font-bold">
                            <thead>
                                <tr className="text-gray-400 uppercase tracking-tighter border-b border-black/5 dark:border-white/10">
                                    <th className="px-4 py-3">Reference</th>
                                    <th className="px-4 py-3">Amount</th>
                                    <th className="px-4 py-3">Status</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-black/5 dark:divide-white/5 uppercase">
                                {transactions.map((tx, i) => (
                                    <tr key={i} className="hover:bg-black/5 dark:hover:bg-white/5 transition-colors">
                                        <td className="px-4 py-3 font-mono text-[10px] tracking-tight">{tx.merchant_reference}</td>
                                        <td className="px-4 py-3">{tx.currency} {tx.amount}</td>
                                        <td className="px-4 py-3">
                                            <span className={`px-2 py-0.5 rounded-full text-[9px] ${tx.status === 'Completed' ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'}`}>
                                                {tx.status}
                                            </span>
                                        </td>
                                    </tr>
                                ))}
                                {transactions.length === 0 && (
                                    <tr><td colSpan={3} className="py-8 text-center text-gray-400 italic">No recent transactions recorded.</td></tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>

                {/* System Alerts */}
                <div className="bg-white dark:bg-[#1A1A1A] rounded-[2.5rem] border border-black/5 dark:border-white/10 overflow-hidden shadow-xl">
                    <div className="px-8 py-6 border-b border-black/5 dark:border-white/10 bg-gray-50/50 dark:bg-black/20 flex items-center justify-between">
                        <h3 className="text-sm font-black uppercase tracking-widest flex items-center gap-2 text-red-500">
                            <AlertTriangle className="w-4 h-4" /> System Alerts & Logs
                        </h3>
                    </div>
                    <div className="p-6 space-y-4">
                        {alerts.map((alert, i) => (
                            <div key={i} className="flex gap-4 p-4 rounded-2xl bg-gray-50 dark:bg-black/30 border border-black/5 dark:border-white/5">
                                <div className="mt-1"><AlertTriangle className="w-4 h-4 text-orange-500" /></div>
                                <div>
                                    <p className="text-xs font-bold tracking-tight">{alert.message}</p>
                                    <p className="text-[9px] text-gray-400 mt-1 uppercase tracking-widest">{new Date(alert.created_at).toLocaleString()}</p>
                                </div>
                            </div>
                        ))}
                        {alerts.length === 0 && (
                            <p className="text-center py-8 text-gray-400 text-xs italic">System monitoring active. No critical alerts found.</p>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
