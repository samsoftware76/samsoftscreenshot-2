'use client';

import { Auth } from '@supabase/auth-ui-react';
import { ThemeSupa } from '@supabase/auth-ui-shared';
import { supabase } from '@/integrations/supabase/client';

export default function AuthUI() {
    return (
        <div className="w-full max-w-sm mx-auto p-8 bg-white dark:bg-[#1A1A1A] rounded-[2.5rem] shadow-2xl border border-black/5 dark:border-white/10">
            <div className="flex flex-col items-center mb-8">
                <div className="w-16 h-16 bg-black rounded-full flex items-center justify-center shadow-xl mb-6 overflow-hidden">
                    <img src="/logo.svg" alt="Logo" className="w-10 h-10" />
                </div>
                <h2 className="text-2xl font-black text-black dark:text-white tracking-tighter text-center">Software Challenge Solver</h2>
                <p className="text-xs font-bold text-gray-400 mt-2 uppercase tracking-[0.2em]">Military Grade Access</p>
            </div>

            <Auth
                supabaseClient={supabase}
                appearance={{
                    theme: ThemeSupa,
                    variables: {
                        default: {
                            colors: {
                                brand: '#000000',
                                brandAccent: '#333333',
                            },
                        },
                    },
                    className: {
                        container: 'font-sans',
                        button: 'rounded-xl font-bold uppercase tracking-widest text-[10px] py-3',
                        input: 'rounded-xl border-gray-100 dark:border-white/10 bg-gray-50 dark:bg-white/5',
                    }
                }}
                providers={['google', 'github']}
                theme="dark"
            />
        </div>
    );
}
