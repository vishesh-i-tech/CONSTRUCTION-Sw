import React, { useState, useEffect } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../core/db/database';
import { Site, DailyRecord } from '../../types';
import { useTheme } from '../../core/theme/ThemeContext';
import {
  Calendar,
  CheckCircle2,
  Clock,
  MapPin,
  ChevronRight,
  PlusCircle,
  FileCheck2,
  RefreshCw,
  Camera,
  Mic,
} from 'lucide-react';
import { SupervisorDprModal } from './SupervisorDprModal';

interface SupervisorTodayDashboardProps {
  assignedSites: Site[];
  onOpenDprModal: (siteId?: string) => void;
}

export const SupervisorTodayDashboard: React.FC<SupervisorTodayDashboardProps> = ({
  assignedSites,
  onOpenDprModal,
}) => {
  const { language } = useTheme();
  const isHi = language === 'hi';

  const todayIst = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());

  // Query today's daily records reactively from Dexie
  const todayRecords = useLiveQuery(
    () => db.dailyRecords.where('recordDate').equals(todayIst).toArray(),
    [todayIst]
  ) || [];

  const recordsBySiteId = new Map<string, DailyRecord>(
    todayRecords.map((r) => [r.siteId, r])
  );

  const totalAssigned = assignedSites.length;
  const submittedCount = assignedSites.filter((s) => recordsBySiteId.has(s.id)).length;
  const pendingCount = Math.max(0, totalAssigned - submittedCount);

  return (
    <div className="space-y-4">
      {/* Today Overview Card */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-primary/15 via-surface to-surface border border-primary/20 p-5 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2 text-primary font-bold text-sm">
            <Calendar className="w-4 h-4" />
            <span>
              {new Date().toLocaleDateString(isHi ? 'hi-IN' : 'en-IN', {
                weekday: 'long',
                day: 'numeric',
                month: 'short',
                year: 'numeric',
              })}
            </span>
          </div>
          <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-primary/10 text-primary border border-primary/20">
            IST (Asia/Kolkata)
          </span>
        </div>

        <div className="grid grid-cols-2 gap-3 mb-4">
          <div className="p-3.5 rounded-2xl bg-surface border border-border">
            <p className="text-xs text-muted-foreground font-medium">
              {isHi ? 'जमा की गई रिपोर्ट' : 'Reports Submitted'}
            </p>
            <p className="text-2xl font-black text-emerald-500 mt-1">
              {submittedCount} / {totalAssigned}
            </p>
          </div>
          <div className="p-3.5 rounded-2xl bg-surface border border-border">
            <p className="text-xs text-muted-foreground font-medium">
              {isHi ? 'बाकी रिपोर्ट' : 'Pending Reports'}
            </p>
            <p className={`text-2xl font-black mt-1 ${pendingCount > 0 ? 'text-amber-500' : 'text-muted-foreground'}`}>
              {pendingCount}
            </p>
          </div>
        </div>

        {totalAssigned > 0 && (
          <button
            type="button"
            onClick={() => onOpenDprModal()}
            className="w-full py-3.5 px-4 rounded-2xl bg-primary text-white font-bold text-sm shadow-lg shadow-primary/25 hover:bg-primary/90 flex items-center justify-center gap-2 transition-all active:scale-[0.99]"
          >
            <PlusCircle className="w-5 h-5" />
            <span>{isHi ? 'आज की रिपोर्ट दर्ज करें' : "Submit Today's Report"}</span>
          </button>
        )}
      </div>

      {/* Sites Status List */}
      <div>
        <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground px-1 mb-2.5">
          {isHi ? 'आपकी साइट्स और आज की स्थिति' : 'Your Assigned Sites & Status'}
        </h3>

        {assignedSites.length === 0 ? (
          <div className="p-6 rounded-3xl bg-surface border border-border text-center">
            <MapPin className="w-8 h-8 text-muted-foreground/40 mx-auto mb-2" />
            <p className="text-sm font-semibold text-foreground">
              {isHi ? 'कोई साइट असाइन नहीं है' : 'No Assigned Sites'}
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              {isHi
                ? 'मालिक द्वारा साइट असाइन होने के बाद वह यहां दिखेगी।'
                : 'Sites assigned to you by the owner will appear here.'}
            </p>
          </div>
        ) : (
          <div className="space-y-2.5">
            {assignedSites.map((site) => {
              const record = recordsBySiteId.get(site.id);
              const isSubmitted = !!record;

              return (
                <div
                  key={site.id}
                  className="p-4 rounded-2xl bg-surface border border-border hover:border-border/80 transition-all shadow-sm flex items-center justify-between gap-3"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <h4 className="text-sm font-bold text-foreground truncate">{site.name}</h4>
                      {isSubmitted ? (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/15 text-emerald-500 border border-emerald-500/30 flex items-center gap-1">
                          <CheckCircle2 className="w-3 h-3" />
                          {isHi ? 'जमा' : 'Submitted'}
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/15 text-amber-500 border border-amber-500/30 flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {isHi ? 'बाकी' : 'Pending'}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground flex items-center gap-1 mt-1 truncate">
                      <MapPin className="w-3.5 h-3.5 shrink-0" />
                      <span>{site.location || 'Site Location'}</span>
                    </p>

                    {record && (
                      <div className="mt-2 flex items-center gap-2 text-xs">
                        <span className="font-semibold text-muted-foreground">
                          {isHi ? 'स्थिति:' : 'Status:'}{' '}
                          <span
                            className={
                              record.status === 'full'
                                ? 'text-emerald-500 font-bold'
                                : record.status === 'half'
                                ? 'text-amber-500 font-bold'
                                : 'text-red-500 font-bold'
                            }
                          >
                            {record.status === 'full'
                              ? isHi
                                ? 'पूरा दिन'
                                : 'Full Day'
                              : record.status === 'half'
                              ? isHi
                                ? 'आधा दिन'
                                : 'Half Day'
                              : isHi
                              ? 'काम बंद'
                              : 'Stopped'}
                          </span>
                        </span>
                        {record.media && record.media.length > 0 && (
                          <span className="text-[10px] text-muted-foreground flex items-center gap-0.5 bg-surface-raised px-1.5 py-0.5 rounded-md">
                            <Camera className="w-3 h-3" /> {record.media.filter((m) => m.kind === 'photo').length}
                          </span>
                        )}
                        {!record.missingVoice && (
                          <span className="text-[10px] text-muted-foreground flex items-center gap-0.5 bg-surface-raised px-1.5 py-0.5 rounded-md">
                            <Mic className="w-3 h-3" /> 1
                          </span>
                        )}
                      </div>
                    )}
                  </div>

                  <div>
                    <button
                      type="button"
                      onClick={() => onOpenDprModal(site.id)}
                      className={`px-3 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1 shadow-sm ${
                        isSubmitted
                          ? 'bg-surface-raised hover:bg-border text-foreground border border-border'
                          : 'bg-primary text-white hover:bg-primary/90'
                      }`}
                    >
                      <span>{isSubmitted ? (isHi ? 'अपडेट' : 'Update') : isHi ? 'रिपोर्ट भरें' : 'Report'}</span>
                      <ChevronRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
