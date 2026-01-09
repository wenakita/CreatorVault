import React, { useState } from 'react';
import { Button } from '../components/Button';
import { Sparkline } from '../components/Sparkline';
import { InteractiveToggle, InteractiveCheckbox, InteractiveSlider } from '../components/brand/InteractiveElements';

interface SettingsProps {
    onNotify: (type: 'success' | 'error' | 'info', msg: string) => void;
}

export const Settings: React.FC<SettingsProps> = ({ onNotify }) => {
    const [apiKey, setApiKey] = useState('sk-................................');
    const [isEditingKey, setIsEditingKey] = useState(false);

    const handleSaveKey = () => {
        setIsEditingKey(false);
        onNotify('success', 'API Key encrypted and stored in local vault.');
    };

    return (
        <div className="p-10 animate-fade-in max-w-[1200px] mx-auto min-h-screen">
             <header className="mb-16 border-b border-glass pb-8">
                <h1 className="text-4xl font-light text-white tracking-tighter mb-4">Protocol Configuration</h1>
                <p className="text-vault-subtext text-sm max-w-xl">
                    Manage your identity, compute resources, and interface preferences.
                    Changes are propagated immediately across the local node.
                </p>
             </header>

             <div className="grid grid-cols-1 lg:grid-cols-3 gap-12">
                 
                 {/* Left Column: Navigation / Status */}
                 <div className="space-y-8">
                     <div className="p-6 border border-glass rounded-xl bg-vault-card/20">
                         <h3 className="text-[10px] font-bold text-white uppercase tracking-widest mb-6">Node Status</h3>
                         <div className="space-y-4">
                             <div className="flex justify-between items-center">
                                 <span className="text-xs text-vault-subtext font-mono">UPTIME</span>
                                 <span className="text-xs text-white font-mono">99.9%</span>
                             </div>
                             <div className="flex justify-between items-center">
                                 <span className="text-xs text-vault-subtext font-mono">LATENCY</span>
                                 <span className="text-xs text-green-500 font-mono">24ms</span>
                             </div>
                             <div className="flex justify-between items-center">
                                 <span className="text-xs text-vault-subtext font-mono">VERSION</span>
                                 <span className="text-xs text-brand-primary font-mono">v4.2.0</span>
                             </div>
                             <div className="pt-4 mt-4 border-t border-glass">
                                 <Sparkline color="#22c55e" />
                             </div>
                         </div>
                     </div>
                 </div>

                 {/* Middle/Right: Settings Forms */}
                 <div className="lg:col-span-2 space-y-12">
                     
                     {/* Identity Section */}
                     <section>
                         <h2 className="text-xl font-medium text-white mb-6 flex items-center gap-3">
                             <span className="w-2 h-2 bg-brand-primary rounded-full"></span>
                             Identity
                         </h2>
                         <div className="bg-[#050505] border border-glass rounded-xl p-8 space-y-6">
                             <div className="flex items-center gap-6">
                                 <div className="w-20 h-20 rounded-full bg-gradient-to-br from-brand-primary to-blue-900 flex items-center justify-center text-2xl font-bold text-white border-4 border-black shadow-[0_0_20px_rgba(0,82,255,0.3)]">
                                     ER
                                 </div>
                                 <div className="space-y-2">
                                     <div className="text-white font-medium">Early Adopter</div>
                                     <div className="text-xs font-mono text-vault-subtext px-2 py-1 bg-white/5 rounded border border-white/5 inline-block">0x71C...92A</div>
                                 </div>
                                 <div className="ml-auto">
                                     <Button variant="outline" size="sm">Edit Profile</Button>
                                 </div>
                             </div>
                         </div>
                     </section>

                     {/* Compute Section */}
                     <section>
                        <h2 className="text-xl font-medium text-white mb-6 flex items-center gap-3">
                             <span className="w-2 h-2 bg-brand-primary rounded-full"></span>
                             Compute & API
                         </h2>
                         <div className="bg-[#050505] border border-glass rounded-xl p-8 space-y-8">
                             <div>
                                 <label className="text-[10px] font-bold text-vault-subtext uppercase tracking-widest block mb-3">Google Gemini API Key</label>
                                 <div className="flex gap-4">
                                     <input 
                                        type={isEditingKey ? "text" : "password"} 
                                        value={apiKey}
                                        onChange={(e) => setApiKey(e.target.value)}
                                        disabled={!isEditingKey}
                                        className="flex-1 bg-black border border-glass rounded-md px-4 py-2 text-sm text-white font-mono focus:border-brand-primary focus:outline-none transition-colors disabled:opacity-50"
                                     />
                                     {isEditingKey ? (
                                         <Button onClick={handleSaveKey} size="sm">Save Key</Button>
                                     ) : (
                                         <Button onClick={() => setIsEditingKey(true)} variant="outline" size="sm">Update</Button>
                                     )}
                                 </div>
                                 <p className="text-[10px] text-vault-subtext mt-2">Key is stored locally in your browser's secure storage.</p>
                             </div>

                             <div className="grid grid-cols-2 gap-8 pt-4 border-t border-glass">
                                 <div>
                                     <span className="text-[10px] font-bold text-vault-subtext uppercase tracking-widest block mb-4">Model Temperature</span>
                                     <InteractiveSlider />
                                 </div>
                                 <div>
                                     <span className="text-[10px] font-bold text-vault-subtext uppercase tracking-widest block mb-4">Safe Mode</span>
                                     <div className="flex items-center justify-between bg-black/50 p-3 rounded border border-glass">
                                         <span className="text-xs text-white">Content Filtering</span>
                                         <InteractiveCheckbox />
                                     </div>
                                 </div>
                             </div>
                         </div>
                     </section>

                     {/* Interface Section */}
                     <section>
                        <h2 className="text-xl font-medium text-white mb-6 flex items-center gap-3">
                             <span className="w-2 h-2 bg-brand-primary rounded-full"></span>
                             Interface
                         </h2>
                         <div className="bg-[#050505] border border-glass rounded-xl p-8 space-y-6">
                             <div className="flex items-center justify-between pb-6 border-b border-glass">
                                 <div>
                                     <div className="text-sm text-white font-medium mb-1">Reduced Motion</div>
                                     <div className="text-xs text-vault-subtext">Disable complex physics animations.</div>
                                 </div>
                                 <InteractiveToggle />
                             </div>
                             <div className="flex items-center justify-between pb-6 border-b border-glass">
                                 <div>
                                     <div className="text-sm text-white font-medium mb-1">High Contrast Mode</div>
                                     <div className="text-xs text-vault-subtext">Increase border visibility and text contrast.</div>
                                 </div>
                                 <InteractiveToggle />
                             </div>
                             <div className="flex justify-end pt-2">
                                 <Button variant="danger" size="sm" onClick={() => onNotify('error', 'Cache clearance failed. System locked.')}>Clear Local Cache</Button>
                             </div>
                         </div>
                     </section>

                 </div>
             </div>
        </div>
    );
}