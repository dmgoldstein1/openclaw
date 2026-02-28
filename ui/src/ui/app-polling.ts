import type { OpenClawApp } from "./app.ts";
import { loadConfig } from "./controllers/config.ts";
import { loadDebug } from "./controllers/debug.ts";
import { loadLogs } from "./controllers/logs.ts";
import { loadNodes } from "./controllers/nodes.ts";

type PollingHost = {
  nodesPollInterval: number | null;
  logsPollInterval: number | null;
  debugPollInterval: number | null;
  configPollInterval?: number | null;
  configPollingPaused?: boolean;
  tab: string;
};

export function startNodesPolling(host: PollingHost) {
  if (host.nodesPollInterval != null) {
    return;
  }
  host.nodesPollInterval = window.setInterval(
    () => void loadNodes(host as unknown as OpenClawApp, { quiet: true }),
    5000,
  );
}

export function stopNodesPolling(host: PollingHost) {
  if (host.nodesPollInterval == null) {
    return;
  }
  clearInterval(host.nodesPollInterval);
  host.nodesPollInterval = null;
}

export function startLogsPolling(host: PollingHost) {
  if (host.logsPollInterval != null) {
    return;
  }
  host.logsPollInterval = window.setInterval(() => {
    if (host.tab !== "logs") {
      return;
    }
    void loadLogs(host as unknown as OpenClawApp, { quiet: true });
  }, 2000);
}

export function stopLogsPolling(host: PollingHost) {
  if (host.logsPollInterval == null) {
    return;
  }
  clearInterval(host.logsPollInterval);
  host.logsPollInterval = null;
}

export function startDebugPolling(host: PollingHost) {
  if (host.debugPollInterval != null) {
    return;
  }
  host.debugPollInterval = window.setInterval(() => {
    if (host.tab !== "debug") {
      return;
    }
    void loadDebug(host as unknown as OpenClawApp);
  }, 3000);
}

export function stopDebugPolling(host: PollingHost) {
  if (host.debugPollInterval == null) {
    return;
  }
  clearInterval(host.debugPollInterval);
  host.debugPollInterval = null;
}

export function startConfigPolling(host: PollingHost) {
  if (host.configPollInterval != null) {
    return;
  }
  host.configPollInterval = window.setInterval(() => {
    if (host.tab !== "agents") {
      return;
    }
    // Skip polling if a form element is focused (dropdown/input in use)
    if (host.configPollingPaused) {
      return;
    }
    void loadConfig(host as unknown as OpenClawApp);
  }, 5000);
}

export function stopConfigPolling(host: PollingHost) {
  if (host.configPollInterval == null) {
    return;
  }
  clearInterval(host.configPollInterval);
  host.configPollInterval = null;
}

export function pauseConfigPolling(host: PollingHost) {
  host.configPollingPaused = true;
}

export function resumeConfigPolling(host: PollingHost) {
  host.configPollingPaused = false;
}

export function setupConfigPollingPauseOnFormInteraction(host: PollingHost) {
  let resumeDebounceTimer: number | null = null;

  document.addEventListener(
    "focusin",
    (e) => {
      const target = e.target;
      if (
        target instanceof HTMLElement &&
        (target.tagName === "SELECT" || target.tagName === "INPUT" || target.tagName === "TEXTAREA")
      ) {
        pauseConfigPolling(host);
        // Clear any pending resume timer
        if (resumeDebounceTimer != null) {
          clearTimeout(resumeDebounceTimer);
          resumeDebounceTimer = null;
        }
      }
    },
    true,
  );
  document.addEventListener(
    "focusout",
    (e) => {
      const target = e.target;
      if (
        target instanceof HTMLElement &&
        (target.tagName === "SELECT" || target.tagName === "INPUT" || target.tagName === "TEXTAREA")
      ) {
        // Debounce resume by 250ms to allow updateConfigFormValue() to complete and set dirty flag
        resumeDebounceTimer = window.setTimeout(() => {
          const app = host as unknown as OpenClawApp;
          if (app.configFormDirty) {
            // Keep polling paused if there are unsaved changes
            pauseConfigPolling(host);
          } else {
            // Resume polling after debounce
            resumeConfigPolling(host);
          }
          resumeDebounceTimer = null;
        }, 250);
      }
    },
    true,
  );
}
