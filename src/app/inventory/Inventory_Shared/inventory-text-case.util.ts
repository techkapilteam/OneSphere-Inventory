export type InventoryTextCase = 'upper' | 'title' | 'sentence' | 'lower' | 'none';

const ACRONYMS = new Set([
  'api', 'bom', 'cgst', 'cm', 'fefo', 'fifo', 'gb', 'gm', 'grn', 'gst', 'gstin',
  'hr', 'hsn', 'igst', 'imei', 'it', 'kg', 'km', 'ltr', 'mb', 'ml', 'mm', 'nos',
  'pan', 'pi', 'po', 'pr', 'qc', 'rfq', 'sac', 'sgst', 'sku', 'sqft', 'uom',
  'upi', 'url'
]);

function wordsKey(key?: string | null, label?: string | null): string {
  return `${key || ''} ${label || ''}`.toLowerCase().replace(/[_-]+/g, ' ');
}

function preserveAcronym(word: string): string | null {
  const normalized = word.toLowerCase().replace(/[^a-z0-9]/g, '');
  return ACRONYMS.has(normalized) ? word.toUpperCase() : null;
}

export function toInventoryTitleCase(value: string): string {
  return value.replace(/[A-Za-z0-9]+(?:['’][A-Za-z0-9]+)?/g, word => {
    const acronym = preserveAcronym(word);
    if (acronym) return acronym;
    if (/\d/.test(word)) return word.replace(/[a-z]+/g, chars => chars.toUpperCase());
    return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
  });
}

export function toInventorySentenceCase(value: string): string {
  const source = /[a-z]/.test(value) ? value : value.toLowerCase();
  return source
    .replace(/(^\s*[a-z])|([.!?]\s+[a-z])/g, match => match.toUpperCase())
    .replace(/\b[A-Za-z]{2,}\b/g, word => preserveAcronym(word) || word);
}

export function inventoryTextCaseForField(key?: string | null, label?: string | null, fieldType?: string | null): InventoryTextCase {
  const type = String(fieldType || '').toLowerCase();
  if (['number', 'date', 'select', 'multiselect', 'file'].includes(type)) return 'none';

  const text = wordsKey(key, label);
  if (/\b(email|e mail|mail id)\b/.test(text)) return 'lower';
  if (/\b(code|sku|hsn|sac|pan|gstin|gst no|gst number|symbol|prefix)\b/.test(text)) return 'upper';
  if (/\b(description|remarks?|notes?|usage note|address)\b/.test(text)) return 'sentence';
  if (/\b(product|service|brand|variant|category|uom|segment|warehouse|branch|location|group|policy|attribute|manufacturer|department|city|district|state|country|name|title|type)\b/.test(text)) return 'title';
  return 'none';
}

export function inventoryTextCaseForLineColumn(column?: string | null): InventoryTextCase {
  const text = wordsKey(column, '');
  if (/\b(email|e mail|mail id)\b/.test(text)) return 'lower';
  if (/\b(code|sku|hsn|sac|pan|gstin|gst no|gst number|symbol|prefix|serial no|batch no|lot no)\b/.test(text)) return 'upper';
  if (/\b(description|remarks?|notes?|address|purpose|reason|terms)\b/.test(text)) return 'sentence';
  // Previous: if (/\b(product|item|service|brand|variant|category|uom|segment|warehouse|branch|location|group|policy|attribute|manufacturer|department|city|district|state|country|name|title|type)\b/.test(text)) return 'title';
  if (/\b(brand|variant|category|uom|segment|warehouse|branch|location|group|policy|attribute|manufacturer|department|city|district|state|country|name|title|type)\b/.test(text)) return 'title';
  return 'none';
}

export function applyInventoryTextCase(value: any, textCase: InventoryTextCase): any {
  if (typeof value !== 'string') return value;
  switch (textCase) {
    case 'upper':
      return value.toUpperCase();
    case 'lower':
      return value.toLowerCase();
    case 'title':
      return toInventoryTitleCase(value);
    case 'sentence':
      return toInventorySentenceCase(value);
    default:
      return value;
  }
}
