import React, { useState, useEffect } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../core/db/database';
import { IssueType } from '../../types';
import { useTheme } from '../../core/theme/ThemeContext';
import {
  apiGetIssueTypes,
  apiCreateIssueType,
  apiUpdateIssueType,
} from '../../services/apiClient';
import {
  X,
  Plus,
  Trash2,
  CheckCircle2,
  AlertCircle,
  Tag,
  ToggleLeft,
  ToggleRight,
  Loader2,
} from 'lucide-react';

interface OwnerIssueChipsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const OwnerIssueChipsModal: React.FC<OwnerIssueChipsModalProps> = ({
  isOpen,
  onClose,
}) => {
  const { language } = useTheme();
  const isHi = language === 'hi';

  const [labelHi, setLabelHi] = useState('');
  const [labelEn, setLabelEn] = useState('');
  const [icon, setIcon] = useState('⚠️');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  // Live query from local Dexie store
  const localChips = useLiveQuery(() => db.issueTypes.toArray()) || [];

  // Fetch latest from backend when modal opens
  useEffect(() => {
    if (isOpen) {
      apiGetIssueTypes(false).then((res) => {
        if (res.data?.issueTypes) {
          res.data.issueTypes.forEach(async (chip) => {
            await db.issueTypes.put({
              ...chip,
              organizationId: chip.organizationId || '',
            });
          });
        }
      });
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const activeCount = localChips.filter((c) => c.isActive).length;

  const handleCreateChip = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!labelHi.trim() || !labelEn.trim()) {
      setErrorMessage(isHi ? 'कृपया हिंदी और अंग्रेज़ी दोनों नाम लिखें।' : 'Please enter both Hindi and English labels.');
      return;
    }

    if (activeCount >= 8) {
      setErrorMessage(
        isHi
          ? 'अधिकतम 8 सक्रिय चिप्स की अनुमति है। पहले किसी अन्य चिप को बंद करें।'
          : 'Maximum 8 active chips allowed. Deactivate another chip first.'
      );
      return;
    }

    setIsSubmitting(true);
    setErrorMessage('');
    setSuccessMessage('');

    try {
      const newChip: IssueType = {
        id: crypto.randomUUID(),
        organizationId: '',
        labelHi: labelHi.trim(),
        labelEn: labelEn.trim(),
        icon: icon || '⚠️',
        sortOrder: localChips.length + 1,
        isActive: true,
        isDefault: false,
      };

      // 1. Save locally
      await db.issueTypes.put(newChip);

      // 2. Submit to backend if online
      const res = await apiCreateIssueType({
        labelHi: newChip.labelHi,
        labelEn: newChip.labelEn,
        icon: newChip.icon,
        sortOrder: newChip.sortOrder,
        isActive: true,
      });

      if (res.data?.issueType) {
        await db.issueTypes.delete(newChip.id);
        await db.issueTypes.put(res.data.issueType);
      }

      setLabelHi('');
      setLabelEn('');
      setSuccessMessage(isHi ? 'नई समस्या चिप सफलतापूर्वक जोड़ी गई।' : 'New issue chip added successfully.');
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to add chip');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleToggleActive = async (chip: IssueType) => {
    if (!chip.isActive && activeCount >= 8) {
      setErrorMessage(
        isHi
          ? 'अधिकतम 8 सक्रिय चिप्स की अनुमति है। पहले किसी अन्य चिप को निष्क्रिय करें।'
          : 'Maximum 8 active chips allowed. Deactivate another chip first.'
      );
      return;
    }

    const updatedStatus = !chip.isActive;
    await db.issueTypes.update(chip.id, { isActive: updatedStatus });

    // Sync to backend
    apiUpdateIssueType(chip.id, { isActive: updatedStatus }).catch(() => {});
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm p-0 sm:p-4">
      <div className="relative w-full max-w-lg bg-surface border border-border sm:rounded-3xl rounded-t-3xl shadow-2xl overflow-hidden max-h-[90vh] flex flex-col animate-in fade-in slide-in-from-bottom-6 duration-200">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-border bg-surface-raised/40">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-2xl bg-primary/10 text-primary flex items-center justify-center">
              <Tag className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-foreground">
                {isHi ? 'समस्या चिप्स कस्टमाइज़र' : 'Issue Chips Customizer'}
              </h2>
              <p className="text-xs text-muted-foreground">
                {isHi ? `सक्रिय: ${activeCount} / अधिकतम 8` : `Active: ${activeCount} / max 8`}
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

        {/* Body */}
        <div className="p-4 sm:p-6 overflow-y-auto space-y-6 flex-1">
          {errorMessage && (
            <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-2xl flex items-center gap-2 text-xs text-red-500">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          {successMessage && (
            <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-2xl flex items-center gap-2 text-xs text-emerald-500">
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              <span>{successMessage}</span>
            </div>
          )}

          {/* Add New Chip Form */}
          <form onSubmit={handleCreateChip} className="p-4 rounded-2xl bg-surface-raised border border-border space-y-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
              {isHi ? '+ नई समस्या चिप जोड़ें' : '+ Add New Issue Chip'}
            </h3>

            <div className="grid grid-cols-4 gap-2">
              <input
                type="text"
                value={icon}
                onChange={(e) => setIcon(e.target.value)}
                placeholder="Emoji"
                className="col-span-1 bg-surface border border-border rounded-xl px-3 py-2 text-center text-lg focus:outline-none focus:ring-2 focus:ring-primary"
              />
              <input
                type="text"
                value={labelHi}
                onChange={(e) => setLabelHi(e.target.value)}
                placeholder={isHi ? 'हिंदी नाम (जैसे सीमेंट खत्म)' : 'Hindi Label'}
                className="col-span-3 bg-surface border border-border rounded-xl px-3 py-2 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>

            <div className="flex gap-2">
              <input
                type="text"
                value={labelEn}
                onChange={(e) => setLabelEn(e.target.value)}
                placeholder={isHi ? 'अंग्रेज़ी नाम (उदा. Cement Shortage)' : 'English Label'}
                className="flex-1 bg-surface border border-border rounded-xl px-3 py-2 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-primary"
              />
              <button
                type="submit"
                disabled={isSubmitting || activeCount >= 8}
                className="px-4 py-2 bg-primary text-white font-bold text-xs rounded-xl hover:bg-primary/90 flex items-center gap-1 disabled:opacity-50"
              >
                {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                <span>{isHi ? 'जोड़ें' : 'Add'}</span>
              </button>
            </div>
          </form>

          {/* Existing Chips List */}
          <div>
            <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2.5">
              {isHi ? 'उपलब्ध चिप्स (सक्रिय/निष्क्रिय)' : 'Available Chips (Active / Inactive)'}
            </h3>

            <div className="space-y-2">
              {localChips.map((chip) => (
                <div
                  key={chip.id}
                  className="p-3 rounded-2xl bg-surface border border-border flex items-center justify-between gap-3 shadow-sm"
                >
                  <div className="flex items-center gap-2.5">
                    <span className="text-xl">{chip.icon || '⚠️'}</span>
                    <div>
                      <p className="text-xs font-bold text-foreground">
                        {isHi ? chip.labelHi : chip.labelEn}
                      </p>
                      <p className="text-[10px] text-muted-foreground">
                        {isHi ? chip.labelEn : chip.labelHi}
                      </p>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => handleToggleActive(chip)}
                    className="p-1 text-muted-foreground hover:text-primary transition-colors"
                  >
                    {chip.isActive ? (
                      <ToggleRight className="w-7 h-7 text-emerald-500 fill-emerald-500/20" />
                    ) : (
                      <ToggleLeft className="w-7 h-7 text-muted-foreground" />
                    )}
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-border bg-surface-raised/40 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="py-2.5 px-6 rounded-2xl bg-surface border border-border text-foreground font-semibold text-xs hover:bg-border transition-colors"
          >
            {isHi ? 'पूर्ण' : 'Done'}
          </button>
        </div>
      </div>
    </div>
  );
};
