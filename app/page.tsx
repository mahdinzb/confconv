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
    if (b.type === "code") {
      const language = escapeHtml(b.language);
      return `<pre class="code-block language-${language}" data-language="${language}" dir="ltr"><code class="language-${language}">${escapeHtml(b.text)}</code></pre>`;
    }
    if (b.type === "list") {
      const tag = b.ordered ? "ol" : "ul";
      return `<${tag} dir="${direction(b.items.join(" "))}">${b.items.map((x) => `<li>${inline(x)}</li>`).join("")}</${tag}>`;
    }
    const [head, ...rows] = b.rows;
    return `<table dir="${direction(b.rows.flat().join(" "))}"><thead><tr>${head.map((x) => `<th>${inline(x)}</th>`).join("")}</tr></thead><tbody>${rows.map((r) => `<tr>${r.map((x) => `<td>${inline(x)}</td>`).join("")}</tr>`).join("")}</tbody></table>`;
  }).join("\n");
}

function storageMarkup(blocks: Block[]) {
  const cdata = (value: string) => value.replace(/]]>/g, "]]]]><![CDATA[>");
  return blocks.map((b) => {
    if (b.type === "rule") return "<hr />";
    if (b.type === "heading") return `<h${b.level}>${inline(b.text)}</h${b.level}>`;
    if (b.type === "paragraph") return `<p>${inline(b.text)}</p>`;
    if (b.type === "quote") {
      return `<ac:structured-macro ac:name="info"><ac:rich-text-body><p>${inline(b.text).replace(/\n/g, "<br />")}</p></ac:rich-text-body></ac:structured-macro>`;
    }
    if (b.type === "code") {
      return `<ac:structured-macro ac:name="code"><ac:parameter ac:name="language">${escapeHtml(b.language)}</ac:parameter><ac:plain-text-body><![CDATA[${cdata(b.text)}]]></ac:plain-text-body></ac:structured-macro>`;
    }
    if (b.type === "list") {
      const tag = b.ordered ? "ol" : "ul";
      return `<${tag}>${b.items.map((item) => `<li><p>${inline(item)}</p></li>`).join("")}</${tag}>`;
    }
    const [head, ...rows] = b.rows;
    return `<table><tbody><tr>${head.map((cell) => `<th><p>${inline(cell)}</p></th>`).join("")}</tr>${rows.map((row) => `<tr>${row.map((cell) => `<td><p>${inline(cell)}</p></td>`).join("")}</tr>`).join("")}</tbody></table>`;
  }).join("");
}

function wikiInline(value: string) {
  return value
    .replace(/\[([^\]]+)\]\((https?:\/\/[^)]+)\)/g, "[$1|$2]")
    .replace(/`([^`]+)`/g, "{{$1}}")
    .replace(/\*\*([^*]+)\*\*/g, "*$1*")
    .replace(/__([^_]+)__/g, "*$1*")
    .replace(/(?<!\*)\*([^*]+)\*(?!\*)/g, "_$1_");
}

function wikiMarkup(blocks: Block[]) {
  return blocks.map((block) => {
    if (block.type === "rule") return "----";
    if (block.type === "heading") return `h${block.level}. ${wikiInline(block.text)}`;
    if (block.type === "paragraph") return wikiInline(block.text);
    if (block.type === "quote") return `{quote}\n${wikiInline(block.text)}\n{quote}`;
    if (block.type === "code") {
      const supported: Record<string, string> = {
        javascript: "javascript", typescript: "javascript", js: "javascript", ts: "javascript",
        python: "python", py: "python", java: "java", sql: "sql", bash: "bash", shell: "bash",
        css: "css", html: "html/xml", xml: "html/xml", json: "javascript",
      };
      const language = supported[block.language.toLowerCase()] || "none";
      return `{code:language=${language}}\n${block.text}\n{code}`;
    }
    if (block.type === "list") {
      const marker = block.ordered ? "#" : "*";
      return block.items.map((item) => `${marker} ${wikiInline(item)}`).join("\n");
    }
    const [head, ...rows] = block.rows;
    return [`||${head.map(wikiInline).join("||")}||`, ...rows.map((row) => `|${row.map(wikiInline).join("|")}|`)].join("\n");
  }).join("\n\n");
}

export default function Home() {
  const [text, setText] = useState(sample);
  const [mode, setMode] = useState<"preview" | "wiki" | "markdown" | "storage">("wiki");
  const [copied, setCopied] = useState<"" | "rich" | "wiki" | "markdown" | "storage">("");
  const [publishOpen, setPublishOpen] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [publishResult, setPublishResult] = useState<{ ok: boolean; message: string; url?: string } | null>(null);
  const [connection, setConnection] = useState({ siteUrl: "", email: "", apiToken: "", spaceId: "", parentId: "", title: "" });
  const blocks = useMemo(() => parse(text), [text]);
  const html = useMemo(() => renderHtml(blocks), [blocks]);
  const clipboardHtml = useMemo(() =>
    `<!doctype html><html><head><meta charset="utf-8"></head><body><!--StartFragment--><div class="markdown-body" dir="auto">${html}</div><!--EndFragment--></body></html>`,
    [html]
  );
  const storage = useMemo(() => storageMarkup(blocks), [blocks]);
  const wiki = useMemo(() => wikiMarkup(blocks), [blocks]);
  const codeCount = blocks.filter((x) => x.type === "code").length;
  const tableCount = blocks.filter((x) => x.type === "table").length;

  async function copyAs(kind: "rich" | "wiki" | "markdown" | "storage") {
    if (kind === "markdown") await navigator.clipboard.writeText(text);
    else if (kind === "wiki") await navigator.clipboard.writeText(wiki);
    else if (kind === "storage") await navigator.clipboard.writeText(storage);
    else {
      const blob = new Blob([clipboardHtml], { type: "text/html" });
      const plain = new Blob([text], { type: "text/plain" });
      if (typeof ClipboardItem !== "undefined" && navigator.clipboard.write) {
        await navigator.clipboard.write([new ClipboardItem({ "text/html": blob, "text/plain": plain })]);
      } else {
        await navigator.clipboard.writeText(text);
      }
    }
    setCopied(kind); setTimeout(() => setCopied(""), 1600);
  }

  async function publishToConfluence(event: React.FormEvent) {
    event.preventDefault();
    setPublishing(true);
    setPublishResult(null);
    try {
      const response = await fetch("/api/confluence/publish", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...connection, storage }),
      });
      const result = await response.json() as { message?: string; url?: string };
      if (!response.ok) throw new Error(result.message || "انتشار انجام نشد.");
      setPublishResult({ ok: true, message: "صفحه با ساختار Native کانفلوئنس ساخته شد.", url: result.url });
      setConnection((value) => ({ ...value, apiToken: "" }));
    } catch (error) {
      setPublishResult({ ok: false, message: error instanceof Error ? error.message : "خطای ناشناخته" });
    } finally {
      setPublishing(false);
    }
  }

  return (
    <main>
      <header className="topbar">
        <div className="brand"><span className="mark">CF</span><div><strong>Conflux</strong><small>متن مرتب، آمادهٔ کانفلوئنس</small></div></div>
        <button className="publish-top" onClick={() => { setPublishOpen(true); setPublishResult(null); }}>انتشار مستقیم در Confluence</button>
      </header>
      <section className="hero">
        <div><span className="eyebrow">Persian · English · Mixed</span><h1>از متن خام تا صفحه‌ای<br />که آمادهٔ انتشار است.</h1></div>
        <p>متن، کد و جدول را تشخیص می‌دهد. برای نتیجهٔ کاملاً Native، صفحه را مستقیم در کانفلوئنس منتشر کنید؛ کپی معمولی همیشه محدودیت‌های ویرایشگر را دارد.</p>
      </section>
      <section className="toolbar">
        <div className="metrics">
          <span><b>{blocks.length}</b> بلوک</span><span><b>{codeCount}</b> کد</span><span><b>{tableCount}</b> جدول</span>
        </div>
        <div className="segmented" aria-label="نوع خروجی">
          <button className={mode === "preview" ? "active" : ""} onClick={() => setMode("preview")}>پیش‌نمایش</button>
          <button className={mode === "wiki" ? "active recommended-tab" : ""} onClick={() => setMode("wiki")}>Confluence Wiki ✓</button>
          <button className={mode === "markdown" ? "active" : ""} onClick={() => setMode("markdown")}>Markdown برای Import</button>
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
          <div className="panel-head">
            <div><span>02</span><h2>خروجی کانفلوئنس</h2></div>
            <button className={`copy ${copied ? "done" : ""}`} onClick={() => copyAs(mode === "preview" ? "rich" : mode)}>
              {copied ? "کپی شد ✓" : mode === "preview" ? "کپی مثل ChatGPT" : mode === "wiki" ? "کپی Confluence Wiki" : mode === "markdown" ? "کپی برای Import" : "کپی Storage"}
            </button>
          </div>
          {mode === "preview" && <div className="preview confluence" dangerouslySetInnerHTML={{ __html: html }} />}
          {mode === "wiki" && <textarea className="storage wiki-output" readOnly value={wiki} dir="auto" aria-label="Confluence Wiki Markup output" />}
          {mode === "markdown" && <textarea className="storage" readOnly value={text} dir="auto" aria-label="Markdown output" />}
          {mode === "storage" && <textarea className="storage" readOnly value={storage} dir="ltr" aria-label="Confluence storage format" />}
          <div className="panel-foot">
            <span>{mode === "wiki" ? "مسیر استفاده: Insert → Markup → Confluence Wiki" : mode === "preview" ? "برای Paste معمولی؛ تبدیل Code block تضمین‌شده نیست" : mode === "markdown" ? "برای Paste عادی نیست؛ مخصوص Markdown Import" : "فقط برای API؛ داخل Editor پیست نکنید"}</span>
            <span className={mode === "wiki" ? "ready" : "caution"}>{mode === "wiki" ? "پیشنهاد برای شرکت شما" : "محدودیت تبدیل"}</span>
          </div>
        </article>
      </section>
      <section className="native-cta">
        <div><span className="native-kicker">روش پیشنهادی</span><h2>بلوک واقعی می‌خواهید؟ مستقیم منتشر کنید.</h2><p>Code macro، جدول، تیتر و فهرست با Storage API خود کانفلوئنس ساخته می‌شوند؛ نه با حدس Clipboard.</p></div>
        <button onClick={() => { setPublishOpen(true); setPublishResult(null); }}>اتصال و ساخت صفحه</button>
      </section>
      <footer><span>امنیت</span> توکن API ذخیره نمی‌شود و بعد از پاسخ موفق از فرم پاک می‌شود.</footer>

      {publishOpen && (
        <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setPublishOpen(false); }}>
          <section className="modal" role="dialog" aria-modal="true" aria-labelledby="publish-title">
            <div className="modal-head"><div><span>CONFLUENCE API</span><h2 id="publish-title">ساخت صفحهٔ Native</h2></div><button aria-label="بستن" onClick={() => setPublishOpen(false)}>×</button></div>
            <div className="privacy-note"><b>اطلاعات اتصال ذخیره نمی‌شوند.</b> درخواست فقط به دامنهٔ رسمی <code>*.atlassian.net</code> شما ارسال می‌شود.</div>
            <form onSubmit={publishToConfluence}>
              <label>آدرس سایت کانفلوئنس<input required type="url" dir="ltr" placeholder="https://company.atlassian.net" value={connection.siteUrl} onChange={(e) => setConnection({ ...connection, siteUrl: e.target.value })} /></label>
              <div className="form-grid">
                <label>ایمیل اکانت<input required type="email" dir="ltr" placeholder="you@company.com" value={connection.email} onChange={(e) => setConnection({ ...connection, email: e.target.value })} /></label>
                <label>API Token<input required type="password" dir="ltr" autoComplete="off" placeholder="••••••••••••" value={connection.apiToken} onChange={(e) => setConnection({ ...connection, apiToken: e.target.value })} /></label>
              </div>
              <label>عنوان صفحه<input required placeholder="مثلاً راهنمای معماری LiteLLM" value={connection.title} onChange={(e) => setConnection({ ...connection, title: e.target.value })} /></label>
              <div className="form-grid">
                <label>Space ID<input required inputMode="numeric" dir="ltr" placeholder="123456" value={connection.spaceId} onChange={(e) => setConnection({ ...connection, spaceId: e.target.value })} /></label>
                <label>Parent Page ID <small>اختیاری</small><input inputMode="numeric" dir="ltr" placeholder="987654" value={connection.parentId} onChange={(e) => setConnection({ ...connection, parentId: e.target.value })} /></label>
              </div>
              {publishResult && <div className={`result ${publishResult.ok ? "success" : "error"}`}>{publishResult.message}{publishResult.url && <> <a href={publishResult.url} target="_blank" rel="noreferrer">باز کردن صفحه ↗</a></>}</div>}
              <div className="modal-actions"><button type="button" className="ghost-button" onClick={() => setPublishOpen(false)}>انصراف</button><button type="submit" className="submit-button" disabled={publishing || !text.trim()}>{publishing ? "در حال ساخت صفحه…" : "ساخت صفحه در کانفلوئنس"}</button></div>
            </form>
          </section>
        </div>
      )}
    </main>
  );
}
