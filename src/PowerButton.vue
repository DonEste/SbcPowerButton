<template>
	<v-menu v-if="machineStore.isSbcMode" location="bottom end">
		<template #activator="{ props: activatorProps }">
			<v-btn v-bind="activatorProps" icon="mdi-power" variant="text"
				   :class="isLargeButtons ? 'ms-5' : 'ms-3'" :size="isLargeButtons ? 'large' : undefined"
				   :disabled="!enabled"
				   :title="machineStore.isDuetPiManagementPluginRunning ? $t('settings.about.powerCaption') : $t('settings.about.powerPluginRequired')"
				   :aria-label="$t('settings.about.powerCaption')" />
		</template>

		<v-list density="compact" min-width="180">
			<v-list-subheader>{{ $t("settings.about.powerCaption") }}</v-list-subheader>
			<v-list-item prepend-icon="mdi-restart" base-color="warning"
						 :title="$t('settings.about.reboot')" @click="power('reboot')" />
			<v-list-item prepend-icon="mdi-power" base-color="error"
						 :title="$t('settings.about.shutdown')" @click="power('shutdown')" />
		</v-list>
	</v-menu>
</template>

<script setup lang="ts">
import { DisconnectedError } from "@duet3d/connectors";
import { computed, ref } from "vue";
import { useDisplay } from "vuetify";

import { showConfirmDialog } from "@/composables/useConfirmDialog";
import i18n from "@/i18n";
import { useMachineStore } from "@/stores/machine";
import { useSettingsStore } from "@/stores/settings";
import { useUiStore } from "@/stores/ui";
import { isPrinting } from "@/utils/enums";

const machineStore = useMachineStore();
const settingsStore = useSettingsStore();
const uiStore = useUiStore();
const { name: breakpointName } = useDisplay();

// Same rule as DWC's app bar, which uses large buttons on "sm" screens when enabled
const isLargeButtons = computed(() => settingsStore.largeButtons && breakpointName.value === "sm");

// True while a confirmation is open or a command is being sent, so clicks don't queue up
const busy = ref(false);

// Same guard as DWC's own buttons under Settings -> About
const enabled = computed(() => !busy.value
	&& machineStore.isConnected
	&& machineStore.isDuetPiManagementPluginRunning
	&& !uiStore.uiFrozen
	&& !isPrinting(machineStore.model.state.status));

// M999 B-1 is intercepted by the DuetPi Management Plugin, which runs `systemctl reboot`;
// with P"OFF" it runs `systemctl poweroff` instead
const actions = {
	reboot: { code: "M999 B-1", icon: "mdi-restart" },
	shutdown: { code: 'M999 B-1 P"OFF"', icon: "mdi-power" }
};

async function power(kind: keyof typeof actions) {
	if (!enabled.value) {
		return;
	}
	busy.value = true;
	try {
		const { code, icon } = actions[kind];
		if (!(await showConfirmDialog(i18n.global.t(`settings.about.${kind}Title`), i18n.global.t(`settings.about.${kind}Prompt`), icon))) {
			return;
		}

		// The dialog can stay open for a long time: re-check, e.g. a print may have started meanwhile
		busy.value = false;
		if (!enabled.value) {
			uiStore.notifyWarning(new Error("Nothing was sent: the machine started printing, disconnected or the DuetPi Management Plugin stopped."), i18n.global.t("settings.about.powerError"));
			return;
		}
		busy.value = true;

		await machineStore.sendCode(code, false, false);
	} catch (e) {
		// The SBC going away mid-request is the expected outcome, not an error
		if (!(e instanceof DisconnectedError)) {
			uiStore.notifyError(e, i18n.global.t("settings.about.powerError"));
		}
	} finally {
		busy.value = false;
	}
}
</script>
