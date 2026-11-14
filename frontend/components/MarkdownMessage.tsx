"use client";
import React, { useState } from "react";
import { Copy, Check, Info, Sparkles } from "lucide-react";

interface MarkdownMessageProps {
  content: string;
  time?: Date;
}

export default function MarkdownMessage({ content, time }: MarkdownMessageProps) {
  const [copied, setCopied] = useState(false);

  function copyToClipboard() {
    navigator.clipboard.writeText(content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  // Parse lines into structured blocks
  const blocks = parseMarkdown(content);

  return (
    <div className="w-full">
      {/* Top Header Bar */}
      <div className="flex items-center justify-between pb-2 mb-3 border-b border-[#252538]">
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 rounded bg-accent/20 flex items-center justify-center">
            <Sparkles size={10} className="text-accent-light" />
          </div>
          <span className="text-[11px] font-semibold text-accent-light uppercase tracking-wider">
            InvestIntel Research
          </span>
          <span className="text-[10px] text-txt-dim">&bull;</span>
          <span className="text-[10px] text-emerald-400 flex items-center gap-1 font-medium">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            Verified Ledger
          </span>
        </div>

        <button
          onClick={copyToClipboard}
          className="flex items-center gap-1.5 px-2 py-1 rounded-md text-[11px] text-txt-secondary hover:text-white hover:bg-white/5 transition-colors border border-transparent hover:border-border"
          title="Copy response"
        >
          {copied ? (
            <>
              <Check size={12} className="text-emerald-400" />
              <span className="text-emerald-400 font-medium">Copied</span>
            </>
          ) : (
            <>
              <Copy size={12} />
              <span>Copy</span>
            </>
          )}
        </button>
      </div>

      {/* Structured Content Body */}
      <div className="space-y-2.5 text-[13.5px] leading-relaxed text-slate-200">
        {blocks.map((block, i) => (
          <React.Fragment key={i}>{renderBlock(block)}</React.Fragment>
        ))}
      </div>

      {/* Timestamp */}
      {time && (
        <div className="mt-3 pt-2 border-t border-[#1e1e30] flex justify-end">
          <span className="text-[10px] text-txt-dim">
            {time.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
          </span>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Block Parsing Engine
// ---------------------------------------------------------------------------

type Block =
  | { type: "header"; level: number; text: string }
  | { type: "divider" }
  | { type: "disclaimer"; text: string }
  | { type: "list"; items: { indent: number; text: string; bullet?: string }[] }
  | { type: "table"; headers: string[]; rows: string[][] }
  | { type: "paragraph"; text: string };

function parseMarkdown(raw: string): Block[] {
  const lines = raw.split("\n");
  const blocks: Block[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];
    const trimmed = line.trim();

    // Empty lines
    if (!trimmed) {
      i++;
      continue;
    }

    // Horizontal Rule: ---, ***, ___
    if (/^(\*{3,}|-{3,}|_{3,})$/.test(trimmed)) {
      blocks.push({ type: "divider" });
      i++;
      continue;
    }

    // Disclaimer detection (italic line starting with Disclaimer:)
    if (
      (trimmed.startsWith("*Disclaimer:") ||
        trimmed.startsWith("_Disclaimer:") ||
        trimmed.toLowerCase().includes("not a sebi-registered") ||
        trimmed.toLowerCase().includes("not financial advice")) &&
      (trimmed.endsWith("*") || trimmed.endsWith("_") || trimmed.startsWith("*"))
    ) {
      const cleanDisclaimer = trimmed.replace(/^[\*_]+|[\*_]+$/g, "");
      blocks.push({ type: "disclaimer", text: cleanDisclaimer });
      i++;
      continue;
    }

    // Headers: #, ##, ###
    const headerMatch = trimmed.match(/^(#{1,4})\s+(.+)$/);
    if (headerMatch) {
      blocks.push({
        type: "header",
        level: headerMatch[1].length,
        text: headerMatch[2],
      });
      i++;
      continue;
    }

    // Table detection: starts with | and contains |
    if (trimmed.startsWith("|") && trimmed.endsWith("|") && i + 1 < lines.length) {
      const nextTrimmed = lines[i + 1].trim();
      if (/^\|(\s*[-:]+\s*\|)+$/.test(nextTrimmed)) {
        // Table found!
        const headers = trimmed
          .split("|")
          .slice(1, -1)
          .map((s) => s.trim());
        i += 2; // skip header and separator
        const rows: string[][] = [];
        while (i < lines.length && lines[i].trim().startsWith("|") && lines[i].trim().endsWith("|")) {
          rows.push(
            lines[i]
              .trim()
              .split("|")
              .slice(1, -1)
              .map((s) => s.trim())
          );
          i++;
        }
        blocks.push({ type: "table", headers, rows });
        continue;
      }
    }

    // List items: starts with * , - , + or numbers 1. , 2.
    if (/^(\s*)([*+-]|\d+\.)\s+(.+)$/.test(line)) {
      const listItems: { indent: number; text: string; bullet?: string }[] = [];
      while (i < lines.length) {
        const currentLine = lines[i];
        const match = currentLine.match(/^(\s*)([*+-]|\d+\.)\s+(.+)$/);
        if (match) {
          const indent = match[1].length;
          const bullet = match[2];
          const text = match[3];
          listItems.push({ indent, text, bullet });
          i++;
        } else if (currentLine.trim() === "") {
          // Peek ahead: is the next line also a list item?
          if (i + 1 < lines.length && /^(\s*)([*+-]|\d+\.)\s+/.test(lines[i + 1])) {
            i++;
            continue;
          }
          break;
        } else {
          break;
        }
      }
      blocks.push({ type: "list", items: listItems });
      continue;
    }

    // Normal paragraph
    blocks.push({ type: "paragraph", text: trimmed });
    i++;
  }

  return blocks;
}

// ---------------------------------------------------------------------------
// Block Rendering
// ---------------------------------------------------------------------------

function renderBlock(block: Block) {
  switch (block.type) {
    case "divider":
      return <div className="h-px bg-gradient-to-r from-transparent via-[#2d2d46] to-transparent my-3.5" />;

    case "header": {
      const isLevel1 = block.level === 1;
      const isLevel2 = block.level === 2;
      return (
        <div
          className={`flex items-center gap-2 font-bold tracking-tight ${
            isLevel1
              ? "text-lg text-white mt-4 mb-2 pb-1.5 border-b border-[#252538]"
              : isLevel2
              ? "text-[15.5px] text-white mt-3.5 mb-1.5"
              : "text-[14.5px] text-accent-light mt-3 mb-1"
          }`}
        >
          <span>{renderInline(block.text)}</span>
        </div>
      );
    }

    case "disclaimer":
      return (
        <div className="flex items-start gap-2.5 p-3 rounded-xl bg-[#0f0f18] border border-[#202033] text-[11.5px] text-slate-400 mt-3 shadow-inner">
          <Info size={14} className="text-accent-light flex-shrink-0 mt-0.5" />
          <div className="leading-relaxed italic">{renderInline(block.text)}</div>
        </div>
      );

    case "table":
      return (
        <div className="overflow-x-auto my-3 rounded-lg border border-[#26263b]">
          <table className="w-full text-left text-[12.5px]">
            <thead className="bg-[#181827] text-white font-semibold border-b border-[#26263b]">
              <tr>
                {block.headers.map((h, idx) => (
                  <th key={idx} className="px-3.5 py-2">
                    {renderInline(h)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-[#1f1f33]">
              {block.rows.map((row, rIdx) => (
                <tr key={rIdx} className="hover:bg-white/[0.02] transition-colors">
                  {row.map((cell, cIdx) => (
                    <td key={cIdx} className="px-3.5 py-2 text-slate-300">
                      {renderInline(cell)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );

    case "list":
      return (
        <div className="space-y-1.5 my-1.5">
          {block.items.map((item, idx) => {
            const isSubItem = item.indent > 1;
            const isNumbered = item.bullet && /^\d+\./.test(item.bullet);

            return (
              <div
                key={idx}
                className={`flex items-start gap-2.5 ${
                  isSubItem
                    ? "ml-5 pl-2.5 border-l-2 border-[#2b2b42] py-0.5 text-[12.5px] text-slate-300"
                    : "text-[13px] text-slate-100"
                }`}
              >
                {/* Bullet or Number Badge */}
                {!isSubItem && (
                  <span className="flex-shrink-0 mt-1">
                    {isNumbered ? (
                      <span className="w-4 h-4 rounded-full bg-accent/20 border border-accent/30 text-accent-light text-[10px] font-bold flex items-center justify-center">
                        {item.bullet?.replace(".", "")}
                      </span>
                    ) : (
                      <span className="w-1.5 h-1.5 rounded-full bg-accent-light block" />
                    )}
                  </span>
                )}

                {/* Content */}
                <div className="flex-1 leading-relaxed">{renderInline(item.text)}</div>
              </div>
            );
          })}
        </div>
      );

    case "paragraph":
      return <p className="leading-relaxed text-slate-200">{renderInline(block.text)}</p>;
  }
}

// ---------------------------------------------------------------------------
// Inline Tokenizer (Bold, Code, Italics, Currency, Parentheses)
// ---------------------------------------------------------------------------

function renderInline(text: string): React.ReactNode[] {
  // Regex to match:
  // 1. Code: `...`
  // 2. Bold: **...**
  // 3. Italic: *...* or _..._
  // 4. Currency tags: ₹[0-9,.]+
  const regex = /(`[^`]+`|\*\*[^*]+\*\*|\*[^*]+\*|₹[0-9,.]+(?:\s*(?:shares|lakhs|crores))?)/g;

  const parts = text.split(regex);
  return parts.map((part, index) => {
    if (!part) return null;

    // Inline Code / Stock Symbols: `SYMBOL`
    if (part.startsWith("`") && part.endsWith("`") && part.length > 2) {
      const code = part.slice(1, -1);
      return (
        <code
          key={index}
          className="inline-flex items-center px-1.5 py-0.5 mx-0.5 rounded-md bg-accent/15 border border-accent/30 text-accent-light font-mono text-[12px] font-semibold tracking-wide shadow-sm"
        >
          {code}
        </code>
      );
    }

    // Bold text: **text**
    if (part.startsWith("**") && part.endsWith("**") && part.length > 4) {
      const inner = part.slice(2, -2);
      return (
        <strong key={index} className="text-white font-semibold">
          {renderInline(inner)}
        </strong>
      );
    }

    // Italic text: *text*
    if (part.startsWith("*") && part.endsWith("*") && part.length > 2) {
      const inner = part.slice(1, -1);
      return (
        <em key={index} className="text-txt-secondary italic">
          {inner}
        </em>
      );
    }

    // Currency values: ₹1,300.00
    if (part.startsWith("₹")) {
      return (
        <span key={index} className="font-semibold text-emerald-300 font-mono tracking-tight">
          {part}
        </span>
      );
    }

    return <React.Fragment key={index}>{part}</React.Fragment>;
  });
}
