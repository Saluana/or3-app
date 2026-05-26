export const OR3_ELECTRON_CSP: string;
export const IPC_CHANNELS: Readonly<Record<string, string>>;
export function buildElectronCsp(options?: { scriptHashes?: string[] }): string;
export function extractInlineScriptHashes(html: string): string[];
export function isAllowedNavigation(url: string): boolean;
export function validateIpcChannel(channel: string): boolean;
