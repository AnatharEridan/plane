const PLANE_SERVER_URL = "https://devilgate-dev.ru";

const serverUrl = new URL(PLANE_SERVER_URL);

export const desktopConfig = {
  serverUrl: serverUrl.origin,
  serverOrigin: serverUrl.origin,
  serverHostname: serverUrl.hostname,
  apiBaseUrl: serverUrl.origin,
  sessionPartition: "persist:plane",
  allowInsecureCert: false,
  allowedHosts: [serverUrl.hostname],
  pollIntervalMs: 15_000,
  appUserModelId: "DevilGate.Plane.Desktop",
  userAgentSuffix: "PlaneDesktop/0.1.0",
};
