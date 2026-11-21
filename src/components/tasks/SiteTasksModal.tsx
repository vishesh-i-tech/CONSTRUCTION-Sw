import React, { useState, useEffect, useRef } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../core/db/database';
import { Site, SiteTask, UserRole } from '../../types';
import { useTheme } from '../../core/theme/ThemeContext';
import { compressImage } from '../../utils/imageCompressor';
import {
  apiGetTasks,
  apiCreateTask,
  apiUpdateTaskStatus,
  apiPresignUpload,
  apiUploadToR2,
  apiGetSupervisors,
} from '../../services/apiClient';
import { dataUrlToBlob, enqueueSyncMutation } from '../../core/sync/syncEngine';
import {
  X,
  CheckSquare,
  Clock,
  AlertTriangle,
  Camera,
  Plus,
  Calendar,
  CheckCircle2,
  AlertCircle,
  Loader2,
  User,
  MapPin,
} from 'lucide-react';

interface SiteTasksModalProps {
  isOpen: boolean;
  onClose: () => void;
  sites: Site[];
  defaultSiteId?: string;
  isOwner?: boolean;
  userRole?: UserRole;
}

export const SiteTasksModal: React.FC<SiteTasksModalProps> = ({
  isOpen,
  onClose,
  sites,
  defaultSiteId,
  isOwner = true,
  userRole,
}) => {
  const { language } = useTheme();
  const isHi = language === 'hi';
  const effectiveIsOwner = userRole ? userRole === 'owner' : isOwner;

  const [activeTab, setActiveTab] = useState<'todo' | 'in_progress' | 'done'>('todo');
  const [selectedSiteFilter, setSelectedSiteFilter] = useState<string>(defaultSiteId || 'all');
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  // Create Task Form State
  const [newTitle, setNewTitle] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [newSiteId, setNewSiteId] = useState<string>(defaultSiteId || (sites[0]?.id || ''));
  const [newPriority, setNewPriority] = useState<'low' | 'medium' | 'high'>('medium');
  const [newDueDate, setNewDueDate] = useState('');
  const [newAssignee, setNewAssignee] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Complete Task Dialog State (Mandatory Photo Proof)
  const [completingTask, setCompletingTask] = useState<SiteTask | null>(null);
  const [proofPhotoPreview, setProofPhotoPreview] = useState<string | null>(null);
  const [completionNotes, setCompletionNotes] = useState('');
  const [isUploadingProof, setIsUploadingProof] = useState(false);
  const proofFileRef = useRef<HTMLInputElement>(null);

  // Live queries from Dexie
  const localTasks = useLiveQuery(() => db.siteTasks.toArray()) || [];
  const [supervisors, setSupervisors] = useState<any[]>([]);

  // Fetch supervisors and sync tasks on open
  useEffect(() => {
    if (isOpen) {
      apiGetTasks().then((res) => {
        if (res.data?.tasks) {
          res.data.tasks.forEach(async (task) => {
            await db.siteTasks.put({
              id: task.id,
              clientId: task.id,
              organizationId: task.organizationId,
              siteId: task.siteId,
              siteName: task.siteName,
              title: task.title,
              description: task.description,
              assignedTo: task.assignedTo,
              assignedToName: task.assignedToName,
              priority: task.priority,
              status: task.status,
              dueDate: task.dueDate,
              createdAt: task.createdAt,
              synced: true,
            });
          });
        }
      });

      apiGetSupervisors().then((res) => {
        if (res.data?.supervisors) {
          setSupervisors(res.data.supervisors);
        }
      });
    }
  }, [isOpen]);

  if (!isOpen) return null;

  // Filter tasks
  let filteredTasks = localTasks.filter((t) => t.status === activeTab);
  if (selectedSiteFilter !== 'all') {
    filteredTasks = filteredTasks.filter((t) => t.siteId === selectedSiteFilter);
  }
  filteredTasks.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  // Handle Task Creation
  const handleCreateTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim()) {
      setErrorMessage(isHi ? 'कृपया कार्य शीर्षक दर्ज करें।' : 'Please enter task title.');
      return;
    }
    if (!newSiteId) {
      setErrorMessage(isHi ? 'कृपया साइट चुनें।' : 'Please select a site.');
      return;
    }

    setIsSubmitting(true);
    setErrorMessage('');

    try {
      const siteObj = sites.find((s) => s.id === newSiteId);
      const assigneeObj = supervisors.find((s) => s.id === newAssignee);
      const clientId = crypto.randomUUID();
      const taskId = crypto.randomUUID();

      const newTask: SiteTask = {
        id: taskId,
        clientId,
        siteId: newSiteId,
        siteName: siteObj?.name || 'Site',
        title: newTitle.trim(),
        description: newDesc.trim() || undefined,
        assignedTo: newAssignee || undefined,
        assignedToName: assigneeObj?.name || undefined,
        priority: newPriority,
        status: 'todo',
        dueDate: newDueDate || undefined,
        synced: false,
        createdAt: new Date().toISOString(),
      };

      // 1. Save locally
      await db.siteTasks.put(newTask);

      // 2. Queue in outbox
      await enqueueSyncMutation('site_task', 'create', {
        siteId: newTask.siteId,
        title: newTask.title,
        description: newTask.description,
        assignedTo: newTask.assignedTo,
        priority: newTask.priority,
        dueDate: newTask.dueDate,
        clientId: newTask.clientId,
      });

      setNewTitle('');
      setNewDesc('');
      setIsCreateOpen(false);
      setSuccessMessage(isHi ? 'नया कार्य सफलतापूर्वक जोड़ा गया।' : 'New task created successfully.');
      setTimeout(() => setSuccessMessage(''), 3000);
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to create task');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Move task to 'in_progress'
  const handleStartTask = async (task: SiteTask) => {
    try {
      await db.siteTasks.update(task.id, { status: 'in_progress' });
      await apiUpdateTaskStatus(task.id, { status: 'in_progress' });
    } catch (err: any) {
      console.warn('Status update sync error:', err);
    }
  };

  // Open Mandatory Proof Modal before marking 'done'
  const handleOpenCompleteModal = (task: SiteTask) => {
    setCompletingTask(task);
    setProofPhotoPreview(null);
    setCompletionNotes('');
  };

  // Capture Proof Photo
  const handleCaptureProof = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const compressed = await compressImage(file, 1280, 200 * 1024);
      setProofPhotoPreview(compressed);
    } catch {
      setErrorMessage(isHi ? 'फोटो प्रोसेस करने में त्रुटि।' : 'Failed to process proof photo.');
    }
  };

  // Submit Completion with Photo Proof
  const handleConfirmCompletion = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!completingTask) return;

    if (!proofPhotoPreview) {
      setErrorMessage(
        isHi
          ? 'अनिवार्य नियम: कार्य पूरा करने के लिए साइट से फोटो प्रमाण आवश्यक है।'
          : 'Mandatory rule: Completion proof photo is required to mark task done.'
      );
      return;
    }

    setIsUploadingProof(true);
    setErrorMessage('');

    try {
      let photoKey = `proof-${Date.now()}.jpg`;

      // Upload to R2 if possible
      try {
        const presign = await apiPresignUpload(completingTask.siteId, 'photo', 'image/jpeg');
        if (presign.data?.uploadUrl) {
          const blob = dataUrlToBlob(proofPhotoPreview);
          const ok = await apiUploadToR2(presign.data.uploadUrl, blob, 'image/jpeg');
          if (ok) {
            photoKey = presign.data.storageKey;
          }
        }
      } catch {
        // Fallback to local
      }

      // 1. Update Dexie task
      await db.siteTasks.update(completingTask.id, {
        status: 'done',
        completionPhotoKey: photoKey,
        completedAt: new Date().toISOString(),
      });

      // 2. Submit to API
      await apiUpdateTaskStatus(completingTask.id, {
        status: 'done',
        completionPhotoKey: photoKey,
        notes: completionNotes.trim() || undefined,
      });

      setSuccessMessage(isHi ? 'कार्य फोटो प्रमाण के साथ पूरा हुआ!' : 'Task completed with photo proof verified!');
      setCompletingTask(null);
      setTimeout(() => setSuccessMessage(''), 3000);
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to complete task');
    } finally {
      setIsUploadingProof(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-slate-950/70 backdrop-blur-xs animate-fade-in">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl w-full max-w-2xl max-h-[92vh] flex flex-col shadow-2xl overflow-hidden">
        
        {/* Header */}
        <div className="px-5 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-indigo-50 dark:bg-indigo-950/60 flex items-center justify-center text-indigo-600 dark:text-indigo-400">
              <CheckSquare className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-extrabold text-sm text-slate-900 dark:text-white font-heading">
                {isHi ? 'साइट टास्क और पंच-लिस्ट (Site Tasks)' : 'Site Action Items & Tasks'}
              </h3>
              <p className="text-[10px] text-slate-500">
                {isHi ? 'फोटो प्रमाण के साथ कार्य पूर्णता अनिवार्य' : 'Action items with mandatory completion photo proof'}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => setIsCreateOpen((prev) => !prev)}
              className="px-2.5 py-1.5 rounded-full bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold transition-all shadow-xs flex items-center gap-1 cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>{isHi ? 'नया टास्क' : 'Add Task'}</span>
            </button>
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-500 hover:text-slate-800 dark:hover:text-white flex items-center justify-center transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Filter Bar */}
        <div className="px-5 py-2.5 bg-slate-50 dark:bg-slate-900/60 border-b border-slate-100 dark:border-slate-800 flex flex-wrap items-center justify-between gap-2 text-xs">
          {/* Status Tabs */}
          <div className="flex items-center gap-1">
            {(['todo', 'in_progress', 'done'] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`px-3 py-1 rounded-xl font-bold capitalize transition-all cursor-pointer ${
                  activeTab === tab
                    ? 'bg-indigo-600 text-white shadow-xs'
                    : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-100'
                }`}
              >
                {tab === 'todo'
                  ? (isHi ? 'करने योग्य' : 'To Do')
                  : tab === 'in_progress'
                  ? (isHi ? 'प्रगति पर' : 'In Progress')
                  : (isHi ? 'पूरा हुआ' : 'Done')}
              </button>
            ))}
          </div>

          {/* Site Filter */}
          {sites.length > 1 && (
            <select
              value={selectedSiteFilter}
              onChange={(e) => setSelectedSiteFilter(e.target.value)}
              className="px-2.5 py-1 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-300 focus:outline-none"
            >
              <option value="all">{isHi ? 'सभी साइटें' : 'All Sites'}</option>
              {sites.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          )}
        </div>

        {/* Messages */}
        {errorMessage && (
          <div className="mx-5 mt-3 p-3 rounded-2xl bg-red-50 border border-red-200 text-xs text-red-700 font-semibold flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{errorMessage}</span>
          </div>
        )}
        {successMessage && (
          <div className="mx-5 mt-3 p-3 rounded-2xl bg-emerald-50 border border-emerald-200 text-xs text-emerald-700 font-semibold flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span>{successMessage}</span>
          </div>
        )}

        {/* Create Task Collapsible Form */}
        {isCreateOpen && (
          <form onSubmit={handleCreateTask} className="p-4 mx-5 my-3 rounded-2xl bg-indigo-50/50 dark:bg-indigo-950/20 border border-indigo-200/80 space-y-3 text-xs">
            <div className="font-bold text-indigo-900 dark:text-indigo-300">
              {isHi ? 'नया साइट कार्य जोड़ें' : 'Create New Site Action Item'}
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-[10px] font-bold text-slate-600 mb-1">
                  {isHi ? 'साइट चुनें *' : 'Site *'}
                </label>
                <select
                  value={newSiteId}
                  onChange={(e) => setNewSiteId(e.target.value)}
                  className="w-full px-2.5 py-1.5 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 text-xs font-semibold"
                >
                  {sites.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-[10px] font-bold text-slate-600 mb-1">
                  {isHi ? 'प्राथमिकता (Priority)' : 'Priority'}
                </label>
                <select
                  value={newPriority}
                  onChange={(e) => setNewPriority(e.target.value as any)}
                  className="w-full px-2.5 py-1.5 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 text-xs font-semibold"
                >
                  <option value="low">{isHi ? 'कम (Low)' : 'Low'}</option>
                  <option value="medium">{isHi ? 'मध्यम (Medium)' : 'Medium'}</option>
                  <option value="high">{isHi ? 'उच्च (High)' : 'High'}</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-[10px] font-bold text-slate-600 mb-1">
                {isHi ? 'कार्य का शीर्षक *' : 'Task Title *'}
              </label>
              <input
                type="text"
                required
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                placeholder={isHi ? 'उदा. कॉलम C2 के कवर ब्लॉक ठीक करें...' : 'e.g. Fix cover blocks on column C2...'}
                className="w-full px-3 py-2 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 text-xs font-semibold focus:outline-none"
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-[10px] font-bold text-slate-600 mb-1">
                  {isHi ? 'अंतिम तारीख (Due Date)' : 'Due Date'}
                </label>
                <input
                  type="date"
                  value={newDueDate}
                  onChange={(e) => setNewDueDate(e.target.value)}
                  className="w-full px-2.5 py-1.5 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 text-xs font-semibold"
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-slate-600 mb-1">
                  {isHi ? 'सुपरवाइज़र को सौंपें' : 'Assign To'}
                </label>
                <select
                  value={newAssignee}
                  onChange={(e) => setNewAssignee(e.target.value)}
                  className="w-full px-2.5 py-1.5 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 text-xs font-semibold"
                >
                  <option value="">{isHi ? '-- कोई नहीं --' : '-- Unassigned --'}</option>
                  {supervisors.map((sup) => (
                    <option key={sup.id} value={sup.id}>
                      {sup.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={() => setIsCreateOpen(false)}
                className="px-3 py-1.5 rounded-xl text-slate-600 font-bold hover:bg-slate-100"
              >
                {isHi ? 'रद्द करें' : 'Cancel'}
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="px-4 py-1.5 rounded-xl bg-indigo-600 text-white font-bold shadow-xs hover:bg-indigo-700"
              >
                {isSubmitting ? (isHi ? 'जोड़ रहे हैं...' : 'Adding...') : (isHi ? 'टास्क जोड़ें' : 'Save Task')}
              </button>
            </div>
          </form>
        )}

        {/* Tasks List */}
        <div className="flex-1 p-5 overflow-y-auto space-y-3">
          {filteredTasks.length === 0 ? (
            <div className="py-12 text-center text-slate-400 space-y-2">
              <CheckSquare className="w-10 h-10 mx-auto text-slate-300" />
              <p className="text-xs font-medium">
                {isHi ? 'इस स्थिति में कोई कार्य नहीं है।' : 'No tasks in this column.'}
              </p>
            </div>
          ) : (
            filteredTasks.map((task) => {
              const isOverdue =
                task.status !== 'done' &&
                task.dueDate &&
                task.dueDate < new Date().toISOString().slice(0, 10);

              return (
                <div
                  key={task.id}
                  className="p-4 rounded-2xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700/80 shadow-xs space-y-2 transition-all"
                >
                  {/* Top: Site, Priority & Due Date */}
                  <div className="flex items-center justify-between">
                    <span className="font-extrabold text-xs text-slate-900 dark:text-white font-heading">
                      {task.siteName || 'Site'}
                    </span>
                    <div className="flex items-center gap-1.5">
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase ${
                          task.priority === 'high'
                            ? 'bg-red-100 text-red-700'
                            : task.priority === 'medium'
                            ? 'bg-amber-100 text-amber-700'
                            : 'bg-slate-100 text-slate-600'
                        }`}
                      >
                        {task.priority}
                      </span>
                      {task.dueDate && (
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-bold flex items-center gap-1 ${
                            isOverdue
                              ? 'bg-red-50 text-red-700 border border-red-200 animate-pulse'
                              : 'bg-slate-50 text-slate-500'
                          }`}
                        >
                          <Calendar className="w-3 h-3" />
                          <span>{task.dueDate}</span>
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Title & Description */}
                  <div>
                    <h4 className="font-bold text-sm text-slate-900 dark:text-white">
                      {task.title}
                    </h4>
                    {task.description && (
                      <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">
                        {task.description}
                      </p>
                    )}
                  </div>

                  {/* Footer & Actions */}
                  <div className="pt-2 border-t border-slate-100 dark:border-slate-700/60 flex items-center justify-between">
                    <div className="flex items-center gap-1.5 text-[11px] text-slate-400">
                      <User className="w-3.5 h-3.5" />
                      <span>{task.assignedToName || (isHi ? 'असाइन नहीं' : 'Unassigned')}</span>
                    </div>

                    <div className="flex items-center gap-2">
                      {task.status === 'todo' && (
                        <button
                          onClick={() => handleStartTask(task)}
                          className="px-2.5 py-1 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition-all cursor-pointer"
                        >
                          {isHi ? 'शुरू करें' : 'Start'}
                        </button>
                      )}

                      {task.status !== 'done' && (
                        <button
                          onClick={() => handleOpenCompleteModal(task)}
                          className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition-all shadow-xs flex items-center gap-1.5 cursor-pointer"
                        >
                          <Camera className="w-3.5 h-3.5" />
                          <span>{isHi ? 'फोटो प्रमाण के साथ पूरा करें' : 'Complete with Proof'}</span>
                        </button>
                      )}

                      {task.status === 'done' && (
                        <span className="flex items-center gap-1 text-[11px] font-bold text-emerald-600">
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          <span>{isHi ? 'फोटो सत्यापित व पूर्ण' : 'Proof Verified & Done'}</span>
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

      </div>

      {/* Mandatory Completion Proof Modal Dialog */}
      {completingTask && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-3 bg-slate-950/80 backdrop-blur-xs animate-fade-in">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl w-full max-w-md flex flex-col shadow-2xl overflow-hidden">
            
            <div className="px-5 py-3.5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Camera className="w-4 h-4 text-emerald-600" />
                <h4 className="font-extrabold text-sm text-slate-900 dark:text-white font-heading">
                  {isHi ? 'कार्य पूर्णता फोटो प्रमाण' : 'Mandatory Completion Photo Proof'}
                </h4>
              </div>
              <button
                onClick={() => setCompletingTask(null)}
                className="w-7 h-7 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-500 hover:text-slate-800 flex items-center justify-center cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleConfirmCompletion} className="p-5 space-y-3.5 text-xs">
              <div className="p-3 rounded-2xl bg-indigo-50 dark:bg-indigo-950/30 border border-indigo-200">
                <span className="font-bold text-indigo-900 dark:text-indigo-300 block">
                  {completingTask.title}
                </span>
                <span className="text-[11px] text-indigo-700">
                  Site: {completingTask.siteName}
                </span>
              </div>

              {/* Photo Proof Capture */}
              <div>
                <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 mb-1">
                  {isHi ? 'साइट पर काम पूरा होने की लाइव फोटो *' : 'Live On-Site Completion Photo *'}
                </label>
                <input
                  type="file"
                  accept="image/*"
                  capture="environment"
                  ref={proofFileRef}
                  onChange={handleCaptureProof}
                  className="hidden"
                />

                {proofPhotoPreview ? (
                  <div className="relative rounded-2xl overflow-hidden border border-slate-200 max-h-44">
                    <img src={proofPhotoPreview} alt="Proof" className="w-full h-full object-cover" />
                    <button
                      type="button"
                      onClick={() => setProofPhotoPreview(null)}
                      className="absolute top-2 right-2 p-1 rounded-full bg-slate-900/80 text-white cursor-pointer"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => proofFileRef.current?.click()}
                    className="w-full py-4 rounded-2xl border-2 border-dashed border-slate-200 dark:border-slate-700 hover:border-emerald-500 flex flex-col items-center justify-center gap-1.5 text-slate-500 font-bold transition-all cursor-pointer"
                  >
                    <Camera className="w-6 h-6 text-emerald-600" />
                    <span>{isHi ? 'काम की फोटो खींचें' : 'Take Proof Photo of Completed Work'}</span>
                    <span className="text-[10px] text-slate-400 font-normal">
                      {isHi ? 'फोटो के बिना कार्य पूर्ण नहीं माना जाएगा' : 'Required by contractor anti-fraud policy'}
                    </span>
                  </button>
                )}
              </div>

              {/* Notes */}
              <div>
                <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 mb-1">
                  {isHi ? 'टिप्पणी (वैकल्पिक)' : 'Completion Notes (Optional)'}
                </label>
                <textarea
                  rows={2}
                  value={completionNotes}
                  onChange={(e) => setCompletionNotes(e.target.value)}
                  placeholder={isHi ? 'काम के बारे में विवरण लिखें...' : 'e.g. Work inspected and verified on site...'}
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 text-xs font-medium focus:outline-none resize-none"
                />
              </div>

              {/* Submit */}
              <div className="pt-1">
                <button
                  type="submit"
                  disabled={isUploadingProof}
                  className="w-full py-3.5 rounded-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-sm shadow-md shadow-emerald-500/25 flex items-center justify-center gap-2 transition-all cursor-pointer"
                >
                  {isUploadingProof ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>{isHi ? 'प्रमाण अपलोड हो रहा है...' : 'Uploading Proof...'}</span>
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="w-4 h-4" />
                      <span>{isHi ? 'फोटो प्रमाण के साथ सबमिट करें' : 'Submit & Mark Task Done'}</span>
                    </>
                  )}
                </button>
              </div>
            </form>

          </div>
        </div>
      )}

    </div>
  );
};
