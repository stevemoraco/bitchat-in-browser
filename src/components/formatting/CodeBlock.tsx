/**
 * CodeBlock Component
 *
 * Displays code with terminal-style formatting, line numbers,
 * and a copy button. Supports optional syntax highlighting.
 */

import { FunctionComponent } from 'preact';
import { useState, useCallback, useMemo, useRef } from 'preact/hooks';
import { escapeHtml, sanitizeText } from '../../services/formatting/renderer';

// ============================================================================
// Types
// ============================================================================

export interface CodeBlockProps {
  /** Code content */
  code: string;
  /** Programming language (for syntax highlighting) */
  language?: string;
  /** Show line numbers */
  showLineNumbers?: boolean;
  /** Starting line number */
  startLineNumber?: number;
  /** Show copy button */
  showCopyButton?: boolean;
  /** Show language label */
  showLanguageLabel?: boolean;
  /** Maximum height before scrolling */
  maxHeight?: string;
  /** Additional CSS classes */
  className?: string;
  /** Compact mode (smaller padding/font) */
  compact?: boolean;
  /** Wrap long lines */
  wrapLines?: boolean;
  /** Highlight specific lines (1-indexed) */
  highlightLines?: number[];
}

export interface InlineCodeProps {
  /** Code content */
  code: string;
  /** Additional CSS classes */
  className?: string;
  /** Click to copy */
  copyOnClick?: boolean;
}

// ============================================================================
// Language Detection
// ============================================================================

/**
 * Common language aliases
 */
const LANGUAGE_ALIASES: Record<string, string> = {
  js: 'javascript',
  ts: 'typescript',
  py: 'python',
  rb: 'ruby',
  sh: 'bash',
  shell: 'bash',
  zsh: 'bash',
  yml: 'yaml',
  md: 'markdown',
  rs: 'rust',
  go: 'golang',
  kt: 'kotlin',
  cs: 'csharp',
  cpp: 'c++',
  h: 'c',
  hpp: 'c++',
  jsx: 'javascript',
  tsx: 'typescript',
  vue: 'html',
  svelte: 'html',
  dockerfile: 'docker',
  makefile: 'make',
  plaintext: 'text',
  txt: 'text',
  '': 'text',
};

/**
 * Normalize language name
 */
function normalizeLanguage(lang?: string): string {
  if (!lang) return 'text';
  const lower = lang.toLowerCase().trim();
  return LANGUAGE_ALIASES[lower] || lower;
}

/**
 * Get display name for language
 */
function getLanguageDisplayName(lang: string): string {
  const normalized = normalizeLanguage(lang);
  const displayNames: Record<string, string> = {
    javascript: 'JavaScript',
    typescript: 'TypeScript',
    python: 'Python',
    rust: 'Rust',
    golang: 'Go',
    ruby: 'Ruby',
    bash: 'Bash',
    json: 'JSON',
    yaml: 'YAML',
    html: 'HTML',
    css: 'CSS',
    sql: 'SQL',
    markdown: 'Markdown',
    text: 'Plain Text',
    csharp: 'C#',
    'c++': 'C++',
    kotlin: 'Kotlin',
    swift: 'Swift',
    java: 'Java',
    php: 'PHP',
  };
  return displayNames[normalized] || normalized;
}

// ============================================================================
// Basic Syntax Highlighting (No external dependencies)
// ============================================================================

/**
 * Basic keywords for common languages
 */
const KEYWORDS: Record<string, string[]> = {
  javascript: [
    'const',
    'let',
    'var',
    'function',
    'return',
    'if',
    'else',
    'for',
    'while',
    'do',
    'switch',
    'case',
    'break',
    'continue',
    'try',
    'catch',
    'finally',
    'throw',
    'new',
    'class',
    'extends',
    'import',
    'export',
    'default',
    'from',
    'async',
    'await',
    'yield',
    'typeof',
    'instanceof',
    'in',
    'of',
    'true',
    'false',
    'null',
    'undefined',
    'this',
    'super',
  ],
  typescript: [
    'const',
    'let',
    'var',
    'function',
    'return',
    'if',
    'else',
    'for',
    'while',
    'do',
    'switch',
    'case',
    'break',
    'continue',
    'try',
    'catch',
    'finally',
    'throw',
    'new',
    'class',
    'extends',
    'import',
    'export',
    'default',
    'from',
    'async',
    'await',
    'yield',
    'typeof',
    'instanceof',
    'in',
    'of',
    'true',
    'false',
    'null',
    'undefined',
    'this',
    'super',
    'type',
    'interface',
    'enum',
    'namespace',
    'module',
    'declare',
    'readonly',
    'private',
    'public',
    'protected',
    'static',
    'abstract',
    'implements',
    'as',
    'is',
    'keyof',
    'infer',
    'never',
    'unknown',
    'any',
    'void',
    'string',
    'number',
    'boolean',
    'object',
  ],
  python: [
    'def',
    'class',
    'return',
    'if',
    'elif',
    'else',
    'for',
    'while',
    'break',
    'continue',
    'try',
    'except',
    'finally',
    'raise',
    'with',
    'as',
    'import',
    'from',
    'async',
    'await',
    'yield',
    'lambda',
    'and',
    'or',
    'not',
    'in',
    'is',
    'True',
    'False',
    'None',
    'self',
    'pass',
    'global',
    'nonlocal',
  ],
  rust: [
    'fn',
    'let',
    'mut',
    'const',
    'static',
    'struct',
    'enum',
    'impl',
    'trait',
    'type',
    'where',
    'for',
    'loop',
    'while',
    'if',
    'else',
    'match',
    'return',
    'break',
    'continue',
    'move',
    'ref',
    'self',
    'Self',
    'super',
    'crate',
    'mod',
    'pub',
    'use',
    'as',
    'in',
    'async',
    'await',
    'dyn',
    'true',
    'false',
    'Some',
    'None',
    'Ok',
    'Err',
  ],
  bash: [
    'if',
    'then',
    'else',
    'elif',
    'fi',
    'for',
    'while',
    'do',
    'done',
    'case',
    'esac',
    'function',
    'return',
    'exit',
    'export',
    'local',
    'readonly',
    'declare',
    'source',
    'echo',
    'printf',
    'read',
    'cd',
    'pwd',
    'ls',
    'mkdir',
    'rm',
    'cp',
    'mv',
    'cat',
    'grep',
    'sed',
    'awk',
    'true',
    'false',
  ],
};

/**
 * Very basic syntax highlighting
 * In production, you'd use a library like Prism or highlight.js
 */
function highlightCode(code: string, language: string): string {
  const normalized = normalizeLanguage(language);
  const keywords = KEYWORDS[normalized] || [];

  if (keywords.length === 0 || normalized === 'text') {
    return escapeHtml(code);
  }

  // Simple tokenization (not perfect, but functional)
  let result = escapeHtml(code);

  // Highlight strings (simple approach - doesn't handle escapes perfectly)
  result = result.replace(
    /(&quot;[^&]*&quot;|&#x27;[^&]*&#x27;|`[^`]*`)/g,
    '<span class="text-terminal-yellow">$1</span>'
  );

  // Highlight comments
  result = result.replace(
    /(\/\/.*$|\/\*[\s\S]*?\*\/|#.*$)/gm,
    '<span class="text-terminal-green/50 italic">$1</span>'
  );

  // Highlight numbers
  result = result.replace(
    /\b(\d+\.?\d*)\b/g,
    '<span class="text-terminal-magenta">$1</span>'
  );

  // Highlight keywords
  const keywordPattern = new RegExp(`\\b(${keywords.join('|')})\\b`, 'g');
  result = result.replace(
    keywordPattern,
    '<span class="text-terminal-cyan font-semibold">$1</span>'
  );

  return result;
}

// ============================================================================
// CodeBlock Component
// ============================================================================

export const CodeBlock: FunctionComponent<CodeBlockProps> = ({
  code,
  language,
  showLineNumbers = true,
  startLineNumber = 1,
  showCopyButton = true,
  showLanguageLabel = true,
  maxHeight = '400px',
  className = '',
  compact = false,
  wrapLines = false,
  highlightLines = [],
}) => {
  const [copied, setCopied] = useState(false);
  const codeRef = useRef<HTMLPreElement>(null);

  // Sanitize code
  const sanitizedCode = useMemo(() => sanitizeText(code), [code]);

  // Split into lines
  const lines = useMemo(() => sanitizedCode.split('\n'), [sanitizedCode]);

  // Normalize language
  const normalizedLang = useMemo(
    () => normalizeLanguage(language),
    [language]
  );
  const displayLang = useMemo(
    () => getLanguageDisplayName(language || ''),
    [language]
  );

  // Highlight each line
  const highlightedLines = useMemo(() => {
    return lines.map((line) => highlightCode(line, normalizedLang));
  }, [lines, normalizedLang]);

  // Copy handler
  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(sanitizedCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      // Fallback for older browsers
      const textarea = document.createElement('textarea');
      textarea.value = sanitizedCode;
      textarea.style.position = 'fixed';
      textarea.style.opacity = '0';
      document.body.appendChild(textarea);
      textarea.select();
      try {
        document.execCommand('copy');
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      } catch {
        console.error('Copy failed');
      }
      document.body.removeChild(textarea);
    }
  }, [sanitizedCode]);

  // Line number width calculation
  const lineNumberWidth = useMemo(() => {
    const maxLineNum = startLineNumber + lines.length - 1;
    return Math.max(2, String(maxLineNum).length);
  }, [startLineNumber, lines.length]);

  // Container classes
  const containerClass = [
    'code-block',
    'border border-terminal-green/30 rounded overflow-hidden',
    'bg-terminal-bg/80',
    compact ? 'text-xs' : 'text-sm',
    className,
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div class={containerClass}>
      {/* Header */}
      {(showLanguageLabel || showCopyButton) && (
        <div class="flex items-center justify-between px-3 py-1.5 bg-terminal-green/10 border-b border-terminal-green/30">
          {showLanguageLabel && (
            <span class="text-terminal-green/70 text-xs font-mono">
              {displayLang}
            </span>
          )}
          {showCopyButton && (
            <button
              type="button"
              class={[
                'text-xs px-2 py-0.5 rounded transition-colors',
                copied
                  ? 'bg-terminal-green/20 text-terminal-green'
                  : 'text-terminal-green/50 hover:text-terminal-green hover:bg-terminal-green/10',
              ].join(' ')}
              onClick={handleCopy}
              title="Copy code"
            >
              {copied ? 'Copied!' : 'Copy'}
            </button>
          )}
        </div>
      )}

      {/* Code content */}
      <div
        class="overflow-auto"
        style={{ maxHeight }}
      >
        <pre
          ref={codeRef}
          class={[
            'font-mono',
            compact ? 'p-2' : 'p-3',
            wrapLines ? 'whitespace-pre-wrap' : 'whitespace-pre',
          ].join(' ')}
        >
          {highlightedLines.map((line, index) => {
            const lineNumber = startLineNumber + index;
            const isHighlighted = highlightLines.includes(lineNumber);

            return (
              <div
                key={index}
                class={[
                  'flex',
                  isHighlighted ? 'bg-terminal-yellow/10 -mx-3 px-3' : '',
                ].join(' ')}
              >
                {showLineNumbers && (
                  <span
                    class="select-none text-terminal-green/30 pr-3 text-right flex-shrink-0"
                    style={{ minWidth: `${lineNumberWidth + 1}ch` }}
                  >
                    {lineNumber}
                  </span>
                )}
                <span
                  class="flex-1 text-terminal-green/90"
                  dangerouslySetInnerHTML={{ __html: line || '&nbsp;' }}
                />
              </div>
            );
          })}
        </pre>
      </div>
    </div>
  );
};

// ============================================================================
// InlineCode Component
// ============================================================================

export const InlineCode: FunctionComponent<InlineCodeProps> = ({
  code,
  className = '',
  copyOnClick = false,
}) => {
  const [copied, setCopied] = useState(false);

  const sanitizedCode = useMemo(() => sanitizeText(code), [code]);

  const handleClick = useCallback(async () => {
    if (!copyOnClick) return;

    try {
      await navigator.clipboard.writeText(sanitizedCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // Ignore
    }
  }, [copyOnClick, sanitizedCode]);

  const containerClass = [
    'inline-code',
    'px-1.5 py-0.5 rounded font-mono text-sm',
    'bg-terminal-green/10 border border-terminal-green/30',
    'text-terminal-green/90',
    copyOnClick ? 'cursor-pointer hover:bg-terminal-green/20' : '',
    copied ? 'bg-terminal-green/30' : '',
    className,
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <code
      class={containerClass}
      onClick={handleClick}
      title={copyOnClick ? 'Click to copy' : undefined}
    >
      {escapeHtml(sanitizedCode)}
    </code>
  );
};

// ============================================================================
// Specialized Components
// ============================================================================

/**
 * Terminal output display
 */
export const TerminalOutput: FunctionComponent<{
  output: string;
  command?: string;
  className?: string;
}> = ({ output, command, className = '' }) => {
  return (
    <div
      class={`terminal-output border border-terminal-green/30 rounded overflow-hidden bg-black/50 ${className}`}
    >
      {command && (
        <div class="px-3 py-2 border-b border-terminal-green/30 font-mono text-sm">
          <span class="text-terminal-green">$</span>{' '}
          <span class="text-terminal-green/90">{command}</span>
        </div>
      )}
      <pre class="p-3 font-mono text-sm text-terminal-green/80 whitespace-pre-wrap overflow-auto max-h-64">
        {output}
      </pre>
    </div>
  );
};

/**
 * Diff display
 */
export const DiffBlock: FunctionComponent<{
  diff: string;
  className?: string;
}> = ({ diff, className = '' }) => {
  const lines = diff.split('\n');

  return (
    <div
      class={`diff-block border border-terminal-green/30 rounded overflow-hidden bg-terminal-bg/80 ${className}`}
    >
      <div class="px-3 py-1.5 bg-terminal-green/10 border-b border-terminal-green/30 text-xs text-terminal-green/70 font-mono">
        diff
      </div>
      <pre class="p-3 font-mono text-sm overflow-auto max-h-96">
        {lines.map((line, i) => {
          let colorClass = 'text-terminal-green/70';
          if (line.startsWith('+') && !line.startsWith('+++')) {
            colorClass = 'text-terminal-green bg-terminal-green/10';
          } else if (line.startsWith('-') && !line.startsWith('---')) {
            colorClass = 'text-terminal-red bg-terminal-red/10';
          } else if (line.startsWith('@@')) {
            colorClass = 'text-terminal-cyan';
          }

          return (
            <div key={i} class={`${colorClass} -mx-3 px-3`}>
              {escapeHtml(line) || '\u00A0'}
            </div>
          );
        })}
      </pre>
    </div>
  );
};

/**
 * JSON viewer with formatting
 */
export const JsonBlock: FunctionComponent<{
  data: unknown;
  className?: string;
}> = ({ data, className = '' }) => {
  const formatted = useMemo(() => {
    try {
      return JSON.stringify(data, null, 2);
    } catch {
      return String(data);
    }
  }, [data]);

  return <CodeBlock code={formatted} language="json" className={className} />;
};

export default CodeBlock;
