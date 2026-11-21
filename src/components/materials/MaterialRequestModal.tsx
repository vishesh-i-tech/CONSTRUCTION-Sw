import React, { useState } from 'react';
import { useTheme } from '../../core/theme/ThemeContext';
import { Site, MaterialRequest } from '../../types';
import { db } from '../../core/db/database';
import { enqueueSyncMutation } from '../../core/sync/syncEngine';
import {
  X,
  Package,
  AlertCircle,
  Clock,
  Flame,
  CheckCircle2,
  FileText,
  Loader2,
  Layers,
} from 'lucide-react';

interface MaterialRequestModalProps {
  isOpen: boolean;
  onClose: () => void;
  assignedSites: Site[];
  defaultSiteId?: string;
  onRequestSubmitted?: (req: MaterialRequest) => void;
  onSubmitted?: () => void;
}

const COMMON_CONSTRUCTION_ITEMS = [
  { nameHi: 'सीमेंट (53 ग्रेड)', nameEn: 'Cement (53 Grade)', defaultUnit: 'bags' },
  { nameHi: '10mm टीएमटी सरिया', nameEn: '10mm TMT Rebar', defaultUnit: 'tons' },
  { nameHi: 'रेत / बजरी', nameEn: 'Sand / Dust', defaultUnit: 'brass' },
  { nameHi: 'लाल ईंटें (Red Bricks)', nameEn: 'Red Bricks', defaultUnit: 'nos' },
  { nameHi: 'क्रशर रोड़ी (20mm Aggregates)', nameEn: '20mm Aggregates', defaultUnit: 'brass' },
  { nameHi: 'पेंट / प्राइमर', nameEn: 'Paint / Primer', defaultUnit: 'litres' },
];

const COMMON_UNITS = ['bags', 'tons', 'brass', 'nos', 'kg', 'litres', 'sqft'];

export const MaterialRequestModal: React.FC<MaterialRequestModalProps> = ({
  isOpen,
  onClose,
  assignedSites,
  defaultSiteId,
  onRequestSubmitted,
  onSubmitted,
}) => {
  const { language } = useTheme();
  const isHi = language === 'hi';

  const [selectedSiteId, setSelectedSiteId] = useState<string>(() => {
    return defaultSiteId || (assignedSites.length > 0 ? assignedSites[0].id : '');
  });
  const [itemName, setItemName] = useState('');
  const [quantity, setQuantity] = useState('');
  const [unit, setUnit] = useState('bags');
  const [urgency, setUrgency] = useState<'normal' | 'urgent'>('normal');
  const [notes, setNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSiteId) {
      setErrorMessage(isHi ? 'कृपया साइट चुनें।' : 'Please select a site.');
      return;
    }
    if (!itemName.trim()) {
      setErrorMessage(isHi ? 'कृपया सामग्री का नाम लिखें।' : 'Please enter material name.');
      return;
    }
    const numQty = parseFloat(quantity);
    if (isNaN(numQty) || numQty <= 0) {
      setErrorMessage(isHi ? 'कृपया मान्य मात्रा दर्ज करें।' : 'Please enter a valid quantity.');
      return;
    }

    setIsSubmitting(true);
    setErrorMessage('');

    try {
      const activeUser = await db.account.toCollection().first();
      const siteObj = assignedSites.find((s) => s.id === selectedSiteId);
      const clientId = crypto.randomUUID();
      const requestId = crypto.randomUUID();

      const newRequest: MaterialRequest = {
        id: requestId,
        clientId,
        organizationId: activeUser?.organizationId || '',
        siteId: selectedSiteId,
        siteName: siteObj?.name || 'Site',
        requestedBy: activeUser?.id || 'supervisor',
        requestedByName: activeUser?.name || 'Supervisor',
        itemsJson: [
          {
            itemName: itemName.trim(),
            quantity: numQty,
            unit,
          },
        ],
        urgency,
        status: 'pending',
        notes: notes.trim() || undefined,
        synced: false,
        createdAt: new Date().toISOString(),
      };

      // 1. Save locally in Dexie database
      await db.materialRequests.put(newRequest);

      // 2. Queue mutation in offline sync outbox
      await enqueueSyncMutation('material_request', 'create', {
        siteId: newRequest.siteId,
        itemsJson: newRequest.itemsJson,
        urgency: newRequest.urgency,
        notes: newRequest.notes,
        clientId: newRequest.clientId,
      });

      onRequestSubmitted?.(newRequest);
      onSubmitted?.();
      onClose();
    } catch (err: any) {
      console.error('Failed to submit material request:', err);
      setErrorMessage(err.message || (isHi ? 'अनुरोध दर्ज करने में त्रुटि हुई।' : 'Failed to submit request.'));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-slate-950/70 backdrop-blur-xs animate-fade-in">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl w-full max-w-md max-h-[92vh] flex flex-col shadow-2xl overflow-hidden">
        
        {/* Header */}
        <div className="px-5 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-blue-50 dark:bg-blue-950/60 flex items-center justify-center text-blue-600 dark:text-blue-400">
              <Package className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-extrabold text-sm text-slate-900 dark:text-white font-heading">
                {isHi ? 'नई सामग्री का अनुरोध (Material Request)' : 'Request Site Materials'}
              </h3>
              <p className="text-[10px] text-slate-500">
                {isHi ? '30 सेकंड में ठेकेदार को मांग भेजें' : 'Send instant procurement request to owner'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-500 hover:text-slate-800 dark:hover:text-white flex items-center justify-center transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content Form */}
        <form onSubmit={handleSubmit} className="p-5 overflow-y-auto space-y-4 text-xs">
          {errorMessage && (
            <div className="p-3 rounded-2xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 text-red-700 dark:text-red-400 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* 1. Site Selector */}
          {assignedSites.length > 1 ? (
            <div>
              <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 mb-1">
                {isHi ? 'साइट चुनें *' : 'Select Site *'}
              </label>
              <select
                value={selectedSiteId}
                onChange={(e) => setSelectedSiteId(e.target.value)}
                className="w-full px-3 py-2.5 rounded-2xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 font-semibold text-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {assignedSites.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </div>
          ) : assignedSites.length === 1 ? (
            <div className="p-2.5 rounded-2xl bg-slate-50 dark:bg-slate-800 border border-slate-200/80 dark:border-slate-700/80 flex items-center justify-between">
              <span className="text-slate-500 font-medium">{isHi ? 'कार्य स्थल:' : 'Project Site:'}</span>
              <span className="font-bold text-slate-900 dark:text-white">{assignedSites[0].name}</span>
            </div>
          ) : null}

          {/* 2. Quick Item Selection Chips */}
          <div>
            <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 mb-1.5">
              {isHi ? 'अक्सर मांगी जाने वाली सामग्री:' : 'Common Construction Materials:'}
            </label>
            <div className="flex flex-wrap gap-1.5">
              {COMMON_CONSTRUCTION_ITEMS.map((item) => (
                <button
                  key={item.nameEn}
                  type="button"
                  onClick={() => {
                    setItemName(isHi ? item.nameHi : item.nameEn);
                    setUnit(item.defaultUnit);
                  }}
                  className={`px-2.5 py-1.5 rounded-xl border text-[11px] font-bold transition-all cursor-pointer ${
                    itemName.includes(item.nameEn) || itemName.includes(item.nameHi)
                      ? 'bg-blue-600 text-white border-blue-600 shadow-xs'
                      : 'bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-100'
                  }`}
                >
                  {isHi ? item.nameHi : item.nameEn}
                </button>
              ))}
            </div>
          </div>

          {/* 3. Item Name Input */}
          <div>
            <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 mb-1">
              {isHi ? 'सामग्री का नाम / विवरण *' : 'Material Name & Specification *'}
            </label>
            <input
              type="text"
              required
              value={itemName}
              onChange={(e) => setItemName(e.target.value)}
              placeholder={isHi ? 'उदा. सीमेंट 53 ग्रेड, 12mm सरिया...' : 'e.g., UltraTech 53 Grade Cement, 12mm Rebar...'}
              className="w-full px-3.5 py-2.5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 font-semibold text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* 4. Quantity and Unit */}
          <div className="grid grid-cols-2 gap-2.5">
            <div>
              <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 mb-1">
                {isHi ? 'मात्रा (Quantity) *' : 'Quantity *'}
              </label>
              <input
                type="number"
                step="any"
                required
                min="0.1"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                placeholder="50"
                className="w-full px-3.5 py-2.5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 font-semibold text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 mb-1">
                {isHi ? 'इकाई (Unit) *' : 'Unit *'}
              </label>
              <select
                value={unit}
                onChange={(e) => setUnit(e.target.value)}
                className="w-full px-3 py-2.5 rounded-2xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 font-semibold text-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {COMMON_UNITS.map((u) => (
                  <option key={u} value={u}>
                    {u}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* 5. Urgency Selection */}
          <div>
            <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 mb-1.5">
              {isHi ? 'ज़रूरत की तीव्रता (Urgency) *' : 'Urgency Level *'}
            </label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setUrgency('normal')}
                className={`p-3 rounded-2xl border font-bold flex items-center justify-center gap-2 transition-all cursor-pointer ${
                  urgency === 'normal'
                    ? 'border-blue-600 bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 ring-1 ring-blue-500'
                    : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-50'
                }`}
              >
                <Clock className="w-4 h-4 text-blue-500" />
                <span>{isHi ? 'सामान्य (Normal)' : 'Normal Routine'}</span>
              </button>
              <button
                type="button"
                onClick={() => setUrgency('urgent')}
                className={`p-3 rounded-2xl border font-bold flex items-center justify-center gap-2 transition-all cursor-pointer ${
                  urgency === 'urgent'
                    ? 'border-red-600 bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-300 ring-1 ring-red-500'
                    : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-50'
                }`}
              >
                <Flame className="w-4 h-4 text-red-500" />
                <span>{isHi ? 'अति आवश्यक (Urgent)' : 'Urgent (Work Halt)'}</span>
              </button>
            </div>
          </div>

          {/* 6. Notes */}
          <div>
            <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 mb-1">
              {isHi ? 'टिप्पणी / संदर्भ (वैकल्पिक)' : 'Notes / Remarks (Optional)'}
            </label>
            <textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder={isHi ? 'उदा. कल सुबह स्लैब कास्टिंग के लिए चाहिए...' : 'e.g. Needed for 2nd floor slab casting tomorrow morning...'}
              className="w-full px-3.5 py-2 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 font-medium text-slate-800 dark:text-slate-200 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
            />
          </div>

          {/* Submit Button */}
          <div className="pt-2">
            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full py-3.5 px-4 rounded-full bg-blue-600 hover:bg-blue-700 text-white font-bold text-sm shadow-md shadow-blue-500/25 active:scale-[0.99] flex items-center justify-center gap-2 transition-all cursor-pointer"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>{isHi ? 'अनुरोध दर्ज हो रहा है...' : 'Sending Request...'}</span>
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-4 h-4" />
                  <span>{isHi ? 'मांग दर्ज करें (Submit Request)' : 'Submit Material Request'}</span>
                </>
              )}
            </button>
          </div>
        </form>

      </div>
    </div>
  );
};
