# NEXORA frontend

Vue 3 + TypeScript + Pinia + Tailwind CSS frontend.

See [the project README](../README.md) for architecture, Windows setup, local Ollama/FastAPI instructions, data safety, validation commands and limitations.

From this directory, run `npm.cmd run dev`. Production build: `npm.cmd run build`. Tests: `npm.cmd run test:unit -- --run`.

Localization uses vue-i18n with matching English, Polish and Russian JSON catalogues in `src/locales`. `src/i18n.ts` supplies translation helpers and English fallback. The shell and Settings language selectors persist account/browser preferences. See [Phase 4](../docs/PHASE_4.md) for the financial response contract, translation maintenance and verification evidence.
