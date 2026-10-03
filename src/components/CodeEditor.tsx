import { useState, useEffect, useRef, useCallback } from "react";
import type { VirtualFile } from "../lib/storage";

export interface CodeEditorProps {
  file: VirtualFile | null;
  onChange: (content: string) => void;
  onSave: () => Promise<void>;
  isSaved: boolean;
  readOnly?: boolean;
  language?: string;
}

// Language to mode mapping for syntax highlighting
const LANGUAGE_MODES: Record<string, string> = {
  js: "javascript",
  javascript: "javascript",
  ts: "typescript",
  typescript: "typescript",
  tsx: "tsx",
  jsx: "jsx",
  html: "html",
  css: "css",
  json: "json",
  md: "markdown",
  markdown: "markdown",
  py: "python",
  python: "python",
  sh: "bash",
  bash: "bash",
  yaml: "yaml",
  yml: "yaml",
  xml: "xml",
  svg: "xml",
  txt: "text",
  "": "text",
};

// Keywords for syntax highlighting
const KEYWORDS: Record<string, string[]> = {
  javascript: ["function", "const", "let", "var", "if", "else", "for", "while", "do", "switch", "case", "break", "continue", "return", "try", "catch", "finally", "throw", "new", "delete", "typeof", "instanceof", "void", "this", "class", "extends", "import", "export", "from", "as", "default", "async", "await", "yield", "true", "false", "null", "undefined"],
  typescript: ["function", "const", "let", "var", "if", "else", "for", "while", "do", "switch", "case", "break", "continue", "return", "try", "catch", "finally", "throw", "new", "delete", "typeof", "instanceof", "void", "this", "class", "extends", "import", "export", "from", "as", "default", "async", "await", "yield", "true", "false", "null", "undefined", "interface", "type", "enum", "namespace", "module", "declare", "public", "private", "protected", "static", "readonly", "abstract", "implements"],
  python: ["def", "class", "import", "from", "as", "if", "elif", "else", "for", "while", "try", "except", "finally", "with", "lambda", "return", "yield", "True", "False", "None", "and", "or", "not", "in", "is", "del", "global", "nonlocal", "assert", "pass", "break", "continue"],
  html: ["doctype", "html", "head", "body", "meta", "link", "script", "style", "div", "span", "a", "img", "p", "h1", "h2", "h3", "h4", "h5", "h6", "ul", "ol", "li", "table", "tr", "td", "th", "form", "input", "button", "textarea", "select", "option"],
  css: ["color", "background", "font", "size", "margin", "padding", "border", "display", "position", "top", "right", "bottom", "left", "width", "height", "flex", "grid", "justify", "align", "items", "content", "class", "id", "hover", "focus", "active", "before", "after", "animation", "transition", "transform"],
};

// Built-in types/values
const BUILTINS: Record<string, string[]> = {
  javascript: ["String", "Number", "Boolean", "Array", "Object", "Function", "Date", "RegExp", "Error", "Promise", "Math", "JSON", "console", "setTimeout", "clearTimeout", "setInterval", "clearInterval", "fetch", "Request", "Response", "Headers"],
  python: ["str", "int", "float", "bool", "list", "tuple", "dict", "set", "frozenset", "bytes", "bytearray", "memoryview", "range", "len", "print", "open", "input", "type", "isinstance", "abs", "all", "any", "bin", "chr", "complex", "delattr", "dir", "divmod", "enumerate", "eval", "exec", "filter", "format", "getattr", "globals", "hasattr", "hash", "help", "hex", "id", "iter", "locals", "map", "max", "min", "next", "oct", "ord", "pow", "property", "reversed", "round", "slice", "sorted", "staticmethod", "sum", "super", "vars", "zip", "__import__"],
};

// Syntax highlighter function
function highlightCode(content: string, language: string): string {
  const lang = LANGUAGE_MODES[language] || "text";
  const keywords = KEYWORDS[lang] || [];
  const builtins = BUILTINS[lang] || [];

  if (!content) return content;

  // Escape HTML
  let html = content
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

  // Highlight comments
  html = html.replace(/(\/\/[^\n]*)/g, '<span class="editor-token comment">$1</span>');
  html = html.replace(/(\/\*[\s\S]*?\*\/)/g, '<span class="editor-token comment">$1</span>');

  // Highlight strings
  html = html.replace(/("[^"]*")/g, '<span class="editor-token string">$1</span>');
  html = html.replace(/('['^']*')/g, '<span class="editor-token string">$1</span>');

  // Highlight numbers
  html = html.replace(/\b(0[bB][01]+|0[oO][0-7]+|0[xX][0-9a-fA-F]+|\d+(\.\d+)?([eE][+-]?\d+)?)\b/g, '<span class="editor-token number">$&</span>');

  // Highlight keywords
  for (const keyword of keywords) {
    const regex = new RegExp(`\b(${keyword})\b`, "g");
    html = html.replace(regex, '<span class="editor-token keyword">$1</span>');
  }

  // Highlight builtins
  for (const builtin of builtins) {
    const regex = new RegExp(`\b(${builtin})\b`, "g");
    html = html.replace(regex, '<span class="editor-token builtin">$1</span>');
  }

  // Highlight operators
  html = html.replace(/([+\-*/%^&|~!=<>]=?|&&|\|\||\?\:|\.|,|\\|\/|\*\*|\+\+|--|=>)/g, '<span class="editor-token operator">$1</span>');

  // Highlight punctuation
  html = html.replace(/([(){}\[\]:;])/g, '<span class="editor-token punctuation">$1</span>');

  return html;
}

export function CodeEditor({ file, onChange, onSave, isSaved, readOnly = false, language: lang = "" }: CodeEditorProps) {
  const [content, setContent] = useState(file?.content ?? "");
  const editorRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<string>(file?.content ?? "");

  // Determine language from file extension
  const detectedLanguage = useCallback((): string => {
    if (lang) return lang;
    if (!file) return "text";
    const ext = file.path.split(".").pop()?.toLowerCase() ?? "";
    return LANGUAGE_MODES[ext] || "text";
  }, [file, lang]);

  // Sync content when file changes
  useEffect(() => {
    if (file && file.content !== contentRef.current) {
      setContent(file.content);
      contentRef.current = file.content;
    }
  }, [file]);

  // Handle content changes
  const handleContentChange = useCallback((newContent: string) => {
    setContent(newContent);
    contentRef.current = newContent;
    onChange(newContent);
  }, [onChange]);

  // Handle input for contenteditable
  const handleInput = useCallback((e: React.FormEvent<HTMLDivElement>) => {
    const target = e.target as HTMLDivElement;
    handleContentChange(target.textContent ?? "");
  }, [handleContentChange]);

  // Handle paste
  const handlePaste = useCallback((e: React.ClipboardEvent<HTMLDivElement>) => {
    if (readOnly) {
      e.preventDefault();
      return;
    }
    e.preventDefault();
    const text = e.clipboardData.getData("text/plain");
    const selection = window.getSelection();
    if (!selection || !editorRef.current?.contains(selection.anchorNode)) return;

    const range = selection.getRangeAt(0);
    range.deleteContents();
    range.insertNode(document.createTextNode(text));
    handleContentChange(editorRef.current.textContent ?? "");
  }, [readOnly, handleContentChange]);

  // Handle key down
  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLDivElement>) => {
    if (readOnly) {
      if (e.key.length === 1 || ["Backspace", "Delete", "Enter", "Tab"].includes(e.key)) {
        e.preventDefault();
      }
      return;
    }

    if (e.key === "Tab") {
      e.preventDefault();
      document.execCommand("insertText", false, "  ");
    }

    if (e.ctrlKey || e.metaKey) {
      if (e.key === "s") {
        e.preventDefault();
        void onSave();
      }
      if (e.key === "a") {
        e.preventDefault();
        const selection = window.getSelection();
        if (editorRef.current) {
          const range = document.createRange();
          range.selectNodeContents(editorRef.current);
          selection?.removeAllRanges();
          selection?.addRange(range);
        }
      }
    }
  }, [readOnly, onSave]);

  // Calculate line count
  const lineCount = content.split("\n").length;

  // Get file stats
  const getFileStats = () => {
    const lines = content.split("\n").length;
    const chars = content.length;
    const size = new Blob([content]).size;
    return { lines, chars, size };
  };

  const stats = getFileStats();

  const insertSymbol = (symbol: string) => {
    if (readOnly) return;
    editorRef.current?.focus();
    document.execCommand("insertText", false, symbol);
    onChange(editorRef.current?.innerText ?? `${content}${symbol}`);
  };

  // Generate highlighted HTML
  const highlightedHtml = highlightCode(content, detectedLanguage());

  return (
    <div className="code-editor">
      <div className="editor-wrapper">
        {/* Line numbers */}
        <div className="editor-line-numbers">
          {Array.from({ length: lineCount }, (_, i) => (
            <span key={i} className="line-number">{i + 1}</span>
          ))}
        </div>

        {/* Editor content */}
        <div
          ref={editorRef}
          className="editor-content"
          contentEditable={!readOnly}
          suppressContentEditableWarning
          onInput={handleInput}
          onKeyDown={handleKeyDown}
          onPaste={handlePaste}
          onBlur={() => {
            if (!isSaved) {
              void onSave();
            }
          }}
          dangerouslySetInnerHTML={!readOnly ? undefined : { __html: highlightedHtml || "&nbsp;" }}
          data-placeholder={!readOnly ? "Start typing..." : undefined}
        />
      </div>
      <div className="quick-keys" aria-label="Symbol keys">
        {["{", "}", "[", "]", "(", ")", "<", ">", ";", "=", "/", "!"].map((symbol) => (
          <button key={symbol} type="button" onClick={() => insertSymbol(symbol)}>{symbol}</button>
        ))}
      </div>
    </div>
  );
}
