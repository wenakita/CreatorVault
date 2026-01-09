import React, { useState } from 'react';
import { Sidebar } from './components/Sidebar';
import { Dashboard } from './pages/Dashboard';
import { Generator } from './pages/Generator';
import { BrandKit } from './pages/BrandKit';
import { Settings } from './pages/Settings';
import { AssetInspector } from './components/AssetInspector';
import { NotificationSystem, Notification } from './components/NotificationSystem';
import { NavItem, VaultAsset, AssetType } from './types';
import { HomeIcon, CreateIcon, SettingsIcon, BrandIcon } from './components/Icons';
import { v4 as uuidv4 } from 'uuid';

// Mock Initial Data
const INITIAL_ASSETS: VaultAsset[] = [
  {
    id: '1',
    title: 'Protocol_Launch_Manifesto_v1',
    type: AssetType.IDEA,
    content: 'The future of digital ownership lies in the ability to seamlessly create, store, and deploy assets on-chain.',
    createdAt: Date.now() - 10000000,
    tags: ['Strategy', 'Manifesto']
  },
  {
      id: '2',
      title: 'Genesis_Collection_Hero_Img',
      type: AssetType.IMAGE,
      content: 'https://picsum.photos/800/450',
      createdAt: Date.now() - 5000000,
      tags: ['Art', 'Genesis']
  }
];

const NAV_ITEMS: NavItem[] = [
  { label: 'Overview', path: 'dashboard', icon: <HomeIcon /> },
  { label: 'Studio', path: 'studio', icon: <CreateIcon /> },
  { label: 'Design System', path: 'brand-kit', icon: <BrandIcon /> },
  { label: 'Settings', path: 'settings', icon: <SettingsIcon /> },
];

export default function App() {
  const [currentView, setCurrentView] = useState('dashboard');
  const [assets, setAssets] = useState<VaultAsset[]>(INITIAL_ASSETS);
  const [selectedAsset, setSelectedAsset] = useState<VaultAsset | null>(null);
  const [notifications, setNotifications] = useState<Notification[]>([]);

  const handleNavigate = (path: string) => {
    setCurrentView(path);
  };

  const addNotification = (type: 'success' | 'error' | 'info', message: string) => {
    const id = uuidv4();
    setNotifications(prev => [...prev, { id, type, message }]);
    // Auto dismiss
    setTimeout(() => {
        setNotifications(prev => prev.filter(n => n.id !== id));
    }, 4000);
  };

  const handleSaveAsset = (asset: VaultAsset) => {
    setAssets([asset, ...assets]);
    setCurrentView('dashboard');
    addNotification('success', 'Asset successfully minted to Vault.');
  };

  const handleDeleteAsset = (id: string) => {
    setAssets(assets.filter(a => a.id !== id));
    setSelectedAsset(null);
    addNotification('info', 'Asset burned from existence.');
  };

  const handleUpdateAsset = (updatedAsset: VaultAsset) => {
    setAssets(assets.map(a => a.id === updatedAsset.id ? updatedAsset : a));
    // Also update the selected asset view if it's currently open
    if (selectedAsset && selectedAsset.id === updatedAsset.id) {
        setSelectedAsset(updatedAsset);
    }
  };

  return (
    <div className="flex min-h-screen bg-black text-vault-text">
      <Sidebar 
        items={NAV_ITEMS} 
        activePath={currentView} 
        onNavigate={handleNavigate} 
      />
      
      <main className="flex-1 ml-64 bg-vault-bg relative min-h-screen">
        {currentView === 'dashboard' && (
          <Dashboard 
            assets={assets} 
            onGenerate={() => setCurrentView('studio')} 
            onAssetClick={setSelectedAsset}
            onNotify={addNotification}
          />
        )}

        {currentView === 'studio' && (
          <Generator 
            onSave={handleSaveAsset} 
            onCancel={() => setCurrentView('dashboard')} 
          />
        )}

        {currentView === 'brand-kit' && (
          <BrandKit />
        )}
        
        {currentView === 'settings' && (
             <Settings onNotify={addNotification} />
        )}
      </main>

      {/* Overlays */}
      <AssetInspector 
        asset={selectedAsset} 
        onClose={() => setSelectedAsset(null)} 
        onDelete={handleDeleteAsset}
        onUpdate={handleUpdateAsset}
      />
      
      <NotificationSystem 
        notifications={notifications} 
        onDismiss={(id) => setNotifications(prev => prev.filter(n => n.id !== id))} 
      />
    </div>
  );
}