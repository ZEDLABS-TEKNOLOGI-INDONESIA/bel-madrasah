import { spawn } from "node:child_process";
import { existsSync } from "node:fs";

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const CANDIDATES = [
  process.env.CHROME_BIN,
  "/usr/bin/chromium",
  "/usr/bin/chromium-browser",
  "/usr/bin/google-chrome",
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
].filter(Boolean);

export async function launchChrome(profileDir, port = 9339) {
  const bin = CANDIDATES.find((c) => existsSync(c));
  if (!bin) throw new Error("Chromium tidak ditemukan. Set CHROME_BIN.");
  const proc = spawn(
    bin,
    [
      "--headless=new",
      `--remote-debugging-port=${port}`,
      "--no-first-run",
      "--disable-gpu",
      "--hide-scrollbars",
      "--autoplay-policy=no-user-gesture-required",
      ...(process.env.CI ? ["--no-sandbox"] : []),
      `--user-data-dir=${profileDir}`,
      "about:blank",
    ],
    { stdio: "ignore" },
  );
  return { port, kill: () => proc.kill() };
}

export class CdpPage {
  static async open(port) {
    let target;
    for (let i = 0; i < 100 && !target; i++) {
      try {
        const list = await (await fetch(`http://127.0.0.1:${port}/json`)).json();
        target = list.find((t) => t.type === "page");
      } catch {}
      if (!target) await sleep(100);
    }
    if (!target) throw new Error("Chromium tidak merespons");
    const page = new CdpPage(new WebSocket(target.webSocketDebuggerUrl));
    await new Promise((r) => (page.ws.onopen = r));
    await page.send("Page.enable");
    await page.send("Runtime.enable");
    return page;
  }

  constructor(ws) {
    this.ws = ws;
    this.id = 0;
    this.pending = new Map();
    this.errors = [];
    ws.onmessage = (m) => {
      const msg = JSON.parse(m.data);
      if (msg.id && this.pending.has(msg.id)) {
        this.pending.get(msg.id)(msg);
        this.pending.delete(msg.id);
      } else if (msg.method === "Runtime.exceptionThrown") {
        this.errors.push(msg.params.exceptionDetails.exception?.description ?? "exception");
      } else if (msg.method === "Runtime.consoleAPICalled" && msg.params.type === "error") {
        this.errors.push(msg.params.args.map((a) => a.value ?? a.description).join(" "));
      }
    };
  }

  send(method, params = {}) {
    return new Promise((r) => {
      const id = ++this.id;
      this.pending.set(id, r);
      this.ws.send(JSON.stringify({ id, method, params }));
    });
  }

  async eval(expression) {
    const res = await this.send("Runtime.evaluate", {
      expression,
      returnByValue: true,
      awaitPromise: true,
    });
    if (res.result?.exceptionDetails) throw new Error(res.result.exceptionDetails.text);
    return res.result?.result?.value;
  }

  async viewport(width, height) {
    await this.send("Emulation.setDeviceMetricsOverride", {
      width,
      height,
      deviceScaleFactor: 1,
      mobile: width < 768,
    });
  }

  async goto(url) {
    await this.send("Page.navigate", { url });
    for (let i = 0; i < 60; i++) {
      await sleep(100);
      const ready = await this.eval(
        `document.readyState === "complete" && !document.body.textContent.includes("Memuat...") && !document.querySelector("[style*=shimmer]")`,
      ).catch(() => false);
      if (ready) break;
    }
    await sleep(400);
  }

  setCookie(name, value, url) {
    return this.send("Network.setCookie", { name, value, url });
  }

  clearCookies() {
    return this.send("Network.clearBrowserCookies");
  }

  async waitFor(expression, timeout = 3000) {
    const end = Date.now() + timeout;
    while (Date.now() < end) {
      if (await this.eval(expression).catch(() => false)) return true;
      await sleep(100);
    }
    return false;
  }

  exists(selector) {
    return this.eval(`!!document.querySelector(${JSON.stringify(selector)})`);
  }

  async click(selector) {
    const ok = await this.eval(
      `(() => { const el = document.querySelector(${JSON.stringify(selector)}); if (!el) return false; el.click(); return true; })()`,
    );
    if (!ok) throw new Error(`elemen tidak ditemukan: ${selector}`);
    await sleep(400);
  }

  async clickText(selector, text) {
    const ok = await this.eval(
      `(() => { const el = [...document.querySelectorAll(${JSON.stringify(selector)})].find((b) => b.textContent.trim() === ${JSON.stringify(text)}); if (!el) return false; el.click(); return true; })()`,
    );
    if (!ok) throw new Error(`tombol tidak ditemukan: ${text}`);
    await sleep(300);
  }

  async type(selector, value) {
    await this.setValue(selector, value, "HTMLInputElement", "input");
  }

  async select(selector, value) {
    await this.setValue(selector, value, "HTMLSelectElement", "change");
  }

  async setValue(selector, value, proto, event) {
    const ok = await this.eval(`(() => {
      const el = document.querySelector(${JSON.stringify(selector)});
      if (!el) return false;
      Object.getOwnPropertyDescriptor(${proto}.prototype, "value").set.call(el, ${JSON.stringify(value)});
      el.dispatchEvent(new Event(${JSON.stringify(event)}, { bubbles: true }));
      return true;
    })()`);
    if (!ok) throw new Error(`elemen tidak ditemukan: ${selector}`);
    await sleep(200);
  }

  toasts() {
    return this.eval(
      `[...document.querySelectorAll("[role=status]")].map((e) => e.textContent).join(" | ")`,
    );
  }

  api(path) {
    return this.eval(
      `fetch(${JSON.stringify(path)}, { credentials: "include", headers: { Accept: "application/json" } }).then((r) => r.json())`,
    );
  }
}
