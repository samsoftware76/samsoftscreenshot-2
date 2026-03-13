'use client';

import { Auth } from '@supabase/auth-ui-react';
import { ThemeSupa } from '@supabase/auth-ui-shared';
import { supabase } from '@/integrations/supabase/client';

export default function AuthUI({ initialView = 'sign_in' }: { initialView?: 'sign_in' | 'sign_up' | 'magic_link' | 'forgotten_password' | 'update_password' }) {
    return (
        <div className="w-full max-w-sm mx-auto p-8 bg-[#0A0A0A] rounded-[2.5rem] shadow-2xl border border-white/10">
            <div className="flex flex-col items-center mb-8">
                <div className="w-16 h-16 bg-[#1a1a1a] rounded-full flex items-center justify-center shadow-xl mb-6 overflow-hidden border border-white/5">
                    <img src="/logo.svg" alt="Logo" className="w-10 h-10 invert" />
                </div>
                <h2 className="text-2xl font-black text-white tracking-tighter text-center">Ask Connie Ai</h2>
                <p className="text-xs font-bold text-[#555577] mt-2 uppercase tracking-[0.2em]">Personal Intelligence Partner</p>
            </div>

            <Auth
                supabaseClient={supabase}
                view={initialView}
                appearance={{
                    theme: ThemeSupa,
                    variables: {
                        default: {
                            colors: {
                                brand: '#4f8ef7',
                                brandAccent: '#3a7de6',
                                inputBackground: '#12121e',
                                inputText: 'white',
                                inputPlaceholder: '#555577',
                                inputBorder: '#1e1e35',
                            },
                        },
                    },
                    className: {
                        container: 'font-sans',
                        button: 'rounded-xl font-bold uppercase tracking-widest text-[10px] py-3 shadow-lg',
                        input: 'rounded-xl border-[#1e1e35] bg-[#12121e] text-white',
                    }
                }}
                providers={['google']}
                theme="dark"
            />
        </div>
    );
}
