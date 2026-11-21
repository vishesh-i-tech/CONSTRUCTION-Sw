import React, { useEffect, useState } from 'react';
import { useTheme } from '../../core/theme/ThemeContext';
import {
  Bell,
  SlidersHorizontal,
  Search,
  Users,
  ClipboardCheck,
  RefreshCw,
  CloudCheck,
} from 'lucide-react';
import { UserRole } from '../../types';
import { subscribeSyncStatus } from '../../core/sync/syncEngine';

interface HeaderProps {
  onOpenVoiceModal?: () => void;
  onOpenNotifications: () => void;
  onOpenSettings: () => void;
  unreadRemindersCount?: number;
  onOpenTutorial?: () => void;
  onResetData?: () => void;
  contractorName?: string;
  onLogout?: () => void;
  searchQuery?: string;
  onSearchChange?: (query: string) => void;
  showSearchBar?: boolean;
  userRole?: UserRole;
  onOpenDprFeed?: () => void;
  onOpenTeamModal?: () => void;
  onOpenIssueChipsModal?: () => void;
  onOpenSupervisorDpr?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  onOpenNotifications,
  onOpenSettings,
  unreadRemindersCount = 2,
  contractorName = 'Alex Carter',
  searchQuery = '',
  onSearchChange,
  showSearchBar = true,
  userRole = 'owner',
  onOpenDprFeed,
  onOpenTeamModal,
  onOpenSupervisorDpr,
}) => {
  const { language } = useTheme();

  const [syncStatus, setSyncStatus] = useState<{
    isSyncing: boolean;
    pendingCount: number;
    lastSyncedAt: string | null;
  }>({
    isSyncing: false,
    pendingCount: 0,
    lastSyncedAt: null,
  });

  useEffect(() => {
    const unsubscribe = subscribeSyncStatus((status) => {
      setSyncStatus(status);
    });
    return () => unsubscribe();
  }, []);

  const initials = contractorName
    ? contractorName
        .split(' ')
        .map((n) => n[0])
        .join('')
        .slice(0, 2)
        .toUpperCase()
    : 'AC';

  const isSupervisor = userRole === 'supervisor';

  return (
    <header className="w-full bg-[#f4f7fc] dark:bg-slate-950 transition-colors pt-2 px-3 pb-2 space-y-2.5">
      
      {/* Top Greeting Row */}
      <div className="flex items-center justify-between">
        
        {/* Left: User Avatar & Greeting */}
        <div className="flex items-center gap-2.5 min-w-0">
          <div
            className={`w-10 h-10 rounded-full text-white font-extrabold text-sm flex items-center justify-center shrink-0 border-2 border-white dark:border-slate-800 ${
              isSupervisor
                ? 'bg-gradient-to-tr from-emerald-600 to-teal-500 shadow-[0_4px_12px_rgba(16,185,129,0.25)]'
                : 'bg-gradient-to-tr from-blue-600 to-indigo-500 shadow-[0_4px_12px_rgba(37,99,235,0.25)]'
            }`}
          >
            {initials}
          </div>

          <div className="flex flex-col min-w-0">
            <div className="flex items-center gap-1.5">
              <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400 leading-tight">
                Hello 👋
              </span>
              <span
                className={`text-[9px] font-bold px-1.5 py-0.2 rounded-full uppercase tracking-wider ${
                  isSupervisor
                    ? 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400'
                    : 'bg-blue-100 dark:bg-blue-950/60 text-blue-700 dark:text-blue-400'
                }`}
              >
                {isSupervisor ? (language === 'hi' ? 'सुपरवाइज़र' : 'Supervisor') : (language === 'hi' ? 'मालिक' : 'Owner')}
              </span>
            </div>
            <span className="font-extrabold text-sm text-slate-900 dark:text-white truncate font-heading tracking-tight leading-tight">
              {contractorName}
            </span>
          </div>
        </div>

        {/* Right: Actions, Sync Status, Bell, Settings */}
        <div className="flex items-center gap-1.5 shrink-0">
          
          {/* Sync Engine Status Pill */}
          {syncStatus.isSyncing ? (
            <div className="flex items-center gap-1 px-2 py-1 rounded-full bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800 text-[10px] font-bold text-blue-600 dark:text-blue-400 animate-pulse" title="Syncing changes with cloud...">
              <RefreshCw className="w-3 h-3 animate-spin" />
              <span className="hidden sm:inline">Syncing</span>
            </div>
          ) : syncStatus.pendingCount > 0 ? (
            <div className="flex items-center gap-1 px-2 py-1 rounded-full bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 text-[10px] font-bold text-amber-700 dark:text-amber-400" title={`${syncStatus.pendingCount} offline items queued for sync`}>
              <RefreshCw className="w-3 h-3" />
              <span>{syncStatus.pendingCount}</span>
            </div>
          ) : (
            <div className="hidden xs:flex items-center gap-1 px-2 py-1 rounded-full bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-[10px] font-bold text-emerald-700 dark:text-emerald-400" title="Offline outbox synced">
              <CloudCheck className="w-3.5 h-3.5" />
            </div>
          )}

          {/* Owner Quick Actions: Team & DPR Feed */}
          {!isSupervisor && onOpenTeamModal && (
            <button
              onClick={onOpenTeamModal}
              className="w-9 h-9 rounded-full bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-2xs flex items-center justify-center text-slate-700 dark:text-slate-200 hover:bg-slate-50 active:scale-95 transition-all cursor-pointer"
              title={language === 'hi' ? 'सुपरवाइज़र टीम प्रबंधन' : 'Team & Supervisors'}
            >
              <Users className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
            </button>
          )}

          {!isSupervisor && onOpenDprFeed && (
            <button
              onClick={onOpenDprFeed}
              className="w-9 h-9 rounded-full bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-2xs flex items-center justify-center text-slate-700 dark:text-slate-200 hover:bg-slate-50 active:scale-95 transition-all cursor-pointer"
              title={language === 'hi' ? 'दैनिक रिपोर्ट फ़ीड' : 'Daily Reports Feed'}
            >
              <ClipboardCheck className="w-4 h-4 text-blue-600 dark:text-blue-400" />
            </button>
          )}

          {/* Supervisor Quick Action: New DPR */}
          {isSupervisor && onOpenSupervisorDpr && (
            <button
              onClick={onOpenSupervisorDpr}
              className="px-2.5 py-1.5 rounded-full bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs flex items-center gap-1.5 text-xs font-bold active:scale-95 transition-all cursor-pointer"
              title={language === 'hi' ? 'आज की रिपोर्ट दर्ज करें' : 'Submit Today DPR'}
            >
              <ClipboardCheck className="w-3.5 h-3.5" />
              <span>{language === 'hi' ? 'रिपोर्ट भरें' : 'Add DPR'}</span>
            </button>
          )}

          {/* Bell Icon with Badge */}
          <button
            onClick={onOpenNotifications}
            className="relative w-9 h-9 rounded-full bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-2xs flex items-center justify-center text-slate-700 dark:text-slate-200 hover:bg-slate-50 active:scale-95 transition-all cursor-pointer"
            title="Notifications"
          >
            <Bell className="w-4 h-4" />
            {unreadRemindersCount > 0 && (
              <span className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-[#1877F2] text-white rounded-full text-[9px] font-black flex items-center justify-center border-2 border-white dark:border-slate-900 shadow-xs">
                {unreadRemindersCount}
              </span>
            )}
          </button>

          {/* Filter / Settings Button */}
          <button
            onClick={onOpenSettings}
            className="w-9 h-9 rounded-full bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-2xs flex items-center justify-center text-slate-700 dark:text-slate-200 hover:bg-slate-50 active:scale-95 transition-all cursor-pointer"
            title="Filters & Settings"
          >
            <SlidersHorizontal className="w-4 h-4" />
          </button>

        </div>

      </div>

      {/* Rounded Search Bar */}
      {showSearchBar && (
        <div className="relative">
          <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
            <Search className="w-4 h-4" />
          </div>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => onSearchChange?.(e.target.value)}
            placeholder={isSupervisor ? (language === 'hi' ? 'साइट खोजें...' : 'Search sites...') : (language === 'hi' ? 'साइट, लेबर या बिल खोजें...' : 'Search sites, workers, or bills...')}
            className="w-full pl-10 pr-10 py-2.5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 text-xs text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-[0_2px_12px_rgba(0,0,0,0.03)] transition-all"
          />
          <button
            onClick={onOpenSettings}
            className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 cursor-pointer"
          >
            <SlidersHorizontal className="w-4 h-4" />
          </button>
        </div>
      )}

    </header>
  );
};
