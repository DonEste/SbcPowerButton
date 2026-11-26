// SbcPowerButton - adds a reboot / shut-down menu for the SBC to DWC's top app bar.
//
// DWC 3.7 has no plugin API for the app bar, so this entry point places a small host element
// into the bar (just left of the emergency stop) and renders PowerButton into it with the root
// app's context, which gives the component DWC's Vuetify, Pinia stores and i18n. A
// MutationObserver puts the host back if DWC re-renders the bar (layout switch, reconnect) or
// re-adds the emergency stop next to it.

import { h, render, type App } from "vue";

import Events from "@/utils/events";

import PowerButton from "./PowerButton.vue";

const PLUGIN_ID = "SbcPowerButton";
const BAR_SELECTOR = ".v-app-bar .v-toolbar__content";

let host: HTMLElement | null = null;
let observer: MutationObserver | null = null;

function createHost(): HTMLElement | null {
	// Vue stores the mounted app on its container (also in production builds); this is not a
	// documented DWC API, so fail closed (no button) if it ever disappears
	const app = (document.querySelector("#app") as (Element & { __vue_app__?: App }) | null)?.__vue_app__;
	if (!app) {
		console.warn(`[${PLUGIN_ID}] DWC app not found; the power button cannot be shown`);
		return null;
	}

	const element = document.createElement("div");
	element.className = "d-flex align-center";
	const vnode = h(PowerButton);
	vnode.appContext = app._context;
	render(vnode, element);
	return element;
}

/** Keep the host in the app bar, directly before the emergency stop if that is shown */
function attach() {
	// Cheap path for the common case: nothing to do
	const parent = host?.parentElement;
	if (host && parent?.matches(BAR_SELECTOR)) {
		const estop = parent.querySelector(":scope > .estop-button");
		if (!estop || host.nextElementSibling === estop) {
			return;
		}
	}

	const bar = document.querySelector(BAR_SELECTOR);
	if (!bar) {
		return;
	}
	host ??= createHost();
	if (host) {
		bar.insertBefore(host, bar.querySelector(":scope > .estop-button"));
	}
}

function onUnloaded(id: string) {
	if (id !== PLUGIN_ID) {
		return;
	}
	Events.off("dwcPluginUnloaded", onUnloaded);
	observer?.disconnect();
	observer = null;
	if (host) {
		render(null, host);
		host.remove();
		host = null;
	}
}

attach();
// MutationObserver batches all changes of a task into one callback, and attach() returns early
// when nothing changed, so no extra throttling is needed
observer = new MutationObserver(attach);
observer.observe(document.querySelector("#app") ?? document.body, { childList: true, subtree: true });
Events.on("dwcPluginUnloaded", onUnloaded);
