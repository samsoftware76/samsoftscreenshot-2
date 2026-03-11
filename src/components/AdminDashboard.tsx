'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

export default function AdminDashboard() {
    const [stats, setStats] = useState({ totalUsers: 0, totalTransactions: 0, activeSubscriptions: 0 });
    const [transactions, setTransactions] = useState<any[]>([]);
    const [notifications, setNotifications] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchAdminData = async () => {
            try {
                const { count: userCount } = await supabase.from('profiles').select('*', { count: 'exact', head: true });
                const { count: txCount, data: txData } = await supabase.from('pesapal_transactions').select('*', { count: 'exact' }).order('created_at', { ascending: false }).limit(10);

                const { count: activeCount } = await supabase.from('organizations').select('*', { count: 'exact', head: true }).eq('billing_status', 'active');

                setStats({
                    totalUsers: userCount || 0,
                    totalTransactions: txCount || 0,
                    activeSubscriptions: activeCount || 0
                });
                setTransactions(txData || []);

                const { data: notifData } = await supabase.from('notifications').select('*').order('created_at', { ascending: false }).limit(20);
                setNotifications(notifData || []);
            } catch (err) {
                console.error('Admin fetch error:', err);
            } finally {
                setLoading(false);
            }
        };

        fetchAdminData();
    }, []);

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

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <StatCard title="Total Personnel" value={stats.totalUsers} icon="👥" />
                <StatCard title="Revenue Events" value={stats.totalTransactions} icon="💳" />
                <StatCard title="Active Deployments" value={stats.activeSubscriptions} icon="🚀" />
            </div>

            <div className="bg-white dark:bg-[#1A1A1A] rounded-[2rem] border border-black/5 dark:border-white/10 overflow-hidden shadow-2xl">
                <div className="px-8 py-6 border-b border-black/5 dark:border-white/5 bg-gray-50 dark:bg-black/20">
                    <h3 className="text-sm font-black uppercase tracking-widest text-black dark:text-white">Recent Transactions</h3>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="text-[10px] font-black uppercase tracking-widest text-gray-400 border-b border-black/5 dark:border-white/5">
                                <th className="px-8 py-4">Ref</th>
                                <th className="px-8 py-4">Amount</th>
                                <th className="px-8 py-4">Status</th>
                                <th className="px-8 py-4">Date</th>
                            </tr>
                        </thead>
                        <tbody className="text-xs font-medium">
                            {transactions.map((tx) => (
                                <tr key={tx.id} className="border-b border-black/5 dark:border-white/5 hover:bg-black/5 dark:hover:bg-white/5 transition-colors">
                                    <td className="px-8 py-4 font-bold text-black dark:text-white uppercase truncate max-w-[120px]">{tx.merchant_reference}</td>
                                    <td className="px-8 py-4 text-black dark:text-white">${tx.amount}</td>
                                    <td className="px-8 py-4">
                                        <span className={`px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest ${tx.status === 'COMPLETED' ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'
                                            }`}>
                                            {tx.status}
                                        </span>
                                    </td>
                                    <td className="px-8 py-4 text-gray-500">{new Date(tx.created_at).toLocaleDateString()}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            <div className="bg-white dark:bg-[#1A1A1A] rounded-[2rem] border border-black/5 dark:border-white/10 overflow-hidden shadow-2xl">
                <div className="px-8 py-6 border-b border-black/5 dark:border-white/5 bg-gray-50 dark:bg-black/20 flex items-center justify-between">
                    <h3 className="text-sm font-black uppercase tracking-widest text-black dark:text-white">System Alerts & Logs</h3>
                    <div className="px-3 py-1 bg-red-500 text-white text-[9px] font-black rounded-full animate-pulse">LIVE</div>
                </div>
                <div className="p-4 space-y-4">
                    {notifications.length === 0 ? (
                        <p className="p-8 text-center text-xs font-bold text-gray-400 uppercase tracking-widest">No recent system alerts</p>
                    ) : (
                        notifications.map((n) => (
                            <div key={n.id} className="p-4 bg-black/5 dark:bg-white/5 rounded-2xl border border-black/5 dark:border-white/5 flex gap-4 items-start">
                                <div className={`w-2 h-2 rounded-full mt-1.5 shrink-0 ${n.type === 'SYSTEM' ? 'bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.5)]' : 'bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.5)]'}`} />
                                <div className="space-y-1 min-w-0">
                                    <div className="flex items-center gap-2">
                                        <span className="text-[10px] font-bold text-black dark:text-white uppercase tracking-widest">{n.type}</span>
                                        <span className="text-[9px] font-medium text-gray-400">{new Date(n.created_at).toLocaleString()}</span>
                                    </div>
                                    <p className="text-xs font-medium text-gray-600 dark:text-gray-400 leading-relaxed truncate">{n.message}</p>
                                    <p className="text-[9px] font-bold text-gray-400 uppercase tracking-tighter">Recipient: {n.recipient_email}</p>
                                </div>
                            </div>
                        ))
                    )}
                </div>
            </div>
        </div>
    );
}

function StatCard({ title, value, icon }: { title: string, value: number, icon: string }) {
    return (
        <div className="bg-white dark:bg-[#1A1A1A] p-8 rounded-[2rem] border border-black/5 dark:border-white/10 shadow-xl group hover:scale-[1.02] transition-all">
            <div className="text-3xl mb-4 grayscale group-hover:grayscale-0 transition-all">{icon}</div>
            <p className="text-[10px] font-black uppercase tracking-widest text-gray-400 mb-1">{title}</p>
            <p className="text-4xl font-black text-black dark:text-white tracking-tighter">{value}</p>
        </div>
    );
}
