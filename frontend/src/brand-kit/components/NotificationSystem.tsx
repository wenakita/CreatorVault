import React from 'react';

export interface Notification {
    id: string;
    type: 'success' | 'error' | 'info';
    message: string;
}

interface NotificationSystemProps {
    notifications: Notification[];
    onDismiss: (id: string) => void;
}

export const NotificationSystem: React.FC<NotificationSystemProps> = ({ notifications, onDismiss }) => {
    return (
        <div className="fixed bottom-6 right-6 z-[200] flex flex-col gap-3 pointer-events-none">
            {notifications.map((note) => (
                <div 
                    key={note.id}
                    className="pointer-events-auto bg-[#0A0A0A] border-l-2 border-l-brand-primary border-t border-r border-b border-glass p-4 rounded-r shadow-2xl min-w-[300px] max-w-md transform transition-all duration-500 animate-wipe-in flex items-start gap-4"
                >
                    <div className={`mt-0.5 w-2 h-2 rounded-full ${note.type === 'success' ? 'bg-green-500 shadow-[0_0_8px_#22c55e]' : note.type === 'error' ? 'bg-red-500 shadow-[0_0_8px_#ef4444]' : 'bg-brand-primary shadow-[0_0_8px_#0052FF]'}`}></div>
                    
                    <div className="flex-1">
                        <h4 className="text-xs font-bold text-white uppercase tracking-wider mb-1">
                            {note.type === 'success' ? 'System Success' : note.type === 'error' ? 'System Error' : 'Notification'}
                        </h4>
                        <p className="text-xs text-vault-subtext font-mono leading-relaxed">{note.message}</p>
                    </div>

                    <button 
                        onClick={() => onDismiss(note.id)}
                        className="text-vault-subtext hover:text-white transition-colors"
                    >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>
            ))}
        </div>
    );
};