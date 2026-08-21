import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

async function render() {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);

  return worker.fetch(
    new Request("http://localhost/", {
      headers: { accept: "text/html" },
    }),
    {
      ASSETS: {
        fetch: async () => new Response("Not found", { status: 404 }),
      },
    },
    {
      waitUntil() {},
      passThroughOnException() {},
    },
  );
}

test("server-renders the ConfConv workspace", async () => {
  const response = await render();
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);

  const html = await response.text();
  assert.match(html, /<title>ConfConv — Confluence Content Converter<\/title>/i);
  assert.match(html, /Smart View/);
  assert.match(html, /Confluence Wiki/);
  assert.match(html, /راهنمای استقرار/);
  assert.doesNotMatch(html, /Your site is taking shape|Codex is working/);
});

test("adds accessible per-block copy controls with readable code selection", async () => {
  const [page, css, staticApp, staticCss, staticHtml] = await Promise.all([
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/workspace.css", import.meta.url), "utf8"),
    readFile(new URL("../docs/app.js", import.meta.url), "utf8"),
    readFile(new URL("../docs/styles.css", import.meta.url), "utf8"),
    readFile(new URL("../docs/index.html", import.meta.url), "utf8"),
  ]);

  assert.match(page, /data-code-copy/);
  assert.match(page, /onClick=\{copyCodeBlock\}/);
  assert.match(page, /renderHtml\(blocks, true\)/);
  assert.match(css, /pre code::selection\s*\{[^}]*color:#17241e/);
  assert.match(staticApp, /data-code-copy/);
  assert.match(staticApp, /preview\.addEventListener\("click"/);
  assert.match(staticApp, /html\(blocks,true\)/);
  assert.match(staticCss, /pre code::selection\{[^}]*color:#17241e/);
  assert.match(staticHtml, /styles\.css\?v=20260821-1/);
  assert.match(staticHtml, /app\.js\?v=20260821-1/);
});

test("adds clipboard replacement and an accessible resizable workspace", async () => {
  const [page, css, staticApp, staticCss, staticHtml] = await Promise.all([
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/workspace.css", import.meta.url), "utf8"),
    readFile(new URL("../docs/app.js", import.meta.url), "utf8"),
    readFile(new URL("../docs/styles.css", import.meta.url), "utf8"),
    readFile(new URL("../docs/index.html", import.meta.url), "utf8"),
  ]);

  assert.match(page, /navigator\.clipboard\.readText\(\)/);
  assert.match(page, /role="separator"/);
  assert.match(page, /aria-valuemin=\{25\}/);
  assert.match(page, /onPointerDown=\{startResize\}/);
  assert.match(page, /onKeyDown=\{resizeWithKeyboard\}/);
  assert.match(css, /--input-pane-width:50%/);
  assert.match(css, /workspace-divider/);
  assert.match(staticApp, /navigator\.clipboard\.readText\(\)/);
  assert.match(staticApp, /setPointerCapture/);
  assert.match(staticApp, /ArrowLeft:current-2/);
  assert.match(staticCss, /--input-pane-width:50%/);
  assert.match(staticHtml, /id="paste"/);
  assert.match(staticHtml, /role="separator"/);
  assert.match(staticHtml, /styles\.css\?v=20260821-1/);
  assert.match(staticHtml, /app\.js\?v=20260821-1/);
});
