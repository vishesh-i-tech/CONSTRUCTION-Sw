import { Share } from '@capacitor/share';

/**
 * Universal Share Helper for Web & Android
 * Uses @capacitor/share when available, falls back to Web Share API or wa.me / WhatsApp direct link.
 */
export interface ShareOptions {
  title: string;
  text: string;
  url?: string;
  phone?: string;
}

export const shareViaWhatsApp = (text: string, phone?: string) => {
  const cleanPhone = phone ? phone.replace(/\D/g, '') : '';
  const encodedText = encodeURIComponent(text);
  const waUrl = cleanPhone.length >= 10
    ? `https://wa.me/${cleanPhone.length === 10 ? '91' + cleanPhone : cleanPhone}?text=${encodedText}`
    : `https://wa.me/?text=${encodedText}`;
  window.open(waUrl, '_blank');
};

export const shareNativeOrWhatsApp = async (options: ShareOptions) => {
  try {
    const canShare = await Share.canShare();
    if (canShare.value) {
      await Share.share({
        title: options.title,
        text: options.text,
        url: options.url,
        dialogTitle: options.title,
      });
      return;
    }
  } catch {
    // Non-native fallback
  }

  if (navigator.share) {
    try {
      await navigator.share({
        title: options.title,
        text: options.text,
        url: options.url,
      });
      return;
    } catch {
      // User dismissed or share failed
    }
  }

  // Direct WhatsApp Web / App link
  shareViaWhatsApp(options.text, options.phone);
};

export const formatClientPaymentReceiptShare = (
  siteName: string,
  clientName: string | undefined,
  amount: number,
  mode: string,
  date: string,
  balanceDue?: number,
  companyName: string = 'SiteSaathi Contractor'
): string => {
  return [
    `🧾 *Payment Receipt — ${companyName}*`,
    `--------------------------------`,
    `🏗️ *Site:* ${siteName}`,
    clientName ? `👤 *Client:* ${clientName}` : '',
    `💰 *Amount Received:* ₹${amount.toLocaleString('en-IN')}`,
    `💳 *Payment Mode:* ${mode}`,
    `📅 *Date:* ${date}`,
    balanceDue !== undefined ? `⚖️ *Remaining Balance Due:* ₹${balanceDue.toLocaleString('en-IN')}` : '',
    `--------------------------------`,
    `Generated via SiteSaathi — Smart Site Management`,
  ]
    .filter(Boolean)
    .join('\n');
};

export const formatPendingDueShare = (
  title: string,
  amountDue: number,
  dueDate: string,
  siteName?: string,
  companyName: string = 'SiteSaathi Contractor'
): string => {
  return [
    `⚠️ *Payment Reminder — ${companyName}*`,
    `--------------------------------`,
    siteName ? `🏗️ *Site:* ${siteName}` : '',
    `📌 *Bill / Due:* ${title}`,
    `💰 *Amount Pending:* ₹${amountDue.toLocaleString('en-IN')}`,
    `📅 *Due Date:* ${dueDate}`,
    `--------------------------------`,
    `Please clear this pending balance at your earliest convenience. Thank you!`,
  ]
    .filter(Boolean)
    .join('\n');
};

export const formatDailyAttendanceShare = (
  siteName: string,
  date: string,
  totalWorkers: number,
  totalWages: number,
  totalPaid: number,
  balanceDue: number,
  companyName: string = 'SiteSaathi Contractor'
): string => {
  return [
    `📋 *Daily Attendance & Wage Summary — ${companyName}*`,
    `--------------------------------`,
    `🏗️ *Site:* ${siteName}`,
    `📅 *Date:* ${date}`,
    `👥 *Total Workers:* ${totalWorkers}`,
    `💵 *Total Wages:* ₹${totalWages.toLocaleString('en-IN')}`,
    `✅ *Paid Today:* ₹${totalPaid.toLocaleString('en-IN')}`,
    `⏳ *Balance Due:* ₹${balanceDue.toLocaleString('en-IN')}`,
    `--------------------------------`,
    `Generated via SiteSaathi — 100% Offline Contractor Ledger`,
  ].join('\n');
};
