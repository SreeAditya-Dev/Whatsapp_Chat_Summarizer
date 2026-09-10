import { describe, it, expect } from 'vitest';
import { escapeHtml } from '../src/utils/html-escape';

describe('escapeHtml utility', () => {
  it('should escape dangerous characters correctly', () => {
    expect(escapeHtml('<script>alert("XSS") & goodbye;</script>')).toBe(
      '&lt;script&gt;alert(&quot;XSS&quot;) &amp; goodbye;&lt;/script&gt;'
    );
    expect(escapeHtml("Tom's dog & cat")).toBe('Tom&#39;s dog &amp; cat');
  });

  it('should handle falsy and empty values gracefully', () => {
    expect(escapeHtml('')).toBe('');
    expect(escapeHtml(null as any)).toBe('');
    expect(escapeHtml(undefined as any)).toBe('');
  });

  it('should leave safe alphanumeric strings unchanged', () => {
    expect(escapeHtml('Hello World 123!@#')).toBe('Hello World 123!@#');
  });
});
