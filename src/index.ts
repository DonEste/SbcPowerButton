// SbcPowerButton - adds a reboot / shut-down menu for the SBC to DWC's top app bar.
//
// DWC 3.7 has no plugin API for the app bar, so this entry point places a small host element
// into the bar (just left of the emergency stop) and renders PowerButton into it with the root
// app's context, which gives the component DWC's Vuetify, Pinia stores and i18n. A
// MutationObserver puts the host back if DWC re-renders the bar (layout switch, reconnect).

import { h, render, type AppContext } from "vue";

import Events from "@/utils/events";

import PowerButton from "./PowerButton.vue";

const PLUGIN_ID = "SbcPowerButton";
const HOST_ID = "sbc-power-button-host";
const BAR_SELECTOR = ".v-app-bar .v-toolbar__content";

let host: HTMLElement | null = null;
let observer: MutationObserver | null = null;
let scheduled = false;

/** DWC's root app context, set by Vue on the mount container (also in production builds) */
function getAppContext(): AppContext | null {
	const container = document.querySelector("#app") as (Element & { __vue_app__?: { _context: AppContext } }) | null;
	return container?.__vue_app__?._context ?? null;
}

function createHost(context: AppContext): HTMLElement {
	const element = document.createElement("div");
	element.id = HOST_ID;
	element.className = "d-flex align-center ms-3";

	const vnode = h(PowerButton);
	vnode.appContext = context;
	render(vnode, element);
	return element;
}

/** Place the host in the app bar, before the emergency stop if it is shown */
function attach() {
	scheduled = false;

	const bar = document.querySelector(BAR_SELECTOR);
	if (!bar) {
		return;
	}
	if (host && host.parentElement === bar) {
		return;
	}

	if (!host) {
		const context = getAppContext();
		if (!context) {
			console.warn(`[${PLUGIN_ID}] DWC app context not found; the power button cannot be shown`);
			return;
		}
		host = createHost(context);
	}

	const estop = bar.querySelector(":scope > .estop-button");
	bar.insertBefore(host, estop);
}

function scheduleAttach() {
	if (!scheduled) {
		scheduled = true;
		requestAnimationFrame(attach);
	}
}

attach();
observer = new MutationObserver(scheduleAttach);
observer.observe(document.body, { childList: true, subtree: true });

// Clean up when the plugin is stopped from Settings -> Plugins
Events.on("dwcPluginUnloaded", (id) => {
	if (id !== PLUGIN_ID) {
		return;
	}
	observer?.disconnect();
	observer = null;
	if (host) {
		render(null, host);
		host.remove();
		host = null;
	}
});
