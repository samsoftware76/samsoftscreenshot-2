'use client';

import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { Session } from '@supabase/supabase-js';

const tiers = [
    { credits: 100, price: 5, label: 'Basic' },
    { credits: 200, price: 10, label: 'Standard' },
    { credits: 300, price: 14, label: 'Plus' },
    { credits: 500, price: 20, label: 'Pro' },
    { credits: 1000, price: 35, label: 'Elite' },
    { credits: 2000, price: 60, label: 'Military' },
    { credits: 5000, price: 140, label: 'Enterprise' },
];

export default function PaymentUI({ session }: { session: Session }) {
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [selectedTier, setSelectedTier] = useState(tiers[1]); // Default to $10

    const handleBuyCredits = async (tier: typeof tiers[0]) => {
        setLoading(true);
        setError(null);
        try {
            const { data, error: fnError } = await supabase.functions.invoke('pesapal', {
                body: {
                    action: 'submit-order',
                    order_id: crypto.randomUUID(),
                    amount: tier.price,
                    currency: 'USD',
                    email: session.user.email,
                    firstName: session.user.email?.split('@')[0] || 'User',
                    lastName: '',
                    description: `Challenge Solver Credits: ${tier.credits} Points (${tier.label})`,
                    callback_url: window.location.origin,
                }
            });

            if (fnError) throw fnError;

            if (data?.redirect_url) {
                window.location.href = data.redirect_url;
            } else {
                throw new Error(data?.error || 'No redirect URL received from Pesapal');
            }
        } catch (err: any) {
            console.error('Payment error:', err);
            setError(err.message || 'Failed to initiate payment');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="p-4 sm:p-6 bg-white dark:bg-[#111] rounded-[2rem] border border-black/5 dark:border-white/10 shadow-2xl">
            <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 bg-black rounded-xl flex items-center justify-center shadow-lg">
                    <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
                </div>
                <div>
                    <h3 className="text-lg font-black text-black dark:text-white tracking-tighter uppercase">Credit Exchange</h3>
                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest leading-none">Military-Grade Value</p>
                </div>
            </div>

            <div className="grid grid-cols-2 gap-2 mb-6">
                {tiers.map((tier) => (
                    <button
                        key={tier.label}
                        onClick={() => setSelectedTier(tier)}
                        className={`p-3 rounded-2xl border-2 transition-all flex flex-col items-center justify-center gap-1 ${selectedTier.label === tier.label
                            ? 'border-black dark:border-white bg-black dark:bg-white text-white dark:text-black scale-[1.02] shadow-xl'
                            : 'border-gray-100 dark:border-white/5 hover:border-gray-300 dark:hover:border-white/20'
                            }`}
                    >
                        <span className="text-[10px] font-black uppercase tracking-widest">{tier.label}</span>
                        <span className="text-xl font-black">${tier.price}</span>
                        <span className="text-[9px] font-bold opacity-60 uppercase">{tier.credits} Credits</span>
                    </button>
                ))}
            </div>

            {error && <p className="text-[10px] font-bold text-red-500 mb-4 bg-red-50 dark:bg-red-950/20 p-2 rounded-lg text-center uppercase tracking-tighter">{error}</p>}

            <button
                onClick={() => handleBuyCredits(selectedTier)}
                disabled={loading}
                className="w-full py-4 bg-black dark:bg-white text-white dark:text-black rounded-2xl font-black uppercase tracking-[0.2em] text-[10px] shadow-2xl hover:scale-[1.02] active:scale-95 transition-all disabled:opacity-20"
            >
                {loading ? 'Routing to Secure Gateway...' : `Checkout - $${selectedTier.price}`}
            </button>
            <p className="mt-4 text-[8px] font-bold text-gray-400 text-center uppercase tracking-widest leading-relaxed">
                Secure 256-bit encrypted checkout via Pesapal v3
            </p>
        </div>
    );
}
