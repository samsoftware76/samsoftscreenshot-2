import React from 'react';
import { LucideIcon, ShieldCheck, Zap, Layers, MessageSquare, Code, BookOpen, PenTool, Globe, ChevronRight } from 'lucide-react';

interface FeatureProps {
    icon: LucideIcon;
    title: string;
    description: string;
}

const FeatureCard = ({ icon: Icon, title, description }: FeatureProps) => (
    <div className="p-8 rounded-[2rem] bg-[#12121e] border border-[#1e1e35] hover:border-[#4f8ef7]/30 transition-all duration-500 group">
        <div className="w-14 h-14 rounded-2xl bg-[#4f8ef7]/10 flex items-center justify-center mb-6 group-hover:scale-110 transition-transform duration-500">
            <Icon className="text-[#4f8ef7] w-7 h-7" />
        </div>
        <h3 className="text-xl font-bold text-white mb-3 tracking-tight">{title}</h3>
        <p className="text-sm text-[#555577] leading-relaxed">{description}</p>
    </div>
);

interface LandingPageProps {
    onGetStarted: () => void;
}

export default function LandingPage({ onGetStarted }: LandingPageProps) {
    const whatsappLink = "https://wa.me/256783647260";

    return (
        <div className="min-h-screen bg-[#08080f] text-[#e8e8f8] selection:bg-[#4f8ef7]/30">
            {/* Navigation */}
            <nav className="fixed top-0 left-0 right-0 h-20 border-b border-white/5 bg-[#08080f]/80 backdrop-blur-xl z-[100] px-6">
                <div className="max-w-7xl mx-auto h-full flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#4f8ef7] to-[#9f6ef5] flex items-center justify-center shadow-[0_0_20px_rgba(79,142,247,0.3)]">
                            <img src="/logo.svg" alt="Connie" className="w-7 h-7 invert" />
                        </div>
                        <div className="text-xl font-black tracking-tighter">
                            <span className="bg-gradient-to-r from-[#4f8ef7] to-[#9f6ef5] bg-clip-text text-transparent">Ask Connie</span>
                            <span className="text-white ml-1">Ai</span>
                        </div>
                    </div>
                    
                    <div className="flex items-center gap-6">
                        <a href={whatsappLink} target="_blank" rel="noopener noreferrer" className="hidden md:flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-[#555577] hover:text-[#4f8ef7] transition-colors">
                            <Globe className="w-3 h-3" />
                            Global Support
                        </a>
                        <button 
                            onClick={onGetStarted}
                            className="px-6 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-white text-[10px] font-black uppercase tracking-widest transition-all active:scale-95"
                        >
                            Log In
                        </button>
                    </div>
                </div>
            </nav>

            {/* Hero Section */}
            <section className="pt-40 pb-20 px-6 relative overflow-hidden">
                <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-7xl h-full -z-10 pointer-events-none">
                    <div className="absolute top-0 right-0 w-96 h-96 bg-[#4f8ef7]/10 blur-[120px] rounded-full animate-pulse" />
                    <div className="absolute bottom-0 left-0 w-96 h-96 bg-[#9f6ef5]/10 blur-[120px] rounded-full animate-pulse" style={{ animationDelay: '1s' }} />
                </div>
                
                <div className="max-w-4xl mx-auto text-center space-y-8">
                    <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-[#4f8ef7]/10 border border-[#4f8ef7]/20 text-[10px] font-black uppercase tracking-[0.2em] text-[#4f8ef7] animate-in slide-in-from-bottom-4 duration-500">
                        <Zap className="w-3 h-3 fill-current" />
                        Next-Gen Intelligence
                    </div>
                    
                    <h1 className="text-5xl md:text-7xl font-black tracking-tight leading-[1.1] animate-in slide-in-from-bottom-8 duration-700">
                        Solve Challenges with <br />
                        <span className="bg-gradient-to-r from-[#4f8ef7] via-[#9f6ef5] to-[#4f8ef7] bg-[length:200%_auto] bg-clip-text text-transparent animate-text-gradient">Professional Precision.</span>
                    </h1>
                    
                    <p className="text-lg md:text-xl text-[#555577] max-w-2xl mx-auto leading-relaxed animate-in slide-in-from-bottom-10 duration-1000">
                        Ask Connie Ai combines multi-modal document analysis, handwriting OCR, and reasoning engines into one powerful interface.
                    </p>
                    
                    <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-4 animate-in slide-in-from-bottom-12 duration-[1200ms]">
                        <button 
                            onClick={onGetStarted}
                            className="w-full sm:w-auto px-10 py-5 rounded-2xl bg-[#4f8ef7] hover:bg-[#3d7ed9] text-white text-xs font-black uppercase tracking-widest transition-all shadow-[0_20px_40px_rgba(79,142,247,0.2)] active:scale-95 flex items-center justify-center gap-3"
                        >
                            Get Started Now
                            <ChevronRight className="w-4 h-4" />
                        </button>
                        <a 
                            href={whatsappLink}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="w-full sm:w-auto px-10 py-5 rounded-2xl bg-white/5 hover:bg-white/10 border border-white/10 text-white text-xs font-black uppercase tracking-widest transition-all flex items-center justify-center gap-3"
                        >
                            Contact WhatsApp
                            <MessageSquare className="w-4 h-4" />
                        </a>
                    </div>
                </div>
            </section>

            {/* Why Choose Us */}
            <section className="py-24 px-6 bg-[#0c0c18]/50 border-y border-white/5">
                <div className="max-w-7xl mx-auto">
                    <div className="text-center mb-16 space-y-4">
                        <h2 className="text-3xl md:text-4xl font-black text-white tracking-tight">Why Choose Ask Connie Ai?</h2>
                        <p className="text-[#555577] text-sm font-bold uppercase tracking-widest">Built for Performance & Scale</p>
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                        <FeatureCard 
                            icon={Zap}
                            title="Instant Analysis"
                            description="From complex codebases to handwritten notes, get professional-grade solutions in seconds."
                        />
                        <FeatureCard 
                            icon={ShieldCheck}
                            title="Bank-Grade Security"
                            description="Your data is your own. We use enterprise-level encryption to protect your sessions and documents."
                        />
                        <FeatureCard 
                            icon={Layers}
                            title="Multi-Modal Context"
                            description="Switch between code solving, essay writing, and document analysis seamlessly without losing focus."
                        />
                    </div>
                </div>
            </section>

            {/* Features Breakdown */}
            <section className="py-24 px-6">
                <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
                    <div className="space-y-8 order-2 lg:order-1">
                        <div className="space-y-4">
                            <h2 className="text-4xl font-black text-white tracking-tight leading-tight">Comprehensive AI Tools <br /> for Modern Problems.</h2>
                            <p className="text-[#555577] leading-relaxed">
                                Our platform integrates with the world's leading intelligence models to provide specialized support for every domain.
                            </p>
                        </div>
                        
                        <div className="space-y-6">
                            {[
                                { icon: Code, title: 'Technical Logic', desc: 'Step-by-step logic for complex engineering challenges.' },
                                { icon: PenTool, title: 'Professional Writing', desc: 'Humanized, context-aware content generation.' },
                                { icon: BookOpen, title: 'Academic OCR', desc: 'Scan and solve handwritten homework or scientific papers.' }
                            ].map((item, i) => (
                                <div key={i} className="flex gap-4 p-4 rounded-2xl bg-[#12121e]/50 border border-white/5 hover:bg-[#12121e] transition-colors">
                                    <div className="w-10 h-10 shrink-0 rounded-xl bg-white/5 flex items-center justify-center">
                                        <item.icon className="w-5 h-5 text-[#4f8ef7]" />
                                    </div>
                                    <div>
                                        <h4 className="text-sm font-bold text-white mb-1 uppercase tracking-wider">{item.title}</h4>
                                        <p className="text-xs text-[#555577]">{item.desc}</p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                    
                    <div className="order-1 lg:order-2">
                        <div className="relative aspect-square">
                            <div className="absolute inset-0 bg-gradient-to-br from-[#4f8ef7]/20 to-[#9f6ef5]/20 rounded-[3rem] blur-2xl" />
                            <div className="relative h-full bg-[#12121e] border border-[#1e1e35] rounded-[3rem] p-8 flex flex-col justify-center items-center text-center space-y-6 shadow-2xl">
                                <div className="w-24 h-24 rounded-full bg-gradient-to-br from-[#4f8ef7] to-[#9f6ef5] flex items-center justify-center p-0.5 shadow-xl animate-bounce duration-[3000ms]">
                                    <div className="w-full h-full rounded-full bg-[#08080f] flex items-center justify-center">
                                        <img src="/logo.svg" alt="Connie" className="w-12 h-12" />
                                    </div>
                                </div>
                                <div className="space-y-2">
                                    <div className="text-2xl font-black text-white">Ask Connie Ai v2.0</div>
                                    <div className="text-[10px] font-black uppercase tracking-[0.3em] text-[#4f8ef7]">Deployment Ready</div>
                                </div>
                                <div className="flex gap-2">
                                    {[1, 2, 3].map(i => (
                                        <div key={i} className={`w-2 h-2 rounded-full bg-[#4f8ef7] ${i === 2 ? 'opacity-100' : 'opacity-30'}`} />
                                    ))}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            {/* Footer */}
            <footer className="py-20 px-6 border-t border-white/5 bg-[#0c0c18]">
                <div className="max-w-7xl mx-auto">
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-12 mb-16">
                        <div className="md:col-span-2 space-y-6">
                            <div className="flex items-center gap-3">
                                <div className="w-8 h-8 rounded-lg bg-[#4f8ef7] flex items-center justify-center">
                                    <img src="/logo.svg" alt="Connie" className="w-5 h-5 invert" />
                                </div>
                                <span className="text-lg font-black tracking-tight text-white">Ask Connie Ai</span>
                            </div>
                            <p className="max-w-xs text-sm text-[#555577] leading-relaxed">
                                Professional AI support for the next generation of solvers. Empowering users with multi-modal intelligence and commercial-grade reliability.
                            </p>
                            <div className="text-[10px] font-black text-white/20 uppercase tracking-widest">
                                Developed by Sam Software LLC
                            </div>
                        </div>
                        
                        <div className="space-y-4">
                            <h4 className="text-xs font-black uppercase tracking-[0.2em] text-[#555577]">Quick Links</h4>
                            <ul className="space-y-2 text-sm text-[#444466]">
                                <li><button onClick={onGetStarted} className="hover:text-white transition-colors">Log In</button></li>
                                <li><a href={whatsappLink} className="hover:text-white transition-colors">WhatsApp Contact</a></li>
                            </ul>
                        </div>
                        
                        <div className="space-y-4">
                            <h4 className="text-xs font-black uppercase tracking-[0.2em] text-[#555577]">Contact</h4>
                            <div className="space-y-3">
                                <a href="mailto:samsoftware75@gmail.com" className="block text-sm text-[#e8e8f8] hover:text-[#4f8ef7] transition-colors">samsoftware75@gmail.com</a>
                                <a href={whatsappLink} className="block text-sm text-[#e8e8f8] hover:text-[#4f8ef7] transition-colors">+256 783 647 260</a>
                                <div className="pt-2">
                                    <a href={whatsappLink} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-[#25D366]/10 text-[#25D366] text-[10px] font-black uppercase tracking-widest border border-[#25D366]/20 hover:bg-[#25D366] hover:text-white transition-all">
                                        <MessageSquare className="w-3 h-3" />
                                        WhatsApp Chat
                                    </a>
                                </div>
                            </div>
                        </div>
                    </div>
                    
                    <div className="pt-8 border-t border-white/5 flex flex-col md:flex-row justify-between items-center gap-4">
                        <p className="text-[10px] text-[#444466] uppercase tracking-widest">© 2026 Sam Software LLC. All rights reserved.</p>
                        <div className="flex gap-6 text-[10px] text-[#444466] uppercase tracking-widest">
                            <a href="#" className="hover:text-white transition-colors">Privacy Policy</a>
                            <a href="#" className="hover:text-white transition-colors">Terms of Service</a>
                        </div>
                    </div>
                </div>
            </footer>
        </div>
    );
}
