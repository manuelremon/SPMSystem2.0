import{j as t}from"./index-CU87sTKb.js";function v({className:r="",children:a,hover:e=!0,glow:o=!1,interactive:s,...n}){const d=s!==void 0?s:e;return t.jsxs("div",{className:`
        relative overflow-hidden
        bg-[var(--card)]
        border border-[var(--border)]
        rounded-[var(--radius-lg)]
        transition-all duration-[var(--transition-base)]
        ${d?"hover:border-[var(--border-hover)] hover:bg-[var(--card-hover)]":""}
        ${o?"shadow-[var(--shadow-glow)]":""}
        ${r}
      `,...n,children:[t.jsx("div",{className:"absolute inset-0 bg-[var(--gradient-card)] pointer-events-none opacity-50"}),t.jsx("div",{className:"relative z-10",children:a})]})}function l({className:r="",children:a,...e}){return t.jsx("div",{className:`px-6 pt-6 pb-4 ${r}`,...e,children:a})}function c({className:r="",children:a,...e}){return t.jsx("h3",{className:`text-lg font-bold text-[var(--fg-strong)] tracking-tight ${r}`,...e,children:a})}function u({className:r="",children:a,...e}){return t.jsx("p",{className:`text-sm text-[var(--fg-muted)] mt-1 ${r}`,...e,children:a})}function x({className:r="",children:a,...e}){return t.jsx("div",{className:`px-6 pb-6 ${r}`,...e,children:a})}export{v as C,l as a,c as b,x as c,u as d};
