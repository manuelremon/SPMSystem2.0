import{j as r,X as m}from"./index-BBtzFSXJ.js";import{I as x}from"./info-DUgdjQgb.js";import{A as g}from"./alert-circle-ULNVDQrJ.js";import{X as f}from"./x-circle-CtG45re9.js";import{C as v}from"./check-circle-DVILKVSI.js";const a={success:{bg:"var(--status-success-bg)",border:"var(--status-success-border)",text:"var(--status-success-text)",icon:v},danger:{bg:"var(--status-danger-bg)",border:"var(--status-danger-border)",text:"var(--status-danger-text)",icon:f},warning:{bg:"var(--status-warning-bg)",border:"var(--status-warning-border)",text:"var(--status-warning-text)",icon:g},info:{bg:"var(--status-info-bg)",border:"var(--status-info-border)",text:"var(--status-info-text)",icon:x}};function k({variant:e="info",children:o,className:n="",onClose:i,dismissible:c,onDismiss:d,...l}){const s=a[e]||a.info,b=s.icon,t=i||d,u=c||!!t;return r.jsxs("div",{className:`
        flex items-start gap-3
        px-4 py-3.5
        rounded-[var(--radius-md)]
        border
        animate-slideDown
        ${n}
      `,style:{backgroundColor:s.bg,borderColor:s.border,color:s.text},...l,children:[r.jsx(b,{className:"w-5 h-5 flex-shrink-0 mt-0.5"}),r.jsx("div",{className:"flex-1 text-sm font-medium",children:o}),u&&t&&r.jsx("button",{onClick:t,className:"flex-shrink-0 p-1 rounded hover:bg-black/10 transition-colors",type:"button","aria-label":"Cerrar",children:r.jsx(m,{className:"w-4 h-4"})})]})}export{k as A};
