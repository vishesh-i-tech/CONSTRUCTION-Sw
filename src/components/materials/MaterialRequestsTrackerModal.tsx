import React, { useState, useEffect, useRef } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../core/db/database';
import { Site, MaterialRequest, Vendor, UserRole } from '../../types';
import { useTheme } from '../../core/theme/ThemeContext';
import { compressImage } from '../../utils/imageCompressor';
import {
  apiGetMaterialRequests,
  apiUpdateMaterialRequestStatus,
  apiFulfillMaterialRequest,
  apiPresignUpload,
  apiUploadToR2,
} from '../../services/apiClient';
import { dataUrlToBlob } from '../../core/sync/syncEngine';
import {
  X,
  Package,
  Clock,
  Flame,
  CheckCircle2,
  XCircle,
  Truck,
  Camera,
  AlertCircle,
  Filter,
  DollarSign,
  Loader2,
  FileCheck2,
} from 'lucide-react';

interface MaterialRequestsTrackerModalProps {
  isOpen: boolean;
  onClose: () => void;
  sites: Site[];
  isOwner?: boolean;
  userRole?: UserRole;
  onOpenNewRequestModal?: () => void;
  onOpenNewRequest?: () => void;
}

export const MaterialRequestsTrackerModal: React.FC<MaterialRequestsTrackerModalProps> = ({
  isOpen,
  onClose,
  sites,
  isOwner = true,
  userRole,
  onOpenNewRequestModal,
  onOpenNewRequest,
}) => {
  const effectiveIsOwner = userRole ? userRole === 'owner' : isOwner;
  const handleOpenNew = onOpenNewRequest || onOpenNewRequestModal;
  const { language } = useTheme();
  const isHi = language === 'hi';

  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'approved' | 'fulfilled'>('all');
  const [selectedSiteFilter, setSelectedSiteFilter] = useState<string>('all');
  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  // Delivery GRN Confirmation Modal State
  const [fulfillingRequest, setFulfillingRequest] = useState<MaterialRequest | null>(null);
  const [actualQty, setActualQty] = useState('');
  const [vendorId, setVendorId] = useState('');
  const [unitCost, setUnitCost] = useState('');
  const [totalCost, setTotalCost] = useState('');
  const [paymentStatus, setPaymentStatus] = useState<'paid' | 'pending' | 'partial'>('pending');
  const [paidAmount, setPaidAmount] = useState('0');
  const [challanPhotoPreview, setChallanPhotoPreview] = useState<string | null>(null);
  const [isFulfilling, setIsFulfilling] = useState(false);
  const challanFileRef = useRef<HTMLInputElement>(null);

  // Live queries from Dexie
  const localRequests = useLiveQuery(() => db.materialRequests.toArray()) || [];
  const vendors = useLiveQuery(() => db.vendors.toArray()) || [];

  // Sync with cloud on modal open if online
  useEffect(() => {
    if (isOpen) {
      apiGetMaterialRequests().then((res) => {
        if (res.data?.materialRequests) {
          res.data.materialRequests.forEach(async (req) => {
            await db.materialRequests.put({
              id: req.id,
              clientId: req.id,
              organizationId: req.organizationId,
              siteId: req.siteId,
              siteName: req.siteName,
              requestedBy: req.requestedBy,
              requestedByName: req.requestedByName,
              itemsJson: req.itemsJson,
              urgency: req.urgency,
              status: req.status,
              notes: req.notes,
              createdAt: req.createdAt,
              synced: true,
            });
          });
        }
      });
    }
  }, [isOpen]);

  if (!isOpen) return null;

  // Filter requests
  let filteredRequests = [...localRequests];
  if (statusFilter !== 'all') {
    filteredRequests = filteredRequests.filter((r) => r.status === statusFilter);
  }
  if (selectedSiteFilter !== 'all') {
    filteredRequests = filteredRequests.filter((r) => r.siteId === selectedSiteFilter);
  }
  filteredRequests.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  // Handle Owner Approval / Rejection
  const handleUpdateStatus = async (requestId: string, status: 'approved' | 'rejected') => {
    setErrorMessage('');
    try {
      await db.materialRequests.update(requestId, { status });
      await apiUpdateMaterialRequestStatus(requestId, { status });
      setSuccessMessage(isHi ? `अनुरोध ${status === 'approved' ? 'मंज़ूर' : 'अस्वीकृत'} किया गया।` : `Request marked as ${status}.`);
      setTimeout(() => setSuccessMessage(''), 3000);
    } catch (err: any) {
      setErrorMessage(err.message || 'Status update failed');
    }
  };

  // Open GRN Dialog
  const handleOpenGrnDialog = (req: MaterialRequest) => {
    setFulfillingRequest(req);
    const firstItem = req.itemsJson?.[0];
    setActualQty(firstItem ? String(firstItem.quantity) : '1');
    setUnitCost(firstItem?.estimatedRate ? String(firstItem.estimatedRate) : '');
    setTotalCost(
      firstItem?.estimatedRate && firstItem.quantity ? String(firstItem.estimatedRate * firstItem.quantity) : ''
    );
    setPaymentStatus('pending');
    setPaidAmount('0');
    setChallanPhotoPreview(null);
  };

  // Capture Delivery Challan Photo
  const handleChallanPhoto = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const compressed = await compressImage(file, 1280, 200 * 1024);
      setChallanPhotoPreview(compressed);
    } catch {
      setErrorMessage(isHi ? 'चालान फोटो प्रोसेस करने में त्रुटि।' : 'Failed to process challan photo.');
    }
  };

  // Confirm Delivery & Auto-Ledger Sync
  const handleConfirmGrn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fulfillingRequest) return;

    setIsFulfilling(true);
    setErrorMessage('');

    try {
      let challanKey: string | undefined = undefined;

      // Upload Challan Photo to Cloudflare R2 if captured
      if (challanPhotoPreview) {
        try {
          const presign = await apiPresignUpload(fulfillingRequest.siteId, 'photo', 'image/jpeg');
          if (presign.data?.uploadUrl) {
            const blob = dataUrlToBlob(challanPhotoPreview);
            const uploadOk = await apiUploadToR2(presign.data.uploadUrl, blob, 'image/jpeg');
            if (uploadOk) {
              challanKey = presign.data.storageKey;
            }
          }
        } catch {
          // Continue with local save if upload fails
        }
      }

      const numActualQty = parseFloat(actualQty) || 1;
      const numUnitCost = parseFloat(unitCost) || 0;
      const numTotalCost = parseFloat(totalCost) || numUnitCost * numActualQty;
      const numPaidAmount = parseFloat(paidAmount) || 0;
      const firstItem = fulfillingRequest.itemsJson?.[0] || { itemName: 'Material Delivery', quantity: 1, unit: 'units' };
      const today = new Date().toISOString().slice(0, 10);
      const materialId = crypto.randomUUID();

      // 1. Mark Request Fulfilled in Dexie
      await db.materialRequests.update(fulfillingRequest.id, {
        status: 'fulfilled',
        actualReceivedQuantity: numActualQty,
        unitCost: numUnitCost,
        totalCost: numTotalCost,
        vendorId: vendorId || undefined,
        challanPhotoKey: challanKey,
        fulfilledAt: new Date().toISOString(),
      });

      // 2. Auto-Ledger Sync: Insert into local materials table
      await db.materials.put({
        id: materialId,
        siteId: fulfillingRequest.siteId,
        itemName: firstItem.itemName,
        quantity: numActualQty,
        unit: firstItem.unit,
        unitPrice: numUnitCost,
        totalCost: numTotalCost,
        vendorId: vendorId || undefined,
        purchaseDate: today,
        paymentStatus: paymentStatus,
        paidAmount: numPaidAmount,
        receiptPhoto: challanPhotoPreview || undefined,
        notes: `Fulfilled from Material Request #${fulfillingRequest.id.slice(0, 8)}`,
      });

      // 3. Auto-Ledger Sync: If credit/partial, create linked ExpenseDue
      if (paymentStatus !== 'paid' && numTotalCost > numPaidAmount) {
        await db.dues.put({
          id: crypto.randomUUID(),
          siteId: fulfillingRequest.siteId,
          vendorId: vendorId || undefined,
          materialId,
          title: `Challan Pending: ${firstItem.itemName} (${numActualQty} ${firstItem.unit})`,
          amountDue: numTotalCost - numPaidAmount,
          amountPaid: 0,
          category: 'material',
          dueDate: today,
          status: 'pending',
        });
      }

      // 4. Submit to Backend API
      await apiFulfillMaterialRequest(fulfillingRequest.id, {
        actualQuantity: numActualQty,
        challanPhotoKey: challanKey,
        vendorId: vendorId || undefined,
        unitCost: numUnitCost,
        totalCost: numTotalCost,
        paymentStatus: paymentStatus,
        paidAmount: numPaidAmount,
      });

      setSuccessMessage(isHi ? 'डिलीवरी (GRN) दर्ज की गई और लेजर अपडेट हुआ!' : 'Delivery recorded (GRN) & ledger updated!');
      setFulfillingRequest(null);
      setTimeout(() => setSuccessMessage(''), 3000);
    } catch (err: any) {
      console.error('GRN fulfillment error:', err);
      setErrorMessage(err.message || 'Failed to confirm delivery');
    } finally {
      setIsFulfilling(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-slate-950/70 backdrop-blur-xs animate-fade-in">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl w-full max-w-2xl max-h-[92vh] flex flex-col shadow-2xl overflow-hidden">
        
        {/* Header */}
        <div className="px-5 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-blue-50 dark:bg-blue-950/60 flex items-center justify-center text-blue-600 dark:text-blue-400">
              <Package className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-extrabold text-sm text-slate-900 dark:text-white font-heading">
                {isHi ? 'सामग्री अनुरोध ट्रैकर (Procurement & GRN)' : 'Material Requests & GRN Tracker'}
              </h3>
              <p className="text-[10px] text-slate-500">
                {isHi ? 'मांग से डिलीवरी (GRN) और बहीखाता स्वचालित तालमेल' : 'Closed-loop procurement: request to delivery & ledger sync'}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1.5">
            {handleOpenNew && (
              <button
                onClick={handleOpenNew}
                className="px-2.5 py-1.5 rounded-full bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold transition-all shadow-xs cursor-pointer"
              >
                {isHi ? '+ नई मांग' : '+ New Request'}
              </button>
            )}
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
          <div className="flex items-center gap-1 overflow-x-auto no-scrollbar">
            {(['all', 'pending', 'approved', 'fulfilled'] as const).map((st) => (
              <button
                key={st}
                onClick={() => setStatusFilter(st)}
                className={`px-2.5 py-1 rounded-xl font-bold capitalize transition-all cursor-pointer ${
                  statusFilter === st
                    ? 'bg-blue-600 text-white shadow-xs'
                    : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-100'
                }`}
              >
                {st === 'all'
                  ? (isHi ? 'सभी' : 'All')
                  : st === 'pending'
                  ? (isHi ? 'लंबित' : 'Pending')
                  : st === 'approved'
                  ? (isHi ? 'मंज़ूर' : 'Approved')
                  : (isHi ? 'डिलीवर (GRN)' : 'Delivered')}
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

        {/* Alert Messages */}
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

        {/* Requests List */}
        <div className="flex-1 p-5 overflow-y-auto space-y-3">
          {filteredRequests.length === 0 ? (
            <div className="py-12 text-center text-slate-400 space-y-2">
              <Package className="w-10 h-10 mx-auto text-slate-300" />
              <p className="text-xs font-medium">
                {isHi ? 'कोई सामग्री अनुरोध नहीं मिला।' : 'No material requests found.'}
              </p>
            </div>
          ) : (
            filteredRequests.map((req) => {
              const firstItem = req.itemsJson?.[0] || { itemName: 'Material', quantity: 0, unit: '' };
              const isUrgent = req.urgency === 'urgent';

              return (
                <div
                  key={req.id}
                  className="p-4 rounded-2xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700/80 shadow-xs space-y-2.5 transition-all"
                >
                  {/* Top Row: Site & Status Badge */}
                  <div className="flex items-center justify-between">
                    <span className="font-extrabold text-xs text-slate-900 dark:text-white font-heading">
                      {req.siteName || 'Site'}
                    </span>
                    <div className="flex items-center gap-1.5">
                      {isUrgent && (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase bg-red-100 text-red-700 flex items-center gap-1">
                          <Flame className="w-3 h-3 text-red-600" />
                          Urgent
                        </span>
                      )}
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase ${
                          req.status === 'pending'
                            ? 'bg-amber-100 text-amber-700'
                            : req.status === 'approved'
                            ? 'bg-blue-100 text-blue-700'
                            : req.status === 'fulfilled'
                            ? 'bg-emerald-100 text-emerald-700'
                            : 'bg-slate-200 text-slate-600'
                        }`}
                      >
                        {req.status === 'pending'
                          ? (isHi ? 'लंबित' : 'Pending')
                          : req.status === 'approved'
                          ? (isHi ? 'मंज़ूर' : 'Approved')
                          : req.status === 'fulfilled'
                          ? (isHi ? 'डिलीवर (GRN)' : 'Fulfilled')
                          : (isHi ? 'अस्वीकृत' : 'Rejected')}
                      </span>
                    </div>
                  </div>

                  {/* Main Details */}
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="font-bold text-sm text-slate-900 dark:text-white">
                        {firstItem.itemName}
                      </div>
                      <div className="text-xs text-slate-500 font-semibold">
                        {firstItem.quantity} {firstItem.unit}
                      </div>
                      {req.notes && (
                        <p className="text-[11px] text-slate-500 italic mt-0.5">"{req.notes}"</p>
                      )}
                    </div>
                    <div className="text-right text-[10px] text-slate-400">
                      <div>{new Date(req.createdAt).toLocaleDateString()}</div>
                      <div>by {req.requestedByName || 'Supervisor'}</div>
                    </div>
                  </div>

                  {/* Action Buttons Row */}
                  <div className="pt-2 border-t border-slate-100 dark:border-slate-700/60 flex items-center justify-end gap-2">
                    {/* Owner Approval Controls */}
                    {effectiveIsOwner && req.status === 'pending' && (
                      <>
                        <button
                          onClick={() => handleUpdateStatus(req.id, 'rejected')}
                          className="px-2.5 py-1 rounded-xl border border-red-200 text-red-600 hover:bg-red-50 text-xs font-bold transition-all cursor-pointer"
                        >
                          {isHi ? 'अस्वीकार' : 'Reject'}
                        </button>
                        <button
                          onClick={() => handleUpdateStatus(req.id, 'approved')}
                          className="px-3 py-1 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold transition-all shadow-2xs cursor-pointer"
                        >
                          {isHi ? 'मंज़ूर करें (Approve)' : 'Approve PO'}
                        </button>
                      </>
                    )}

                    {/* Delivery Confirmation (GRN) Button */}
                    {(req.status === 'approved' || req.status === 'pending') && (
                      <button
                        onClick={() => handleOpenGrnDialog(req)}
                        className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition-all shadow-xs flex items-center gap-1.5 cursor-pointer"
                      >
                        <Truck className="w-3.5 h-3.5" />
                        <span>{isHi ? 'सामग्री आ गई (Mark Delivered)' : 'Confirm Delivery (GRN)'}</span>
                      </button>
                    )}

                    {req.status === 'fulfilled' && (
                      <div className="flex items-center gap-1 text-[11px] font-bold text-emerald-600">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>{isHi ? 'चालान सत्यापित व लेजर में दर्ज' : 'GRN Verified & In Ledger'}</span>
                      </div>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>

      </div>

      {/* Delivery Confirmation / GRN Modal Dialog */}
      {fulfillingRequest && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-3 bg-slate-950/80 backdrop-blur-xs animate-fade-in">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl w-full max-w-md max-h-[90vh] flex flex-col shadow-2xl overflow-hidden">
            
            {/* Modal Header */}
            <div className="px-5 py-3.5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Truck className="w-4 h-4 text-emerald-600" />
                <h4 className="font-extrabold text-sm text-slate-900 dark:text-white font-heading">
                  {isHi ? 'सामग्री प्राप्ति पुष्टि (GRN)' : 'Goods Received Note (GRN)'}
                </h4>
              </div>
              <button
                onClick={() => setFulfillingRequest(null)}
                className="w-7 h-7 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-500 hover:text-slate-800 flex items-center justify-center cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* GRN Form */}
            <form onSubmit={handleConfirmGrn} className="p-5 overflow-y-auto space-y-3.5 text-xs">
              <div className="p-3 rounded-2xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800">
                <span className="font-bold text-emerald-900 dark:text-emerald-300 block">
                  {fulfillingRequest.itemsJson?.[0]?.itemName}
                </span>
                <span className="text-[11px] text-emerald-700 dark:text-emerald-400">
                  Site: {fulfillingRequest.siteName}
                </span>
              </div>

              {/* Actual Received Quantity */}
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 mb-1">
                    {isHi ? 'प्राप्त मात्रा *' : 'Actual Received Qty *'}
                  </label>
                  <input
                    type="number"
                    step="any"
                    required
                    value={actualQty}
                    onChange={(e) => setActualQty(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 font-bold text-slate-800 dark:text-white focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 mb-1">
                    {isHi ? 'दर प्रति इकाई (₹)' : 'Rate / Unit (₹)'}
                  </label>
                  <input
                    type="number"
                    step="any"
                    value={unitCost}
                    onChange={(e) => {
                      setUnitCost(e.target.value);
                      const q = parseFloat(actualQty) || 1;
                      const r = parseFloat(e.target.value) || 0;
                      if (r > 0) setTotalCost(String(q * r));
                    }}
                    placeholder="₹420"
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 font-bold text-slate-800 dark:text-white focus:outline-none"
                  />
                </div>
              </div>

              {/* Total Amount & Supplier */}
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 mb-1">
                    {isHi ? 'कुल बिल राशि (₹)' : 'Total Bill Amount (₹)'}
                  </label>
                  <input
                    type="number"
                    step="any"
                    value={totalCost}
                    onChange={(e) => setTotalCost(e.target.value)}
                    placeholder="₹21000"
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 font-bold text-slate-800 dark:text-white focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 mb-1">
                    {isHi ? 'सप्लायर / वेंडर' : 'Supplier / Vendor'}
                  </label>
                  <select
                    value={vendorId}
                    onChange={(e) => setVendorId(e.target.value)}
                    className="w-full px-2.5 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 font-bold text-slate-800 dark:text-white focus:outline-none"
                  >
                    <option value="">{isHi ? '-- सप्लायर चुनें --' : '-- Select Vendor --'}</option>
                    {vendors.map((v) => (
                      <option key={v.id} value={v.id}>
                        {v.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Payment Status */}
              <div>
                <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 mb-1">
                  {isHi ? 'भुगतान स्थिति (Payment Status)' : 'Payment Status'}
                </label>
                <div className="grid grid-cols-3 gap-1.5">
                  {(['pending', 'paid', 'partial'] as const).map((ps) => (
                    <button
                      key={ps}
                      type="button"
                      onClick={() => setPaymentStatus(ps)}
                      className={`py-1.5 rounded-xl border text-[11px] font-bold capitalize transition-all cursor-pointer ${
                        paymentStatus === ps
                          ? 'bg-blue-600 text-white border-blue-600 shadow-2xs'
                          : 'bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400'
                      }`}
                    >
                      {ps === 'pending'
                        ? (isHi ? 'उधार (Credit)' : 'Unpaid')
                        : ps === 'paid'
                        ? (isHi ? 'चुका दिया' : 'Paid')
                        : (isHi ? 'आंशिक' : 'Partial')}
                    </button>
                  ))}
                </div>
              </div>

              {/* Challan Photo Upload */}
              <div>
                <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 mb-1">
                  {isHi ? 'डिलीवरी चालान / बिल फोटो *' : 'Delivery Challan / Bill Photo *'}
                </label>
                <input
                  type="file"
                  accept="image/*"
                  capture="environment"
                  ref={challanFileRef}
                  onChange={handleChallanPhoto}
                  className="hidden"
                />
                {challanPhotoPreview ? (
                  <div className="relative rounded-2xl overflow-hidden border border-slate-200 max-h-36">
                    <img src={challanPhotoPreview} alt="Challan" className="w-full h-full object-cover" />
                    <button
                      type="button"
                      onClick={() => setChallanPhotoPreview(null)}
                      className="absolute top-2 right-2 p-1 rounded-full bg-slate-900/80 text-white cursor-pointer"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => challanFileRef.current?.click()}
                    className="w-full py-3 rounded-2xl border-2 border-dashed border-slate-200 dark:border-slate-700 hover:border-blue-400 flex items-center justify-center gap-2 text-slate-500 font-bold transition-all cursor-pointer"
                  >
                    <Camera className="w-4 h-4 text-blue-500" />
                    <span>{isHi ? 'चालान की फोटो खींचें' : 'Capture Challan / Invoice Photo'}</span>
                  </button>
                )}
              </div>

              {/* Confirm Button */}
              <div className="pt-2">
                <button
                  type="submit"
                  disabled={isFulfilling}
                  className="w-full py-3.5 rounded-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-sm shadow-md shadow-emerald-500/25 flex items-center justify-center gap-2 transition-all cursor-pointer"
                >
                  {isFulfilling ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>{isHi ? 'लेजर में दर्ज हो रहा है...' : 'Recording GRN in Ledger...'}</span>
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="w-4 h-4" />
                      <span>{isHi ? 'डिलीवरी पुष्टि करें (Confirm GRN)' : 'Confirm Delivery (GRN)'}</span>
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
