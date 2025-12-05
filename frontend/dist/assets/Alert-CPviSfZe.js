import{c as x,j as r,X as m}from"./index-R2nLXBvN.js";import{A as g}from"./alert-circle-DpQSvc7T.js";import{X as f}from"./x-circle-CBdIdiEC.js";import{C as v}from"./check-circle-DujjALsM.js";const p=x("Info",[["circle",{cx:"12",cy:"12",r:"10",key:"1mglay"}],["path",{d:"M12 16v-4",key:"1dtifu"}],["path",{d:"M12 8h.01",key:"e9boi3"}]]),a={success:{bg:"var(--status-success-bg)",border:"var(--status-success-border)",text:"var(--status-success-text)",icon:v},danger:{bg:"var(--status-danger-bg)",border:"var(--status-danger-border)",text:"var(--status-danger-text)",icon:f},warning:{bg:"var(--status-warning-bg)",border:"var(--status-warning-border)",text:"var(--status-warning-text)",icon:g},info:{bg:"var(--status-info-bg)",border:"var(--status-info-border)",text:"var(--status-info-text)",icon:p}};function j({variant:e="info",children:o,className:n="",onClose:c,dismissible:i,onDismiss:d,...l}){const s=a[e]||a.info,u=s.icon,t=c||d,b=i||!!t;return r.jsxs("div",{className:`
        flex items-start gap-3
        px-4 py-3.5
        rounded-[var(--radius-md)]
        border
        animate-slideDown
        ${n}
      `,style:{backgroundColor:s.bg,borderColor:s.border,color:s.text},...l,children:[r.jsx(u,{className:"w-5 h-5 flex-shrink-0 mt-0.5"}),r.jsx("div",{className:"flex-1 text-sm font-medium",children:o}),b&&t&&r.jsx("button",{onClick:t,className:"flex-shrink-0 p-1 rounded hover:bg-black/10 transition-colors",type:"button","aria-label":"Cerrar",children:r.jsx(m,{className:"w-4 h-4"})})]})}export{j as A,p as I};
