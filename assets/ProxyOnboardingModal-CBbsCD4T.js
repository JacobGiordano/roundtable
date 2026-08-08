import{r,j as e}from"./markdown-ZSVVB-on.js";const I=`/**
 * Roundtable API Proxy — Cloudflare Workers
 *
 * Routes Roundtable provider API calls to their respective upstream endpoints.
 * Handles CORS preflight and injects Access-Control-Allow-Origin: * on all
 * forwarded responses so browser clients on any origin can reach the APIs.
 *
 * Deploy:    wrangler deploy
 * Local dev: wrangler dev
 *
 * ─── SECURITY NOTE ─────────────────────────────────────────────────────────────
 * This script does NOT log headers or body content. Logging request headers would
 * expose API keys (e.g. Authorization, x-api-key). Logging response bodies would
 * expose private conversation content. No console.log, wrangler bindings, or any
 * other mechanism in this file reads or records header values or body data.
 * ───────────────────────────────────────────────────────────────────────────────
 *
 * Route table — URL prefix → upstream base URL:
 *   /anthropic  →  https://api.anthropic.com
 *   /openai     →  https://api.openai.com
 *   /gemini     →  https://generativelanguage.googleapis.com
 *   /grok       →  https://api.x.ai
 *   /deepseek   →  https://api.deepseek.com
 *   /mistral    →  https://api.mistral.ai
 *
 * Streaming: upstream.body is passed directly to the Response constructor —
 * the response body is never buffered. This is critical for LLM SSE streaming
 * where the client must receive tokens as they are generated.
 */

// Route table: [urlPrefix, upstreamBase]
// Order matters — prefixes are matched left-to-right on the full pathname.
const ROUTES = [
  ['/anthropic', 'https://api.anthropic.com'],
  ['/openai',    'https://api.openai.com'],
  ['/gemini',    'https://generativelanguage.googleapis.com'],
  ['/grok',      'https://api.x.ai'],
  ['/deepseek',  'https://api.deepseek.com'],
  ['/mistral',   'https://api.mistral.ai'],
];

// CORS headers applied to every response (preflight and forwarded).
const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': '*',
  'Access-Control-Allow-Headers': '*',
};

export default {
  /**
   * @param {Request} request
   * @param {unknown} env
   * @param {ExecutionContext} ctx
   * @returns {Response}
   */
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    // ── CORS preflight ──────────────────────────────────────────────────────
    // Respond immediately to OPTIONS without forwarding to the upstream.
    // Browsers send a preflight before POST/PATCH/PUT with custom headers
    // (e.g. Authorization, x-api-key, anthropic-version).
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        status: 204,
        headers: CORS_HEADERS,
      });
    }

    // ── Route matching ──────────────────────────────────────────────────────
    for (const [prefix, upstreamBase] of ROUTES) {
      // Match exact prefix (e.g. "/anthropic") or prefix + "/" (e.g. "/anthropic/v1/...").
      if (url.pathname === prefix || url.pathname.startsWith(prefix + '/')) {
        // Strip the route prefix to get the upstream path.
        // e.g. /anthropic/v1/messages → /v1/messages
        const upstreamPath = url.pathname.slice(prefix.length) || '/';
        // Preserve the full query string (e.g. ?key=... for Gemini, ?alt=sse).
        const upstreamUrl = \`\${upstreamBase}\${upstreamPath}\${url.search}\`;

        // Forward all request headers to the upstream unchanged.
        // This includes Authorization, x-api-key, Content-Type,
        // anthropic-version, and any other provider-specific headers.
        // SECURITY: Do not log or inspect header values — they include API keys.
        const upstreamRequest = new Request(upstreamUrl, {
          method: request.method,
          headers: request.headers,
          body: request.body,
        });

        const upstreamResponse = await fetch(upstreamRequest);

        // Copy all upstream response headers, then set the CORS header.
        // Do not log or inspect response headers or body.
        const responseHeaders = new Headers(upstreamResponse.headers);
        responseHeaders.set('Access-Control-Allow-Origin', '*');

        // Pass upstream.body directly — never buffer.
        // Buffering would break SSE streaming and cause the client to wait
        // for the entire LLM response before rendering any tokens.
        return new Response(upstreamResponse.body, {
          status: upstreamResponse.status,
          statusText: upstreamResponse.statusText,
          headers: responseHeaders,
        });
      }
    }

    // ── Unrecognized route ──────────────────────────────────────────────────
    return new Response(
      'Unknown provider route. Valid prefixes: /anthropic, /openai, /gemini, /grok, /deepseek, /mistral',
      {
        status: 400,
        headers: {
          'Content-Type': 'text/plain',
          'Access-Control-Allow-Origin': '*',
        },
      },
    );
  },
};
`,_="https://workers.new",D="https://github.com/JacobGiordano/roundtable/blob/main/docs/deployment.md",F=100,B=2e3;function M({onSaveAndContinue:l,onDismiss:c,returnFocusRef:y}){const v=r.useId(),R=r.useRef(null),w=r.useRef(null),x=r.useRef(null),m=r.useRef(null),[d,T]=r.useState(""),[n,u]=r.useState(""),[a,O]=r.useState("idle"),[s,j]=r.useState("idle"),p=typeof window<"u"?window.matchMedia("(prefers-reduced-motion: reduce)").matches:!1,[C,P]=r.useState(p);r.useEffect(()=>(p||requestAnimationFrame(()=>P(!0)),()=>{x.current!==null&&clearTimeout(x.current),m.current!==null&&clearTimeout(m.current)}),[]),r.useEffect(()=>{requestAnimationFrame(()=>{requestAnimationFrame(()=>{var o;return(o=w.current)==null?void 0:o.focus()})});const t=y.current;return()=>{requestAnimationFrame(()=>{requestAnimationFrame(()=>{t==null||t.focus()})})}},[y]);const k=r.useCallback(t=>t.trim()?/^https?:\/\/.+/.test(t.trim())?(u(""),!0):(u("Enter a valid URL (e.g. https://my-name.workers.dev)"),!1):(u("Paste your proxy URL here."),!1),[]),h=r.useCallback(()=>{a!=="saved"&&k(d)&&(O("saved"),x.current=setTimeout(()=>{l(d.trim())},F))},[a,d,k,l]),U=r.useCallback(()=>{s!=="copied"&&navigator.clipboard.writeText(I).then(()=>{j("copied"),m.current=setTimeout(()=>{j("idle")},B)})},[s]),q=r.useCallback(t=>{var S,N,A,E;if(t.key==="Escape"){t.preventDefault(),c();return}if(t.key==="Enter"&&((S=document.activeElement)==null?void 0:S.tagName)==="INPUT"){t.preventDefault(),h();return}if(t.key!=="Tab")return;const o=(N=R.current)==null?void 0:N.querySelectorAll("a[href], button:not([disabled]), input:not([disabled])");if(!o||o.length===0)return;const i=Array.from(o),f=i.indexOf(document.activeElement);if(t.preventDefault(),t.shiftKey){const g=f<=0?i.length-1:f-1;(A=i[g])==null||A.focus()}else{const g=f>=i.length-1?0:f+1;(E=i[g])==null||E.focus()}},[c,h]),L=["w-full h-9 px-3 rounded-md text-[13px] text-text-primary placeholder:text-text-muted","bg-input border transition-colors duration-fast","focus:outline-none focus:border-border-strong","focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-1"].join(" ");return e.jsx("div",{className:["fixed inset-0 z-50 flex items-center justify-center p-4",p?"":"transition-opacity duration-medium ease-out",C?"opacity-100":"opacity-0"].join(" "),style:{backgroundColor:"rgba(0,0,0,0.5)"},onClick:t=>{t.target===t.currentTarget&&c()},children:e.jsxs("div",{ref:R,role:"dialog","aria-modal":"true","aria-labelledby":v,className:["bg-card border border-border rounded-lg shadow-lg","max-w-md w-full","flex flex-col gap-5 p-6",p?"":"transition-[opacity,transform] duration-medium ease-out",C?"opacity-100 scale-100":"opacity-0 scale-[0.97]"].join(" "),onKeyDown:q,onClick:t=>t.stopPropagation(),children:[e.jsx("h2",{id:v,className:"text-[16px] font-semibold text-text-primary leading-snug",children:"Connect your proxy"}),e.jsxs("ol",{role:"list",className:"flex flex-col gap-5 list-none","aria-label":"Setup steps",children:[e.jsxs("li",{className:"flex gap-3",children:[e.jsx(b,{n:1}),e.jsxs("div",{className:"flex flex-col gap-2 flex-1 min-w-0",children:[e.jsx("p",{className:"text-[13px] font-semibold text-text-primary",children:"Copy the proxy code"}),e.jsx("p",{className:"text-[13px] text-text-secondary leading-relaxed",children:"Click Copy to put the proxy script on your clipboard."}),e.jsx("div",{"aria-live":"polite","aria-atomic":"true",className:"sr-only",children:s==="copied"?"Copied to clipboard.":""}),e.jsx("button",{ref:w,type:"button",onClick:U,"aria-label":s==="copied"?"Proxy code copied to clipboard":"Copy proxy code to clipboard",className:["flex items-center justify-center w-full","px-4 py-2.5 rounded-md","text-[14px] font-semibold",s==="copied"?"bg-success/10 text-success border border-success/30 cursor-default":"bg-accent-claude text-text-inverse hover:opacity-90 active:opacity-80 transition-opacity duration-fast","focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2"].join(" "),children:s==="copied"?"Copied!":"Copy proxy code"})]})]}),e.jsxs("li",{className:"flex gap-3",children:[e.jsx(b,{n:2}),e.jsxs("div",{className:"flex flex-col gap-2 flex-1 min-w-0",children:[e.jsx("p",{className:"text-[13px] font-semibold text-text-primary",children:"Open Cloudflare Workers"}),e.jsx("p",{className:"text-[13px] text-text-secondary leading-relaxed",children:"Select all (Ctrl+A), paste, click Go to apply the code, then click Deploy. Takes about 30 seconds."}),e.jsxs("a",{href:_,target:"_blank",rel:"noopener noreferrer","aria-label":"Open Cloudflare Workers (opens in new tab)",className:["group flex items-center justify-center w-full","px-4 py-2.5 rounded-md","text-[14px] font-semibold text-text-inverse bg-accent-claude","hover:opacity-90 active:opacity-80","transition-opacity duration-fast","focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2"].join(" "),children:["Open Cloudflare Workers",e.jsx("span",{className:["ml-1.5","transition-transform duration-fast ease-out","group-hover:translate-x-0.5","motion-reduce:transition-none motion-reduce:group-hover:translate-x-0"].join(" "),"aria-hidden":"true",children:"→"})]})]})]}),e.jsxs("li",{className:"flex gap-3",children:[e.jsx(b,{n:3}),e.jsxs("div",{className:"flex flex-col gap-2 flex-1 min-w-0",children:[e.jsx("p",{className:"text-[13px] font-semibold text-text-primary",children:"Paste your Worker URL"}),e.jsx("p",{className:"text-[13px] text-text-secondary leading-relaxed",children:"After deploying, copy the URL from the Cloudflare dashboard and paste it here."}),e.jsxs("div",{className:"flex gap-2 items-start",children:[e.jsxs("div",{className:"flex-1 min-w-0",children:[e.jsx("input",{type:"url",value:d,onChange:t=>{T(t.target.value),n&&u("")},placeholder:"https://your-name.workers.dev",autoComplete:"url","aria-label":"Proxy URL","aria-invalid":n?!0:void 0,"aria-describedby":n?"proxy-onboarding-url-error":void 0,className:[L,n?"border-error":"border-border"].join(" ")}),n&&e.jsx("p",{id:"proxy-onboarding-url-error",role:"alert",className:"mt-1 text-[11px] text-error",children:n})]}),e.jsx("button",{type:"button",onClick:h,"aria-disabled":a==="saved",className:["h-9 px-3 rounded-md text-[13px] font-semibold flex-shrink-0",a==="saved"?"bg-success/10 text-success border border-success/30 cursor-default":"bg-accent-claude text-text-inverse hover:brightness-110 active:brightness-90 active:scale-[0.97] transition-[filter,transform] duration-fast","focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2"].join(" "),children:a==="saved"?"Saved":"Save & continue"})]})]})]})]}),e.jsx("p",{className:"text-[11px] text-text-muted leading-relaxed border-t border-border pt-4",children:"Your API keys go directly from your browser to the AI provider. The proxy just handles CORS — it never sees your keys."}),e.jsx("div",{className:"flex justify-center",children:e.jsx("a",{href:D,target:"_blank",rel:"noopener noreferrer","aria-label":"Full setup guide (opens in new tab)",className:["text-[12px] text-text-muted underline","underline-offset-2","hover:text-text-secondary hover:decoration-2","focus:outline-none","focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-1 focus-visible:rounded-sm"].join(" "),children:"Full setup guide →"})}),e.jsx("div",{className:"flex justify-center -mt-1",children:e.jsx("button",{type:"button",onClick:c,className:["py-2 px-2 rounded","text-[13px] text-text-muted","hover:text-text-secondary","transition-colors duration-fast","focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-1"].join(" "),children:"I'll set this up later"})})]})})}function b({n:l}){return e.jsx("span",{"aria-hidden":"true",className:["w-6 h-6 flex-shrink-0 rounded-full","flex items-center justify-center","text-[11px] font-medium","bg-hover text-text-muted","mt-0.5"].join(" "),children:l})}export{M as ProxyOnboardingModal};
