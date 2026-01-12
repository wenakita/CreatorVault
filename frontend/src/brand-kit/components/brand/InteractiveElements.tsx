import { useState } from 'react';

export const InteractiveToggle = () => {
    const [active, setActive] = useState(false);
    return (
        <div 
            onClick={() => setActive(!active)}
            className={`w-10 h-5 rounded-full border border-glass cursor-pointer relative transition-all duration-300 ${active ? 'bg-brand-primary/20 border-brand-primary' : 'bg-black'}`}
        >
            <div className={`absolute top-0.5 left-0.5 w-3.5 h-3.5 rounded-full bg-white transition-all duration-300 shadow-md ${active ? 'translate-x-5 bg-brand-primary shadow-[0_0_8px_#0052FF]' : 'bg-vault-subtext'}`}></div>
        </div>
    );
};

export const InteractiveCheckbox = () => {
    const [checked, setChecked] = useState(true);
    return (
        <div 
            onClick={() => setChecked(!checked)}
            className={`w-5 h-5 rounded border cursor-pointer flex items-center justify-center transition-all duration-300 ${checked ? 'bg-brand-primary border-brand-primary shadow-[0_0_10px_rgba(0,82,255,0.4)]' : 'border-glass bg-black hover:border-white/30'}`}
        >
            {checked && <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>}
        </div>
    );
};

export const InteractiveSlider = () => {
    const [val, setVal] = useState(60);
    return (
        <div className="w-full h-8 flex items-center gap-4 group">
            <span className="text-[9px] font-mono w-6 text-right opacity-50">{val}%</span>
            <div className="flex-1 h-1 bg-white/10 rounded-full relative cursor-pointer">
                <input 
                    type="range" 
                    min="0" 
                    max="100" 
                    value={val} 
                    onChange={(e) => setVal(Number(e.target.value))}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                />
                <div className="absolute top-0 left-0 h-full bg-brand-primary rounded-full transition-all duration-75" style={{ width: `${val}%` }}></div>
                <div 
                    className="absolute top-1/2 -translate-y-1/2 w-3 h-3 bg-white rounded-full shadow-[0_0_10px_rgba(255,255,255,0.5)] transition-all duration-75 group-hover:scale-125 border border-brand-primary/50" 
                    style={{ left: `${val}%`, transform: 'translate(-50%, -50%)' }}
                ></div>
            </div>
        </div>
    );
}