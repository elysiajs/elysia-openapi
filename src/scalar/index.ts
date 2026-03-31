import type { OpenAPIV3 } from 'openapi-types'
import { ElysiaOpenAPIConfig } from '../types'

const elysiaCSS = `.light-mode {
  --scalar-color-1: oklch(43.5% 0.029 321.78);
  --scalar-color-2: oklch(54.2% 0.034 322.5);
  --scalar-color-3: oklch(71.1% 0.019 323.02);
  --scalar-color-accent: oklch(71.2% 0.194 13.428);

  --scalar-background-1: oklch(98.5% 0 0);
  --scalar-background-2: oklch(96% 0.003 325.6);
  --scalar-background-3: oklch(92.2% 0.005 325.62);

  --scalar-border-color: oklch(92.2% 0.005 325.62);
}

.dark-mode {
  --scalar-color-1: oklch(98.5% 0 0);
  --scalar-color-2: oklch(71.1% 0.019 323.02);
  --scalar-color-3: oklch(86.5% 0.012 325.68);
  --scalar-color-accent: oklch(89.2% 0.058 10.001);

  --scalar-background-1: oklch(21.2% 0.019 322.12);
  --scalar-background-2: oklch(26.3% 0.024 320.12);
  --scalar-background-3: oklch(36.4% 0.029 323.89);
  --scalar-background-accent: oklch(43.5% 0.029 321.78);

  --scalar-border-color: oklch(36.4% 0.029 323.89);
}

/* Document Sidebar */
.light-mode .t-doc__sidebar,
.dark-mode .t-doc__sidebar {
  --scalar-sidebar-background-1: var(--scalar-background-1);
  --scalar-sidebar-color-1: var(--scalar-color-1);
  --scalar-sidebar-color-2: var(--scalar-color-2);
  --scalar-sidebar-border-color: var(--scalar-border-color);

  --scalar-sidebar-item-hover-background: var(--scalar-background-2);
  --scalar-sidebar-item-hover-color: currentColor;

  --scalar-sidebar-item-active-background: #f062921f;
  --scalar-sidebar-color-active: var(--scalar-color-accent);

  --scalar-sidebar-search-background: transparent;
  --scalar-sidebar-search-color: var(--scalar-color-3);
  --scalar-sidebar-search-border-color: var(--scalar-border-color);
}

/* advanced */
.light-mode {
  --scalar-button-1: rgb(49 53 56);
  --scalar-button-1-color: #fff;
  --scalar-button-1-hover: rgb(28 31 33);

  --scalar-color-green: #069061;
  --scalar-color-red: #ef0006;
  --scalar-color-yellow: #edbe20;
  --scalar-color-blue: #0082d0;
  --scalar-color-orange: #fb892c;
  --scalar-color-purple: #5203d1;

  --scalar-scrollbar-color: rgba(0, 0, 0, 0.18);
  --scalar-scrollbar-color-active: rgba(0, 0, 0, 0.36);
}
.dark-mode {
  --scalar-button-1: #f6f6f6;
  --scalar-button-1-color: #000;
  --scalar-button-1-hover: #e7e7e7;

  --scalar-color-green: #a3ffa9;
  --scalar-color-red: #ffa3a3;
  --scalar-color-yellow: #fffca3;
  --scalar-color-blue: #a5d6ff;
  --scalar-color-orange: #e2ae83;
  --scalar-color-purple: #d2a8ff;

  --scalar-scrollbar-color: rgba(255, 255, 255, 0.24);
  --scalar-scrollbar-color-active: rgba(255, 255, 255, 0.48);
}
.section-flare {
  width: 100%;
  height: 400px;
  position: absolute;
}
.section-flare-item:first-of-type:before {
  content: "";
  position: absolute;
  top: 0;
  right: 0;
  bottom: 0;
  left: 0;
  --stripes: repeating-linear-gradient(100deg, #fff 0%, #fff 0%, transparent 2%, transparent 12%, #fff 17%);
  --stripesDark: repeating-linear-gradient(100deg, #000 0%, #000 0%, transparent 10%, transparent 12%, #000 17%);
  --rainbow: repeating-linear-gradient(100deg, #60a5fa 10%, #e879f9 16%, #5eead4 22%, #60a5fa 30%);
  contain: strict;
  contain-intrinsic-size: 100vw 40vh;
  background-image: var(--stripesDark), var(--rainbow);
  background-size: 300%, 200%;
  background-position: 50% 50%, 50% 50%;
  filter: opacity(20%) saturate(200%);
  -webkit-mask-image: radial-gradient(ellipse at 100% 0%, black 40%, transparent 70%);
  mask-image: radial-gradient(ellipse at 100% 0%, black 40%, transparent 70%);
  pointer-events: none;
}
.section-flare-item:first-of-type:after {
  content: "";
  position: absolute;
  top: 0;
  right: 0;
  bottom: 0;
  left: 0;
  background-image: var(--stripes), var(--rainbow);
  background-size: 200%, 100%;
  background-attachment: fixed;
  mix-blend-mode: difference;
  background-image: var(--stripesDark), var(--rainbow);
  pointer-events: none;
}
.light-mode .section-flare-item:first-of-type:after,
.light-mode .section-flare-item:first-of-type:before {
  background-image: var(--stripes), var(--rainbow);
  filter: opacity(4%) saturate(200%);
}`

export const ScalarRender = (
	info: OpenAPIV3.InfoObject,
	config: NonNullable<ElysiaOpenAPIConfig['scalar']>,
	embedSpec?: string
) => `<!doctype html>
<html>
  <head>
    <title>${info.title}</title>
    <meta
        name="description"
        content="${info.description}"
    />
    <meta
        name="og:description"
        content="${info.description}"
    />
    <meta charset="utf-8" />
    <meta
      name="viewport"
      content="width=device-width, initial-scale=1" />
    <style>
      body {
        margin: 0;
      }
    </style>
    <style>
      ${config.customCss ?? elysiaCSS}
    </style>
  </head>
  <body>
    <script
      id="api-reference"
      data-configuration='${JSON.stringify(
			Object.assign(
				config,
				{
					content: embedSpec
				}
			)
		)}'
    >
    </script>
    <script src="${config.cdn}" crossorigin></script>
  </body>
</html>`
