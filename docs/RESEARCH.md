# Research: a top-bar power button for DWC 3.7

Goal: put the Raspberry Pi (SBC) reboot / shutdown controls, which DWC already has under **Settings → About**, into a button at the right of DWC's top app bar, without forking DWC.

Target: DuetWebControl **3.7.0** (tag `v3.7.0`, 2026-10-07) on DSF 3.7.0, SBC mode, with the DuetPi Management Plugin installed.

## 1. What DWC offers plugins

Source: `PLUGINS.md` and `CUSTOM-LAYOUT.md` at tag `v3.7.0`, plus `src/plugins/global-api.ts`.

- Plugins can register routes (side-menu pages), settings tabs, job-view tabs, themes, context-menu items, translations, object-model patches and code interceptors.
- **There is no API to add anything to the app bar.**
- The only documented way to change the app bar is `registerLayout`, which replaces DWC's whole shell (app bar, drawer, status panel, hub) and must be activated by the user in Settings. Too heavy for one button.
- The guide says the old `injectComponent` API was removed and to "use Vue 3's `<Teleport>` directly if you need to render outside your route". It does not name any target in the shell.
- Note: `PLUGINS.md` and `CUSTOM-LAYOUT.md` disagree on whether several layouts can be registered at once.

## 2. How the reboot / shutdown buttons work today

In `src/pages/Settings/[[tab]].vue` (Settings → About):

| Action | How | Guard |
|---|---|---|
| Reboot Pi | `sendCode("M999 B-1")` after `showConfirmDialog(...)` | enabled only if connected, DuetPi plugin running, UI not frozen, not printing |
| Shut down Pi | `sendCode('M999 B-1 P"OFF"')` after `showConfirmDialog(...)` | same |
| Close browser (kiosk) | `request("POST", "machine/DuetPiManagementPlugin/closeBrowser")` | only when DWC runs locally on the Pi |

`M999 B-1` is intercepted by the DuetPi Management Plugin, which runs `systemctl reboot` / `poweroff`. The plugin needs no SBC permissions of its own: it only sends G-code.

## 3. Verified on the live printer (read-only, 2026-11-25)

Checked in the browser against http://192.168.1.104 (DWC 3.7.0):

- `window.DWC` exists (116 keys) and includes `useMachineStore`, `useUiStore`, `showConfirmDialog`, `Enums.isPrinting`, `Events`, `Vue`, `VuetifyComponents`.
- `useMachineStore().isDuetPiManagementPluginRunning` → `true`; `.sendCode`, `.request`, `.isConnected` present.
- `useUiStore().uiFrozen` present.
- The app bar is `.v-app-bar .v-toolbar__content`; its last child is the red emergency-stop button.
- `document.querySelector("#app").__vue_app__` exists, with Pinia and Vuetify provided on its context. Vue sets this in production builds too (`apiCreateApp.ts`: `rootContainer.__vue_app__ = app`, not behind `__DEV__`).

## 4. Ways to mount a button in the bar

| Option | How | Pros | Cons |
|---|---|---|---|
| **A. Render into a host element with DWC's app context** (chosen) | The plugin entry creates a `<div>` in the app bar (before the emergency stop) and renders the button component into it with `render()`, using `#app.__vue_app__._context` so Vuetify, Pinia and i18n work. A `MutationObserver` re-attaches the host if DWC re-renders the bar. | No fork; full Vuetify styling; reuses DWC stores and the confirm dialog | Relies on DOM structure and an undocumented Vue internal; may need a fix after a DWC update |
| B. Separate mini Vue app | `DWC.Vue.createApp(Button)` with `getActivePinia()` | No Vue internals | No access to DWC's Vuetify instance, so the button would need its own Vuetify setup or plain HTML styling |
| C. `<Teleport>` from an always-mounted component | Teleport into the app bar | The documented mechanism | Needs a component that is always mounted; plugins have none (routes and tabs mount only when opened). Can be combined with A. |
| D. `registerLayout` | Copy DWC's whole shell and add the button | Fully supported API | Large copy of DWC's layout to maintain; user must switch layouts |
| E. Patched DWC build | Edit `builtin.vue`, rebuild, replace `/opt/dsf/dwc` | Cleanest code | Overwritten by every DWC package update |

## 5. Building

From `PLUGINS.md` (v3.7.0):

- Standalone repo layout: `plugin.json` + `src/index.ts` + `.vue` components + optional `src/i18n/*.json`.
- Building needs a DWC checkout at the **matching tag** (`v3.7.0`), `npm install` there, then from inside it:
  - `node scripts/build-plugin.js /path/to/SbcPowerButton` – simple build;
  - `node scripts/build-plugin-pkg.js /path/to/SbcPowerButton` – also fills `dwcFiles` in the manifest (use for releases).
- Output: `SbcPowerButton-<version>.zip` (plus a `-srcmap.zip` for stable versions). Imports from `"DuetWebControl"`, `vue`, `vuetify` are externalised to `window.DWC` at runtime.
- Node: the docs say "Node.js (LTS)"; no version pinned. Local machine has Node 24.18 / npm 11.16.
- Plain-JS alternative: a single IIFE `.js` using `DWC.Vue.h()` needs no build at all (no templates allowed). Viable for a button this small, but loses type checking.
- Possible CI: a GitHub Actions job that checks out DWC `v3.7.0`, runs `npm ci`, builds the plugin and attaches the zip to a release.

## 6. Installing and update survival

- Install: DWC **Settings → Plugins → upload the zip**, then start it and enable auto-start.
- DSF (`DuetPluginService/Commands/InstallPlugin.cs`) keeps the plugin under `/opt/dsf/plugins/SbcPowerButton/` and links (or copies) its web files into the web folder (`/opt/dsf/dwc/...`).
- The `duetwebcontrol` package's `postinst` only fixes ownership. Since the plugin's files are not owned by the package, dpkg should leave them in place on an update, but **this is not documented and not yet tested**.
- The real update risk is API/DOM changes in a newer DWC, not file loss.

## 7. Listing on plugins.duet3d.com (optional)

- Public GitHub repo whose name equals the plugin id; `README.md` and optionally `PLUGIN.md`; `plugin.json` under 16 KB; at least one GitHub release with the zip.
- Submit via an issue on `Duet3D/PluginRepository`.

## 8. Open questions

1. Does the plugin's web file survive a `duetwebcontrol` package update? Test on the next DWC update.
2. Where exactly to place the button on narrow screens (the bar hides the code input below `md`).
3. Should "Close browser" (kiosk) be included? The kiosk autostart is disabled on this printer.
