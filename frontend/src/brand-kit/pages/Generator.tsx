import React, { useState, useEffect, useRef } from 'react';
import { AssetType, VaultAsset } from '../types';
import { Button } from '../components/Button';
import { generateCreativeText, generateCreativeImage } from '../services/geminiService';
import { v4 as uuidv4 } from 'uuid';

interface GeneratorProps {
  onSave: (asset: VaultAsset) => void;
  onCancel: () => void;
}

// Simulated system logs for the "fabrication" process
const SYSTEM_LOGS = [
    "Initializing neural handshake...",
    "Allocating tensor cores [Cluster A]...",
    "Retrieving latent space vectors...",
    "Optimizing diffusion paths...",
    "Refining high-frequency details...",
    "Applying perceptual compression...",
    "Verifying output integrity...",
    "Render complete."
];

export const Generator: React.FC<GeneratorProps> = ({ onSave, onCancel }) => {
  const [activeTab, setActiveTab] = useState<'image' | 'text'>('image');
  const [prompt, setPrompt] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedContent, setGeneratedContent] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  
  // Terminal Logic
  const [logs, setLogs] = useState<string[]>([]);
  const logContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (logContainerRef.current) {
        logContainerRef.current.scrollTop = logContainerRef.current.scrollHeight;
    }
  }, [logs]);

  const handleGenerate = async () => {
    if (!prompt.trim()) return;
    setIsGenerating(true);
    setError(null);
    setGeneratedContent(null);
    setLogs([]); // Reset logs

    // Start simulating logs
    let logIndex = 0;
    const logInterval = setInterval(() => {
        if (logIndex < SYSTEM_LOGS.length) {
            setLogs(prev => [...prev, `> ${SYSTEM_LOGS[logIndex]} ${Math.floor(Math.random() * 50) + 10}ms`]);
            logIndex++;
        }
    }, 600);

    try {
      let result = '';
      if (activeTab === 'image') {
        result = await generateCreativeImage(prompt);
      } else {
        result = await generateCreativeText(prompt);
      }
      
      // Artificial delay to let logs play out a bit if API is too fast
      await new Promise(r => setTimeout(r, 1500)); 
      
      setGeneratedContent(result);
    } catch (err) {
      setError("System Failure: Generation protocol interrupted.");
      setLogs(prev => [...prev, "> CRITICAL ERROR: Connection Terminated."]);
    } finally {
      clearInterval(logInterval);
      setIsGenerating(false);
    }
  };

  const handleSave = async () => {
    if (!generatedContent) return;
    const title = activeTab === 'image' ? `Visual: ${prompt.slice(0, 15)}...` : `Note: ${prompt.slice(0, 15)}...`;

    const newAsset: VaultAsset = {
      id: uuidv4(),
      title: title,
      type: activeTab === 'image' ? AssetType.IMAGE : AssetType.IDEA,
      content: generatedContent,
      createdAt: Date.now(),
      tags: ['AI Generated', activeTab]
    };
    onSave(newAsset);
  };

  return (
    <div className="h-[calc(100vh-1rem)] p-6 flex flex-col animate-fade-in gap-6 max-w-[1800px] mx-auto">
        <header className="flex items-center justify-between px-6 py-5 bg-vault-card border border-glass rounded-xl shadow-2xl">
            <div className="flex items-center gap-6">
                <button onClick={onCancel} className="text-vault-subtext hover:text-white text-xs uppercase tracking-widest transition-colors flex items-center gap-2 group">
                    <span className="group-hover:-translate-x-1 transition-transform">←</span>
                    Abort Sequence
                </button>
                <div className="h-4 w-[1px] bg-glass"></div>
                <div className="flex flex-col">
                     <h1 className="text-sm font-medium text-white tracking-wide">Fabrication Studio</h1>
                     <span className="text-[9px] font-mono text-brand-primary opacity-80">Connected: Node_01</span>
                </div>
            </div>
            
            <div className="bg-[#050505] p-1 rounded-lg border border-glass flex gap-1">
                 {['image', 'text'].map((tab) => (
                    <button 
                        key={tab}
                        onClick={() => setActiveTab(tab as any)}
                        className={`px-6 py-2 rounded-md text-[10px] font-bold font-mono transition-all uppercase tracking-widest ${
                            activeTab === tab 
                            ? 'bg-brand-primary text-white shadow-[0_0_15px_rgba(0,82,255,0.4)]' 
                            : 'text-vault-subtext hover:text-white hover:bg-white/5'
                        }`}
                    >
                        {tab}
                    </button>
                 ))}
            </div>
        </header>

      <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 gap-6 min-h-0">
        {/* Left: Input Console */}
        <div className="lg:col-span-4 flex flex-col gap-6">
             <div className="bg-[#080808] rounded-xl border border-glass flex flex-col flex-1 overflow-hidden shadow-2xl relative group">
                {/* Decorative glowing border on focus */}
                <div className="absolute inset-0 border border-brand-primary/0 group-focus-within:border-brand-primary/30 transition-colors pointer-events-none rounded-xl z-10"></div>
                
                <div className="p-4 border-b border-glass bg-white/[0.01] flex justify-between items-center">
                    <label className="text-[9px] font-mono font-bold text-vault-subtext uppercase tracking-widest flex items-center gap-2">
                        <div className="w-1.5 h-1.5 rounded-full bg-brand-primary animate-pulse shadow-[0_0_8px_#0052FF]"></div>
                        Input_Stream
                    </label>
                    <span className="text-[9px] text-vault-subtext font-mono opacity-50">Markdown: ON</span>
                </div>
                <div className="flex-1 p-0 relative">
                    <textarea
                        className="w-full h-full bg-transparent text-white p-6 focus:outline-none resize-none placeholder-vault-subtext/20 font-mono text-sm leading-relaxed border-none selection:bg-brand-primary/30 relative z-20"
                        placeholder={activeTab === 'image' ? "// INIT VISUAL SEQUENCE... \n// Describe target parameters..." : "// INIT THOUGHT STREAM... \n// Enter conceptual data..."}
                        value={prompt}
                        onChange={(e) => setPrompt(e.target.value)}
                        autoFocus
                    />
                     {/* Gradient fade at bottom */}
                     <div className="absolute bottom-0 left-0 right-0 h-24 bg-gradient-to-t from-[#080808] to-transparent pointer-events-none z-10"></div>
                </div>
                <div className="p-5 border-t border-glass bg-[#050505] flex justify-between items-center">
                    <span className="text-[9px] text-vault-subtext font-mono tracking-widest">BUFFER: {prompt.length}B</span>
                    <Button 
                        onClick={handleGenerate} 
                        isLoading={isGenerating} 
                        disabled={!prompt} 
                        className="w-36 font-mono text-xs uppercase tracking-wider shadow-[0_0_20px_rgba(0,82,255,0.15)] hover:shadow-[0_0_30px_rgba(0,82,255,0.4)] transition-shadow"
                    >
                        {isGenerating ? 'Processing...' : 'Execute'}
                    </Button>
                </div>
            </div>
            
            {/* Parameters Panel */}
            <div className="bg-vault-card/50 rounded-xl border border-glass p-6 flex flex-col gap-5 backdrop-blur-sm">
                 <h3 className="text-[10px] text-white font-bold uppercase tracking-[0.2em] flex items-center gap-2">
                     <span className="w-3 h-[1px] bg-white/50"></span>
                     Config_Vector
                 </h3>
                 <div className="grid grid-cols-2 gap-4">
                     <div className="space-y-2">
                         <span className="text-[9px] text-vault-subtext uppercase tracking-wider">Engine</span>
                         <div className="px-3 py-2.5 bg-black border border-glass rounded text-[10px] text-white font-mono flex justify-between items-center">
                             <span>GEMINI_V3</span>
                             <div className="w-1 h-1 bg-green-500 rounded-full"></div>
                         </div>
                     </div>
                     <div className="space-y-2">
                         <span className="text-[9px] text-vault-subtext uppercase tracking-wider">Latency</span>
                         <div className="px-3 py-2.5 bg-black border border-glass rounded text-[10px] text-white font-mono flex justify-between items-center">
                             <span>LOW</span>
                             <span className="text-vault-subtext">~400ms</span>
                         </div>
                     </div>
                 </div>
            </div>
        </div>

        {/* Right: Output Visualization */}
        <div className="lg:col-span-8 bg-black rounded-xl border border-glass flex flex-col overflow-hidden relative shadow-2xl">
            {/* Scanner Line Animation */}
            {isGenerating && (
                 <div className="absolute inset-0 z-30 pointer-events-none">
                     <div className="w-full h-1 bg-brand-primary/50 shadow-[0_0_20px_#0052FF] animate-scan opacity-50"></div>
                     <div className="absolute inset-0 bg-brand-primary/5"></div>
                 </div>
            )}

            {generatedContent ? (
                <div className="flex-1 flex flex-col h-full animate-fade-in relative z-20">
                    <div className="flex-1 overflow-auto flex items-center justify-center bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAiIGhlaWdodD0iNDAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PHBhdGggZD0iTTAgNDBMMDQgMCIgc3Ryb2tlPSJ3aGl0ZSIgc3Ryb2tlLW9wYWNpdHk9IjAuMDIiLz48L3N2Zz4=')]">
                        {activeTab === 'image' ? (
                            <div className="relative group max-h-[80%] max-w-[90%] shadow-[0_0_50px_rgba(0,0,0,0.8)] rounded-sm overflow-hidden border border-white/10">
                                <img src={generatedContent} alt="Generated" className="object-contain max-h-full max-w-full" />
                                {/* Holographic Corner Markers */}
                                <div className="absolute top-0 left-0 w-8 h-8 border-t-2 border-l-2 border-brand-primary opacity-50"></div>
                                <div className="absolute bottom-0 right-0 w-8 h-8 border-b-2 border-r-2 border-brand-primary opacity-50"></div>
                            </div>
                        ) : (
                            <div className="p-16 w-full max-w-4xl overflow-y-auto max-h-full">
                                <div className="border-l-2 border-brand-primary pl-6">
                                    <p className="text-white whitespace-pre-wrap font-sans text-xl leading-9 font-light tracking-wide">{generatedContent}</p>
                                </div>
                            </div>
                        )}
                    </div>
                    <div className="p-6 border-t border-glass bg-[#080808] flex justify-between items-center z-10">
                         <div className="text-[10px] text-vault-subtext font-mono flex items-center gap-3">
                            <span className="px-1.5 py-0.5 bg-green-500/10 text-green-500 border border-green-500/20 rounded">SUCCESS</span>
                            <span>RENDER_TIME: 0.8s</span>
                         </div>
                         <div className="flex gap-4">
                             <Button variant="ghost" onClick={() => setGeneratedContent(null)} size="sm" className="text-xs">DISCARD</Button>
                             <Button variant="secondary" onClick={handleSave} size="sm" className="text-xs uppercase tracking-wide">Secure Asset</Button>
                         </div>
                    </div>
                </div>
            ) : (
                <div className="flex-1 flex flex-col items-center justify-center text-vault-subtext/40 relative">
                     {/* Empty State / Terminal Log */}
                     {isGenerating ? (
                        <div className="w-full max-w-md font-mono text-xs space-y-2 p-8 border border-glass bg-black/50 rounded-lg backdrop-blur-sm">
                            <div className="border-b border-glass pb-2 mb-4 text-brand-primary font-bold tracking-widest flex justify-between">
                                <span>SYSTEM_LOG</span>
                                <span className="animate-pulse">● REC</span>
                            </div>
                            <div ref={logContainerRef} className="h-48 overflow-y-auto space-y-1 scrollbar-hide">
                                {logs.map((log, i) => (
                                    <div key={i} className="text-vault-subtext/80 animate-fade-in">{log}</div>
                                ))}
                                <div className="w-2 h-4 bg-brand-primary animate-pulse inline-block align-middle ml-1"></div>
                            </div>
                        </div>
                     ) : (
                         <>
                            <div className="w-32 h-32 border border-dashed border-vault-border rounded-full mb-8 flex items-center justify-center relative animate-[spin_10s_linear_infinite]">
                                <div className="absolute inset-0 border-t border-brand-primary/30 rounded-full"></div>
                            </div>
                            <p className="text-sm font-mono tracking-[0.3em] uppercase text-white/50">Awaiting Directive</p>
                            <p className="text-[10px] mt-3 opacity-30 font-mono">System Ready</p>
                         </>
                     )}
                </div>
            )}
             {error && <div className="absolute bottom-6 left-6 right-6 p-4 bg-red-500/10 border border-red-500/20 text-red-500 text-xs font-mono rounded backdrop-blur-md animate-bounce">{error}</div>}
        </div>
      </div>
    </div>
  );
};