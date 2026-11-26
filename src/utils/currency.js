/**
 * Currency formatting and rounding helpers.
 * - GHS: 1 decimal place
 * - USD: nearest whole number (0 decimal places)
 * - Other currencies (e.g. EUR, GBP): 2 decimal places
 */

export function normalizeCurrencyCode(currency) {
  return String(currency || 'GHS').toUpperCase().trim() || 'GHS';
}

export function getCurrencyDecimals(currency = 'GHS') {
  const code = normalizeCurrencyCode(currency);
  if (code === 'USD') return 0;
  if (code === 'GHS') return 1;
  return 2;
}

export function getCurrencyStep(currency = 'GHS') {
  const decimals = getCurrencyDecimals(currency);
  if (decimals === 0) return '1';
  if (decimals === 1) return '0.1';
  return '0.01';
}

export function getCurrencyPlaceholder(currency = 'GHS') {
  const decimals = getCurrencyDecimals(currency);
  if (decimals === 0) return '0';
  if (decimals === 1) return '0.0';
  return '0.00';
}

export function roundCurrencyAmount(amount, currency = 'GHS') {
  if (amount === '' || amount === null || amount === undefined) return 0;
  const num = Number(amount);
  if (!Number.isFinite(num)) return 0;

  const decimals = getCurrencyDecimals(currency);
  const sign = num < 0 ? -1 : 1;
  const abs = Math.abs(num);

  let rounded;
  if (decimals === 0) {
    rounded = sign * Math.round(abs + 1e-12);
  } else {
    const factor = 10 ** decimals;
    rounded = sign * (Math.round(abs * factor + 1e-9) / factor);
  }

  return rounded === 0 ? 0 : rounded;
}

export function formatCurrency(amount, currency = 'GHS') {
  const code = normalizeCurrencyCode(currency);
  const decimals = getCurrencyDecimals(code);
  const raw = amount === null || amount === undefined || amount === '' ? 0 : Number(amount);
  const rounded = Number.isFinite(raw) ? roundCurrencyAmount(raw, code) : 0;

  const localeMap = {
    GHS: 'en-GH',
    USD: 'en-US',
    EUR: 'de-DE',
    GBP: 'en-GB'
  };

  try {
    return new Intl.NumberFormat(localeMap[code] || 'en-US', {
      style: 'currency',
      currency: code,
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals
    }).format(rounded);
  } catch {
    return `${code} ${rounded.toFixed(decimals)}`;
  }
}
