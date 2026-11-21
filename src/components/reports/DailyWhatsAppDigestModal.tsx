import React, { useState, useEffect } from 'react';
import { useTheme } from '../../core/theme/ThemeContext';
import { Site, DailyRecord } from '../../types';
import { apiGetDailyDigest, DailyDigestResult } from '../../services/apiClient';
import {
  X,
  MessageCircle,
  Copy,
  Check,
  Share2,
  Calendar,
  Building2,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Loader2,
  ExternalLink,
} from 'lucide-react';

interface DailyWhatsAppDigestModalProps {
  isOpen: boolean;
  onClose: () => void;
  sites: Site[];
  ownerPhone?: string;
}

export const DailyWhatsAppDigestModal: React.FC<DailyWhatsAppDigestModalProps> = ({
  isOpen,
  onClose,
  sites,
  ownerPhone,
}) => {
  const { language } = useTheme();
  const isHi = language === 'hi';

  const [isLoading, setIsLoading] = useState(false);
  const [digest, setDigest] = useState<DailyDigestResult | null>(null);
  const [copied, setCopied] = useState(false);
  const [customPhone, setCustomPhone] = useState(ownerPhone || '');

  // Load today's live digest from backend or compute locally
  useEffect(() => {
    if (!isOpen) return;

    setIsLoading(true);
    apiGetDailyDigest(customPhone)
      .then((res) => {
        if (res.data?.digest) {
          setDigest(res.data.digest);
        }
      })
      .catch((err) => {
        console.warn('Backend digest fetch failed, generating local summary:', err);
        // Fallback local digest
        const today = new Date().toLocaleDateString('en-IN', {
          dateStyle: 'medium',
          timeZone: 'Asia/Kolkata',
        });
        const total = sites.length;
        const msg = `🏗️ *SiteSaathi — Daily Site Digest*\n📅 *Date:* ${today} (IST)\n━━━━━━━━━━━━━━━━━━\n📊 *Active Sites:* *${total}*\n📲 *Open SiteSaathi:*\nhttps://sitesaathi.app/dashboard`;
        setDigest({
          date: new Date().toISOString().slice(0, 10),
          totalSites: total,
          reportedSites: 0,
          pendingSites: total,
          fullDayCount: 0,
          halfDayCount: 0,
          stoppedCount: 0,
          pendingMaterialsCount: 0,
          overdueTasksCount: 0,
          messageText: msg,
          waLink: `https://wa.me/?text=${encodeURIComponent(msg)}`,
        });
      })
      .finally(() => {
        setIsLoading(false);
      });
  }, [isOpen, customPhone, sites.length]);

  if (!isOpen) return null;

  const handleCopyText = async () => {
    if (!digest?.messageText) return;
    try {
      await navigator.clipboard.writeText(digest.messageText);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      // Fallback
    }
  };

  const handleOpenWhatsApp = () => {
    if (!digest) return;
    const cleanPhone = customPhone.replace(/\D/g, '');
    const url = cleanPhone
      ? `https://wa.me/${cleanPhone}?text=${encodeURIComponent(digest.messageText)}`
      : `https://wa.me/?text=${encodeURIComponent(digest.messageText)}`;

    window.open(url, '_blank');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 overflow-y-auto">
      {/* Backdrop */}
      <div className="fixed inset-0 bg-slate-950/75 backdrop-blur-sm transition-opacity" onClick={onClose} />

      {/* Dialog Container */}
      <div className="relative z-10 bg-white dark:bg-slate-900 w-full max-w-lg rounded-t-3xl sm:rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden flex flex-col max-h-[90vh] animate-slide-in">
        
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-gradient-to-r from-emerald-50/70 to-teal-50/50 dark:from-slate-800/80 dark:to-slate-800/60">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-2xl bg-emerald-600 text-white flex items-center justify-center shadow-md">
              <MessageCircle className="w-5 h-5" />
            </div>
            <div>
              <h2 className="font-extrabold text-base text-slate-900 dark:text-white font-heading">
                {isHi ? 'दैनिक व्हाट्सएप डाइजेस्ट' : 'Daily WhatsApp Digest'}
              </h2>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                {isHi ? 'शाम 8:30 बजे की ऑटोमैटिक साइट प्रगति सारांश' : 'Automated 8:30 PM IST Daily Site Executive Summary'}
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
          
          {isLoading ? (
            <div className="py-12 text-center text-slate-400 flex flex-col items-center justify-center gap-2">
              <Loader2 className="w-8 h-8 animate-spin text-emerald-600" />
              <p className="text-xs font-semibold">{isHi ? 'आज का सारांश तैयार हो रहा है...' : 'Compiling today\'s site summary...'}</p>
            </div>
          ) : digest ? (
            <>
              {/* Stat Highlights Card */}
              <div className="grid grid-cols-3 gap-2">
                <div className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700/80 text-center">
                  <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 block">
                    {isHi ? 'साइट रिपोर्ट' : 'Reported'}
                  </span>
                  <span className="text-base font-black text-emerald-600 dark:text-emerald-400 mt-0.5 block">
                    {digest.reportedSites} / {digest.totalSites}
                  </span>
                </div>

                <div className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700/80 text-center">
                  <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 block">
                    {isHi ? 'सामान पेंडिंग' : 'Materials'}
                  </span>
                  <span className={`text-base font-black mt-0.5 block ${digest.pendingMaterialsCount > 0 ? 'text-amber-500' : 'text-slate-700 dark:text-slate-200'}`}>
                    {digest.pendingMaterialsCount}
                  </span>
                </div>

                <div className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700/80 text-center">
                  <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 block">
                    {isHi ? 'ओवरड्यू टास्क' : 'Overdue Tasks'}
                  </span>
                  <span className={`text-base font-black mt-0.5 block ${digest.overdueTasksCount > 0 ? 'text-red-500' : 'text-slate-700 dark:text-slate-200'}`}>
                    {digest.overdueTasksCount}
                  </span>
                </div>
              </div>

              {/* Message Preview Box */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                    {isHi ? 'व्हाट्सएप संदेश पूर्वावलोकन' : 'WhatsApp Message Preview'}
                  </label>
                  <button
                    type="button"
                    onClick={handleCopyText}
                    className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400 hover:underline flex items-center gap-1 cursor-pointer"
                  >
                    {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copied ? (isHi ? 'कॉपी हो गया!' : 'Copied!') : (isHi ? 'टेक्स्ट कॉपी करें' : 'Copy Text')}</span>
                  </button>
                </div>

                <pre className="p-4 rounded-2xl bg-slate-900 text-slate-100 text-xs font-mono whitespace-pre-wrap leading-relaxed border border-slate-800 max-h-56 overflow-y-auto shadow-inner">
                  {digest.messageText}
                </pre>
              </div>

              {/* Recipient Phone Input (Optional) */}
              <div className="space-y-1">
                <label className="text-[11px] font-bold text-slate-500 dark:text-slate-400">
                  {isHi ? 'प्राप्तकर्ता फोन (वैकल्पिक)' : 'Send to Specific WhatsApp Number (Optional)'}
                </label>
                <input
                  type="tel"
                  value={customPhone}
                  onChange={(e) => setCustomPhone(e.target.value)}
                  placeholder="e.g. 9876543210 (Leave blank to pick in WhatsApp)"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              {/* 1-Tap Action Buttons */}
              <div className="pt-2 space-y-2">
                <button
                  type="button"
                  onClick={handleOpenWhatsApp}
                  className="w-full py-3.5 rounded-2xl bg-[#25D366] hover:bg-[#20bd5a] text-white text-xs font-black shadow-lg shadow-emerald-500/25 flex items-center justify-center gap-2 transition-all active:scale-[0.99] cursor-pointer"
                >
                  <MessageCircle className="w-4 h-4 fill-white" />
                  <span>{isHi ? 'व्हाट्सएप पर 1-टैप में साझा करें' : '1-Tap Share to WhatsApp'}</span>
                  <ExternalLink className="w-3.5 h-3.5" />
                </button>
              </div>
            </>
          ) : null}

        </div>

      </div>
    </div>
  );
};
