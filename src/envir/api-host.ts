// One Inventory deployment (onesphere-inventory.kapilit.com) serves every
// shell, so its assets/appsettings.json can only hold one API host. When
// federated, Inventory runs on the shell's origin, so the hostname tells us
// which environment we're in; opened directly it uses OneSuite production.
// Returns null for any other host (e.g. localhost) so dev keeps using
// assets/appsettings.json.
const API_HOSTS: Record<string, string> = {
  'onesuite-uat.kapilit.com': 'https://onesuite-uat-api.kapilit.com/api',
  'onesuite.kapilit.com': 'https://onesuite-api.kapilit.com/api',
  'onesphere.kapilit.com': 'https://globalacc-api.kapilit.com/api',
  'onesphere-inventory.kapilit.com': 'https://onesuite-api.kapilit.com/api'
};

export function resolveApiUrlForHost(hostname: string = window.location.hostname): string | null {
  return API_HOSTS[hostname] ?? null;
}
