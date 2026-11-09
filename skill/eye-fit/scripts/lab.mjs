import { SAMPLES, tokenize } from "./samples.mjs";

const esc = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

function codeHtml(langKey) {
  return tokenize(langKey)
    .map(([role, text]) => (role ? `<span class="t-${role}">${esc(text)}</span>` : esc(text)))
    .join("");
}

function variantCss(v, i) {
  const p = v.palette;
  const s = p.style;
  const sel = `.v${i}`;
  const roles = ["fg", "keyword", "fn", "type", "param", "str", "punct", "const", "comment"];
  return [
    `${sel}{background:${p.bg};color:${p.fg};border-color:${p.border}}`,
    `${sel} .desc{color:${p.comment}}`,
    `${sel} pre{background:${p.bg};color:${p.fg};font-family:"${s.font.family}",ui-monospace,Menlo,monospace;font-size:${s.font.size}px;font-weight:${s.font.weight};line-height:${s.font.lineHeight}}`,
    `${sel} pre ::selection{background:${p.sel}}`,
    ...roles.map((r) => `${sel} .t-${r}{color:${p[r]}}`),
    `${sel} .t-keyword{font-weight:${s.boldKeywords ? 700 : "inherit"}}`,
    `${sel} .t-comment{font-style:${s.italicComments ? "italic" : "normal"}}`,
  ].join("\n");
}

export function labHtml({ title, variants, blind = true }) {
  const first = variants[0].palette;
  const langs = Object.keys(SAMPLES);
  const panels = variants
    .map(
      (v, i) => `<section class="panel v${i}" data-label="${v.label}">
  <header><b>${v.label}</b><span class="desc"${blind ? " hidden" : ""}>${esc(v.desc)}</span></header>
  ${langs.map((l, j) => `<pre data-lang="${l}"${j ? " hidden" : ""}>${codeHtml(l)}</pre>`).join("\n  ")}
  ${variants.length > 1 || blind ? `<footer><label>Score <select><option value="">-</option>${[...Array(10)].map((_, k) => `<option>${k + 1}</option>`).join("")}</select></label><input type="text" placeholder="What do you notice? (optional)"></footer>` : ""}
</section>`,
    )
    .join("\n");
  const rounds = JSON.stringify(variants.map((v) => ({ label: v.label, desc: v.desc })));
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)}</title>
<style>
:root{--bg:${first.bg};--fg:${first.fg};--muted:${first.comment};--line:${first.border}}
*{box-sizing:border-box}
body{margin:0;background:var(--bg);color:var(--fg);font:15px/1.5 system-ui,sans-serif}
.bar{display:flex;flex-wrap:wrap;gap:12px;align-items:center;padding:12px 16px;border-bottom:1px solid var(--line);position:sticky;top:0;background:var(--bg);z-index:1}
.bar h1{font-size:16px;margin:0 12px 0 0}
button,select,input{font:inherit;color:inherit;background:none;border:1px solid var(--line);border-radius:6px;padding:4px 10px}
button[aria-pressed=true]{background:var(--line)}
.hint{color:var(--muted);font-size:13px;margin:12px 16px 0}
.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,580px),1fr));gap:16px;padding:16px}
.panel{border:1px solid var(--line);border-radius:8px;overflow:hidden}
.panel header,.panel footer{display:flex;gap:12px;align-items:center;padding:8px 12px}
.panel header b{font-size:20px}
.desc{color:var(--muted);font-size:13px}
.panel footer input{flex:1;min-width:0}
pre{margin:0;padding:16px;overflow-x:auto;tab-size:4}
${variants.map(variantCss).join("\n")}
</style>
</head>
<body>
<div class="bar">
  <h1>${esc(title)}</h1>
  ${langs.map((l, j) => `<button data-lang="${l}" aria-pressed="${!j}">${SAMPLES[l].label}</button>`).join("")}
  ${variants.length > 1 ? `<button id="reveal">Show settings</button><button id="copy">Copy results</button><span id="copied" class="desc"></span>` : ""}
</div>
<textarea id="out" hidden rows="6" style="width:calc(100% - 32px);margin:12px 16px 0"></textarea>
${variants.length > 1 ? `<p class="hint">Read each panel for a minute at your normal distance and screen brightness. Score how comfortable it is, not how pretty. Then press "Copy results" and paste them back to Claude.</p>` : ""}
<main class="grid">
${panels}
</main>
<script>
const rounds = ${rounds};
document.querySelectorAll(".bar button[data-lang]").forEach((b) => b.onclick = () => {
  document.querySelectorAll(".bar button[data-lang]").forEach((x) => x.setAttribute("aria-pressed", x === b));
  document.querySelectorAll("pre").forEach((p) => p.hidden = p.dataset.lang !== b.dataset.lang);
});
const reveal = document.getElementById("reveal");
if (reveal) reveal.onclick = () => document.querySelectorAll(".desc").forEach((d) => d.hidden = !d.hidden);
const copy = document.getElementById("copy");
if (copy) copy.onclick = async () => {
  const lines = [...document.querySelectorAll(".panel")].map((p, i) => {
    const score = p.querySelector("select").value || "?";
    const note = p.querySelector("footer input").value.trim();
    return rounds[i].label + " (" + rounds[i].desc + "): " + score + "/10" + (note ? " - " + note : "");
  });
  const text = ${JSON.stringify(title)} + "\\n" + lines.join("\\n");
  try { await navigator.clipboard.writeText(text); document.getElementById("copied").textContent = "Copied"; }
  catch { const out = document.getElementById("out"); out.hidden = false; out.value = text; out.select(); }
};
</script>
</body>
</html>
`;
}
