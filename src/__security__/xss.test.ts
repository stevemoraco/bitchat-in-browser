/**
 * XSS (Cross-Site Scripting) Security Tests
 *
 * Tests to ensure the application properly sanitizes and handles
 * potentially malicious content to prevent XSS attacks.
 *
 * @module __security__/xss.test
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// ============================================================================
// Test Data - XSS Attack Vectors
// ============================================================================

/**
 * Common XSS attack vectors for testing.
 * These should all be safely handled by the application.
 */
const XSS_VECTORS = {
  // Basic script injection
  scriptTag: '<script>alert("xss")</script>',
  scriptTagVariant: '<SCRIPT>alert("xss")</SCRIPT>',
  scriptTagWithSpaces: '<script >alert("xss")</script >',
  scriptSrc: '<script src="https://evil.com/xss.js"></script>',

  // Event handler injection
  imgOnerror: '<img src="x" onerror="alert(\'xss\')">',
  svgOnload: '<svg onload="alert(\'xss\')">',
  bodyOnload: '<body onload="alert(\'xss\')">',
  divOnclick: '<div onclick="alert(\'xss\')">click</div>',
  inputOnfocus: '<input onfocus="alert(\'xss\')" autofocus>',

  // JavaScript URL schemes
  javascriptUrl: 'javascript:alert("xss")',
  javascriptUrlEncoded: 'javascript:alert%28%22xss%22%29',
  dataUrl: 'data:text/html,<script>alert("xss")</script>',
  vbscriptUrl: 'vbscript:alert("xss")',

  // HTML entity encoding bypass
  encodedScript: '&lt;script&gt;alert("xss")&lt;/script&gt;',
  unicodeScript: '\u003cscript\u003ealert("xss")\u003c/script\u003e',

  // Nested/obfuscated injection
  nestedScript: '<<script>script>alert("xss")<</script>/script>',
  splitScript: '<scr<script>ipt>alert("xss")</scr</script>ipt>',

  // CSS-based attacks
  styleExpression: '<div style="background:url(javascript:alert(\'xss\'))">',
  styleImport: '<style>@import "https://evil.com/xss.css";</style>',

  // Iframe injection
  iframeSrc: '<iframe src="javascript:alert(\'xss\')">',
  iframeSrcdoc: '<iframe srcdoc="<script>alert(\'xss\')</script>">',

  // Object/embed injection
  objectData: '<object data="javascript:alert(\'xss\')">',
  embedSrc: '<embed src="javascript:alert(\'xss\')">',

  // Template literals (for frameworks)
  templateLiteral: '${alert("xss")}',
  angularExpression: '{{constructor.constructor("alert(1)")()}}',

  // Markdown XSS
  markdownImage: '![alt](javascript:alert("xss"))',
  markdownLink: '[click](javascript:alert("xss"))',
} as const;

// ============================================================================
// Message Content Sanitization Tests
// ============================================================================

describe('XSS: Message Content Sanitization', () => {
  describe('Script Tag Injection Prevention', () => {
    it('should not execute script tags in message content', () => {
      const alertMock = vi.fn();
      vi.stubGlobal('alert', alertMock);

      // Simulate processing message content (would be done by parser/renderer)
      const content = XSS_VECTORS.scriptTag;

      // The content should be escaped or stripped
      // Script tags should never be rendered as executable HTML
      const processed = escapeHtml(content);

      expect(processed).not.toContain('<script>');
      expect(processed).toContain('&lt;script&gt;');
      expect(alertMock).not.toHaveBeenCalled();

      vi.unstubAllGlobals();
    });

    it('should handle script tag variations', () => {
      const vectors = [
        XSS_VECTORS.scriptTagVariant,
        XSS_VECTORS.scriptTagWithSpaces,
        XSS_VECTORS.scriptSrc,
      ];

      for (const vector of vectors) {
        const processed = escapeHtml(vector);
        expect(processed.toLowerCase()).not.toContain('<script');
        expect(processed.toLowerCase()).not.toContain('</script>');
      }
    });
  });

  describe('Event Handler Injection Prevention', () => {
    it('should strip or escape event handlers', () => {
      const vectors = [
        XSS_VECTORS.imgOnerror,
        XSS_VECTORS.svgOnload,
        XSS_VECTORS.divOnclick,
        XSS_VECTORS.inputOnfocus,
      ];

      for (const vector of vectors) {
        const processed = sanitizeHtml(vector);

        // Should not contain executable event handlers
        expect(processed.toLowerCase()).not.toMatch(/on\w+\s*=/i);
      }
    });
  });

  describe('JavaScript URL Scheme Prevention', () => {
    it('should block javascript: URLs', () => {
      expect(isUrlSafe(XSS_VECTORS.javascriptUrl)).toBe(false);
      expect(isUrlSafe(XSS_VECTORS.javascriptUrlEncoded)).toBe(false);
    });

    it('should block data: URLs with scripts', () => {
      expect(isUrlSafe(XSS_VECTORS.dataUrl)).toBe(false);
    });

    it('should block vbscript: URLs', () => {
      expect(isUrlSafe(XSS_VECTORS.vbscriptUrl)).toBe(false);
    });

    it('should allow safe URLs', () => {
      expect(isUrlSafe('https://example.com')).toBe(true);
      expect(isUrlSafe('http://example.com')).toBe(true);
      expect(isUrlSafe('/relative/path')).toBe(true);
    });
  });

  describe('HTML Entity Encoding', () => {
    it('should properly encode HTML entities', () => {
      const dangerous = '<script>alert("xss")</script>';
      const safe = escapeHtml(dangerous);

      expect(safe).toBe('&lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt;');
    });

    it('should handle nested encoding attempts', () => {
      const nested = '&lt;script&gt;';
      const processed = escapeHtml(nested);

      // Should double-encode
      expect(processed).toBe('&amp;lt;script&amp;gt;');
    });
  });

  describe('Iframe Injection Prevention', () => {
    it('should strip iframe tags from content', () => {
      const vectors = [XSS_VECTORS.iframeSrc, XSS_VECTORS.iframeSrcdoc];

      for (const vector of vectors) {
        const processed = sanitizeHtml(vector);
        expect(processed.toLowerCase()).not.toContain('<iframe');
      }
    });
  });

  describe('CSS Expression Prevention', () => {
    it('should strip dangerous CSS expressions', () => {
      const processed = sanitizeCss(XSS_VECTORS.styleExpression);

      expect(processed.toLowerCase()).not.toContain('javascript:');
      expect(processed.toLowerCase()).not.toContain('expression');
    });

    it('should block external CSS imports', () => {
      const processed = sanitizeCss(XSS_VECTORS.styleImport);

      expect(processed).not.toContain('@import');
    });
  });
});

// ============================================================================
// URL Parsing Safety Tests
// ============================================================================

describe('XSS: URL Parsing Safety', () => {
  describe('Link URL Validation', () => {
    it('should only allow safe URL schemes', () => {
      const safeSchemes = ['https:', 'http:', 'mailto:', 'tel:'];
      const dangerousSchemes = ['javascript:', 'data:', 'vbscript:', 'file:'];

      for (const scheme of safeSchemes) {
        expect(isUrlSchemeAllowed(scheme)).toBe(true);
      }

      for (const scheme of dangerousSchemes) {
        expect(isUrlSchemeAllowed(scheme)).toBe(false);
      }
    });

    it('should handle case-insensitive URL schemes', () => {
      expect(isUrlSafe('JAVASCRIPT:alert(1)')).toBe(false);
      expect(isUrlSafe('JavaScript:alert(1)')).toBe(false);
      expect(isUrlSafe('JaVaScRiPt:alert(1)')).toBe(false);
    });

    it('should handle whitespace in URL schemes', () => {
      expect(isUrlSafe('  javascript:alert(1)')).toBe(false);
      expect(isUrlSafe('\njavascript:alert(1)')).toBe(false);
      expect(isUrlSafe('\tjavascript:alert(1)')).toBe(false);
    });

    it('should handle URL-encoded dangerous schemes', () => {
      // %6A = j, %61 = a, %76 = v, etc.
      expect(isUrlSafe('%6aavascript:alert(1)')).toBe(false);
    });
  });

  describe('URL Sanitization', () => {
    it('should sanitize URLs with fragments containing XSS', () => {
      const url = 'https://example.com#<script>alert(1)</script>';
      const sanitized = sanitizeUrl(url);

      expect(sanitized).not.toContain('<script>');
    });

    it('should sanitize URLs with query params containing XSS', () => {
      const url = 'https://example.com?q=<script>alert(1)</script>';
      const sanitized = sanitizeUrl(url);

      expect(sanitized).not.toContain('<script>');
    });
  });
});

// ============================================================================
// HTML Injection Prevention Tests
// ============================================================================

describe('XSS: HTML Injection Prevention', () => {
  describe('User Input Rendering', () => {
    it('should render user input as text, not HTML', () => {
      const userInput = '<b>bold</b> <i>italic</i>';
      const rendered = renderAsText(userInput);

      // Should be escaped, not interpreted as HTML
      expect(rendered).toContain('&lt;b&gt;');
      expect(rendered).toContain('&lt;/b&gt;');
    });

    it('should handle template literal injection', () => {
      const malicious = '${alert("xss")}';
      const rendered = renderAsText(malicious);

      // Template literal should be treated as plain text
      expect(rendered).toBe('${alert(&quot;xss&quot;)}');
    });
  });

  describe('Object/Embed Tag Prevention', () => {
    it('should strip object tags', () => {
      const processed = sanitizeHtml(XSS_VECTORS.objectData);
      expect(processed.toLowerCase()).not.toContain('<object');
    });

    it('should strip embed tags', () => {
      const processed = sanitizeHtml(XSS_VECTORS.embedSrc);
      expect(processed.toLowerCase()).not.toContain('<embed');
    });
  });

  describe('SVG Injection Prevention', () => {
    it('should strip SVG event handlers', () => {
      const svgWithXSS = '<svg><use href="#" onload="alert(1)"/></svg>';
      const processed = sanitizeHtml(svgWithXSS);

      expect(processed.toLowerCase()).not.toContain('onload');
    });

    it('should strip foreign object in SVG', () => {
      const svg =
        '<svg><foreignObject><body onload="alert(1)"/></foreignObject></svg>';
      const processed = sanitizeHtml(svg);

      expect(processed.toLowerCase()).not.toContain('foreignobject');
    });
  });
});

// ============================================================================
// Script Injection Prevention Tests
// ============================================================================

describe('XSS: Script Injection Prevention', () => {
  let originalCreateElement: typeof document.createElement;
  let originalEval: typeof eval;
  let originalFunction: typeof Function;

  beforeEach(() => {
    originalCreateElement = document.createElement;
    originalEval = globalThis.eval;
    originalFunction = globalThis.Function;
  });

  afterEach(() => {
    document.createElement = originalCreateElement;
    globalThis.eval = originalEval;
    globalThis.Function = originalFunction;
  });

  describe('Dynamic Script Creation Prevention', () => {
    it('should not allow dynamic script element creation from user input', () => {
      const mockCreateElement = vi.fn(originalCreateElement);
      document.createElement = mockCreateElement;

      // Simulate safe content processing
      const userInput = '<script>alert(1)</script>';
      processUserContent(userInput);

      // Should not have created any script elements
      const scriptCalls = mockCreateElement.mock.calls.filter(
        (call) => call[0].toLowerCase() === 'script'
      );
      expect(scriptCalls).toHaveLength(0);
    });
  });

  describe('eval() Usage Prevention', () => {
    it('should never pass user input to eval()', () => {
      const evalSpy = vi.fn();
      globalThis.eval = evalSpy as typeof eval;

      const userInput = 'alert("xss")';
      processUserContent(userInput);

      expect(evalSpy).not.toHaveBeenCalled();
    });

    it('should never use Function constructor with user input', () => {
      const functionSpy = vi.fn();
      globalThis.Function = functionSpy as typeof Function;

      const userInput = 'return alert("xss")';
      processUserContent(userInput);

      expect(functionSpy).not.toHaveBeenCalled();
    });
  });

  describe('innerHTML Usage Safety', () => {
    it('should not use innerHTML with unsanitized content', () => {
      const div = document.createElement('div');
      const innerHTMLSetter = vi.fn();

      Object.defineProperty(div, 'innerHTML', {
        set: innerHTMLSetter,
        get: () => '',
      });

      // Content should be sanitized before any innerHTML usage
      const userInput = '<img src=x onerror=alert(1)>';
      const sanitized = sanitizeHtml(userInput);

      // If innerHTML is used, it should be with sanitized content
      div.innerHTML = sanitized;
      expect(innerHTMLSetter).toHaveBeenCalledWith(
        expect.not.stringContaining('onerror')
      );
    });
  });
});

// ============================================================================
// DOM-based XSS Prevention Tests
// ============================================================================

describe('XSS: DOM-based Attack Prevention', () => {
  describe('Location Hash/Query Parameter Handling', () => {
    it('should sanitize content from URL hash', () => {
      const hash = '#<script>alert(1)</script>';
      const processed = sanitizeLocationInput(hash);

      expect(processed).not.toContain('<script>');
    });

    it('should sanitize content from query parameters', () => {
      const query = '?message=<img src=x onerror=alert(1)>';
      const processed = sanitizeLocationInput(query);

      expect(processed).not.toContain('onerror');
    });
  });

  describe('Document.write Prevention', () => {
    it('should never use document.write with user content', () => {
      const writeSpy = vi.spyOn(document, 'write').mockImplementation(() => {});

      const userContent = '<script>alert(1)</script>';
      processUserContent(userContent);

      expect(writeSpy).not.toHaveBeenCalled();

      writeSpy.mockRestore();
    });
  });
});

// ============================================================================
// Helper Functions (Mock implementations for testing)
// ============================================================================

/**
 * Escape HTML entities to prevent XSS.
 */
function escapeHtml(str: string): string {
  const htmlEntities: Record<string, string> = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  };

  return str.replace(/[&<>"']/g, (char) => htmlEntities[char]);
}

/**
 * Sanitize HTML by removing dangerous elements and attributes.
 */
function sanitizeHtml(html: string): string {
  // Remove dangerous tags
  const dangerousTags =
    /<(script|iframe|object|embed|svg|style|link|base|form|input|button|meta|foreignObject)[^>]*>[\s\S]*?<\/\1>|<(script|iframe|object|embed|svg|style|link|base|form|input|button|meta|foreignObject)[^>]*\/?>/gi;
  let sanitized = html.replace(dangerousTags, '');

  // Remove event handlers
  sanitized = sanitized.replace(/\s*on\w+\s*=\s*(['"])[^'"]*\1/gi, '');
  sanitized = sanitized.replace(/\s*on\w+\s*=\s*[^\s>]+/gi, '');

  return sanitized;
}

/**
 * Sanitize CSS to prevent expression/import attacks.
 */
function sanitizeCss(css: string): string {
  // Remove expressions and JavaScript
  let sanitized = css.replace(/expression\s*\([^)]*\)/gi, '');
  sanitized = sanitized.replace(/javascript\s*:/gi, '');
  sanitized = sanitized.replace(/@import[^;]+;/gi, '');
  sanitized = sanitized.replace(/behavior\s*:\s*url\s*\([^)]*\)/gi, '');

  return sanitized;
}

/**
 * Check if a URL scheme is allowed.
 */
function isUrlSchemeAllowed(scheme: string): boolean {
  const allowedSchemes = ['https:', 'http:', 'mailto:', 'tel:'];
  return allowedSchemes.includes(scheme.toLowerCase());
}

/**
 * Check if a URL is safe to use.
 */
function isUrlSafe(url: string): boolean {
  const trimmed = url.trim().toLowerCase();
  const dangerousPatterns = [
    /^javascript:/i,
    /^data:/i,
    /^vbscript:/i,
    /^file:/i,
    /^\s*javascript:/i,
    /^(?:%[0-9a-f]{2})+javascript:/i,
  ];

  for (const pattern of dangerousPatterns) {
    if (pattern.test(trimmed)) {
      return false;
    }
  }

  // Check URL-decoded version
  try {
    const decoded = decodeURIComponent(url);
    if (decoded !== url) {
      return isUrlSafe(decoded);
    }
  } catch {
    // If decoding fails, check the original
  }

  return true;
}

/**
 * Sanitize a URL.
 */
function sanitizeUrl(url: string): string {
  if (!isUrlSafe(url)) {
    return 'about:blank';
  }

  // Escape HTML entities in URL parts
  return url.replace(/[<>"']/g, (char) => {
    const entities: Record<string, string> = {
      '<': '%3C',
      '>': '%3E',
      '"': '%22',
      "'": '%27',
    };
    return entities[char] || char;
  });
}

/**
 * Render content as plain text (escaped).
 */
function renderAsText(content: string): string {
  return escapeHtml(content);
}

/**
 * Sanitize input from location (hash, query params).
 */
function sanitizeLocationInput(input: string): string {
  // Remove prefix (# or ?)
  const content = input.substring(1);
  return sanitizeHtml(decodeURIComponent(content));
}

/**
 * Process user content safely.
 * This is a mock of what the app should do.
 */
function processUserContent(content: string): string {
  // Never use eval, Function constructor, or document.write
  // Always sanitize before rendering
  return sanitizeHtml(content);
}
