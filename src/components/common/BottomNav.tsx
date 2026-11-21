import React from 'react';
import { useTheme } from '../../core/theme/ThemeContext';
import {
  LayoutDashboard,
  Building2,
  Users,
  Plus,
} from 'lucide-react';

export type ActiveTab = 'dashboard' | 'sites' | 'labour' | 'tools' | 'materials' | 'machinery' | 'dues' | 'reports';

interface BottomNavProps {
  activeTab: ActiveTab;
  onTabChange: (tab: ActiveTab) => void;
  onOpenQuickAdd?: () => void;
}

export const BottomNav: React.FC<BottomNavProps> = ({
  activeTab,
  onTabChange,
  onOpenQuickAdd,
}) => {
  const { t, language, tradeConfig } = useTheme();

  return (
    <div className="sticky bottom-2 sm:bottom-3 left-0 right-0 z-40 px-3 pointer-events-none pb-safe">
      <div className="max-w-[320px] sm:max-w-[340px] mx-auto bg-white/95 dark:bg-slate-900/95 backdrop-blur-xl border border-slate-200/80 dark:border-slate-800 rounded-full py-1.5 px-3 shadow-[0_12px_40px_rgba(0,0,0,0.14)] flex items-center justify-between pointer-events-auto transition-all">
        {/* Home */}
        <button
          onClick={() => onTabChange('dashboard')}
          className="relative flex flex-col items-center justify-center p-1 rounded-full transition-all group cursor-pointer focus:outline-none"
          title="Home"
        >
          {activeTab === 'dashboard' ? (
            <div className="w-10 h-10 rounded-full bg-gradient-to-r from-[#1877F2] to-[#0084FF] text-white flex items-center justify-center shadow-[0_4px_14px_rgba(24,119,242,0.45)] transform scale-105 transition-all">
              <LayoutDashboard className="w-5 h-5 stroke-[2.3]" />
            </div>
          ) : (
            <div className="w-10 h-10 rounded-full flex items-center justify-center text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800/60 transition-all">
              <LayoutDashboard className="w-5 h-5 stroke-[1.8]" />
            </div>
          )}
        </button>

        {/* Sites */}
        <button
          onClick={() => onTabChange('sites')}
          className="relative flex flex-col items-center justify-center p-1 rounded-full transition-all group cursor-pointer focus:outline-none"
          title="Sites"
        >
          {activeTab === 'sites' ? (
            <div className="w-10 h-10 rounded-full bg-gradient-to-r from-[#1877F2] to-[#0084FF] text-white flex items-center justify-center shadow-[0_4px_14px_rgba(24,119,242,0.45)] transform scale-105 transition-all">
              <Building2 className="w-5 h-5 stroke-[2.3]" />
            </div>
          ) : (
            <div className="w-10 h-10 rounded-full flex items-center justify-center text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800/60 transition-all">
              <Building2 className="w-5 h-5 stroke-[1.8]" />
            </div>
          )}
        </button>

        {/* Center Floating Quick Add (+) Button */}
        {onOpenQuickAdd && (
          <button
            onClick={onOpenQuickAdd}
            className="relative flex flex-col items-center justify-center cursor-pointer focus:outline-none group transform active:scale-95 transition-all"
            title={language === 'hi' ? 'त्वरित जोड़ें' : 'Quick Add'}
          >
            <div
              className="w-11 h-11 rounded-full flex items-center justify-center text-white shadow-[0_4px_16px_rgba(234,88,12,0.4)] hover:shadow-[0_6px_20px_rgba(234,88,12,0.6)] hover:scale-105 transition-all"
              style={{ backgroundColor: tradeConfig.primaryColor || '#EA580C' }}
            >
              <Plus className="w-6 h-6 stroke-[2.5]" />
            </div>
          </button>
        )}

        {/* Workers */}
        <button
          onClick={() => onTabChange('labour')}
          className="relative flex flex-col items-center justify-center p-1 rounded-full transition-all group cursor-pointer focus:outline-none"
          title="Workers"
        >
          {activeTab === 'labour' ? (
            <div className="w-10 h-10 rounded-full bg-gradient-to-r from-[#1877F2] to-[#0084FF] text-white flex items-center justify-center shadow-[0_4px_14px_rgba(24,119,242,0.45)] transform scale-105 transition-all">
              <Users className="w-5 h-5 stroke-[2.3]" />
            </div>
          ) : (
            <div className="w-10 h-10 rounded-full flex items-center justify-center text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800/60 transition-all">
              <Users className="w-5 h-5 stroke-[1.8]" />
            </div>
          )}
        </button>
      </div>
    </div>
  );
};
