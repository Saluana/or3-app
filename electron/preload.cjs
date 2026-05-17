const { contextBridge, ipcRenderer } = require('electron');

const channels = Object.freeze({
	platformCapabilities: 'or3:platform:get-capabilities',
	setupGetState: 'or3:setup:get-state',
	setupSaveState: 'or3:setup:save-state',
	filesystemPickWorkspace: 'or3:filesystem:pick-workspace-directory',
	filesystemPickData: 'or3:filesystem:pick-data-directory',
	filesystemPickInternBinary: 'or3:filesystem:pick-intern-binary',
	internLocate: 'or3:intern:locate',
	internInstall: 'or3:intern:install',
	internConfigure: 'or3:intern:configure',
	internStart: 'or3:intern:start',
	internStop: 'or3:intern:stop',
	internRestart: 'or3:intern:restart',
	internStatus: 'or3:intern:status',
	internIssueServiceToken: 'or3:intern:issue-service-token',
	internSetAutostart: 'or3:intern:set-autostart',
	internCreateSecureInvite: 'or3:intern:create-secure-invite',
	internCreateCliInvite: 'or3:intern:create-cli-invite',
	internListSecureDevices: 'or3:intern:list-secure-devices',
	internRevokeSecureDevice: 'or3:intern:revoke-secure-device',
	internListLegacyDevices: 'or3:intern:list-legacy-devices',
	internRevokeLegacyDevice: 'or3:intern:revoke-legacy-device',
});

function invoke(channel, payload) {
	if (!Object.values(channels).includes(channel)) {
		return Promise.reject(new Error('Blocked desktop request'));
	}
	return ipcRenderer.invoke(channel, payload);
}

contextBridge.exposeInMainWorld(
	'or3Desktop',
	Object.freeze({
		platform: Object.freeze({
			getCapabilities: () => invoke(channels.platformCapabilities),
			getSetupState: () => invoke(channels.setupGetState),
			saveSetupState: (input) => invoke(channels.setupSaveState, input),
		}),
		filesystem: Object.freeze({
			pickWorkspaceDirectory: () => invoke(channels.filesystemPickWorkspace),
			pickDataDirectory: () => invoke(channels.filesystemPickData),
			pickInternBinary: () => invoke(channels.filesystemPickInternBinary),
		}),
		intern: Object.freeze({
			locate: () => invoke(channels.internLocate),
			install: () => invoke(channels.internInstall),
			configure: (input) => invoke(channels.internConfigure, input),
			start: () => invoke(channels.internStart),
			stop: () => invoke(channels.internStop),
			restart: () => invoke(channels.internRestart),
			status: () => invoke(channels.internStatus),
			issueServiceToken: (input) => invoke(channels.internIssueServiceToken, {
				method: String(input?.method || ''),
				path: String(input?.path || ''),
			}),
			setAutostart: (enabled) => invoke(channels.internSetAutostart, { enabled: Boolean(enabled) }),
			createSecureInvite: () => invoke(channels.internCreateSecureInvite),
			createCliInvite: () => invoke(channels.internCreateCliInvite),
			listSecureDevices: () => invoke(channels.internListSecureDevices),
			revokeSecureDevice: (deviceId) => invoke(channels.internRevokeSecureDevice, { deviceId: String(deviceId || '') }),
			listLegacyDevices: () => invoke(channels.internListLegacyDevices),
			revokeLegacyDevice: (deviceId) => invoke(channels.internRevokeLegacyDevice, { deviceId: String(deviceId || '') }),
		}),
	}),
);
