import React, { useState } from 'react';
import { useTheme } from '../../core/theme/ThemeContext';
import { AlertTriangle, Trash2, X, Lock } from 'lucide-react';
import { ContractorAccount } from '../../types';
import { verifyCredential } from '../../utils/cryptoUtils';

interface ConfirmDeleteModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title?: string;
  message?: string;
  itemTitle?: string;
  account?: ContractorAccount | null;
  isAntiDeleteEnabled?: boolean;
}

export const ConfirmDeleteModal: React.FC<ConfirmDeleteModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  itemTitle,
  account,
  isAntiDeleteEnabled,
}) => {
  const { language, t } = useTheme();
  const [pin, setPin] = useState('');
  const [pinError, setPinError] = useState('');
  const [isVerifying, setIsVerifying] = useState(false);

  if (!isOpen) return null;

  const antiDeleteActive = isAntiDeleteEnabled ?? account?.isAntiDeleteEnabled ?? false;
  const targetCred = account?.pinLock || account?.password || '';

  const handleConfirmClick = async () => {
    if (antiDeleteActive && targetCred) {
      if (!pin.trim()) {
        setPinError(language === 'hi' ? 'कृपया सुरक्षा पिन दर्ज करें' : 'Please enter security PIN');
        return;
      }
      setIsVerifying(true);
      setPinError('');
      try {
        const verifyRes = await verifyCredential(pin.trim(), targetCred);
        if (!verifyRes.isValid) {
          setPinError(language === 'hi' ? 'गलत सुरक्षा पिन! हटाने की अनुमति नहीं है।' : 'Incorrect security PIN! Deletion denied.');
          return;
        }
      } catch (err) {
        setPinError('Verification failed');
        return;
      } finally {
        setIsVerifying(false);
      }
    }

    setPin('');
    setPinError('');
    onConfirm();
    onClose();
  };

  const handleClose = () => {
    setPin('');
    setPinError('');
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 overflow-y-auto">
      {/* Separate Backdrop Layer */}
      <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm transition-opacity" onClick={onClose} />

      {/* Interactive Sharp Dialog Container */}
      <div className="relative z-10 bg-white dark:bg-slate-900 w-full max-w-md rounded-3xl shadow-2xl border border-red-200 dark:border-red-900/60 overflow-hidden flex flex-col p-6 space-y-4 animate-fade-in">
        
        <div className="flex items-center justify-between">
          <div className="w-12 h-12 rounded-2xl bg-red-100 dark:bg-red-950/50 flex items-center justify-center text-red-600 dark:text-red-400">
            <AlertTriangle className="w-6 h-6" />
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="space-y-1.5">
          <h3 className="font-extrabold text-base sm:text-lg text-slate-900 dark:text-white font-heading">
            {title || (language === 'hi' ? 'हटाने की पुष्टि करें' : 'Confirm Deletion')}
          </h3>
          <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
            {message ||
              (language === 'hi'
                ? `क्या आप वाकई इसे हटाना चाहते हैं? यह क्रिया पूर्ववत नहीं की जा सकती।`
                : `Are you sure you want to delete this record? This action cannot be undone.`)}
          </p>
          {itemTitle && (
            <div className="p-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-xs font-bold text-slate-800 dark:text-slate-200 truncate">
              "{itemTitle}"
            </div>
          )}

          {/* Anti-Delete Security PIN Input */}
          {antiDeleteActive && targetCred && (
            <div className="pt-2 pb-1 space-y-2 border-t border-slate-100 dark:border-slate-800">
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                <Lock className="w-3.5 h-3.5 text-rose-500" />
                <span>
                  {language === 'hi'
                    ? 'एंटी-डिलीट सुरक्षा सक्रिय: पुष्टि हेतु सुरक्षा पिन दर्ज करें *'
                    : 'Anti-Delete Active: Enter security PIN to authorize *'}
                </span>
              </label>
              <input
                type="password"
                maxLength={6}
                autoFocus
                value={pin}
                onChange={(e) => {
                  setPin(e.target.value);
                  setPinError('');
                }}
                placeholder="••••"
                className="w-full px-3 py-2 text-center font-mono font-bold text-sm rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white focus:outline-none focus:border-red-500"
              />
              {pinError && (
                <p className="text-xs text-red-600 font-semibold">{pinError}</p>
              )}
            </div>
          )}
        </div>

        <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-slate-100 dark:border-slate-800">
          <button
            type="button"
            onClick={handleClose}
            className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
          >
            {t('cancel')}
          </button>
          <button
            type="button"
            disabled={isVerifying || (antiDeleteActive && Boolean(targetCred) && pin.length < 4)}
            onClick={handleConfirmClick}
            className="px-5 py-2.5 rounded-xl text-xs font-black text-white bg-red-600 hover:bg-red-700 disabled:opacity-50 shadow-md flex items-center gap-1.5 btn-tactile"
          >
            <Trash2 className="w-4 h-4" />
            <span>
              {isVerifying
                ? language === 'hi'
                  ? 'सत्यापित हो रहा है...'
                  : 'Verifying...'
                : language === 'hi'
                ? 'हाँ, हटाएं'
                : 'Yes, Delete'}
            </span>
          </button>
        </div>

      </div>
    </div>
  );
};
