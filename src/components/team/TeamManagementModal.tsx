import React, { useState, useEffect } from 'react';
import { Site, SupervisorUser } from '../../types';
import { useTheme } from '../../core/theme/ThemeContext';
import { db } from '../../core/db/database';
import {
  apiGetSupervisors,
  apiCreateSupervisor,
  apiResetSupervisorPin,
  apiUpdateSupervisorStatus,
  apiAssignSupervisors,
} from '../../services/apiClient';
import {
  X,
  Users,
  UserPlus,
  KeyRound,
  ShieldCheck,
  ShieldAlert,
  Loader2,
  CheckCircle2,
  AlertCircle,
  MapPin,
  Phone,
  Lock,
} from 'lucide-react';

interface TeamManagementModalProps {
  isOpen: boolean;
  onClose: () => void;
  sites: Site[];
}

export const TeamManagementModal: React.FC<TeamManagementModalProps> = ({
  isOpen,
  onClose,
  sites,
}) => {
  const { language } = useTheme();
  const isHi = language === 'hi';

  const [supervisors, setSupervisors] = useState<SupervisorUser[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  // Add supervisor modal state
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [pin, setPin] = useState('');
  const [selectedSiteIds, setSelectedSiteIds] = useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Reset PIN state
  const [resettingSupervisor, setResettingSupervisor] = useState<SupervisorUser | null>(null);
  const [newPin, setNewPin] = useState('');

  const loadTeam = async () => {
    setIsLoading(true);
    setErrorMessage('');
    try {
      const res = await apiGetSupervisors();
      if (res.data?.supervisors && res.data.supervisors.length > 0) {
        setSupervisors(res.data.supervisors as SupervisorUser[]);
      } else {
        // Fallback: load local supervisors from local accounts
        const localSupervisors = await db.account
          .where('role')
          .equals('supervisor')
          .toArray()
          .catch(() => []);

        if (localSupervisors.length > 0) {
          setSupervisors(
            localSupervisors.map((acc) => ({
              id: acc.id,
              name: acc.name,
              phone: acc.phone,
              role: 'supervisor',
              isActive: true,
              assignedSiteIds: [],
              createdAt: acc.createdAt || new Date().toISOString(),
            }))
          );
        } else if (
          res.error &&
          !res.error.toLowerCase().includes('unauthorized') &&
          !res.error.toLowerCase().includes('session')
        ) {
          setErrorMessage(res.error);
        }
      }
    } catch {
      // Local fallback on network failure
      const localSupervisors = await db.account
        .where('role')
        .equals('supervisor')
        .toArray()
        .catch(() => []);

      if (localSupervisors.length > 0) {
        setSupervisors(
          localSupervisors.map((acc) => ({
            id: acc.id,
            name: acc.name,
            phone: acc.phone,
            role: 'supervisor',
            isActive: true,
            assignedSiteIds: [],
            createdAt: acc.createdAt || new Date().toISOString(),
          }))
        );
      }
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      loadTeam();
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleCreateSupervisor = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !phone.trim() || !pin.trim()) {
      setErrorMessage(isHi ? 'कृपया नाम, फोन और 4-अंकों का पिन भरें।' : 'Please fill Name, Phone, and 4-digit PIN.');
      return;
    }

    if (!/^\d{4}$/.test(pin.trim())) {
      setErrorMessage(isHi ? 'पिन केवल 4 अंकों का होना चाहिए।' : 'PIN must be exactly 4 digits.');
      return;
    }

    setIsSubmitting(true);
    setErrorMessage('');
    setSuccessMessage('');

    try {
      const res = await apiCreateSupervisor({
        name: name.trim(),
        phone: phone.trim().replace(/\D/g, ''),
        pin: pin.trim(),
      });

      if (res.data?.supervisor) {
        if (selectedSiteIds.length > 0) {
          await apiAssignSupervisors(res.data.supervisor.id, selectedSiteIds).catch(() => {});
        }
        setSuccessMessage(
          isHi
            ? `सुपरवाइज़र ${res.data.supervisor.name} सफलतापूर्वक जोड़ा गया!`
            : `Supervisor ${res.data.supervisor.name} added successfully!`
        );
        setName('');
        setPhone('');
        setPin('');
        setSelectedSiteIds([]);
        setIsAddOpen(false);
        loadTeam();
      } else {
        // Local offline fallback
        const newSupId = `sup-${Date.now()}`;
        await db.account.put({
          id: newSupId,
          name: name.trim(),
          phone: phone.trim().replace(/\D/g, ''),
          password: pin.trim(),
          pinLock: pin.trim(),
          trade: 'construction',
          role: 'supervisor',
          isPinLockEnabled: true,
          language: 'en',
          themeMode: 'light',
          tutorialCompleted: true,
          createdAt: new Date().toISOString(),
        });

        setSuccessMessage(
          isHi
            ? `सुपरवाइज़र ${name.trim()} सहेजा गया!`
            : `Supervisor ${name.trim()} added successfully!`
        );
        setName('');
        setPhone('');
        setPin('');
        setSelectedSiteIds([]);
        setIsAddOpen(false);
        loadTeam();
      }
    } catch {
      // Offline fallback
      const newSupId = `sup-${Date.now()}`;
      await db.account.put({
        id: newSupId,
        name: name.trim(),
        phone: phone.trim().replace(/\D/g, ''),
        password: pin.trim(),
        pinLock: pin.trim(),
        trade: 'construction',
        role: 'supervisor',
        isPinLockEnabled: true,
        language: 'en',
        themeMode: 'light',
        tutorialCompleted: true,
        createdAt: new Date().toISOString(),
      });

      setSuccessMessage(
        isHi
          ? `सुपरवाइज़र ${name.trim()} सहेजा गया!`
          : `Supervisor ${name.trim()} added successfully!`
      );
      setName('');
      setPhone('');
      setPin('');
      setSelectedSiteIds([]);
      setIsAddOpen(false);
      loadTeam();
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleResetPin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resettingSupervisor) return;
    if (!/^\d{4}$/.test(newPin.trim())) {
      setErrorMessage(isHi ? 'नया पिन ठीक 4 अंकों का होना चाहिए।' : 'New PIN must be exactly 4 digits.');
      return;
    }

    try {
      const res = await apiResetSupervisorPin(resettingSupervisor.id, newPin.trim());
      if (res.data || !res.error) {
        setSuccessMessage(
          isHi
            ? `पिन बदल दिया गया! नया पिन: ${newPin}`
            : `PIN updated! New PIN: ${newPin}`
        );
        setResettingSupervisor(null);
        setNewPin('');
      } else {
        setErrorMessage(res.error || 'Failed to reset PIN');
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to reset PIN');
    }
  };

  const handleToggleStatus = async (sup: SupervisorUser) => {
    try {
      const newStatus = !sup.isActive;
      await apiUpdateSupervisorStatus(sup.id, newStatus);
      setSupervisors((prev) =>
        prev.map((s) => (s.id === sup.id ? { ...s, isActive: newStatus } : s))
      );
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to update status');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-slate-950/75 p-0 sm:p-4 overflow-y-auto">
      {/* Solid Opaque Dialog Container */}
      <div className="relative w-full max-w-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 sm:rounded-3xl rounded-t-3xl shadow-2xl overflow-hidden max-h-[92vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 sm:p-5 border-b border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/60">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-2xl bg-blue-100 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 flex items-center justify-center shadow-xs">
              <Users className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-extrabold text-slate-900 dark:text-white font-heading">
                {isHi ? 'टीम और सुपरवाइज़र प्रबंधन' : 'Team & Supervisor Management'}
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {isHi ? 'साइट सुपरवाइज़र जोड़ें, पिन सेट करें और साइट असाइन करें' : 'Manage supervisors, set PINs & assign sites'}
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

        {/* Body */}
        <div className="p-4 sm:p-6 overflow-y-auto space-y-4 flex-1 bg-white dark:bg-slate-900">
          {errorMessage && (
            <div className="p-3 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 rounded-2xl flex items-center gap-2 text-xs text-red-600 dark:text-red-400">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          {successMessage && (
            <div className="p-3 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 rounded-2xl flex items-center gap-2 text-xs text-emerald-600 dark:text-emerald-400">
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              <span>{successMessage}</span>
            </div>
          )}

          {/* Add Supervisor Action Button */}
          {!isAddOpen && !resettingSupervisor && (
            <button
              type="button"
              onClick={() => setIsAddOpen(true)}
              className="w-full py-3.5 px-4 rounded-2xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs shadow-md shadow-blue-500/20 flex items-center justify-center gap-2 transition-all active:scale-[0.99] cursor-pointer"
            >
              <UserPlus className="w-4 h-4" />
              <span>{isHi ? '+ नया सुपरवाइज़र जोड़ें' : '+ Add New Supervisor'}</span>
            </button>
          )}

          {/* Add Form */}
          {isAddOpen && (
            <form onSubmit={handleCreateSupervisor} className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-bold uppercase tracking-wider text-blue-600 dark:text-blue-400">
                  {isHi ? 'नया सुपरवाइज़र खाता' : 'New Supervisor Account'}
                </h3>
                <button
                  type="button"
                  onClick={() => setIsAddOpen(false)}
                  className="text-xs text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 cursor-pointer"
                >
                  {isHi ? 'बंद करें' : 'Cancel'}
                </button>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  {isHi ? 'सुपरवाइज़र का नाम' : 'Supervisor Name'}
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Ramesh Verma"
                  className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-3.5 py-2 text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  {isHi ? 'मोबाइल नंबर (10 अंक)' : 'Phone Number (10 Digits)'}
                </label>
                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="e.g. 9876543210"
                  maxLength={10}
                  className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-3.5 py-2 text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  {isHi ? '4-अंकों का लॉगिन पिन' : '4-Digit Login PIN'}
                </label>
                <input
                  type="password"
                  value={pin}
                  onChange={(e) => setPin(e.target.value)}
                  placeholder="e.g. 1234"
                  maxLength={4}
                  className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-3.5 py-2 text-xs font-mono tracking-widest text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  {isHi ? 'असाइन की गई साइटें' : 'Assign Sites (Optional)'}
                </label>
                <div className="space-y-1.5 max-h-32 overflow-y-auto border border-slate-200 dark:border-slate-700 rounded-xl p-2 bg-white dark:bg-slate-900">
                  {sites.map((site) => (
                    <label key={site.id} className="flex items-center gap-2 text-xs text-slate-700 dark:text-slate-300 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={selectedSiteIds.includes(site.id)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setSelectedSiteIds((prev) => [...prev, site.id]);
                          } else {
                            setSelectedSiteIds((prev) => prev.filter((id) => id !== site.id));
                          }
                        }}
                        className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                      />
                      <span className="truncate">{site.name}</span>
                    </label>
                  ))}
                  {sites.length === 0 && (
                    <p className="text-[11px] text-slate-400 italic">No sites created yet.</p>
                  )}
                </div>
              </div>

              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs shadow-md transition-all flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                {isSubmitting ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <UserPlus className="w-3.5 h-3.5" />
                )}
                <span>{isHi ? 'खाता बनाएं' : 'Create Supervisor'}</span>
              </button>
            </form>
          )}

          {/* Reset PIN Sub-Form */}
          {resettingSupervisor && (
            <form onSubmit={handleResetPin} className="p-4 rounded-2xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-bold text-amber-700 dark:text-amber-400 flex items-center gap-1.5">
                  <KeyRound className="w-4 h-4" />
                  <span>
                    {isHi ? `पिन बदलें: ${resettingSupervisor.name}` : `Reset PIN: ${resettingSupervisor.name}`}
                  </span>
                </h3>
                <button
                  type="button"
                  onClick={() => setResettingSupervisor(null)}
                  className="text-xs text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 cursor-pointer"
                >
                  {isHi ? 'रद्द' : 'Cancel'}
                </button>
              </div>

              <div className="flex gap-2">
                <input
                  type="password"
                  value={newPin}
                  onChange={(e) => setNewPin(e.target.value)}
                  placeholder="नया 4-अंकों का पिन (New PIN)"
                  maxLength={4}
                  className="flex-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-3.5 py-2 text-xs font-mono tracking-widest text-center text-slate-900 dark:text-white"
                />
                <button
                  type="submit"
                  className="px-4 py-2 bg-amber-600 text-white font-bold text-xs rounded-xl shadow-md hover:bg-amber-700 cursor-pointer"
                >
                  {isHi ? 'सेव करें' : 'Save'}
                </button>
              </div>
            </form>
          )}

          {/* Supervisor Roster List */}
          <div>
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 mb-2.5">
              {isHi ? 'सक्रिय सुपरवाइज़र सूची' : 'Supervisor Roster'}
            </h3>

            {isLoading ? (
              <div className="py-8 text-center text-slate-400 flex items-center justify-center gap-2">
                <Loader2 className="w-5 h-5 animate-spin text-blue-600" />
                <span className="text-xs">{isHi ? 'लोड हो रहा है...' : 'Loading team...'}</span>
              </div>
            ) : supervisors.length === 0 ? (
              <div className="p-6 rounded-3xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700 text-center">
                <Users className="w-8 h-8 text-slate-300 dark:text-slate-600 mx-auto mb-2" />
                <p className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                  {isHi ? 'अभी कोई सुपरवाइज़र नहीं है।' : 'No supervisors registered yet.'}
                </p>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                  {isHi
                    ? 'ऊपर दिए बटन से अपने साइट सुपरवाइज़र को जोड़ें।'
                    : 'Click above to invite site supervisors with 4-digit PIN access.'}
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                {supervisors.map((sup) => (
                  <div
                    key={sup.id}
                    className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/80 flex items-center justify-between gap-3 shadow-2xs"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div
                        className={`w-9 h-9 rounded-xl flex items-center justify-center font-bold text-xs ${
                          sup.isActive
                            ? 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400'
                            : 'bg-slate-200 dark:bg-slate-700 text-slate-500'
                        }`}
                      >
                        {sup.name.slice(0, 2).toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className="font-bold text-xs text-slate-900 dark:text-white truncate">
                            {sup.name}
                          </span>
                          {!sup.isActive && (
                            <span className="text-[9px] px-1.5 py-0.2 bg-red-100 text-red-700 rounded-full font-bold">
                              Inactive
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-2 text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                          <span className="flex items-center gap-1">
                            <Phone className="w-3 h-3 text-slate-400" />
                            {sup.phone}
                          </span>
                          <span>•</span>
                          <span className="flex items-center gap-1">
                            <MapPin className="w-3 h-3 text-slate-400" />
                            {sup.assignedSites?.length || 0} Sites
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      <button
                        type="button"
                        onClick={() => {
                          setResettingSupervisor(sup);
                          setNewPin('');
                        }}
                        title="Reset PIN"
                        className="p-2 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors shadow-2xs cursor-pointer"
                      >
                        <KeyRound className="w-3.5 h-3.5 text-amber-500" />
                      </button>

                      <button
                        type="button"
                        onClick={() => handleToggleStatus(sup)}
                        title={sup.isActive ? 'Deactivate' : 'Activate'}
                        className={`p-2 rounded-xl border transition-colors shadow-2xs cursor-pointer ${
                          sup.isActive
                            ? 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-emerald-600 hover:bg-emerald-50'
                            : 'bg-slate-200 border-slate-300 text-slate-500'
                        }`}
                      >
                        {sup.isActive ? (
                          <ShieldCheck className="w-3.5 h-3.5" />
                        ) : (
                          <ShieldAlert className="w-3.5 h-3.5" />
                        )}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/60 flex items-center justify-end">
          <button
            type="button"
            onClick={onClose}
            className="py-2.5 px-6 rounded-2xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs shadow-md transition-all cursor-pointer"
          >
            {isHi ? 'पूर्ण' : 'Done'}
          </button>
        </div>
      </div>
    </div>
  );
};
