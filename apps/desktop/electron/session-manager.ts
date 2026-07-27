import path from "node:path";
import { app, session } from "electron";
import { desktopConfig } from "./config";

const APP_NAME = "PlaneDesktop";
let planeSession: Electron.Session | null = null;
let isFlushingSession = false;

export function configureAppPaths(): void {
  app.setName(APP_NAME);
  app.setPath("userData", path.join(app.getPath("appData"), APP_NAME));
}

export function getPlaneSession(): Electron.Session {
  if (!planeSession) {
    planeSession = session.fromPartition(desktopConfig.sessionPartition, { cache: true });
  }

  return planeSession;
}

export function configurePlaneSession(): void {
  const planeSessionInstance = getPlaneSession();
  const defaultUserAgent = planeSessionInstance.getUserAgent();
  planeSessionInstance.setUserAgent(`${defaultUserAgent} ${desktopConfig.userAgentSuffix}`);
}

export function registerSessionPersistenceHandlers(): void {
  app.on("before-quit", (event) => {
    if (!app.isReady() || !planeSession) {
      return;
    }

    if (isFlushingSession) {
      return;
    }

    event.preventDefault();
    isFlushingSession = true;

    void planeSession.cookies
      .flushStore()
      .catch((error) => {
        console.warn("[Plane Desktop] Failed to flush session cookies", error);
      })
      .finally(() => {
        app.quit();
      });
  });
}
