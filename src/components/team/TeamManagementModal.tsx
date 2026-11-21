import React, { useState, useEffect } from 'react';
import { Site, SupervisorUser } from '../../types';
import { useTheme } from '../../core/theme/ThemeContext';
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
      if (res.data?.supervisors) {
        setSupervisors(res.data.supervisors as SupervisorUser[]);
      } else if (res.error) {
        setErrorMessage(res.error);
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to load supervisors');
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
        phone: phone.trim(),
        pin: pin.trim(),
        language: isHi ? 'hi' : 'en',
      });

      if (res.data?.supervisor) {
        const supId = res.data.supervisor.id;
        // If sites selected, assign supervisor
        if (selectedSiteIds.length > 0) {
          for (const sId of selectedSiteIds) {
            await apiAssignSupervisors(sId, [supId]);
          }
        }

        setSuccessMessage(
          isHi
            ? `सुपरवाइज़र "${name}" सफलतापूर्वक जोड़ा गया। (पिन: ${pin})`
            : `Supervisor "${name}" added successfully. (PIN: ${pin})`
        );
        setName('');
        setPhone('');
        setPin('');
        setSelectedSiteIds([]);
        setIsAddOpen(false);
        await loadTeam();
      } else {
        setErrorMessage(res.error || 'Failed to create supervisor');
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Error creating supervisor');
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
      if (res.error) {
        setErrorMessage(res.error);
      } else {
        setSuccessMessage(
          isHi
            ? `पिन बदल दिया गया! नया पिन: ${newPin}`
            : `PIN updated! New PIN: ${newPin}`
        );
        setResettingSupervisor(null);
        setNewPin('');
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
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm p-0 sm:p-4">
      <div className="relative w-full max-w-xl bg-surface border border-border sm:rounded-3xl rounded-t-3xl shadow-2xl overflow-hidden max-h-[92vh] flex flex-col animate-in fade-in slide-in-from-bottom-6 duration-200">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-border bg-surface-raised/40">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-2xl bg-primary/10 text-primary flex items-center justify-center">
              <Users className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-foreground">
                {isHi ? 'टीम और सुपरवाइज़र प्रबंधन' : 'Team & Supervisor Management'}
              </h2>
              <p className="text-xs text-muted-foreground">
                {isHi ? 'साइट सुपरवाइज़र जोड़ें, पिन सेट करें और साइट असाइन करें' : 'Manage supervisors, set PINs & assign sites'}
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
        <div className="p-4 sm:p-6 overflow-y-auto space-y-4 flex-1">
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

          {/* Add Supervisor Action Button */}
          {!isAddOpen && !resettingSupervisor && (
            <button
              type="button"
              onClick={() => setIsAddOpen(true)}
              className="w-full py-3 px-4 rounded-2xl bg-primary text-white font-bold text-xs shadow-md shadow-primary/25 hover:bg-primary/90 flex items-center justify-center gap-2 transition-all active:scale-[0.99]"
            >
              <UserPlus className="w-4 h-4" />
              <span>{isHi ? '+ नया सुपरवाइज़र जोड़ें' : '+ Add New Supervisor'}</span>
            </button>
          )}

          {/* Add Form */}
          {isAddOpen && (
            <form onSubmit={handleCreateSupervisor} className="p-4 rounded-2xl bg-surface-raised border border-border space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-bold uppercase tracking-wider text-primary">
                  {isHi ? 'नया सुपरवाइज़र खाता' : 'New Supervisor Account'}
                </h3>
                <button
                  type="button"
                  onClick={() => setIsAddOpen(false)}
                  className="text-xs text-muted-foreground hover:text-foreground"
                >
                  {isHi ? 'बंद करें' : 'Cancel'}
                </button>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-muted-foreground mb-1">
                  {isHi ? 'सुपरवाइज़र का नाम' : 'Supervisor Name'}
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="उदा. रमेश कुमार"
                  className="w-full bg-surface border border-border rounded-xl px-3.5 py-2.5 text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[11px] font-semibold text-muted-foreground mb-1">
                    {isHi ? '10-अंकों का मोबाइल नंबर' : '10-Digit Mobile'}
                  </label>
                  <input
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="9876543210"
                    maxLength={10}
                    className="w-full bg-surface border border-border rounded-xl px-3.5 py-2.5 text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-primary font-mono"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-muted-foreground mb-1">
                    {isHi ? '4-अंकों का लॉगिन पिन' : '4-Digit Login PIN'}
                  </label>
                  <input
                    type="password"
                    value={pin}
                    onChange={(e) => setPin(e.target.value)}
                    placeholder="1234"
                    maxLength={4}
                    className="w-full bg-surface border border-border rounded-xl px-3.5 py-2.5 text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-primary font-mono tracking-widest text-center"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-muted-foreground mb-1">
                  {isHi ? 'साइट असाइन करें (वैकल्पिक)' : 'Assign Sites (Optional)'}
                </label>
                <div className="space-y-1.5 max-h-32 overflow-y-auto p-2 bg-surface rounded-xl border border-border">
                  {sites.map((site) => (
                    <label key={site.id} className="flex items-center gap-2 text-xs text-foreground cursor-pointer">
                      <input
                        type="checkbox"
                        checked={selectedSiteIds.includes(site.id)}
                        onChange={(e) => {
                          if (e.target.checked) setSelectedSiteIds((prev) => [...prev, site.id]);
                          else setSelectedSiteIds((prev) => prev.filter((id) => id !== site.id));
                        }}
                        className="rounded border-border text-primary focus:ring-primary"
                      />
                      <span>{site.name}</span>
                    </label>
                  ))}
                </div>
              </div>

              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full py-2.5 bg-primary text-white font-bold text-xs rounded-xl hover:bg-primary/90 flex items-center justify-center gap-1.5 shadow-md"
              >
                {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <UserPlus className="w-4 h-4" />}
                <span>{isHi ? 'खाता बनाएं' : 'Create Account'}</span>
              </button>
            </form>
          )}

          {/* Reset PIN Sub-Form */}
          {resettingSupervisor && (
            <form onSubmit={handleResetPin} className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/20 space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-bold text-amber-500 flex items-center gap-1.5">
                  <KeyRound className="w-4 h-4" />
                  <span>
                    {isHi ? `पिन बदलें: ${resettingSupervisor.name}` : `Reset PIN: ${resettingSupervisor.name}`}
                  </span>
                </h3>
                <button
                  type="button"
                  onClick={() => setResettingSupervisor(null)}
                  className="text-xs text-muted-foreground"
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
                  className="flex-1 bg-surface border border-border rounded-xl px-3.5 py-2 text-xs font-mono tracking-widest text-center"
                />
                <button
                  type="submit"
                  className="px-4 py-2 bg-amber-500 text-white font-bold text-xs rounded-xl shadow-md hover:bg-amber-600"
                >
                  {isHi ? 'सेव करें' : 'Save'}
                </button>
              </div>
            </form>
          )}

          {/* Supervisor Roster List */}
          <div>
            <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2.5">
              {isHi ? 'सक्रिय सुपरवाइज़र सूची' : 'Supervisor Roster'}
            </h3>

            {isLoading ? (
              <div className="py-8 text-center text-muted-foreground flex items-center justify-center gap-2">
                <Loader2 className="w-5 h-5 animate-spin text-primary" />
                <span className="text-xs">{isHi ? 'लोड हो रहा है...' : 'Loading team...'}</span>
              </div>
            ) : supervisors.length === 0 ? (
              <div className="p-6 rounded-3xl bg-surface border border-border text-center">
                <Users className="w-8 h-8 text-muted-foreground/30 mx-auto mb-2" />
                <p className="text-xs font-semibold text-foreground">
                  {isHi ? 'अभी कोई सुपरवाइज़र नहीं है।' : 'No supervisors registered yet.'}
                </p>
                <p className="text-[11px] text-muted-foreground mt-0.5">
                  {isHi
                    ? 'ऊपर दिए बटन से अपने साइट सुपरवाइज़र को जोड़ें।'
                    : 'Click above to invite site supervisors with 4-digit PIN access.'}
                </p>
              </div>
            ) : (
              <div className="space-y-2.5">
                {supervisors.map((sup) => (
                  <div
                    key={sup.id}
                    className="p-3.5 rounded-2xl bg-surface border border-border flex items-center justify-between gap-3 shadow-sm"
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <h4 className="text-xs font-bold text-foreground">{sup.name}</h4>
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            sup.isActive
                              ? 'bg-emerald-500/15 text-emerald-500 border border-emerald-500/30'
                              : 'bg-red-500/15 text-red-500 border border-red-500/30'
                          }`}
                        >
                          {sup.isActive ? (isHi ? 'सक्रिय' : 'Active') : (isHi ? 'बंद' : 'Disabled')}
                        </span>
                      </div>
                      <p className="text-[11px] text-muted-foreground flex items-center gap-1 mt-0.5 font-mono">
                        <Phone className="w-3 h-3" />
                        <span>{sup.phone}</span>
                      </p>
                      {sup.assignedSites && sup.assignedSites.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-1.5">
                          {sup.assignedSites.map((as, idx) => (
                            <span
                              key={idx}
                              className="px-1.5 py-0.5 rounded-md bg-surface-raised border border-border text-[10px] text-muted-foreground flex items-center gap-0.5"
                            >
                              <MapPin className="w-2.5 h-2.5 text-primary" />
                              {as.name}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>

                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => setResettingSupervisor(sup)}
                        title={isHi ? 'पिन रीसेट करें' : 'Reset PIN'}
                        className="p-2 rounded-xl bg-surface-raised hover:bg-border text-primary border border-border text-xs transition-colors"
                      >
                        <KeyRound className="w-4 h-4" />
                      </button>

                      <button
                        type="button"
                        onClick={() => handleToggleStatus(sup)}
                        className={`px-2.5 py-1.5 rounded-xl text-xs font-bold border transition-colors ${
                          sup.isActive
                            ? 'bg-red-500/10 text-red-500 border-red-500/20 hover:bg-red-500/20'
                            : 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20 hover:bg-emerald-500/20'
                        }`}
                      >
                        {sup.isActive ? (isHi ? 'रोकें' : 'Disable') : (isHi ? 'चालू' : 'Enable')}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
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
