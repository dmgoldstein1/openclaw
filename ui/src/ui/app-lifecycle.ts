import { connectGateway } from "./app-gateway.ts";
import {
  startLogsPolling,
  startNodesPolling,
  stopLogsPolling,
  stopNodesPolling,
  startDebugPolling,
  stopDebugPolling,
  startConfigPolling,
  stopConfigPolling,
  setupConfigPollingPauseOnFormInteraction,
} from "./app-polling.ts";
import { observeTopbar, scheduleChatScroll, scheduleLogsScroll } from "./app-scroll.ts";
import {
  applySettingsFromUrl,
  attachThemeListener,
  detachThemeListener,
  inferBasePath,
  syncTabWithLocation,
  syncThemeWithSettings,
} from "./app-settings.ts";
import { updateConfigFormValue, removeConfigFormValue } from "./controllers/config.ts";
import { loadControlUiBootstrapConfig } from "./controllers/control-ui-bootstrap.ts";
import type { Tab } from "./navigation.ts";

type LifecycleHost = {
  basePath: string;
  client?: { stop: () => void } | null;
  connected?: boolean;
  tab: Tab;
  assistantName: string;
  assistantAvatar: string | null;
  assistantAgentId: string | null;
  chatHasAutoScrolled: boolean;
  chatManualRefreshInFlight: boolean;
  chatLoading: boolean;
  chatMessages: unknown[];
  chatToolMessages: unknown[];
  chatStream: string;
  logsAutoFollow: boolean;
  logsAtBottom: boolean;
  logsEntries: unknown[];
  configPollInterval?: number | null;
  configForm: Record<string, unknown> | null;
  popStateHandler: () => void;
  topbarObserver: ResizeObserver | null;
};

/**
 * Attach native event listeners to model select elements.
 * This is a workaround for Lit @change bindings not rendering.
 */
function setupModelSelectEventListeners(host: LifecycleHost) {
  const selects = document.querySelectorAll<HTMLSelectElement>('select[data-model-type="primary"]');

  selects.forEach((select) => {
    // Remove old listener if exists to prevent duplicates
    const oldListener = (select as unknown as { __modelChangeListener?: EventListener })
      .__modelChangeListener;
    if (oldListener) {
      select.removeEventListener("change", oldListener);
    }

    // Create and attach new listener
    const listener: EventListener = (e: Event) => {
      const target = e.target as HTMLSelectElement;
      const agentId = target.getAttribute("data-agent-id");
      const modelId = target.value || null;

      if (!agentId) {
        return;
      }

      // Directly update the config form (replicates onModelChange logic)
      const state = host;
      const configValue = state.configForm?.value;

      if (!configValue) {
        console.log("[setupModelSelectEventListeners] No configValue");
        return;
      }

      const list = (configValue as { agents?: { list?: unknown[] } }).agents?.list;
      if (!Array.isArray(list)) {
        console.log("[setupModelSelectEventListeners] list is not an array");
        return;
      }

      const index = list.findIndex(
        (entry) =>
          entry &&
          typeof entry === "object" &&
          "id" in entry &&
          (entry as { id?: string }).id === agentId,
      );

      if (index < 0) {
        console.log("[setupModelSelectEventListeners] Agent not found in list");
        return;
      }

      const basePath = ["agents", "list", index, "model"];

      if (!modelId) {
        console.log("[setupModelSelectEventListeners] Removing model value");
        removeConfigFormValue(state, basePath);
        return;
      }

      const entry = list[index] as { model?: unknown };
      const existing = entry?.model;

      if (existing && typeof existing === "object" && !Array.isArray(existing)) {
        const fallbacks = (existing as { fallbacks?: unknown }).fallbacks;
        const next = {
          primary: modelId,
          ...(Array.isArray(fallbacks) ? { fallbacks } : {}),
        };
        console.log("[setupModelSelectEventListeners] Updating with object:", next);
        updateConfigFormValue(state, basePath, next);
      } else {
        console.log("[setupModelSelectEventListeners] Updating with string:", modelId);
        updateConfigFormValue(state, basePath, modelId);
      }

      console.log("[setupModelSelectEventListeners] configFormDirty:", state.configFormDirty);
    };

    select.addEventListener("change", listener);
    (select as unknown as { __modelChangeListener?: EventListener }).__modelChangeListener =
      listener;
  });
}

export function handleConnected(host: LifecycleHost) {
  host.basePath = inferBasePath();
  void loadControlUiBootstrapConfig(host);
  applySettingsFromUrl(host as unknown as Parameters<typeof applySettingsFromUrl>[0]);
  syncTabWithLocation(host as unknown as Parameters<typeof syncTabWithLocation>[0], true);
  syncThemeWithSettings(host as unknown as Parameters<typeof syncThemeWithSettings>[0]);
  attachThemeListener(host as unknown as Parameters<typeof attachThemeListener>[0]);
  window.addEventListener("popstate", host.popStateHandler);
  connectGateway(host as unknown as Parameters<typeof connectGateway>[0]);
  startNodesPolling(host as unknown as Parameters<typeof startNodesPolling>[0]);
  if (host.tab === "logs") {
    startLogsPolling(host as unknown as Parameters<typeof startLogsPolling>[0]);
  }
  if (host.tab === "agents") {
    startConfigPolling(host as unknown as Parameters<typeof startConfigPolling>[0]);
    setupConfigPollingPauseOnFormInteraction(
      host as unknown as Parameters<typeof setupConfigPollingPauseOnFormInteraction>[0],
    );
  }
  if (host.tab === "debug") {
    startDebugPolling(host as unknown as Parameters<typeof startDebugPolling>[0]);
  }
}

export function handleFirstUpdated(host: LifecycleHost) {
  observeTopbar(host as unknown as Parameters<typeof observeTopbar>[0]);
}

export function handleDisconnected(host: LifecycleHost) {
  window.removeEventListener("popstate", host.popStateHandler);
  stopNodesPolling(host as unknown as Parameters<typeof stopNodesPolling>[0]);
  stopLogsPolling(host as unknown as Parameters<typeof stopLogsPolling>[0]);
  stopConfigPolling(host as unknown as Parameters<typeof stopConfigPolling>[0]);
  stopDebugPolling(host as unknown as Parameters<typeof stopDebugPolling>[0]);
  host.client?.stop();
  host.client = null;
  host.connected = false;
  detachThemeListener(host as unknown as Parameters<typeof detachThemeListener>[0]);
  host.topbarObserver?.disconnect();
  host.topbarObserver = null;
}

export function handleUpdated(host: LifecycleHost, changed: Map<PropertyKey, unknown>) {
  if (host.tab === "chat" && host.chatManualRefreshInFlight) {
    return;
  }
  if (
    host.tab === "chat" &&
    (changed.has("chatMessages") ||
      changed.has("chatToolMessages") ||
      changed.has("chatStream") ||
      changed.has("chatLoading") ||
      changed.has("tab"))
  ) {
    const forcedByTab = changed.has("tab");
    const forcedByLoad =
      changed.has("chatLoading") && changed.get("chatLoading") === true && !host.chatLoading;
    scheduleChatScroll(
      host as unknown as Parameters<typeof scheduleChatScroll>[0],
      forcedByTab || forcedByLoad || !host.chatHasAutoScrolled,
    );
  }
  if (changed.has("tab")) {
    // Handle config polling when switching to/from agents tab
    if (host.tab === "agents") {
      startConfigPolling(host as unknown as Parameters<typeof startConfigPolling>[0]);
      setupConfigPollingPauseOnFormInteraction(
        host as unknown as Parameters<typeof setupConfigPollingPauseOnFormInteraction>[0],
      );
      // Attach native event listeners to model selects (workaround for Lit @change not rendering)
      setTimeout(() => setupModelSelectEventListeners(host), 0);
    } else {
      stopConfigPolling(host as unknown as Parameters<typeof stopConfigPolling>[0]);
    }
  }
  // Re-attach model select listeners when config form changes (agents tab only)
  if (host.tab === "agents" && changed.has("configForm")) {
    setTimeout(() => setupModelSelectEventListeners(host), 0);
  }
  if (
    host.tab === "logs" &&
    (changed.has("logsEntries") || changed.has("logsAutoFollow") || changed.has("tab"))
  ) {
    if (host.logsAutoFollow && host.logsAtBottom) {
      scheduleLogsScroll(
        host as unknown as Parameters<typeof scheduleLogsScroll>[0],
        changed.has("tab") || changed.has("logsAutoFollow"),
      );
    }
  }
}
