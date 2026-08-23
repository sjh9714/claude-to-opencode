/* dsh-movein client bundle */
window.__ModuleLoader__.load({
  id: "dsh-movein",
  factory: (require) => {
    var module = { exports: {} };
    var exports = module.exports;
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/client/index.jsx
var index_exports = {};
__export(index_exports, {
  apply: () => apply,
  inject: () => inject
});
module.exports = __toCommonJS(index_exports);

// src/client/MoveInSettings.jsx
var import_react = __toESM(require("react"), 1);
var import_jsx_runtime = require("react/jsx-runtime");
var CATEGORIES = ["instructions", "skills", "commands", "agents", "hooks", "permissions", "mcp"];
async function requestMovein(payload) {
  const response = await fetch("/dsh-movein/run", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload)
  });
  const result = await response.json();
  if (!response.ok || result.error) throw new Error(result.error || `request failed with ${response.status}`);
  return result;
}
function MoveInSettings({ t }) {
  const [project, setProject] = (0, import_react.useState)("");
  const [origin, setOrigin] = (0, import_react.useState)("claude");
  const [selected, setSelected] = (0, import_react.useState)(() => new Set(CATEGORIES));
  const [phase, setPhase] = (0, import_react.useState)("idle");
  const [result, setResult] = (0, import_react.useState)(null);
  const [error, setError] = (0, import_react.useState)("");
  const busy = phase === "working";
  const include = (0, import_react.useMemo)(() => CATEGORIES.filter((id) => selected.has(id)), [selected]);
  const toggle = (id) => {
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };
  const run = async (apply2) => {
    setPhase("working");
    setError("");
    try {
      const next = await requestMovein({ project, origin, apply: apply2, include });
      setResult(next);
      setPhase("ready");
    } catch (nextError) {
      setError(String(nextError?.message || nextError));
      setPhase("error");
    }
  };
  return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", { className: "dmi-page", children: [
    /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("header", { className: "dmi-head", children: [
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", { className: "dmi-eyebrow", children: t("eyebrow") }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", { className: "dmi-title", children: t("title") }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", { className: "dmi-intro", children: t("intro") })
    ] }),
    /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: "dmi-block", children: [
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("label", { className: "dmi-label", htmlFor: "dmi-project", children: t("source") }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
        "input",
        {
          id: "dmi-project",
          className: "dmi-input",
          value: project,
          onChange: (event) => setProject(event.target.value),
          placeholder: "C:\\\\work\\\\project",
          spellCheck: "false"
        }
      ),
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", { className: "dmi-hint", children: t("sourceHint") })
    ] }),
    /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("fieldset", { className: "dmi-block", style: { borderLeft: 0, borderRight: 0, borderTop: 0, margin: 0 }, children: [
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("legend", { className: "dmi-legend", children: t("categories") }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "dmi-grid", children: CATEGORIES.map((id) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", { className: "dmi-choice", children: [
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", { type: "checkbox", checked: selected.has(id), onChange: () => toggle(id) }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: t(id) })
      ] }, id)) })
    ] }),
    /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("details", { className: "dmi-details", children: [
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("summary", { children: t("otherOrigins") }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", { className: "dmi-hint", children: t("originNote") }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "dmi-origins", children: ["claude", "codex", "opencode"].map((id) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", { className: "dmi-origin", children: [
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", { type: "radio", name: "dmi-origin", checked: origin === id, onChange: () => setOrigin(id) }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: t(id) })
      ] }, id)) })
    ] }),
    /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: "dmi-actions", children: [
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", { className: "dmi-button", type: "button", disabled: busy || include.length === 0, onClick: () => run(false), children: busy ? t("working") : t("preview") }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", { className: "dmi-button dmi-primary", type: "button", disabled: busy || include.length === 0, onClick: () => run(true), children: t("apply") }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: "dmi-hint", children: t("dryRun") })
    ] }),
    error && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "dmi-error", role: "alert", children: error }),
    result && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", { className: "dmi-result", "aria-live": "polite", children: [
      /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: "dmi-resultHead", children: [
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("h3", { children: result.ok ? result.applied ? t("resultApplied") : t("resultPreview") : t("resultBlocked") }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: "dmi-status", children: result.origin })
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", { className: "dmi-project", children: result.project }),
      result.actions.length === 0 ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", { className: "dmi-hint", children: t("noActions") }) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)("ul", { className: "dmi-list", children: result.actions.map((action, index) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("li", { className: "dmi-row", "data-status": action.status, children: [
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: "dmi-status", children: action.status }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "dmi-rowTitle", children: action.label }),
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "dmi-rowNote", children: action.note })
        ] })
      ] }, `${action.label}-${index}`)) }),
      result.notices.length > 0 && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: "dmi-warning", children: [
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("strong", { children: t("conflicts") }),
        result.notices.map((notice, index) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { children: notice.message }, index))
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("details", { className: "dmi-report", children: [
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("summary", { children: t("fullReport") }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("pre", { children: result.report })
      ] }),
      result.starPrompt && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("a", { className: "dmi-star", href: "https://github.com/sjh9714/dsh-movein", target: "_blank", rel: "noreferrer", children: t("star") })
    ] })
  ] });
}

// src/client/styles.js
var STYLES = [
  ".dmi-page{max-width:820px;padding:8px 4px 32px;color:var(--dsw-alias-label-primary,CanvasText)}",
  ".dmi-head{padding:8px 0 22px;border-bottom:1px solid var(--dsw-alias-border-line,rgba(0,0,0,.14))}",
  ".dmi-eyebrow{margin:0 0 8px;font-size:11px;font-weight:700;letter-spacing:.12em;color:var(--dsw-alias-state-success-primary,#167c4c)}",
  ".dmi-title{margin:0;font-size:28px;line-height:1.15;letter-spacing:-.02em}",
  ".dmi-intro{max-width:620px;margin:9px 0 0;color:var(--dsw-alias-label-secondary,inherit);line-height:1.55}",
  ".dmi-block{padding:22px 0;border-bottom:1px solid var(--dsw-alias-border-line,rgba(0,0,0,.12))}",
  ".dmi-label,.dmi-legend{display:block;margin:0 0 9px;font-size:13px;font-weight:650}",
  ".dmi-input{box-sizing:border-box;width:100%;height:40px;padding:0 12px;border:1px solid var(--dsw-alias-border-line,rgba(0,0,0,.22));border-radius:7px;background:var(--dsw-alias-bg-layer-1,Canvas);color:inherit;font:inherit}",
  ".dmi-input:focus{outline:2px solid var(--dsw-alias-state-success-primary,#167c4c);outline-offset:1px}",
  ".dmi-hint{margin:7px 0 0;font-size:12px;color:var(--dsw-alias-label-secondary,inherit)}",
  ".dmi-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px}",
  ".dmi-choice{display:flex;align-items:center;gap:9px;min-height:40px;padding:0 11px;border:1px solid var(--dsw-alias-border-line,rgba(0,0,0,.16));border-radius:7px;cursor:pointer}",
  ".dmi-choice:has(input:checked){border-color:var(--dsw-alias-state-success-primary,#167c4c);background:color-mix(in srgb,var(--dsw-alias-state-success-primary,#167c4c) 7%,transparent)}",
  ".dmi-choice input{accent-color:var(--dsw-alias-state-success-primary,#167c4c)}",
  ".dmi-details{padding:14px 0;border-bottom:1px solid var(--dsw-alias-border-line,rgba(0,0,0,.12))}",
  ".dmi-details summary{cursor:pointer;font-size:13px;font-weight:650}",
  ".dmi-origins{display:flex;gap:8px;margin-top:12px;flex-wrap:wrap}",
  ".dmi-origin{display:flex;align-items:center;gap:7px;padding:7px 10px;border:1px solid var(--dsw-alias-border-line,rgba(0,0,0,.16));border-radius:999px;cursor:pointer}",
  ".dmi-actions{display:flex;align-items:center;gap:10px;padding:20px 0 8px;flex-wrap:wrap}",
  ".dmi-button{min-height:40px;padding:0 15px;border-radius:7px;border:1px solid var(--dsw-alias-border-line,rgba(0,0,0,.2));background:transparent;color:inherit;font:inherit;font-weight:650;cursor:pointer}",
  ".dmi-button:hover:not(:disabled){border-color:var(--dsw-alias-state-success-primary,#167c4c)}",
  ".dmi-primary{border-color:var(--dsw-alias-state-success-primary,#167c4c);background:var(--dsw-alias-state-success-primary,#167c4c);color:var(--dsw-alias-label-primary-foreground,#fff)}",
  ".dmi-button:disabled{opacity:.5;cursor:not-allowed}",
  ".dmi-result{margin-top:18px;padding-top:18px;border-top:2px solid var(--dsw-alias-label-primary,CanvasText)}",
  ".dmi-resultHead{display:flex;align-items:baseline;justify-content:space-between;gap:12px}",
  ".dmi-resultHead h3{margin:0;font-size:18px}",
  ".dmi-project{margin:4px 0 14px;overflow-wrap:anywhere;font:12px ui-monospace,monospace;color:var(--dsw-alias-label-secondary,inherit)}",
  ".dmi-list{list-style:none;margin:0;padding:0}",
  ".dmi-row{display:grid;grid-template-columns:64px minmax(0,1fr);gap:10px;padding:10px 0;border-top:1px solid var(--dsw-alias-border-line,rgba(0,0,0,.1))}",
  ".dmi-status{font-size:11px;font-weight:700;text-transform:uppercase;color:var(--dsw-alias-label-secondary,inherit)}",
  '.dmi-row[data-status="done"] .dmi-status,.dmi-row[data-status="move"] .dmi-status{color:var(--dsw-alias-state-success-primary,#167c4c)}',
  '.dmi-row[data-status="error"] .dmi-status{color:var(--dsw-alias-state-warn-primary,#b3312d)}',
  ".dmi-rowTitle{font-size:13px;font-weight:600;overflow-wrap:anywhere}",
  ".dmi-rowNote{margin-top:3px;font-size:12px;line-height:1.45;color:var(--dsw-alias-label-secondary,inherit);overflow-wrap:anywhere}",
  ".dmi-warning{margin:12px 0 0;padding:11px 12px;border-left:3px solid var(--dsw-alias-state-warn-primary,#b36b00);background:color-mix(in srgb,var(--dsw-alias-state-warn-primary,#b36b00) 8%,transparent);font-size:12px;line-height:1.5}",
  ".dmi-report{margin-top:12px}",
  ".dmi-report summary{cursor:pointer;font-size:12px;font-weight:650}",
  ".dmi-report pre{max-height:340px;overflow:auto;margin:9px 0 0;padding:12px;border-radius:7px;background:var(--dsw-alias-bg-layer-1,#111);font:11px/1.5 ui-monospace,monospace;white-space:pre-wrap}",
  ".dmi-star{display:inline-block;margin-top:15px;color:var(--dsw-alias-state-success-primary,#167c4c);font-size:13px;font-weight:700}",
  ".dmi-error{margin-top:16px;padding:12px;border-left:3px solid var(--dsw-alias-state-warn-primary,#b3312d);background:color-mix(in srgb,var(--dsw-alias-state-warn-primary,#b3312d) 8%,transparent)}",
  "@media(max-width:640px){.dmi-grid{grid-template-columns:1fr}.dmi-title{font-size:24px}.dmi-row{grid-template-columns:52px minmax(0,1fr)}}",
  "@media(prefers-reduced-motion:no-preference){.dmi-button{transition:background-color .15s ease,border-color .15s ease}}"
].join("");

// src/client/locales.js
var en = {
  nav: "Move in",
  eyebrow: "CLAUDE CODE TO DSH",
  title: "Import your setup",
  intro: "Preview every change before DSH writes anything. Existing destinations stay untouched.",
  source: "Project folder",
  sourceHint: "Leave empty to use the folder where DSH started",
  categories: "Choose what moves",
  instructions: "Instructions",
  skills: "Skills",
  commands: "Commands",
  agents: "Agents",
  hooks: "Hooks",
  permissions: "Permission rules",
  mcp: "MCP servers",
  otherOrigins: "Codex and OpenCode",
  originNote: "Claude Code stays the primary path. Use these only when that is where your setup lives.",
  claude: "Claude Code",
  codex: "Codex",
  opencode: "OpenCode",
  preview: "Preview changes",
  apply: "Apply selected",
  working: "Scanning local files",
  dryRun: "Preview mode writes nothing",
  resultPreview: "Preview ready",
  resultApplied: "Import finished",
  resultBlocked: "Import blocked",
  noActions: "Nothing was found for the selected categories.",
  conflicts: "Conflicts and unsupported items",
  fullReport: "Open full report",
  star: "If this saved you setup time, star dsh-movein",
  retry: "Try again"
};
var zh = {
  nav: "\u8FC1\u5165\u8BBE\u7F6E",
  eyebrow: "CLAUDE CODE \u8FC1\u5165 DSH",
  title: "\u5BFC\u5165\u4F60\u7684\u5F00\u53D1\u73AF\u5883",
  intro: "\u5148\u9884\u89C8\u6240\u6709\u53D8\u5316\uFF0C\u518D\u51B3\u5B9A\u662F\u5426\u5199\u5165\u3002\u5DF2\u6709\u76EE\u6807\u6587\u4EF6\u4E0D\u4F1A\u88AB\u8986\u76D6\u3002",
  source: "\u9879\u76EE\u6587\u4EF6\u5939",
  sourceHint: "\u7559\u7A7A\u65F6\u4F7F\u7528 DSH \u542F\u52A8\u6240\u5728\u7684\u6587\u4EF6\u5939",
  categories: "\u9009\u62E9\u8981\u8FC1\u5165\u7684\u5185\u5BB9",
  instructions: "\u6307\u4EE4",
  skills: "\u6280\u80FD",
  commands: "\u547D\u4EE4",
  agents: "\u5B50\u4EE3\u7406",
  hooks: "Hooks",
  permissions: "\u6743\u9650\u89C4\u5219",
  mcp: "MCP \u670D\u52A1",
  otherOrigins: "Codex \u548C OpenCode",
  originNote: "Claude Code \u662F\u4E3B\u8DEF\u5F84\u3002\u4EC5\u5728\u914D\u7F6E\u6765\u81EA\u5176\u4ED6\u5DE5\u5177\u65F6\u5207\u6362\u3002",
  claude: "Claude Code",
  codex: "Codex",
  opencode: "OpenCode",
  preview: "\u9884\u89C8\u53D8\u5316",
  apply: "\u5E94\u7528\u6240\u9009\u5185\u5BB9",
  working: "\u6B63\u5728\u626B\u63CF\u672C\u5730\u6587\u4EF6",
  dryRun: "\u9884\u89C8\u6A21\u5F0F\u4E0D\u4F1A\u5199\u5165\u4EFB\u4F55\u5185\u5BB9",
  resultPreview: "\u9884\u89C8\u5DF2\u5B8C\u6210",
  resultApplied: "\u8FC1\u5165\u5DF2\u5B8C\u6210",
  resultBlocked: "\u8FC1\u5165\u5DF2\u963B\u6B62",
  noActions: "\u6240\u9009\u7C7B\u522B\u4E2D\u6CA1\u6709\u627E\u5230\u53EF\u8FC1\u5165\u7684\u5185\u5BB9\u3002",
  conflicts: "\u51B2\u7A81\u548C\u4E0D\u652F\u6301\u9879",
  fullReport: "\u67E5\u770B\u5B8C\u6574\u62A5\u544A",
  star: "\u5982\u679C\u5B83\u8282\u7701\u4E86\u914D\u7F6E\u65F6\u95F4\uFF0C\u6B22\u8FCE\u7ED9 dsh-movein \u4E00\u4E2A Star",
  retry: "\u91CD\u8BD5"
};

// src/client/index.jsx
var NS = "dsh-movein";
var inject = ["slots", "locale"];
function apply(ctx) {
  ctx.effect(() => {
    const tag = document.createElement("style");
    tag.setAttribute("data-plugin", "dsh-movein");
    tag.textContent = STYLES;
    document.head.appendChild(tag);
    return () => tag.remove();
  }, "dsh-movein styles");
  ctx.effect(() => ctx.locale.register(NS, { zh, en }), "dsh-movein dictionaries");
  const mount = () => ctx.slots.inject("settings.section", () => ctx.slots.register({
    name: "settings.section",
    id: "dsh-movein",
    order: 45,
    label: ctx.locale.bind(NS)("nav"),
    locale: NS
  }, MoveInSettings));
  ctx.effect(() => {
    let dispose = mount();
    const off = ctx.on("locale/change", () => {
      dispose();
      dispose = mount();
    });
    return () => {
      off();
      dispose();
    };
  }, "dsh-movein settings section");
}

    return module.exports;
  },
});
