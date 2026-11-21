/// <reference types="node" />
import test from 'node:test';
import assert from 'node:assert/strict';

import {
  getTodayIso,
  getTodayFormatted,
  toDisplayDate,
  toIsoDate,
  formatAuditTimestamp,
} from './dateUtils';
import { safePdfText } from './reportExporter';

test('1. getTodayIso returns YYYY-MM-DD format in local time', () => {
  const today = getTodayIso();
  assert.match(today, /^\d{4}-\d{2}-\d{2}$/, 'Should strictly match YYYY-MM-DD');
  const now = new Date();
  const year = String(now.getFullYear());
  assert.ok(today.startsWith(year), 'Should start with current year');
});

test('2. getTodayFormatted returns DD-MM-YYYY format', () => {
  const formatted = getTodayFormatted();
  assert.match(formatted, /^\d{2}-\d{2}-\d{4}$/, 'Should strictly match DD-MM-YYYY');
});

test('3. toDisplayDate converts ISO to DD-MM-YYYY', () => {
  assert.strictEqual(toDisplayDate('2026-10-17'), '17-10-2026');
  assert.strictEqual(toDisplayDate('2026-01-05T12:00:00.000Z'), '05-01-2026');
  // If already DD-MM-YYYY, keeps it as-is
  assert.strictEqual(toDisplayDate('25-12-2026'), '25-12-2026');
  // Empty or undefined returns today's formatted date
  assert.match(toDisplayDate(''), /^\d{2}-\d{2}-\d{4}$/);
});

test('4. toIsoDate converts user-typed dates to ISO YYYY-MM-DD', () => {
  assert.strictEqual(toIsoDate('17-10-2026'), '2026-10-17');
  assert.strictEqual(toIsoDate('17/10/2026'), '2026-10-17');
  assert.strictEqual(toIsoDate('2026-10-17'), '2026-10-17');
});

test('5. formatAuditTimestamp formats timestamp string cleanly', () => {
  const formatted = formatAuditTimestamp('2026-10-17T14:30:00.000Z', 'en');
  assert.ok(formatted.length > 5, 'Should return a non-empty formatted string');
  assert.strictEqual(formatAuditTimestamp(undefined), '');
});

test('6. safePdfText transliterates Devanagari construction words to ASCII', () => {
  // Pure ASCII passes through unmodified
  assert.strictEqual(safePdfText('Main Site Gate 1'), 'Main Site Gate 1');

  // Hindi construction words are mapped cleanly
  assert.strictEqual(safePdfText('राजमिस्त्री'), 'Mason');
  assert.strictEqual(safePdfText('मजदूर'), 'Helper');
  assert.strictEqual(safePdfText('साइट साथी'), 'SiteSaathi');
  assert.strictEqual(safePdfText('सीमेंट बैग'), 'Cement Bags');
  assert.strictEqual(safePdfText('बजरी'), 'Gravel/Aggregate');
  assert.strictEqual(safePdfText('सरिया'), 'Steel/TMT');

  // Empty or undefined passes through safely
  assert.strictEqual(safePdfText(undefined), '');
  assert.strictEqual(safePdfText(''), '');
});
