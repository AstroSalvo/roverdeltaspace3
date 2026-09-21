import { i as __toESM } from "../_runtime.mjs";
import { I as require_jsx_runtime, L as require_react } from "../_libs/@tanstack/react-router+[...].mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/routes-B0S9qtE1.js
var import_react = /* @__PURE__ */ __toESM(require_react());
var import_jsx_runtime = require_jsx_runtime();
function Home() {
	const [Sim, setSim] = (0, import_react.useState)(null);
	(0, import_react.useEffect)(() => {
		let alive = true;
		import("./LunarSim-Be_kY4e1.mjs").then((mod) => {
			if (alive) setSim(() => mod.LunarSim);
		});
		return () => {
			alive = false;
		};
	}, []);
	if (!Sim) return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(BootShell, {});
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Sim, {});
}
function BootShell() {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
		className: "relative h-dvh w-full overflow-hidden bg-bg text-fg",
		children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
			className: "absolute inset-0 z-10 flex items-end justify-center bg-bg/55 p-4 pb-8 sm:items-center sm:pb-4",
			children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "w-full max-w-lg rounded-xl border border-line bg-surface/90 p-6 sm:p-8",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "font-mono text-xs tracking-widest text-muted uppercase",
						children: "DeltaSpace · Ambiente di sviluppo 2026"
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("h1", {
						className: "mt-3 font-sans text-2xl font-medium tracking-tight text-fg sm:text-3xl",
						children: ["Ambiente di Sviluppo", /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
							className: "mt-1 block text-xl sm:text-2xl",
							children: "Rover DeltaSpace 2026"
						})]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "mt-3 max-w-md text-sm leading-relaxed text-muted",
						children: "Banco di prova della regolite. Rover a quattro gambe indipendenti: ogni ruota segue la superficie reale della roccia, senza attraversarla."
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("ul", {
						className: "mt-5 grid grid-cols-2 gap-2 font-mono text-xs text-faint sm:text-sm",
						children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("li", {
								className: "rounded-md border border-line bg-elevated px-3 py-2 text-muted",
								children: "WASD / frecce — guida"
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("li", {
								className: "rounded-md border border-line bg-elevated px-3 py-2 text-muted",
								children: "Spazio — stiva alta"
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("li", {
								className: "rounded-md border border-line bg-elevated px-3 py-2 text-muted",
								children: "Ctrl — accovaccia"
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("li", {
								className: "rounded-md border border-line bg-elevated px-3 py-2 text-muted",
								children: "C camera / POV · R reset"
							})
						]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
						type: "button",
						disabled: true,
						className: "mt-6 flex h-11 w-full items-center justify-center rounded-md bg-primary px-4 text-sm font-medium text-primary-fg opacity-70",
						children: "Caricamento ambiente…"
					})
				]
			})
		})
	});
}
//#endregion
export { Home as component };
