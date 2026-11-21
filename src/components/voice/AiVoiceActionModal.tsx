import React, { useState, useEffect, useRef } from 'react';
import { useTheme } from '../../core/theme/ThemeContext';
import { db } from '../../core/db/database';
import { Site, MaterialRequest, SiteTask } from '../../types';
import { apiExtractVoiceAction, ExtractedVoiceActionResult } from '../../services/apiClient';
import { enqueueSyncMutation } from '../../core/sync/syncEngine';
import {
  Mic,
  MicOff,
  Sparkles,
  CheckCircle2,
  X,
  Package,
  CheckSquare,
  DollarSign,
  Building2,
  Calendar,
  Layers,
  Flame,
  ArrowRight,
  AlertCircle,
  Loader2,
  RotateCcw,
} from 'lucide-react';

interface AiVoiceActionModalProps {
  isOpen: boolean;
  onClose: () => void;
  sites: Site[];
  onActionConfirmed?: (actionType: string, resultData: any) => void;
}

export const AiVoiceActionModal: React.FC<AiVoiceActionModalProps> = ({
  isOpen,
  onClose,
  sites,
  onActionConfirmed,
}) => {
  const { language, tradeConfig } = useTheme();
  const isHi = language === 'hi';

  // Voice recording & input states
  const [isRecording, setIsRecording] = useState(false);
  const [recordSeconds, setRecordSeconds] = useState(0);
  const [transcript, setTranscript] = useState('');
  const [isExtracting, setIsExtracting] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  // MediaRecorder refs
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const recognitionRef = useRef<any>(null);

  // Extracted Action Confirmation Card State
  const [extractedResult, setExtractedResult] = useState<ExtractedVoiceActionResult | null>(null);
  const [actionType, setActionType] = useState<'material_request' | 'site_task' | 'expense' | 'site_create'>('material_request');
  const [targetSiteId, setTargetSiteId] = useState<string>(sites.length > 0 ? sites[0].id : '');
  const [itemName, setItemName] = useState('');
  const [quantity, setQuantity] = useState('10');
  const [unit, setUnit] = useState('bags');
  const [urgency, setUrgency] = useState<'normal' | 'urgent'>('normal');
  const [taskTitle, setTaskTitle] = useState('');
  const [taskPriority, setTaskPriority] = useState<'low' | 'medium' | 'high'>('medium');
  const [taskDueDate, setTaskDueDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [expenseAmount, setExpenseAmount] = useState('0');
  const [expensePaymentStatus, setExpensePaymentStatus] = useState<'paid' | 'pending'>('paid');
  const [notes, setNotes] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  // Clean up timer on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  if (!isOpen) return null;

  // Toggle Live Speech Recording (Web Speech API + Audio Buffer)
  const startRecording = () => {
    setErrorMessage('');
    setTranscript('');
    setRecordSeconds(0);
    setExtractedResult(null);

    // Initialize Web Speech API for real-time live preview
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (SpeechRecognition) {
      const recognition = new SpeechRecognition();
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = language === 'hi' ? 'hi-IN' : 'en-IN';

      recognition.onresult = (event: any) => {
        let currentText = '';
        for (let i = event.resultIndex; i < event.results.length; ++i) {
          currentText += event.results[i][0].transcript;
        }
        setTranscript(currentText);
      };

      recognition.onerror = (e: any) => {
        console.warn('Speech recognition warning:', e);
      };

      try {
        recognition.start();
        recognitionRef.current = recognition;
      } catch (err) {
        console.warn('Recognition start error:', err);
      }
    }

    // Start 60-second timer
    setIsRecording(true);
    timerRef.current = setInterval(() => {
      setRecordSeconds((prev) => {
        if (prev >= 59) {
          stopRecording();
          return 60;
        }
        return prev + 1;
      });
    }, 1000);
  };

  const stopRecording = () => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch {}
      recognitionRef.current = null;
    }
    setIsRecording(false);

    // Auto extract once recording stops
    if (transcript.trim().length > 3) {
      handleExtractFromTranscript(transcript);
    }
  };

  const handleExtractFromTranscript = async (textToExtract: string) => {
    if (!textToExtract.trim()) {
      setErrorMessage(isHi ? 'कृपया पहले कुछ बोलें या टाइप करें।' : 'Please speak or enter text first.');
      return;
    }

    setIsExtracting(true);
    setErrorMessage('');

    try {
      const res = await apiExtractVoiceAction({
        transcript: textToExtract,
        siteId: targetSiteId || (sites[0]?.id ?? undefined),
      });

      if (res.data?.action) {
        const action = res.data.action;
        setExtractedResult(action);
        setActionType((action.actionType as any) || 'site_task');

        if (action.extractedData.siteId && sites.some((s) => s.id === action.extractedData.siteId)) {
          setTargetSiteId(action.extractedData.siteId);
        }

        // Populate fields
        setItemName(action.extractedData.itemName || textToExtract.slice(0, 40));
        setQuantity(String(action.extractedData.quantity || 10));
        setUnit(action.extractedData.unit || 'bags');
        setUrgency((action.extractedData.urgency as any) || 'normal');
        setTaskTitle(action.extractedData.title || textToExtract.slice(0, 80));
        setTaskPriority((action.extractedData.priority as any) || 'medium');
        setExpenseAmount(String(action.extractedData.amount || 0));
        setNotes(action.extractedData.notes || textToExtract);
      }
    } catch (err: any) {
      console.warn('API extraction failed, applying local fallback:', err);
      // Client-side Fallback
      setExtractedResult({
        actionType: 'material_request',
        confidence: 0.8,
        transcript: textToExtract,
        source: 'rules_engine',
        extractedData: {
          itemName: textToExtract.slice(0, 30),
          quantity: 10,
          unit: 'bags',
          urgency: 'normal',
        },
      });
      setItemName(textToExtract.slice(0, 30));
      setTaskTitle(textToExtract.slice(0, 80));
    } finally {
      setIsExtracting(false);
    }
  };

  // Quick Preset Samples for 1-Tap Demonstration
  const handleApplyPreset = (sampleText: string) => {
    setTranscript(sampleText);
    handleExtractFromTranscript(sampleText);
  };

  // Final Confirmation & Creation Handler
  const handleConfirmAndSave = async () => {
    setIsSaving(true);
    setErrorMessage('');

    try {
      const activeSiteId = targetSiteId || (sites.length > 0 ? sites[0].id : 'default-site');
      const activeSiteName = sites.find((s) => s.id === activeSiteId)?.name || 'Construction Site';
      const activeContractorId = localStorage.getItem('sitesaathi_active_user_id') || 'active-user';

      if (actionType === 'material_request') {
        const newReqId = crypto.randomUUID();
        const numQty = parseFloat(quantity) || 1;
        const newRequest: MaterialRequest = {
          id: newReqId,
          clientId: newReqId,
          siteId: activeSiteId,
          siteName: activeSiteName,
          requestedBy: activeContractorId,
          requestedByName: 'Site Voice Assistant',
          itemsJson: [
            {
              itemName: itemName || 'Construction Material',
              quantity: numQty,
              unit: unit || 'bags',
            },
          ],
          urgency,
          status: 'pending',
          notes: notes || undefined,
          synced: false,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };

        await db.materialRequests.put(newRequest);
        await enqueueSyncMutation('material_request', 'create', newRequest);
        onActionConfirmed?.('material_request', newRequest);
      } else if (actionType === 'site_task') {
        const newTaskId = crypto.randomUUID();
        const newTask: SiteTask = {
          id: newTaskId,
          clientId: newTaskId,
          siteId: activeSiteId,
          siteName: activeSiteName,
          title: taskTitle || 'Site Action Item',
          description: notes || taskTitle,
          priority: taskPriority,
          status: 'todo',
          dueDate: taskDueDate,
          synced: false,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };

        await db.siteTasks.put(newTask);
        await enqueueSyncMutation('site_task', 'create', newTask);
        onActionConfirmed?.('site_task', newTask);
      } else if (actionType === 'expense') {
        const materialId = crypto.randomUUID();
        const numAmount = parseFloat(expenseAmount) || 0;
        await db.materials.put({
          id: materialId,
          siteId: activeSiteId,
          itemName: itemName || 'Site Expense',
          quantity: 1,
          unit: 'item',
          unitPrice: numAmount,
          totalCost: numAmount,
          purchaseDate: new Date().toISOString().slice(0, 10),
          paymentStatus: expensePaymentStatus,
          paidAmount: expensePaymentStatus === 'paid' ? numAmount : 0,
          notes: notes || undefined,
        });

        if (expensePaymentStatus === 'pending') {
          await db.dues.put({
            id: crypto.randomUUID(),
            siteId: activeSiteId,
            materialId,
            title: `Voice Due: ${itemName || 'Material Purchase'}`,
            amountDue: numAmount,
            amountPaid: 0,
            category: 'material',
            dueDate: new Date().toISOString().slice(0, 10),
            status: 'pending',
          });
        }
        onActionConfirmed?.('expense', { itemName, amount: numAmount });
      }

      onClose();
    } catch (err: any) {
      console.error('Error confirming voice action:', err);
      setErrorMessage(err.message || (isHi ? 'सुरक्षित करने में त्रुटि।' : 'Failed to save action.'));
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 overflow-y-auto">
      {/* Backdrop */}
      <div className="fixed inset-0 bg-slate-950/75 backdrop-blur-sm transition-opacity" onClick={onClose} />

      {/* Dialog Container */}
      <div className="relative z-10 bg-white dark:bg-slate-900 w-full max-w-lg rounded-t-3xl sm:rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden flex flex-col max-h-[90vh] animate-slide-in">
        
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-gradient-to-r from-blue-50/60 to-indigo-50/40 dark:from-slate-800/60 dark:to-slate-800/40">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-600 text-white flex items-center justify-center shadow-md">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h2 className="font-extrabold text-base text-slate-900 dark:text-white font-heading">
                {isHi ? 'एआई आवाज सहायक' : 'AI Voice Action Assistant'}
              </h2>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                {isHi ? 'बोलकर सामान मंगाएं, टास्क या खर्च जोड़ें' : 'Speak in Hindi/English to request materials or log tasks'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-white dark:bg-slate-800 text-slate-400 hover:text-slate-600 dark:hover:text-white flex items-center justify-center shadow-xs cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="p-4 sm:p-5 overflow-y-auto space-y-4">

          {/* Microphone Recording Section */}
          <div className="p-5 rounded-3xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/80 dark:border-slate-700/80 flex flex-col items-center justify-center text-center space-y-3">
            
            <button
              type="button"
              onClick={isRecording ? stopRecording : startRecording}
              className={`relative w-20 h-20 rounded-full flex items-center justify-center text-white shadow-xl transition-all cursor-pointer ${
                isRecording
                  ? 'bg-red-500 scale-105 shadow-red-500/40 animate-pulse'
                  : 'bg-gradient-to-tr from-blue-600 to-indigo-600 hover:scale-105 shadow-blue-500/30'
              }`}
            >
              {isRecording ? <MicOff className="w-8 h-8" /> : <Mic className="w-8 h-8" />}
              {isRecording && (
                <span className="absolute -inset-2 rounded-full border-2 border-red-500/60 animate-ping pointer-events-none" />
              )}
            </button>

            <div className="space-y-1">
              <span className={`text-xs font-black uppercase tracking-wider ${isRecording ? 'text-red-600 animate-pulse' : 'text-slate-700 dark:text-slate-300'}`}>
                {isRecording
                  ? `${isHi ? 'सुन रहे हैं... रिकॉर्डिंग जारी' : 'Listening... Speaking'} (${recordSeconds}s / 60s)`
                  : isHi
                  ? 'माइक दबाकर बोलें'
                  : 'Tap to Speak'}
              </span>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                {isHi ? 'उदा: "50 बैग अल्ट्राटेक सीमेंट सेक्टर 62 साइट पर कल तुरंत भेजो"' : 'e.g. "Send 50 bags cement to Sector 62 site tomorrow urgent"'}
              </p>
            </div>

            {/* Quick Preset Buttons */}
            {!isRecording && (
              <div className="flex flex-wrap items-center justify-center gap-1.5 pt-2">
                <button
                  type="button"
                  onClick={() => handleApplyPreset('50 bags cement Ultratech Sector 62 site par kal subah bhej do urgent hai')}
                  className="px-2.5 py-1 rounded-xl text-[10px] font-bold bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:border-blue-400 cursor-pointer shadow-xs"
                >
                  📦 50 Bags Cement Urgent
                </button>
                <button
                  type="button"
                  onClick={() => handleApplyPreset('Beam 4 ki shuttering check karo aur theek karo')}
                  className="px-2.5 py-1 rounded-xl text-[10px] font-bold bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:border-emerald-400 cursor-pointer shadow-xs"
                >
                  🔨 Shuttering Check Task
                </button>
                <button
                  type="button"
                  onClick={() => handleApplyPreset('5000 rupaye mixer machine diesel ke liye diya')}
                  className="px-2.5 py-1 rounded-xl text-[10px] font-bold bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:border-amber-400 cursor-pointer shadow-xs"
                >
                  💰 ₹5,000 Diesel Expense
                </button>
              </div>
            )}
          </div>

          {/* Transcript Box */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                {isHi ? 'ऑडियो ट्रांसक्रिप्ट (बोले गए शब्द)' : 'Voice Transcript Preview'}
              </label>
              {transcript && (
                <button
                  type="button"
                  onClick={() => handleExtractFromTranscript(transcript)}
                  disabled={isExtracting}
                  className="text-[11px] font-bold text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1 cursor-pointer"
                >
                  {isExtracting ? <Loader2 className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3" />}
                  <span>{isHi ? 'पुनः विश्लेषण करें' : 'Analyze Intent'}</span>
                </button>
              )}
            </div>
            <textarea
              rows={2}
              value={transcript}
              onChange={(e) => setTranscript(e.target.value)}
              placeholder={isHi ? 'आवाज से बोले गए शब्द यहां दिखेंगे, या आप टाइप भी कर सकते हैं...' : 'Spoken words appear here, or you can type directly...'}
              className="w-full px-3.5 py-2.5 rounded-2xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Error Banner */}
          {errorMessage && (
            <div className="p-3 rounded-2xl bg-red-50 dark:bg-red-950/30 border border-red-200 text-xs text-red-600 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* Mandatory AI Confirmation Card UI */}
          {(extractedResult || transcript.trim().length > 5) && (
            <div className="p-4 sm:p-5 rounded-3xl bg-white dark:bg-slate-800 border-2 border-blue-500/40 shadow-lg space-y-4 animate-fade-in">
              
              {/* Header Badge & Action Type Switcher */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 dark:border-slate-700/80 pb-3">
                <div className="flex items-center gap-2">
                  <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300 uppercase tracking-wider flex items-center gap-1">
                    <Sparkles className="w-3 h-3" />
                    <span>{isHi ? 'पुष्टि कार्ड' : 'Confirmation Card'}</span>
                  </span>
                  {extractedResult?.confidence && (
                    <span className="text-[10px] font-bold text-slate-400">
                      {Math.round(extractedResult.confidence * 100)}% match
                    </span>
                  )}
                </div>

                {/* Action Type Segmented Tabs */}
                <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-900 p-1 rounded-xl">
                  <button
                    type="button"
                    onClick={() => setActionType('material_request')}
                    className={`px-2.5 py-1 rounded-lg text-[10px] font-bold transition-all ${
                      actionType === 'material_request'
                        ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-xs'
                        : 'text-slate-500 hover:text-slate-800'
                    }`}
                  >
                    📦 {isHi ? 'सामान' : 'Material'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setActionType('site_task')}
                    className={`px-2.5 py-1 rounded-lg text-[10px] font-bold transition-all ${
                      actionType === 'site_task'
                        ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-xs'
                        : 'text-slate-500 hover:text-slate-800'
                    }`}
                  >
                    🔨 {isHi ? 'टास्क' : 'Task'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setActionType('expense')}
                    className={`px-2.5 py-1 rounded-lg text-[10px] font-bold transition-all ${
                      actionType === 'expense'
                        ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-xs'
                        : 'text-slate-500 hover:text-slate-800'
                    }`}
                  >
                    💰 {isHi ? 'खर्च' : 'Expense'}
                  </button>
                </div>
              </div>

              {/* Target Site Selector */}
              <div className="space-y-1">
                <label className="text-[11px] font-bold text-slate-500 dark:text-slate-400">
                  {isHi ? 'साइट का चयन करें' : 'Selected Site'}
                </label>
                <select
                  value={targetSiteId}
                  onChange={(e) => setTargetSiteId(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-900 dark:text-white focus:outline-none"
                >
                  {sites.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name} ({s.location || 'Site'})
                    </option>
                  ))}
                </select>
              </div>

              {/* Form Fields for Material Request */}
              {actionType === 'material_request' && (
                <div className="space-y-3">
                  <div className="space-y-1">
                    <label className="text-[11px] font-bold text-slate-500 dark:text-slate-400">
                      {isHi ? 'सामान का नाम' : 'Item Name'}
                    </label>
                    <input
                      type="text"
                      value={itemName}
                      onChange={(e) => setItemName(e.target.value)}
                      placeholder="e.g. Ultratech Cement 53"
                      className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-900 dark:text-white focus:outline-none"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-1">
                      <label className="text-[11px] font-bold text-slate-500 dark:text-slate-400">
                        {isHi ? 'मात्रा (Quantity)' : 'Quantity'}
                      </label>
                      <input
                        type="number"
                        value={quantity}
                        onChange={(e) => setQuantity(e.target.value)}
                        className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-900 dark:text-white focus:outline-none"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[11px] font-bold text-slate-500 dark:text-slate-400">
                        {isHi ? 'इकाई (Unit)' : 'Unit'}
                      </label>
                      <select
                        value={unit}
                        onChange={(e) => setUnit(e.target.value)}
                        className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-900 dark:text-white focus:outline-none"
                      >
                        <option value="bags">Bags (बोरी)</option>
                        <option value="tons">Tons (टन)</option>
                        <option value="brass">Brass (ब्रास)</option>
                        <option value="nos">Nos (पीस)</option>
                        <option value="kg">Kg (किलो)</option>
                        <option value="litres">Litres (लीटर)</option>
                        <option value="trips">Trips / Trolley</option>
                      </select>
                    </div>
                  </div>

                  <div className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700">
                    <span className="text-xs font-bold text-slate-700 dark:text-slate-300">
                      {isHi ? 'जरूरत (Urgency)' : 'Urgency Level'}
                    </span>
                    <button
                      type="button"
                      onClick={() => setUrgency((u) => (u === 'urgent' ? 'normal' : 'urgent'))}
                      className={`px-3 py-1 rounded-full text-xs font-bold flex items-center gap-1 transition-all cursor-pointer ${
                        urgency === 'urgent'
                          ? 'bg-red-500 text-white shadow-xs'
                          : 'bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300'
                      }`}
                    >
                      {urgency === 'urgent' && <Flame className="w-3.5 h-3.5" />}
                      <span>{urgency === 'urgent' ? (isHi ? 'तुरंत (Urgent)' : 'Urgent') : (isHi ? 'सामान्य' : 'Normal')}</span>
                    </button>
                  </div>
                </div>
              )}

              {/* Form Fields for Site Task */}
              {actionType === 'site_task' && (
                <div className="space-y-3">
                  <div className="space-y-1">
                    <label className="text-[11px] font-bold text-slate-500 dark:text-slate-400">
                      {isHi ? 'टास्क का शीर्षक' : 'Task Title'}
                    </label>
                    <input
                      type="text"
                      value={taskTitle}
                      onChange={(e) => setTaskTitle(e.target.value)}
                      placeholder="e.g. Inspect shuttering leakage at beam 4"
                      className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-900 dark:text-white focus:outline-none"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-1">
                      <label className="text-[11px] font-bold text-slate-500 dark:text-slate-400">
                        {isHi ? 'प्राथमिकता (Priority)' : 'Priority'}
                      </label>
                      <select
                        value={taskPriority}
                        onChange={(e) => setTaskPriority(e.target.value as any)}
                        className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-900 dark:text-white focus:outline-none"
                      >
                        <option value="low">Low</option>
                        <option value="medium">Medium</option>
                        <option value="high">High (High Priority)</option>
                      </select>
                    </div>

                    <div className="space-y-1">
                      <label className="text-[11px] font-bold text-slate-500 dark:text-slate-400">
                        {isHi ? 'अंतिम तारीख' : 'Due Date'}
                      </label>
                      <input
                        type="date"
                        value={taskDueDate}
                        onChange={(e) => setTaskDueDate(e.target.value)}
                        className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-900 dark:text-white focus:outline-none"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* Form Fields for Expense */}
              {actionType === 'expense' && (
                <div className="space-y-3">
                  <div className="space-y-1">
                    <label className="text-[11px] font-bold text-slate-500 dark:text-slate-400">
                      {isHi ? 'खर्च का विवरण' : 'Expense Title'}
                    </label>
                    <input
                      type="text"
                      value={itemName}
                      onChange={(e) => setItemName(e.target.value)}
                      placeholder="e.g. Diesel for concrete mixer"
                      className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-900 dark:text-white focus:outline-none"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-1">
                      <label className="text-[11px] font-bold text-slate-500 dark:text-slate-400">
                        {isHi ? 'रकम (Amount ₹)' : 'Amount (₹)'}
                      </label>
                      <input
                        type="number"
                        value={expenseAmount}
                        onChange={(e) => setExpenseAmount(e.target.value)}
                        className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-900 dark:text-white focus:outline-none"
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="text-[11px] font-bold text-slate-500 dark:text-slate-400">
                        {isHi ? 'भुगतान स्थिति' : 'Payment Status'}
                      </label>
                      <select
                        value={expensePaymentStatus}
                        onChange={(e) => setExpensePaymentStatus(e.target.value as any)}
                        className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-900 dark:text-white focus:outline-none"
                      >
                        <option value="paid">{isHi ? 'नकद / चुकता (Paid)' : 'Paid'}</option>
                        <option value="pending">{isHi ? 'बाकी / उधारी (Pending)' : 'Pending Due'}</option>
                      </select>
                    </div>
                  </div>
                </div>
              )}

              {/* Confirm & Save Button */}
              <button
                type="button"
                onClick={handleConfirmAndSave}
                disabled={isSaving}
                className="w-full py-3.5 rounded-2xl text-xs font-extrabold text-white shadow-lg flex items-center justify-center gap-2 transition-all btn-tactile hover:scale-[1.01] active:scale-[0.99] cursor-pointer"
                style={{ backgroundColor: tradeConfig.primaryColor }}
              >
                {isSaving ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <CheckCircle2 className="w-4 h-4" />
                )}
                <span>
                  {isHi ? 'पुष्टि करें और सुरक्षित करें (Confirm & Save)' : 'Confirm & Save Action'}
                </span>
                <ArrowRight className="w-4 h-4" />
              </button>

            </div>
          )}

        </div>

      </div>
    </div>
  );
};
