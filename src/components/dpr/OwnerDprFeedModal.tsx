import React, { useState, useEffect, useRef } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../core/db/database';
import { Site, DailyRecord, IssueType } from '../../types';
import { useTheme } from '../../core/theme/ThemeContext';
import { apiAcknowledgeRecord, apiGetTodayRecords } from '../../services/apiClient';
import {
  X,
  Filter,
  Calendar,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Play,
  Square,
  Volume2,
  MapPin,
  CheckCheck,
  ShieldCheck,
  ShieldAlert,
  ChevronDown,
  Camera,
  Mic,
  Maximize2,
} from 'lucide-react';

interface OwnerDprFeedModalProps {
  isOpen: boolean;
  onClose: () => void;
  sites: Site[];
}

export const OwnerDprFeedModal: React.FC<OwnerDprFeedModalProps> = ({
  isOpen,
  onClose,
  sites,
}) => {
  const { language } = useTheme();
  const isHi = language === 'hi';

  const [selectedSiteId, setSelectedSiteId] = useState<string>('all');
  const [selectedStatus, setSelectedStatus] = useState<string>('all');
  const [selectedDate, setSelectedDate] = useState<string>(() => {
    return new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Kolkata',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(new Date());
  });

  const [activeAudioUrl, setActiveAudioUrl] = useState<string | null>(null);
  const [playbackSpeed, setPlaybackSpeed] = useState<number>(1.0);
  const [isPlayingAudio, setIsPlayingAudio] = useState(false);
  const audioPlayerRef = useRef<HTMLAudioElement | null>(null);

  const [zoomPhotoUrl, setZoomPhotoUrl] = useState<string | null>(null);
  const [acknowledgingId, setAcknowledgingId] = useState<string | null>(null);

  // Live query from local Dexie database
  const allLocalRecords = useLiveQuery(
    () => db.dailyRecords.where('recordDate').equals(selectedDate).toArray(),
    [selectedDate]
  ) || [];

  // Local acknowledgements
  const localAcks = useLiveQuery(() => db.recordAcknowledgements.toArray()) || [];
  const ackRecordIds = new Set(localAcks.map((a) => a.recordId));

  // Sync latest records from backend when feed is opened
  useEffect(() => {
    if (isOpen) {
      apiGetTodayRecords().then((res) => {
        if (res.data?.sites) {
          res.data.sites.forEach(async (item) => {
            if (item.record) {
              await db.dailyRecords.put({
                id: item.record.id,
                clientId: item.record.clientId || item.record.id,
                siteId: item.siteId,
                siteName: item.siteName,
                recordDate: res.data.date,
                status: item.record.status,
                capturedAt: item.record.capturedAt,
                receivedAt: item.record.receivedAt,
                missingPhoto: item.record.missingPhoto,
                missingVoice: item.record.missingVoice,
                flags: item.record.flags,
                submittedBy: item.record.submittedBy,
                submitterName: item.record.submitterName,
                issues: item.record.issues,
                media: item.record.media,
                synced: true,
              });
            }
          });
        }
      });
    }
  }, [isOpen, selectedDate]);

  if (!isOpen) return null;

  const filteredRecords = allLocalRecords.filter((rec) => {
    if (selectedSiteId !== 'all' && rec.siteId !== selectedSiteId) return false;
    if (selectedStatus !== 'all' && rec.status !== selectedStatus) return false;
    return true;
  });

  const handleAcknowledge = async (recordId: string) => {
    setAcknowledgingId(recordId);
    try {
      // 1. Save locally
      await db.recordAcknowledgements.put({
        id: crypto.randomUUID(),
        recordId,
        ownerId: 'active-owner',
        seenAt: new Date().toISOString(),
      });

      // 2. Call backend if online
      await apiAcknowledgeRecord(recordId);
    } catch (err) {
      console.warn('Acknowledgement error:', err);
    } finally {
      setAcknowledgingId(null);
    }
  };

  const handlePlayAudio = (url: string) => {
    if (activeAudioUrl === url && isPlayingAudio) {
      audioPlayerRef.current?.pause();
      setIsPlayingAudio(false);
    } else {
      setActiveAudioUrl(url);
      setIsPlayingAudio(true);
      setTimeout(() => {
        if (audioPlayerRef.current) {
          audioPlayerRef.current.playbackRate = playbackSpeed;
          audioPlayerRef.current.play();
        }
      }, 50);
    }
  };

  const toggleSpeed = () => {
    const nextSpeed = playbackSpeed === 1.0 ? 1.5 : playbackSpeed === 1.5 ? 2.0 : 1.0;
    setPlaybackSpeed(nextSpeed);
    if (audioPlayerRef.current) {
      audioPlayerRef.current.playbackRate = nextSpeed;
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm p-0 sm:p-4">
      <div className="relative w-full max-w-2xl bg-surface border border-border sm:rounded-3xl rounded-t-3xl shadow-2xl overflow-hidden max-h-[92vh] flex flex-col animate-in fade-in slide-in-from-bottom-6 duration-200">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-border bg-surface-raised/40">
          <div>
            <h2 className="text-lg font-bold text-foreground">
              {isHi ? 'दैनिक प्रगति समीक्षा फ़ीड (DPR Feed)' : 'Daily Progress Review Feed'}
            </h2>
            <p className="text-xs text-muted-foreground">
              {isHi
                ? 'साइट रिपोर्ट, वॉइस नोट और एंटी-फेक सत्यापन देखें'
                : 'Review site reports, voice notes & anti-fake verification'}
            </p>
          </div>
          <button
            onClick={onClose}
            className="w-9 h-9 rounded-full bg-surface-raised hover:bg-border flex items-center justify-center text-muted-foreground transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Filters Bar */}
        <div className="p-3 border-b border-border bg-surface-raised/20 flex flex-wrap gap-2 text-xs">
          {/* Date Picker */}
          <div className="flex items-center gap-1.5 bg-surface border border-border rounded-xl px-2.5 py-1.5">
            <Calendar className="w-3.5 h-3.5 text-primary" />
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="bg-transparent text-foreground font-semibold focus:outline-none cursor-pointer"
            />
          </div>

          {/* Site Filter */}
          <div className="flex items-center gap-1.5 bg-surface border border-border rounded-xl px-2.5 py-1.5">
            <span className="text-muted-foreground">{isHi ? 'साइट:' : 'Site:'}</span>
            <select
              value={selectedSiteId}
              onChange={(e) => setSelectedSiteId(e.target.value)}
              className="bg-transparent text-foreground font-semibold focus:outline-none cursor-pointer"
            >
              <option value="all">{isHi ? 'सभी साइट्स' : 'All Sites'}</option>
              {sites.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>

          {/* Status Filter */}
          <div className="flex items-center gap-1.5 bg-surface border border-border rounded-xl px-2.5 py-1.5">
            <span className="text-muted-foreground">{isHi ? 'स्थिति:' : 'Status:'}</span>
            <select
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
              className="bg-transparent text-foreground font-semibold focus:outline-none cursor-pointer"
            >
              <option value="all">{isHi ? 'सभी' : 'All'}</option>
              <option value="full">{isHi ? '🟢 पूरा दिन' : '🟢 Full Day'}</option>
              <option value="half">{isHi ? '🟡 आधा दिन' : '🟡 Half Day'}</option>
              <option value="stopped">{isHi ? '🔴 काम बंद' : '🔴 Stopped'}</option>
            </select>
          </div>
        </div>

        {/* Feed List */}
        <div className="p-4 overflow-y-auto space-y-4 flex-1">
          {filteredRecords.length === 0 ? (
            <div className="py-12 text-center text-muted-foreground">
              <CheckCircle2 className="w-12 h-12 text-muted-foreground/30 mx-auto mb-3" />
              <p className="font-semibold text-foreground text-sm">
                {isHi ? 'इस तारीख के लिए कोई रिपोर्ट नहीं है' : 'No site reports for this date'}
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                {isHi ? 'तारीख बदलकर देखें या सुपरवाइज़र से रिपोर्ट भरवाएं।' : 'Select another date or await supervisor submission.'}
              </p>
            </div>
          ) : (
            filteredRecords.map((record) => {
              const isAcknowledged =
                ackRecordIds.has(record.id) ||
                (record.acknowledgements && record.acknowledgements.length > 0);

              const photos = (record.media || []).filter((m) => m.kind === 'photo');
              const audioMedia = (record.media || []).find((m) => m.kind === 'audio');

              // Check anti-fake warnings
              const hasDistanceWarning = photos.some((p) => p.flags?.distance_warning);
              const hasTimeSkew = photos.some((p) => p.flags?.time_skew);

              return (
                <div
                  key={record.id}
                  className="rounded-3xl bg-surface border border-border p-4 sm:p-5 shadow-sm space-y-4"
                >
                  {/* Record Top Bar */}
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="font-bold text-foreground text-base">
                          {record.siteName || 'Work Site'}
                        </h3>
                        <span
                          className={`px-2.5 py-0.5 rounded-full text-xs font-bold ${
                            record.status === 'full'
                              ? 'bg-emerald-500/15 text-emerald-500 border border-emerald-500/30'
                              : record.status === 'half'
                              ? 'bg-amber-500/15 text-amber-500 border border-amber-500/30'
                              : 'bg-red-500/15 text-red-500 border border-red-500/30'
                          }`}
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
                            : 'Work Stopped'}
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5 flex items-center gap-2">
                        <span>{isHi ? 'सुपरवाइज़र:' : 'By:'} {record.submitterName || 'Supervisor'}</span>
                        <span>•</span>
                        <span>
                          {new Date(record.capturedAt).toLocaleTimeString(isHi ? 'hi-IN' : 'en-IN', {
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </span>
                      </p>
                    </div>

                    {/* Anti-Fake Badges */}
                    <div className="flex flex-col items-end gap-1">
                      {hasDistanceWarning ? (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/15 text-amber-500 border border-amber-500/30 flex items-center gap-1">
                          <ShieldAlert className="w-3 h-3" />
                          {isHi ? 'दूरी चेतावनी (>500m)' : 'Distance Warning'}
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/15 text-emerald-500 border border-emerald-500/30 flex items-center gap-1">
                          <ShieldCheck className="w-3 h-3" />
                          {isHi ? 'साइट पर सत्यापित' : 'Verified On-Site'}
                        </span>
                      )}

                      {hasTimeSkew && (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/15 text-amber-500 border border-amber-500/30 flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {isHi ? 'समय अंतर (>15m)' : 'Time Skew'}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Issue Chips Badges */}
                  {record.issues && record.issues.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 pt-1">
                      {record.issues.map((issue, idx) => (
                        <span
                          key={idx}
                          className="px-2.5 py-1 rounded-xl text-xs font-semibold bg-red-500/10 border border-red-500/20 text-red-500 flex items-center gap-1"
                        >
                          <span>{issue.icon || '⚠️'}</span>
                          <span>{isHi ? issue.labelHi : issue.labelEn}</span>
                        </span>
                      ))}
                    </div>
                  )}

                  {/* Photo Gallery */}
                  {photos.length > 0 && (
                    <div>
                      <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                        {photos.map((p, idx) => (
                          <div
                            key={idx}
                            onClick={() => setZoomPhotoUrl(p.url || p.storageKey)}
                            className="relative aspect-square rounded-2xl overflow-hidden border border-border cursor-pointer group bg-black/30"
                          >
                            <img
                              src={p.url || p.storageKey}
                              alt="Site progress"
                              className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                            />
                            <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors flex items-center justify-center opacity-0 group-hover:opacity-100">
                              <Maximize2 className="w-5 h-5 text-white" />
                            </div>
                            {p.latitude != null && (
                              <div className="absolute bottom-1 left-1 px-1.5 py-0.5 rounded-md bg-black/75 text-[9px] text-emerald-400 flex items-center gap-0.5">
                                <MapPin className="w-2.5 h-2.5" /> GPS
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Voice Note Playback Bar */}
                  {audioMedia && (
                    <div className="p-3 rounded-2xl bg-surface-raised border border-border flex items-center justify-between gap-3">
                      <div className="flex items-center gap-2.5">
                        <button
                          type="button"
                          onClick={() => handlePlayAudio(audioMedia.url || audioMedia.storageKey)}
                          className="w-10 h-10 rounded-full bg-primary text-white flex items-center justify-center shadow-md hover:bg-primary/90 transition-colors"
                        >
                          {isPlayingAudio && activeAudioUrl === (audioMedia.url || audioMedia.storageKey) ? (
                            <Square className="w-4 h-4 fill-current" />
                          ) : (
                            <Play className="w-4 h-4 fill-current ml-0.5" />
                          )}
                        </button>
                        <div>
                          <p className="text-xs font-bold text-foreground">
                            {isHi ? 'सुपरवाइज़र का वॉइस नोट' : "Supervisor's Voice Note"}
                          </p>
                          <p className="text-[10px] text-muted-foreground flex items-center gap-1">
                            <Volume2 className="w-3 h-3 text-primary" />
                            {audioMedia.durationSeconds || 15}s
                          </p>
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={toggleSpeed}
                        className="px-2.5 py-1 rounded-xl bg-surface border border-border text-xs font-bold text-primary hover:bg-border transition-colors"
                      >
                        {playbackSpeed}x
                      </button>
                    </div>
                  )}

                  {/* Bottom Action: Double Blue Tick Seen Button */}
                  <div className="pt-2 border-t border-border/60 flex items-center justify-between">
                    <span className="text-[11px] text-muted-foreground">
                      {record.missingPhoto && isHi ? '⚠️ फोटो अनुपलब्ध' : ''}
                      {record.missingVoice && isHi ? ' • बिना वॉइस नोट' : ''}
                    </span>

                    {isAcknowledged ? (
                      <div className="flex items-center gap-1 text-xs font-bold text-sky-500">
                        <CheckCheck className="w-4 h-4" />
                        <span>{isHi ? 'देखा गया (✓✓ Seen)' : 'Reviewed (✓✓ Seen)'}</span>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => handleAcknowledge(record.id)}
                        disabled={acknowledgingId === record.id}
                        className="px-3.5 py-1.5 rounded-xl bg-primary/10 border border-primary/20 text-primary text-xs font-bold hover:bg-primary/20 transition-all flex items-center gap-1.5"
                      >
                        <CheckCheck className="w-4 h-4" />
                        <span>{isHi ? 'देख लिया (मार्क करें)' : 'Mark as Seen'}</span>
                      </button>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Global Hidden Audio Element */}
        {activeAudioUrl && (
          <audio
            ref={audioPlayerRef}
            src={activeAudioUrl}
            onEnded={() => setIsPlayingAudio(false)}
            className="hidden"
          />
        )}

        {/* Fullscreen Photo Zoom Modal */}
        {zoomPhotoUrl && (
          <div
            onClick={() => setZoomPhotoUrl(null)}
            className="fixed inset-0 z-50 bg-black/90 backdrop-blur-md flex items-center justify-center p-4 cursor-pointer"
          >
            <div className="relative max-w-3xl max-h-[90vh]">
              <img
                src={zoomPhotoUrl}
                alt="Enlarged"
                className="max-w-full max-h-[85vh] object-contain rounded-2xl"
              />
              <button
                onClick={() => setZoomPhotoUrl(null)}
                className="absolute top-4 right-4 w-10 h-10 rounded-full bg-black/70 text-white flex items-center justify-center hover:bg-red-500 transition-colors"
              >
                <X className="w-6 h-6" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
