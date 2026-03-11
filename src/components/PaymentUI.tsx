'use client';

import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { Session } from '@supabase/supabase-js';

export default function PaymentUI({ session }: { session: Session }) {
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const handleSubscribe = async () => {
        setLoading(true);
        setError(null);
        try {
            // Submit Order directly (IPN is handled via Supabase Secrets "No Shortcuts" way)
            const { data, error: fnError } = await supabase.functions.invoke('pesapal', {
                body: {
                    action: 'submit-order',
                    order_id: crypto.randomUUID(),
                    amount: 10,
                    currency: 'USD',
                    email: session.user.email,
                    firstName: session.user.email?.split('@')[0] || 'User',
                    lastName: '',
                    description: 'Military Grade Premium Subscription',
                    callback_url: window.location.origin,
                }
            });

            if (fnError) throw fnError;

            if (data?.redirect_url) {
                window.location.href = data.redirect_url;
            } else {
                console.error('Pesapal response error:', data);
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
        <div className="p-6 bg-white dark:bg-[#1A1A1A] rounded-[2rem] border border-black/5 dark:border-white/10 shadow-xl">
            <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 bg-black rounded-xl flex items-center justify-center">
                    <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
                </div>
                <div>
                    <h3 className="text-lg font-black text-black dark:text-white tracking-tighter uppercase">Military Grade Premium</h3>
                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest leading-none">Unlock Unlimited Solves</p>
                </div>
            </div>

            <p className="text-sm text-gray-500 dark:text-gray-400 mb-6 font-medium leading-relaxed">
                Get unlimited access to advanced code analysis, essay generation, and handwriting OCR for just $10/month.
            </p>

            {error && <p className="text-xs font-bold text-red-500 mb-4">{error}</p>}

            <button
                onClick={handleSubscribe}
                disabled={loading}
                className="w-full py-4 bg-black dark:bg-white text-white dark:text-black rounded-2xl font-black uppercase tracking-[0.2em] text-[10px] shadow-2xl hover:scale-[1.02] active:scale-95 transition-all disabled:opacity-50"
            >
                {loading ? 'Initiating...' : 'Subscribe via Pesapal'}
            </button>
        </div>
    );
}
