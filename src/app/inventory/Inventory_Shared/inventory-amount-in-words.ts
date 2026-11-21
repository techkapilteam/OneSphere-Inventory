// Invoice "amount in words" in the Indian system (Thousand / Lakh / Crore),
// in capitals, rounded to whole rupees (no paise), as on the earlier
// purchase invoice:  41609.16 -> "RUPEES FORTY ONE THOUSAND SIX HUNDRED AND NINE ONLY".
// The shared NumberToWordsPipe is not used: it counts in Million / Billion
// and drops "Rupees ... Only".

const ONES = ['', 'ONE', 'TWO', 'THREE', 'FOUR', 'FIVE', 'SIX', 'SEVEN', 'EIGHT', 'NINE',
  'TEN', 'ELEVEN', 'TWELVE', 'THIRTEEN', 'FOURTEEN', 'FIFTEEN', 'SIXTEEN', 'SEVENTEEN', 'EIGHTEEN', 'NINETEEN'];
const TENS = ['', '', 'TWENTY', 'THIRTY', 'FORTY', 'FIFTY', 'SIXTY', 'SEVENTY', 'EIGHTY', 'NINETY'];

/** 0-99 in words ('' for 0). */
function belowHundred(n: number): string {
  if (n < 20) return ONES[n];
  return [TENS[Math.floor(n / 10)], ONES[n % 10]].filter(Boolean).join(' ');
}

/** Whole number in words, Indian grouping, with "AND" before the last two digits. */
function wholeInWords(n: number): string {
  if (n === 0) return 'ZERO';
  const parts: string[] = [];
  const crore = Math.floor(n / 10000000);
  const lakh = Math.floor((n % 10000000) / 100000);
  const thousand = Math.floor((n % 100000) / 1000);
  const hundred = Math.floor((n % 1000) / 100);
  const rest = n % 100;

  // Crores above 99 are written in words themselves ("ONE HUNDRED CRORE").
  if (crore) parts.push(`${wholeInWords(crore)} CRORE`);
  if (lakh) parts.push(`${belowHundred(lakh)} LAKH`);
  if (thousand) parts.push(`${belowHundred(thousand)} THOUSAND`);
  if (hundred) parts.push(`${ONES[hundred]} HUNDRED`);
  if (rest) parts.push(parts.length ? `AND ${belowHundred(rest)}` : belowHundred(rest));
  return parts.join(' ');
}

/** "RUPEES ... ONLY" for an invoice total, rounded to whole rupees. '' when not a number. */
export function rupeesInWords(amount: number | string | null | undefined): string {
  const value = Math.round(Math.abs(Number(amount)));
  if (amount === null || amount === undefined || amount === '' || !Number.isFinite(value)) return '';
  return `RUPEES ${wholeInWords(value)} ONLY`;
}
