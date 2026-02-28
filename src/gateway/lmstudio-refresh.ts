/**
 * GitHub Copilot - Generated with Claude Haiku 4.5
 *
 * LM Studio periodic model discovery service
 * Refreshes LM Studio models every 10 seconds, but only when there are no active
 * inference requests to LM Studio models (pauses during actual model usage).
 */

import { ensureOpenClawModelsJson } from "../agents/models-config.js";
import { discoverLmstudioModels } from "../agents/models-config.providers.js";
import { loadConfig } from "../config/config.js";
import { createSubsystemLogger } from "../logging/subsystem.js";
import { getActiveTaskCount } from "../process/command-queue.js";

export interface LmstudioRefreshServiceState {
  start: () => void;
  stop: () => void;
}

export function createLmstudioRefreshService(): LmstudioRefreshServiceState {
  const log = createSubsystemLogger("lmstudio-refresh");
  let refreshInterval: ReturnType<typeof setInterval> | null = null;
  let stopped = false;
  let isRunningDiscovery = false;

  const runDiscovery = async () => {
    if (isRunningDiscovery || stopped) {
      return;
    }

    try {
      isRunningDiscovery = true;

      const cfg = loadConfig();
      const lmstudioProvider = cfg.models?.providers?.lmstudio;

      // Skip if LM Studio provider not configured
      if (!lmstudioProvider) {
        return;
      }

      // Skip discovery if there are active tasks (inference in flight)
      const activeTaskCount = getActiveTaskCount();
      if (activeTaskCount > 0) {
        return;
      }

      // Discover models from LM Studio
      const resolvedBaseUrl = (lmstudioProvider.baseUrl as string | undefined)?.trim();
      const resolvedApiKey = (lmstudioProvider.apiKey as string | undefined)?.trim();

      const discovered = await discoverLmstudioModels({
        baseUrl: resolvedBaseUrl,
        apiKey: resolvedApiKey,
      });

      if (!discovered || discovered.length === 0) {
        // No new models found, skip update
        return;
      }

      // Update the models in the current provider config
      const currentModels = Array.isArray(lmstudioProvider.models) ? lmstudioProvider.models : [];

      // Check if models changed (different count or different IDs)
      const currentIds = new Set(currentModels.map((m) => m.id.trim()));
      const discoveredIds = new Set(discovered.map((m) => m.id.trim()));

      const modelsChanged =
        currentIds.size !== discoveredIds.size ||
        Array.from(currentIds).some((id) => !discoveredIds.has(id)) ||
        Array.from(discoveredIds).some((id) => !currentIds.has(id));

      if (!modelsChanged) {
        return;
      }

      // Update the provider with newly discovered models
      const nextCfg = {
        ...cfg,
        models: {
          ...cfg.models,
          providers: {
            ...cfg.models?.providers,
            lmstudio: {
              ...lmstudioProvider,
              models: discovered,
            },
          },
        },
      };

      // Persist the updated models.json
      await ensureOpenClawModelsJson(nextCfg);
      log.debug(
        { discoveredCount: discovered.length, previousCount: currentIds.size },
        "LM Studio models refreshed",
      );
    } catch (err) {
      // Log but don't throw; periodic discovery should not crash the gateway
      log.warn({ err: String(err) }, "LM Studio model discovery failed");
    } finally {
      isRunningDiscovery = false;
    }
  };

  return {
    start() {
      if (refreshInterval) {
        return;
      }

      stopped = false;

      // Run discovery every 10 seconds
      refreshInterval = setInterval(() => {
        void runDiscovery();
      }, 10_000);

      // Run once immediately (async, don't block)
      void runDiscovery();

      log.debug("LM Studio refresh service started (10s interval)");
    },

    stop() {
      stopped = true;
      if (refreshInterval) {
        clearInterval(refreshInterval);
        refreshInterval = null;
      }
      log.debug("LM Studio refresh service stopped");
    },
  };
}
