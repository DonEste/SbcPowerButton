<template>
	<v-menu v-if="isSbc" location="bottom end">
		<template #activator="{ props: activatorProps }">
			<v-btn v-bind="activatorProps" icon="mdi-power" variant="text"
				   :disabled="!enabled"
				   :title="enabled ? $t('settings.about.powerCaption') : $t('settings.about.powerPluginRequired')"
				   :aria-label="$t('settings.about.powerCaption')" />
		</template>

		<v-list density="compact" min-width="180">
			<v-list-subheader>{{ $t("settings.about.powerCaption") }}</v-list-subheader>
			<v-list-item prepend-icon="mdi-restart" base-color="warning" :disabled="!enabled"
						 :title="$t('settings.about.reboot')" @click="reboot" />
			<v-list-item prepend-icon="mdi-power" base-color="error" :disabled="!enabled"
						 :title="$t('settings.about.shutdown')" @click="shutdown" />
		</v-list>
	</v-menu>
</template>

<script setup lang="ts">
import { DisconnectedError } from "@duet3d/connectors";
import { computed } from "vue";

import { showConfirmDialog } from "@/composables/useConfirmDialog";
import i18n from "@/i18n";
import { useMachineStore } from "@/stores/machine";
import { useUiStore } from "@/stores/ui";
import { isPrinting } from "@/utils/enums";

const machineStore = useMachineStore();
const uiStore = useUiStore();

// Only meaningful in SBC mode: the DuetPi Management Plugin runs on the SBC
const isSbc = computed(() => machineStore.model.sbc !== null);

// Same guard as DWC's own buttons under Settings -> About
const enabled = computed(() => machineStore.isConnected
	&& machineStore.isDuetPiManagementPluginRunning
	&& !uiStore.uiFrozen
	&& !isPrinting(machineStore.model.state.status));

async function sendPowerCode(code: string) {
	try {
		await machineStore.sendCode(code, false, false);
	} catch (e) {
		// The SBC going away mid-request is the expected outcome, not an error
		if (!(e instanceof DisconnectedError)) {
			uiStore.notifyError(e, i18n.global.t("settings.about.powerError"));
		}
	}
}

// M999 B-1 is intercepted by the DuetPi Management Plugin, which runs `systemctl reboot`
async function reboot() {
	if (await showConfirmDialog(i18n.global.t("settings.about.rebootTitle"), i18n.global.t("settings.about.rebootPrompt"), "mdi-restart")) {
		await sendPowerCode("M999 B-1");
	}
}

// With P"OFF" the DuetPi Management Plugin runs `systemctl poweroff` instead
async function shutdown() {
	if (await showConfirmDialog(i18n.global.t("settings.about.shutdownTitle"), i18n.global.t("settings.about.shutdownPrompt"), "mdi-power")) {
		await sendPowerCode('M999 B-1 P"OFF"');
	}
}
</script>
