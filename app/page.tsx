"use client";

import { useMemo, useState } from "react";
import "./workspace.css";

type Block =
  | { type: "heading"; level: number; text: string }
  | { type: "paragraph"; text: string }
  | { type: "quote"; text: string }
  | { type: "code"; language: string; text: string }
  | { type: "list"; ordered: boolean; items: string[] }
  | { type: "table"; rows: string[][]; header: boolean }
  | { type: "rule" };

const sample = `# راهنمای استقرار / Deployment Guide

این سرویس درخواست‌های کاربران را پردازش می‌کند و نتیجه را در cache نگه می‌دارد.

## مراحل اجرا
1. متغیرهای محیطی را تنظیم کنید
2. تست‌ها را اجرا کنید
3. نسخهٔ نهایی را deploy کنید

\`\`\`typescript
const message = "سلام Confluence!";
console.log(message);
\`\`\`

| وضعیت | Status | توضیح |
| --- | --- | --- |
| آماده | Ready | قابل انتشار |
| بررسی | Review | نیازمند تأیید |

> نکته: قبل از انتشار، خروجی را یک‌بار بررسی کنید.`;

const escapeHtml = (value: string) =>
  value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

function inline(value: string) {
  return escapeHtml(value)
    .replace(/`([^`]+)`/g, "<code>$1</code>")
    .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
    .replace(/__([^_]+)__/g, "<strong>$1</strong>")
    .replace(/(?<!\*)\*([^*]+)\*(?!\*)/g, "<em>$1</em>")
    .replace(/\[([^\]]+)\]\((https?:\/\/[^)]+)\)/g, '<a href="$2">$1</a>');
}

function direction(text: string) {
  const rtl = (text.match(/[\u0600-\u06ff]/g) || []).length;
  const latin = (text.match(/[A-Za-z]/g) || []).length;
  return rtl > latin * 0.45 ? "rtl" : "ltr";
}

function splitRow(line: string) {
  return line.trim().replace(/^\||\|$/g, "").split("|").map((x) => x.trim());
}

function parse(source: string): Block[] {
  const lines = source.replace(/\r/g, "").split("\n");
  const blocks: Block[] = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    if (!line.trim()) { i++; continue; }
    const fence = line.match(/^```([\w#+.-]*)\s*$/);
    if (fence) {
      const body: string[] = [];
      i++;
      while (i < lines.length && !/^```\s*$/.test(lines[i])) body.push(lines[i++]);
      i++;
      blocks.push({ type: "code", language: fence[1] || detectLanguage(body.join("\n")), text: body.join("\n") });
      continue;
    }
    const heading = line.match(/^(#{1,6})\s+(.+)$/);
    if (heading) { blocks.push({ type: "heading", level: heading[1].length, text: heading[2] }); i++; continue; }
    if (/^(\s*[-*_]){3,}\s*$/.test(line)) { blocks.push({ type: "rule" }); i++; continue; }
    if (/^>\s?/.test(line)) {
      const q: string[] = [];
      while (i < lines.length && /^>\s?/.test(lines[i])) q.push(lines[i++].replace(/^>\s?/, ""));
      blocks.push({ type: "quote", text: q.join("\n") }); continue;
    }
    if (line.includes("|") && i + 1 < lines.length && /^\s*\|?[\s:|-]+\|[\s:|-]+/.test(lines[i + 1])) {
      const rows = [splitRow(line)]; i += 2;
      while (i < lines.length && lines[i].includes("|") && lines[i].trim()) rows.push(splitRow(lines[i++]));
      blocks.push({ type: "table", rows, header: true }); continue;
    }
    const list = line.match(/^\s*(?:([-+*])|(\d+)[.)])\s+(.+)$/);
    if (list) {
      const ordered = Boolean(list[2]); const items: string[] = [];
      while (i < lines.length) {
        const item = lines[i].match(/^\s*(?:([-+*])|(\d+)[.)])\s+(.+)$/);
        if (!item || Boolean(item[2]) !== ordered) break;
        items.push(item[3]); i++;
      }
      blocks.push({ type: "list", ordered, items }); continue;
    }
    if (/^( {4}|\t)/.test(line)) {
      const body: string[] = [];
      while (i < lines.length && (/^( {4}|\t)/.test(lines[i]) || !lines[i].trim())) body.push(lines[i++].replace(/^( {4}|\t)/, ""));
      blocks.push({ type: "code", language: detectLanguage(body.join("\n")), text: body.join("\n").trimEnd() }); continue;
    }
    const paragraph = [line.trim()]; i++;
    while (i < lines.length && lines[i].trim() && !/^(#{1,6})\s|^```|^>\s?|^\s*(?:[-+*]|\d+[.)])\s+/.test(lines[i])) {
      if (lines[i].includes("|") && i + 1 < lines.length && /^\s*\|?[\s:|-]+\|/.test(lines[i + 1])) break;
      paragraph.push(lines[i++].trim());
    }
    blocks.push({ type: "paragraph", text: paragraph.join(" ") });
  }
  return blocks;
}

function detectLanguage(code: string) {
  if (/^\s*[{[]/.test(code) && /":\s*/.test(code)) return "json";
  if (/\b(const|let|function|console\.log|=>)\b/.test(code)) return "javascript";
  if (/\b(def|import|print|elif)\b/.test(code)) return "python";
  if (/<\/?[a-z][\s\S]*>/i.test(code)) return "html";
  if (/\b(SELECT|FROM|WHERE|INSERT)\b/i.test(code)) return "sql";
  if (/\b(class|public static|System\.out)\b/.test(code)) return "java";
  return "text";
}

function renderHtml(blocks: Block[]) {
  return blocks.map((b) => {
    if (b.type === "rule") return "<hr />";
    if (b.type === "heading") return `<h${b.level} dir="${direction(b.text)}">${inline(b.text)}</h${b.level}>`;
    if (b.type === "paragraph") return `<p dir="${direction(b.text)}">${inline(b.text)}</p>`;
    if (b.type === "quote") return `<blockquote dir="${direction(b.text)}">${inline(b.text).replace(/\n/g, "<br />")}</blockquote>`;
    if (b.type === "code") return `<pre data-language="${b.language}" dir="ltr"><code>${escapeHtml(b.text)}</code></pre>`;
    if (b.type === "list") {
      const tag = b.ordered ? "ol" : "ul";
      return `<${tag} dir="${direction(b.items.join(" "))}">${b.items.map((x) => `<li>${inline(x)}</li>`).join("")}</${tag}>`;
    }
    const [head, ...rows] = b.rows;
    return `<table dir="${direction(b.rows.flat().join(" "))}"><thead><tr>${head.map((x) => `<th>${inline(x)}</th>`).join("")}</tr></thead><tbody>${rows.map((r) => `<tr>${r.map((x) => `<td>${inline(x)}</td>`).join("")}</tr>`).join("")}</tbody></table>`;
  }).join("\n");
}

function storageMarkup(blocks: Block[]) {
  return renderHtml(blocks).replace(
    /<pre data-language="([^"]+)" dir="ltr"><code>([\s\S]*?)<\/code><\/pre>/g,
    '<ac:structured-macro ac:name="code"><ac:parameter ac:name="language">$1</ac:parameter><ac:plain-text-body><![CDATA[$2]]></ac:plain-text-body></ac:structured-macro>'
  );
}

export default function Home() {
  const [text, setText] = useState(sample);
  const [mode, setMode] = useState<"preview" | "storage">("preview");
  const [copied, setCopied] = useState(false);
  const blocks = useMemo(() => parse(text), [text]);
  const html = useMemo(() => renderHtml(blocks), [blocks]);
  const storage = useMemo(() => storageMarkup(blocks), [blocks]);
  const codeCount = blocks.filter((x) => x.type === "code").length;
  const tableCount = blocks.filter((x) => x.type === "table").length;

  async function copyAll() {
    if (mode === "storage") await navigator.clipboard.writeText(storage);
    else {
      const blob = new Blob([html], { type: "text/html" });
      const plain = new Blob([text], { type: "text/plain" });
      await navigator.clipboard.write([new ClipboardItem({ "text/html": blob, "text/plain": plain })]);
    }
    setCopied(true); setTimeout(() => setCopied(false), 1600);
  }

  return (
    <main>
      <header className="topbar">
        <div className="brand"><span className="mark">CF</span><div><strong>Conflux</strong><small>متن مرتب، آمادهٔ کانفلوئنس</small></div></div>
        <div className="status"><span></span>پردازش کاملاً داخل مرورگر</div>
      </header>
      <section className="hero">
        <div><span className="eyebrow">Persian · English · Mixed</span><h1>از متن خام تا صفحه‌ای<br />که آمادهٔ انتشار است.</h1></div>
        <p>متن، کد، جدول و ساختار را خودکار تشخیص می‌دهد؛ جهت فارسی و انگلیسی را برای هر بخش جداگانه تنظیم می‌کند.</p>
      </section>
      <section className="toolbar">
        <div className="metrics">
          <span><b>{blocks.length}</b> بلوک</span><span><b>{codeCount}</b> کد</span><span><b>{tableCount}</b> جدول</span>
        </div>
        <div className="segmented" aria-label="نوع خروجی">
          <button className={mode === "preview" ? "active" : ""} onClick={() => setMode("preview")}>پیش‌نمایش</button>
          <button className={mode === "storage" ? "active" : ""} onClick={() => setMode("storage")}>Storage format</button>
        </div>
      </section>
      <section className="workspace">
        <article className="panel input-panel">
          <div className="panel-head"><div><span>01</span><h2>متن ورودی</h2></div><button className="ghost" onClick={() => setText("")}>پاک کردن</button></div>
          <textarea value={text} onChange={(e) => setText(e.target.value)} spellCheck dir="auto" aria-label="متن ورودی" placeholder="متن فارسی، انگلیسی یا ترکیبی را اینجا بچسبانید…" />
          <div className="panel-foot"><span>Markdown و متن ساده</span><span>{text.length.toLocaleString("fa-IR")} کاراکتر</span></div>
        </article>
        <article className="panel output-panel">
          <div className="panel-head"><div><span>02</span><h2>خروجی کانفلوئنس</h2></div><button className={`copy ${copied ? "done" : ""}`} onClick={copyAll}>{copied ? "کپی شد ✓" : "کپی کامل"}</button></div>
          {mode === "preview" ? <div className="preview confluence" dangerouslySetInnerHTML={{ __html: html }} /> : <textarea className="storage" readOnly value={storage} dir="ltr" aria-label="Confluence storage format" />}
          <div className="panel-foot"><span>جهت هر بلوک: خودکار</span><span className="ready">آمادهٔ Paste</span></div>
        </article>
      </section>
      <footer><span>نکته</span> برای بهترین نتیجه، خروجی «پیش‌نمایش» را کپی و مستقیماً داخل ویرایشگر کانفلوئنس Paste کنید.</footer>
    </main>
  );
}
