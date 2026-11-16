import React from 'react';
import { Home, Gamepad2, ListChecks, Wallet, Gift, User } from 'lucide-react';
import { sound } from '../services/audio';

interface Props {
  activeTab: string;
  onSelectTab: (tab: string) => void;
}

export const BottomNav: React.FC<Props> = ({ activeTab, onSelectTab }) => {
  const tabs = [
    { id: 'home', label: 'Home', icon: Home },
    { id: 'games', label: 'Games', icon: Gamepad2 },
    { id: 'tasks', label: 'Tasks', icon: ListChecks },
    { id: 'wallet', label: 'Wallet', icon: Wallet },
    { id: 'rewards', label: 'Rewards', icon: Gift },
    { id: 'profile', label: 'Profile', icon: User },
  ];

  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-[#090a0f]/95 backdrop-blur-md border-t border-white/10 px-1 py-1.5 flex items-center justify-around h-15">
      {tabs.map((tab) => {
        const Icon = tab.icon;
        const isActive = activeTab === tab.id;
        return (
          <button
            key={tab.id}
            onClick={() => {
              sound.playClick();
              onSelectTab(tab.id);
            }}
            className={`flex-1 flex flex-col items-center justify-center py-1 rounded-xl transition-all ${
              isActive
                ? 'text-cyan-400 font-bold scale-105'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Icon size={19} className={isActive ? 'stroke-[2.5]' : 'stroke-2'} />
            <span className="text-[10px] tracking-tight mt-0.5 leading-none">{tab.label}</span>
          </button>
        );
      })}
    </nav>
  );
};
