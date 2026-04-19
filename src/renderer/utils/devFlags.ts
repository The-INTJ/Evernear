// Renderer-side dev affordances. These panels and metrics are hidden by
// default so the shell matches the intended "end product" UI. Opt in by
// launching with `VITE_DEBUG_PANELS=1 npm run dev` (or setting the var in a
// local .env) when you need the run log, engine metric, or editor legend.

export const DEBUG_PANELS = import.meta.env.VITE_DEBUG_PANELS === "1";
