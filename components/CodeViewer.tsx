"use client";

import { useState } from "react";

export default function CodeViewer({ code }: { code: string }) {
  const [copied, setCopied] = useState(false);

  async function copyCode() {
    await navigator.clipboard.writeText(code);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1400);
  }

  return (
    <div className="code-shell">
      <div className="code-toolbar">
        <span>Generated solution</span>
        <button onClick={copyCode}>{copied ? "Copied ✓" : "Copy code"}</button>
      </div>
      <pre><code>{code}</code></pre>
    </div>
  );
}
