import { rupeesInWords } from './inventory-amount-in-words';

describe('rupeesInWords', () => {
  it('matches the earlier purchase invoice wording (rounded, no paise)', () => {
    expect(rupeesInWords(41609.16)).toBe('RUPEES FORTY ONE THOUSAND SIX HUNDRED AND NINE ONLY');
  });

  it('uses Lakh and Crore', () => {
    expect(rupeesInWords(177180.06)).toBe('RUPEES ONE LAKH SEVENTY SEVEN THOUSAND ONE HUNDRED AND EIGHTY ONLY');
    expect(rupeesInWords(2500000)).toBe('RUPEES TWENTY FIVE LAKH ONLY');
    expect(rupeesInWords(123456789)).toBe('RUPEES TWELVE CRORE THIRTY FOUR LAKH FIFTY SIX THOUSAND SEVEN HUNDRED AND EIGHTY NINE ONLY');
  });

  it('rounds to the nearest rupee', () => {
    expect(rupeesInWords(353.5)).toBe('RUPEES THREE HUNDRED AND FIFTY FOUR ONLY');
    expect(rupeesInWords(354.49)).toBe('RUPEES THREE HUNDRED AND FIFTY FOUR ONLY');
  });

  it('handles round numbers and small amounts', () => {
    expect(rupeesInWords(100)).toBe('RUPEES ONE HUNDRED ONLY');
    expect(rupeesInWords(1000)).toBe('RUPEES ONE THOUSAND ONLY');
    expect(rupeesInWords(1009)).toBe('RUPEES ONE THOUSAND AND NINE ONLY');
    expect(rupeesInWords(15)).toBe('RUPEES FIFTEEN ONLY');
    expect(rupeesInWords(0)).toBe('RUPEES ZERO ONLY');
  });

  it('returns empty text for no value', () => {
    expect(rupeesInWords(null)).toBe('');
    expect(rupeesInWords('')).toBe('');
    expect(rupeesInWords('abc')).toBe('');
  });
});
