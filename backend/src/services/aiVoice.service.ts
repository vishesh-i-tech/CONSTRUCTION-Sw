/**
 * AI Voice-to-Structured-Action Service
 * Extracts construction site operational actions (Material Requests, Tasks, Expenses, New Sites)
 * from Hindi, Hinglish, and English voice transcriptions and voice notes.
 *
 * Supports Gemini Flash API with zero-downtime resilient construction NLP parser fallback.
 */

export type ExtractedActionType =
  | 'material_request'
  | 'site_task'
  | 'expense'
  | 'site_create'
  | 'site_note';

export interface ExtractedVoiceAction {
  actionType: ExtractedActionType;
  confidence: number;
  transcript: string;
  source: 'gemini' | 'rules_engine';
  extractedData: {
    siteName?: string;
    siteId?: string;
    itemName?: string;
    title?: string;
    description?: string;
    quantity?: number;
    unit?: string;
    urgency?: 'low' | 'normal' | 'urgent';
    priority?: 'low' | 'medium' | 'high';
    dueDate?: string;
    amount?: number;
    paymentStatus?: 'paid' | 'pending';
    vendorName?: string;
    notes?: string;
  };
}

/**
 * Normalizes Hindi number words into numeric digits
 */
function normalizeHindiNumbers(text: string): string {
  const numberMap: Record<string, string> = {
    'ek': '1', 'do': '2', 'teen': '3', 'chaar': '4', 'char': '4',
    'paanch': '5', 'panch': '5', 'chhe': '6', 'che': '6', 'saat': '7', 'sat': '7',
    'aath': '8', 'ath': '8', 'nau': '9', 'no': '9', 'das': '10', 'dus': '10',
    'gyarah': '11', 'barah': '12', 'terah': '13', 'chaudah': '14', 'pandrah': '15',
    'solah': '16', 'satrah': '17', 'atharah': '18', 'unnis': '19', 'bees': '20',
    'pachees': '25', 'pachis': '25', 'tees': '30', 'tis': '30',
    'chalees': '40', 'chalis': '40', 'pachaas': '50', 'pachas': '50',
    'sau': '100', 'hazaar': '1000', 'hazar': '1000', 'lakh': '100000', 'lac': '100000',
    'एक': '1', 'दो': '2', 'तीन': '3', 'चार': '4', 'पांच': '5',
    'छह': '6', 'सात': '7', 'आठ': '8', 'नौ': '9', 'दस': '10',
    'बीस': '20', 'पचास': '50', 'सौ': '100', 'हजार': '1000', 'लाख': '100000'
  };

  let normalized = text;
  for (const [word, digit] of Object.entries(numberMap)) {
    const regex = new RegExp(`\\b${word}\\b`, 'gi');
    normalized = normalized.replace(regex, digit);
  }
  return normalized;
}

/**
 * Resilient Construction NLP Intent & Entity Parser (offline & test safe)
 */
export function parseVoiceWithRules(transcript: string, defaultSiteId?: string): ExtractedVoiceAction {
  const cleaned = transcript.trim();
  const lower = normalizeHindiNumbers(cleaned.toLowerCase());

  // 1. Detect Action Type
  const materialKeywords = [
    'cement', 'सीमेंट', 'sariya', 'सरिया', 'tmt', 'rebar', 'steel', 'sand', 'रेत', 'balu', 'बजरी',
    'bricks', 'ईंट', 'eent', 'rodi', 'रोड़ी', 'aggregate', 'gravel', 'paint', 'primer', 'plaster',
    'pipe', 'पाइप', 'wire', 'तार', 'tiles', 'टाइल', 'marble', 'wood', 'plywood', 'ply',
    'bhej do', 'manga do', 'chahiye', 'order', 'require', 'indent', 'urgent material', 'supply',
    'bag', 'bags', 'बोरी', 'ton', 'टन', 'brass', 'ब्रास', 'trolley', 'ट्रॉली'
  ];

  const taskKeywords = [
    'task', 'टास्क', 'fix', 'theek', 'theek karo', 'repair', 'kaam karo', 'karna hai',
    'check karo', 'inspect', 'cleaning', 'safai', 'shuttering kholo', 'curing', 'terai',
    'tari', 'leakage', 'crack', 'dhyan do', 'punch', 'action', 'snag', 'rectify'
  ];

  const expenseKeywords = [
    'kharcha', 'खर्च', 'paid', 'diya', 'payment', 'rupaye', 'rupees', 'petrol', 'diesel',
    'challan paid', 'cash', 'advance', 'vendor payment', 'bill bhara', 'due'
  ];

  const siteCreateKeywords = [
    'new site', 'nayi site', 'नयी साइट', 'naya project', 'नया प्रोजेक्ट', 'create site'
  ];

  let actionType: ExtractedActionType = 'site_task';
  let confidence = 0.85;

  if (siteCreateKeywords.some(kw => lower.includes(kw))) {
    actionType = 'site_create';
  } else if (materialKeywords.some(kw => lower.includes(kw))) {
    actionType = 'material_request';
  } else if (expenseKeywords.some(kw => lower.includes(kw))) {
    actionType = 'expense';
  } else if (taskKeywords.some(kw => lower.includes(kw))) {
    actionType = 'site_task';
  }

  // 2. Extract Urgency & Priority
  const isUrgent =
    lower.includes('urgent') ||
    lower.includes('turant') ||
    lower.includes('तुरंत') ||
    lower.includes('abhi') ||
    lower.includes('aaj hi') ||
    lower.includes('asap');

  const urgency: 'low' | 'normal' | 'urgent' = isUrgent ? 'urgent' : 'normal';
  const priority: 'low' | 'medium' | 'high' = isUrgent ? 'high' : 'medium';

  // 3. Extract Quantity and Unit
  let quantity: number | undefined = undefined;
  let unit: string = 'units';

  const qtyMatch = lower.match(/(\d+(?:\.\d+)?)\s*(bags?|बोरी|tonnes?|tons?|टन|brass|ब्रास|kg|किलो|litres?|लीटर|nos?|पीस|trips?|trolley|गाड़ी)?/i);
  if (qtyMatch) {
    quantity = parseFloat(qtyMatch[1]);
    const detectedUnit = (qtyMatch[2] || '').toLowerCase();
    if (detectedUnit.includes('bag') || detectedUnit.includes('बोरी')) unit = 'bags';
    else if (detectedUnit.includes('ton') || detectedUnit.includes('टन')) unit = 'tons';
    else if (detectedUnit.includes('brass') || detectedUnit.includes('ब्रास')) unit = 'brass';
    else if (detectedUnit.includes('kg') || detectedUnit.includes('किलो')) unit = 'kg';
    else if (detectedUnit.includes('litre') || detectedUnit.includes('लीटर')) unit = 'litres';
    else if (detectedUnit.includes('trip') || detectedUnit.includes('trolley') || detectedUnit.includes('गाड़ी')) unit = 'trips';
    else if (detectedUnit.includes('no') || detectedUnit.includes('पीस')) unit = 'nos';
  }

  // 4. Extract Item Name or Task Title
  let itemName: string | undefined = undefined;
  let title: string | undefined = undefined;

  if (actionType === 'material_request') {
    if (lower.includes('cement') || lower.includes('सीमेंट')) itemName = 'Cement (53 Grade)';
    else if (lower.includes('sariya') || lower.includes('सरिया') || lower.includes('tmt') || lower.includes('steel')) itemName = 'TMT Steel Rebar';
    else if (lower.includes('sand') || lower.includes('रेत') || lower.includes('balu')) itemName = 'Sand / Coarse Sand';
    else if (lower.includes('rodi') || lower.includes('aggregate') || lower.includes('रोड़ी')) itemName = '20mm Aggregates';
    else if (lower.includes('eent') || lower.includes('brick') || lower.includes('ईंट')) itemName = 'Red Bricks';
    else if (lower.includes('paint') || lower.includes('primer')) itemName = 'Wall Paint / Primer';
    else itemName = cleaned.slice(0, 40);
  } else if (actionType === 'site_task') {
    title = cleaned.slice(0, 80);
  } else if (actionType === 'expense') {
    itemName = cleaned.slice(0, 40);
  }

  // 5. Extract Amount if Expense
  let amount: number | undefined = undefined;
  if (actionType === 'expense') {
    const amountMatch = lower.match(/(?:rs\.?|₹|inr|rupaye|rupees)?\s*(\d+(?:,\d+)*(?:\.\d+)?)\s*(?:rs\.?|₹|rupaye|rupees)?/i);
    if (amountMatch) {
      amount = parseFloat(amountMatch[1].replace(/,/g, ''));
    }
  }

  return {
    actionType,
    confidence,
    transcript: cleaned,
    source: 'rules_engine',
    extractedData: {
      siteId: defaultSiteId,
      itemName,
      title: title || (actionType === 'site_task' ? cleaned : undefined),
      description: cleaned,
      quantity: quantity || (actionType === 'material_request' ? 10 : undefined),
      unit: actionType === 'material_request' ? unit : undefined,
      urgency,
      priority,
      amount,
      paymentStatus: 'paid',
      notes: cleaned,
    },
  };
}

/**
 * Main Extract Voice Action Handler
 * Uses Gemini API if configured with GEMINI_API_KEY, else falls back to robust local rules engine.
 */
export async function extractVoiceAction(
  transcript: string,
  siteId?: string
): Promise<ExtractedVoiceAction> {
  const geminiApiKey = process.env.GEMINI_API_KEY;

  if (!geminiApiKey) {
    return parseVoiceWithRules(transcript, siteId);
  }

  try {
    const prompt = `You are an expert AI assistant for Indian construction sites.
Analyze this spoken audio transcript from a contractor or site supervisor (which may be in Hindi, Hinglish, or English):
"${transcript}"

Extract the structured operational action and return strictly valid JSON matching this schema:
{
  "actionType": "material_request" | "site_task" | "expense" | "site_create",
  "confidence": number between 0.0 and 1.0,
  "extractedData": {
    "itemName": string or null,
    "title": string or null,
    "description": string or null,
    "quantity": number or null,
    "unit": string or null (e.g. "bags", "tons", "brass", "nos", "kg", "litres"),
    "urgency": "normal" | "urgent",
    "priority": "low" | "medium" | "high",
    "dueDate": string or null,
    "amount": number or null,
    "paymentStatus": "paid" | "pending" | null,
    "notes": string or null
  }
}`;

    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${geminiApiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: {
            responseMimeType: 'application/json',
            temperature: 0.1,
          },
        }),
      }
    );

    if (!res.ok) {
      console.warn(`Gemini API returned status ${res.status}. Falling back to rules engine.`);
      return parseVoiceWithRules(transcript, siteId);
    }

    const data: any = await res.json();
    const rawText = data?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!rawText) {
      return parseVoiceWithRules(transcript, siteId);
    }

    const parsed = JSON.parse(rawText);
    return {
      actionType: parsed.actionType || 'site_task',
      confidence: parsed.confidence || 0.95,
      transcript,
      source: 'gemini',
      extractedData: {
        siteId,
        ...parsed.extractedData,
      },
    };
  } catch (err) {
    console.warn('Gemini extraction failed, using rules engine fallback:', err);
    return parseVoiceWithRules(transcript, siteId);
  }
}
