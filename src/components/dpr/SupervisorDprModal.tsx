import React, { useState, useEffect, useRef } from 'react';
import { db } from '../../core/db/database';
import { Site, IssueType, DailyRecord } from '../../types';
import { useTheme } from '../../core/theme/ThemeContext';
import { compressImage } from '../../utils/imageCompressor';
import { AudioNoteRecorder } from '../../utils/audioRecorder';
import { enqueueSyncMutation } from '../../core/sync/syncEngine';
import {
  X,
  Camera,
  Mic,
  Square,
  Play,
  RotateCcw,
  CheckCircle2,
  AlertTriangle,
  MapPin,
  Clock,
  Sparkles,
  Loader2,
  Trash2,
} from 'lucide-react';

interface SupervisorDprModalProps {
  isOpen: boolean;
  onClose: () => void;
  assignedSites: Site[];
  initialSiteId?: string;
  onSubmitted?: () => void;
}

export const SupervisorDprModal: React.FC<SupervisorDprModalProps> = ({
  isOpen,
  onClose,
  assignedSites,
  initialSiteId,
  onSubmitted,
}) => {
  const { language } = useTheme();
  const isHi = language === 'hi';

  const [siteId, setSiteId] = useState<string>(initialSiteId || (assignedSites[0]?.id ?? ''));
  const [status, setStatus] = useState<'full' | 'half' | 'stopped'>('full');
  const [selectedIssueIds, setSelectedIssueIds] = useState<string[]>([]);
  const [availableChips, setAvailableChips] = useState<IssueType[]>([]);

  // Photos state
  const [photos, setPhotos] = useState<{
    dataUrl: string;
    mimeType: string;
    sizeBytes: number;
    latitude?: number;
    longitude?: number;
    accuracyM?: number;
    capturedAt: string;
  }[]>([]);
  const [isCapturingLocation, setIsCapturingLocation] = useState(false);

  // Audio voice note state
  const recorderRef = useRef<AudioNoteRecorder | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [audioDataUrl, setAudioDataUrl] = useState<string | null>(null);
  const [isPlayingAudio, setIsPlayingAudio] = useState(false);
  const audioPlayerRef = useRef<HTMLAudioElement | null>(null);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  // Load available issue chips from Dexie or fallback defaults
  useEffect(() => {
    async function loadChips() {
      const stored = await db.issueTypes.where('isActive').equals(1).sortBy('sortOrder');
      if (stored.length > 0) {
        setAvailableChips(stored);
      } else {
        // Default universal chips for construction sites
        setAvailableChips([
          { id: 'rain', organizationId: '', labelHi: 'बारिश / जलभराव', labelEn: 'Heavy Rain / Waterlogging', icon: '🌧️', sortOrder: 1, isActive: true, isDefault: true },
          { id: 'no_material', organizationId: '', labelHi: 'सामग्री की कमी', labelEn: 'Material Shortage', icon: '🧱', sortOrder: 2, isActive: true, isDefault: true },
          { id: 'no_power', organizationId: '', labelHi: 'बिजली / जनरेटर बंद', labelEn: 'Power Cut / Generator Down', icon: '⚡', sortOrder: 3, isActive: true, isDefault: true },
          { id: 'labour_shortage', organizationId: '', labelHi: 'मज़दूर कम आए', labelEn: 'Labour Shortage', icon: '👷', sortOrder: 4, isActive: true, isDefault: true },
          { id: 'machine_breakdown', organizationId: '', labelHi: 'मशीन खराब (मिक्सर/JCB)', labelEn: 'Equipment Breakdown', icon: '🚜', sortOrder: 5, isActive: true, isDefault: true },
          { id: 'inspection', organizationId: '', labelHi: 'क्लाइंट / सरकारी निरीक्षण', labelEn: 'Client / Authority Inspection', icon: '📋', sortOrder: 6, isActive: true, isDefault: true },
        ]);
      }
    }
    if (isOpen) {
      loadChips();
      if (initialSiteId) setSiteId(initialSiteId);
      else if (assignedSites.length > 0 && !siteId) setSiteId(assignedSites[0].id);
    }
  }, [isOpen, initialSiteId, assignedSites]);

  // Audio timer
  useEffect(() => {
    let timer: any = null;
    if (isRecording) {
      timer = setInterval(() => setRecordingSeconds((s) => s + 1), 1000);
    } else {
      setRecordingSeconds(0);
    }
    return () => clearInterval(timer);
  }, [isRecording]);

  if (!isOpen) return null;

  const toggleIssueChip = (id: string) => {
    setSelectedIssueIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    if (photos.length + files.length > 6) {
      setErrorMessage(isHi ? 'अधिकतम 6 फोटो की अनुमति है।' : 'Maximum 6 photos allowed.');
      return;
    }

    setIsCapturingLocation(true);
    let coords: { latitude?: number; longitude?: number; accuracy?: number } = {};

    try {
      if (typeof navigator !== 'undefined' && navigator.geolocation) {
        coords = await new Promise((resolve) => {
          navigator.geolocation.getCurrentPosition(
            (pos) => resolve({
              latitude: pos.coords.latitude,
              longitude: pos.coords.longitude,
              accuracy: pos.coords.accuracy,
            }),
            () => resolve({}),
            { timeout: 6000, enableHighAccuracy: true }
          );
        });
      }
    } catch {
      // Continue even if GPS timed out
    } finally {
      setIsCapturingLocation(false);
    }

    const newPhotos = [...photos];
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      try {
        const compressedBase64 = await compressImage(file, 1280, 200 * 1024);
        newPhotos.push({
          dataUrl: compressedBase64,
          mimeType: 'image/jpeg',
          sizeBytes: Math.round((compressedBase64.length * 3) / 4),
          latitude: coords.latitude,
          longitude: coords.longitude,
          accuracyM: coords.accuracy,
          capturedAt: new Date().toISOString(),
        });
      } catch (err) {
        console.warn('Failed to compress photo:', err);
      }
    }
    setPhotos(newPhotos);
    e.target.value = '';
  };

  const startVoiceRecording = async () => {
    recorderRef.current = new AudioNoteRecorder();
    const ok = await recorderRef.current.startRecording();
    if (ok) {
      setIsRecording(true);
      setErrorMessage('');
    } else {
      setErrorMessage(
        isHi
          ? 'माइक की अनुमति नहीं मिली। आप बिना वॉइस नोट के भी रिपोर्ट भेज सकते हैं।'
          : 'Microphone access denied. You can proceed without voice note.'
      );
    }
  };

  const stopVoiceRecording = async () => {
    if (!recorderRef.current) return;
    const base64Audio = await recorderRef.current.stopRecording();
    setIsRecording(false);
    if (base64Audio) {
      setAudioDataUrl(base64Audio);
    }
  };

  const removePhoto = (index: number) => {
    setPhotos((prev) => prev.filter((_, i) => i !== index));
  };

  const removeAudio = () => {
    setAudioDataUrl(null);
    if (audioPlayerRef.current) {
      audioPlayerRef.current.pause();
      setIsPlayingAudio(false);
    }
  };

  const togglePlayAudio = () => {
    if (!audioPlayerRef.current || !audioDataUrl) return;
    if (isPlayingAudio) {
      audioPlayerRef.current.pause();
      setIsPlayingAudio(false);
    } else {
      audioPlayerRef.current.play();
      setIsPlayingAudio(true);
    }
  };

  const handleSubmit = async () => {
    if (!siteId) {
      setErrorMessage(isHi ? 'कृपया एक साइट चुनें।' : 'Please select a work site.');
      return;
    }

    setIsSubmitting(true);
    setErrorMessage('');

    try {
      const clientUuid = crypto.randomUUID();
      const now = new Date();
      // Format IST Date (YYYY-MM-DD)
      const istDate = new Intl.DateTimeFormat('en-CA', {
        timeZone: 'Asia/Kolkata',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
      }).format(now);

      const selectedSite = assignedSites.find((s) => s.id === siteId);
      const siteName = selectedSite?.name || 'Work Site';

      // 1. Prepare local Dexie daily record
      const localDailyRecord: DailyRecord = {
        id: clientUuid,
        clientId: clientUuid,
        siteId,
        siteName,
        recordDate: istDate,
        status,
        capturedAt: now.toISOString(),
        missingPhoto: photos.length === 0,
        missingVoice: !audioDataUrl,
        submittedBy: 'local-supervisor',
        submitterName: 'Site Supervisor',
        issues: availableChips.filter((c) => selectedIssueIds.includes(c.id)),
        media: photos.map((p) => ({
          kind: 'photo',
          storageKey: `local-${crypto.randomUUID()}`,
          url: p.dataUrl,
          mimeType: p.mimeType,
          sizeBytes: p.sizeBytes,
          latitude: p.latitude,
          longitude: p.longitude,
          accuracyM: p.accuracyM,
          capturedAt: p.capturedAt,
        })),
        synced: false,
      };

      if (audioDataUrl) {
        localDailyRecord.media?.push({
          kind: 'audio',
          storageKey: `local-${crypto.randomUUID()}`,
          url: audioDataUrl,
          mimeType: 'audio/webm',
          sizeBytes: Math.round((audioDataUrl.length * 3) / 4),
          capturedAt: now.toISOString(),
          durationSeconds: recordingSeconds || 10,
        });
      }

      // 2. Save locally into Dexie first (offline-first, zero latency)
      await db.dailyRecords.put(localDailyRecord);

      // 3. Prepare payload for cloud sync outbox
      const mediaBlobsToUpload: { kind: 'photo' | 'audio'; siteId: string; mimeType: string; dataUrl: string }[] = [];
      photos.forEach((p) => {
        mediaBlobsToUpload.push({
          kind: 'photo',
          siteId,
          mimeType: p.mimeType,
          dataUrl: p.dataUrl,
        });
      });

      if (audioDataUrl) {
        mediaBlobsToUpload.push({
          kind: 'audio',
          siteId,
          mimeType: 'audio/webm',
          dataUrl: audioDataUrl,
        });
      }

      const syncPayload = {
        clientId: clientUuid,
        siteId,
        recordDate: istDate,
        status,
        capturedAt: now.toISOString(),
        missingPhoto: photos.length === 0,
        missingVoice: !audioDataUrl,
        issueTypeIds: selectedIssueIds,
      };

      // 4. Enqueue into background sync engine
      await enqueueSyncMutation('daily_record', 'create', syncPayload, mediaBlobsToUpload);

      onSubmitted?.();
      onClose();
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to submit report');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-slate-950/75 p-0 sm:p-4">
      <div className="relative w-full max-w-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 sm:rounded-3xl rounded-t-3xl shadow-2xl overflow-hidden max-h-[92vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/60">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-2xl bg-primary/10 flex items-center justify-center text-primary">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-foreground">
                {isHi ? 'दैनिक साइट रिपोर्ट (DPR)' : 'Daily Progress Report (DPR)'}
              </h2>
              <p className="text-xs text-muted-foreground flex items-center gap-1">
                <Clock className="w-3.5 h-3.5" />
                {isHi ? 'आज की प्रगति दर्ज करें' : "Log today's work progress"}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-9 h-9 rounded-full bg-surface-raised hover:bg-border flex items-center justify-center text-muted-foreground transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content body */}
        <div className="p-4 sm:p-6 overflow-y-auto space-y-6 flex-1">
          {errorMessage && (
            <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-2xl flex items-start gap-2.5 text-xs text-red-500">
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* 1. Site Selector */}
          <div>
            <label className="block text-xs font-semibold text-muted-foreground mb-2 uppercase tracking-wider">
              {isHi ? '1. साइट का चयन करें' : '1. Select Work Site'}
            </label>
            <div className="relative">
              <select
                value={siteId}
                onChange={(e) => setSiteId(e.target.value)}
                className="w-full bg-surface-raised border border-border rounded-2xl px-4 py-3.5 text-foreground font-medium focus:outline-none focus:ring-2 focus:ring-primary appearance-none cursor-pointer"
              >
                {assignedSites.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name} ({s.location || 'Job Site'})
                  </option>
                ))}
              </select>
              <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-muted-foreground">
                ▼
              </div>
            </div>
          </div>

          {/* 2. Work Status (3-Tap Selector) */}
          <div>
            <label className="block text-xs font-semibold text-muted-foreground mb-2 uppercase tracking-wider">
              {isHi ? '2. आज काम की स्थिति' : '2. Today Work Status'}
            </label>
            <div className="grid grid-cols-3 gap-2.5">
              <button
                type="button"
                onClick={() => setStatus('full')}
                className={`py-3.5 px-3 rounded-2xl border text-center font-bold text-sm transition-all flex flex-col items-center gap-1.5 ${
                  status === 'full'
                    ? 'bg-emerald-500/15 border-emerald-500 text-emerald-500 shadow-sm'
                    : 'bg-surface-raised border-border text-muted-foreground hover:bg-border/40'
                }`}
              >
                <span className="text-xl">🟢</span>
                <span>{isHi ? 'पूरा दिन' : 'Full Day'}</span>
              </button>

              <button
                type="button"
                onClick={() => setStatus('half')}
                className={`py-3.5 px-3 rounded-2xl border text-center font-bold text-sm transition-all flex flex-col items-center gap-1.5 ${
                  status === 'half'
                    ? 'bg-amber-500/15 border-amber-500 text-amber-500 shadow-sm'
                    : 'bg-surface-raised border-border text-muted-foreground hover:bg-border/40'
                }`}
              >
                <span className="text-xl">🟡</span>
                <span>{isHi ? 'आधा दिन' : 'Half Day'}</span>
              </button>

              <button
                type="button"
                onClick={() => setStatus('stopped')}
                className={`py-3.5 px-3 rounded-2xl border text-center font-bold text-sm transition-all flex flex-col items-center gap-1.5 ${
                  status === 'stopped'
                    ? 'bg-red-500/15 border-red-500 text-red-500 shadow-sm'
                    : 'bg-surface-raised border-border text-muted-foreground hover:bg-border/40'
                }`}
              >
                <span className="text-xl">🔴</span>
                <span>{isHi ? 'काम बंद' : 'Stopped'}</span>
              </button>
            </div>
          </div>

          {/* 3. Issue Chips (Optional) */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                {isHi ? '3. कोई समस्या / रुकावट? (वैकल्पिक)' : '3. Any Issues or Blockers? (Optional)'}
              </label>
              <span className="text-[10px] text-muted-foreground">
                {selectedIssueIds.length} {isHi ? 'चुने गए' : 'selected'}
              </span>
            </div>
            <div className="flex flex-wrap gap-2">
              {availableChips.map((chip) => {
                const isSelected = selectedIssueIds.includes(chip.id);
                return (
                  <button
                    key={chip.id}
                    type="button"
                    onClick={() => toggleIssueChip(chip.id)}
                    className={`px-3 py-2 rounded-xl text-xs font-medium border flex items-center gap-1.5 transition-all ${
                      isSelected
                        ? 'bg-primary/15 border-primary text-primary font-semibold shadow-sm'
                        : 'bg-surface-raised border-border text-muted-foreground hover:bg-border/40'
                    }`}
                  >
                    <span>{chip.icon || '⚠️'}</span>
                    <span>{isHi ? chip.labelHi : chip.labelEn}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* 4. Geotagged Photos */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                <Camera className="w-3.5 h-3.5 text-primary" />
                {isHi ? '4. साइट फोटो (GPS जियोटैग)' : '4. Site Photos (GPS Geotagged)'}
              </label>
              <span className="text-[11px] text-muted-foreground">{photos.length} / 6</span>
            </div>

            {/* Photo thumbnails grid */}
            <div className="grid grid-cols-3 gap-2.5">
              {photos.map((p, idx) => (
                <div
                  key={idx}
                  className="relative aspect-square rounded-2xl overflow-hidden border border-border group bg-black/40"
                >
                  <img src={p.dataUrl} alt="Site" className="w-full h-full object-cover" />
                  <button
                    type="button"
                    onClick={() => removePhoto(idx)}
                    className="absolute top-1.5 right-1.5 w-6 h-6 rounded-full bg-black/70 text-white flex items-center justify-center hover:bg-red-500 transition-colors"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                  {p.latitude != null && (
                    <div className="absolute bottom-1 left-1 px-1.5 py-0.5 rounded-md bg-black/70 text-[9px] text-emerald-400 flex items-center gap-0.5">
                      <MapPin className="w-2.5 h-2.5" /> GPS
                    </div>
                  )}
                </div>
              ))}

              {photos.length < 6 && (
                <label className="relative aspect-square rounded-2xl border-2 border-dashed border-border hover:border-primary bg-surface-raised/40 hover:bg-primary/5 flex flex-col items-center justify-center gap-1.5 cursor-pointer text-muted-foreground transition-all">
                  {isCapturingLocation ? (
                    <Loader2 className="w-6 h-6 text-primary animate-spin" />
                  ) : (
                    <>
                      <Camera className="w-6 h-6 text-primary" />
                      <span className="text-[11px] font-semibold">
                        {isHi ? 'फोटो लें' : 'Add Photo'}
                      </span>
                    </>
                  )}
                  <input
                    type="file"
                    accept="image/*"
                    capture="environment"
                    multiple
                    onChange={handlePhotoUpload}
                    className="hidden"
                    disabled={isCapturingLocation}
                  />
                </label>
              )}
            </div>
          </div>

          {/* 5. Voice Note Recorder */}
          <div>
            <label className="block text-xs font-semibold text-muted-foreground mb-2 uppercase tracking-wider flex items-center gap-1.5">
              <Mic className="w-3.5 h-3.5 text-primary" />
              {isHi ? '5. वॉइस नोट (बोलकर बताएं)' : '5. Voice Note (Speak report)'}
            </label>

            {!audioDataUrl && !isRecording && (
              <button
                type="button"
                onClick={startVoiceRecording}
                className="w-full py-3.5 px-4 rounded-2xl border border-dashed border-primary/40 bg-primary/5 hover:bg-primary/10 text-primary font-semibold text-sm flex items-center justify-center gap-2 transition-all"
              >
                <Mic className="w-4 h-4" />
                <span>{isHi ? 'माइक चालू करें और बोलें' : 'Tap to Record Voice Note'}</span>
              </button>
            )}

            {isRecording && (
              <div className="w-full p-4 rounded-2xl border border-red-500/40 bg-red-500/10 flex items-center justify-between animate-pulse">
                <div className="flex items-center gap-2.5 text-red-500 font-bold text-sm">
                  <span className="w-3 h-3 rounded-full bg-red-500 animate-ping" />
                  <span>
                    {isHi ? 'रिकॉर्डिंग चालू है...' : 'Recording...'} {recordingSeconds}s
                  </span>
                </div>
                <button
                  type="button"
                  onClick={stopVoiceRecording}
                  className="px-4 py-2 rounded-xl bg-red-500 text-white font-bold text-xs flex items-center gap-1.5 shadow-md"
                >
                  <Square className="w-3.5 h-3.5 fill-current" />
                  <span>{isHi ? 'रोकें' : 'Stop'}</span>
                </button>
              </div>
            )}

            {audioDataUrl && (
              <div className="w-full p-3.5 rounded-2xl border border-border bg-surface-raised flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <button
                    type="button"
                    onClick={togglePlayAudio}
                    className="w-9 h-9 rounded-full bg-primary text-white flex items-center justify-center shadow-md hover:bg-primary/90 transition-colors"
                  >
                    {isPlayingAudio ? (
                      <Square className="w-4 h-4 fill-current" />
                    ) : (
                      <Play className="w-4 h-4 fill-current ml-0.5" />
                    )}
                  </button>
                  <div className="text-xs">
                    <p className="font-semibold text-foreground">
                      {isHi ? 'वॉइस नोट रिकॉर्ड हो गया' : 'Voice Note Ready'}
                    </p>
                    <p className="text-[10px] text-muted-foreground">
                      {isHi ? 'सुनने के लिए प्ले करें' : 'Tap play to review'}
                    </p>
                  </div>
                  <audio
                    ref={audioPlayerRef}
                    src={audioDataUrl}
                    onEnded={() => setIsPlayingAudio(false)}
                    className="hidden"
                  />
                </div>
                <button
                  type="button"
                  onClick={removeAudio}
                  className="p-2 text-muted-foreground hover:text-red-500 transition-colors"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Footer Submit Action */}
        <div className="p-4 border-t border-border bg-surface-raised/40 flex items-center gap-3">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 py-3.5 px-4 rounded-2xl border border-border bg-surface font-semibold text-sm text-foreground hover:bg-border/40 transition-colors"
          >
            {isHi ? 'रद्द करें' : 'Cancel'}
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={isSubmitting}
            className="flex-1 py-3.5 px-4 rounded-2xl bg-primary text-white font-bold text-sm shadow-lg shadow-primary/25 hover:bg-primary/90 active:scale-[0.98] transition-all flex items-center justify-center gap-2 disabled:opacity-50"
          >
            {isSubmitting ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <>
                <CheckCircle2 className="w-5 h-5" />
                <span>{isHi ? 'रिपोर्ट जमा करें' : 'Submit DPR'}</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
