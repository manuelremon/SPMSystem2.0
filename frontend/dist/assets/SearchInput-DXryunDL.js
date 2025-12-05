import{j as r,p as u,X as l}from"./index-DSailSuQ.js";function b({value:t,onChange:s,onClear:a,placeholder:e="Buscar...",className:o="",clearLabel:i="Limpiar búsqueda",...n}){return r.jsxs("div",{className:`relative ${o}`,children:[r.jsx(u,{className:"absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--fg-subtle)]","aria-hidden":"true"}),r.jsx("input",{type:"text",value:t,onChange:s,placeholder:e,"aria-label":e,className:`
          w-full
          pl-11 pr-${t&&a?"10":"4"} py-3
          bg-[var(--input-bg)]
          border border-[var(--input-border)]
          rounded-[var(--radius-md)]
          text-sm text-[var(--fg)]
          placeholder:text-[var(--fg-subtle)]
          transition-all duration-[var(--transition-base)]
          focus:border-[var(--primary)]
          focus:ring-2 focus:ring-[var(--input-focus)]
          focus:outline-none
          hover:border-[var(--border-strong)]
        `,...n}),t&&a&&r.jsx("button",{type:"button",onClick:a,"aria-label":i,className:"absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded hover:bg-[var(--bg-elevated)] transition-colors",children:r.jsx(l,{className:"w-4 h-4 text-[var(--fg-muted)]","aria-hidden":"true"})})]})}export{b as S};
