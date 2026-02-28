# OpenClaw + LM Studio Integration Guide

## Current Status

✅ OpenClaw automatically discovers and syncs LM Studio models from your local instance running on port 1234
✅ Models refresh automatically every 10 seconds (when the gateway is idle)
✅ Zero manual configuration needed - works out of the box

## Configuration Details

### Environment Variables

The Docker container is configured with:

- **OPENAI_API_BASE**: `http://host.docker.internal:1234/v1`
- **OPENAI_API_KEY**: `lm-studio`

These allow the gateway to communicate with LM Studio's OpenAI-compatible API endpoint.

### Agent Model Configuration

The default agent model is set to:

```json
{
  "agents": {
    "defaults": {
      "model": "openai/gpt-oss-20b"
    }
  }
}
```

This corresponds to the model currently loaded in your LM Studio instance.

## Querying Available Models

To see what models are currently available in LM Studio, you can query the OpenAI-compatible `/models` endpoint from the container:

```bash
docker exec openclaw-openclaw-gateway-1 \
  curl -s http://host.docker.internal:1234/v1/models | jq '.data[] | .id'
```

Example output:

```
"openai/gpt-oss-20b"
"zai-org/glm-4.7-flash"
"qwen/qwen3-coder-next"
"text-embedding-nomic-embed-text-v1.5"
"allenai/olmocr-2-7b"
```

## Dynamic Model Discovery

✅ **Now Implemented!** OpenClaw automatically discovers LM Studio models running on your local instance.

### How It Works

The OpenClaw gateway runs a **background service that periodically scans LM Studio's model list**:

- **Refresh Interval**: Every 10 seconds
- **Smart Pause**: Discovery is paused during active inference to avoid interruptions
- **Automatic Updates**: When models change in LM Studio, they appear in OpenClaw within 10 seconds (or immediately if idle)
- **Zero Configuration**: No manual setup required

### Automatic Model Discovery Process

1. **Gateway Startup**: The refresh service starts automatically
2. **Periodic Polling**: Every 10 seconds (only when no active inference):
   - Queries `http://host.docker.internal:1234/v1/models`
   - Compares with previously discovered models
3. **Selective Updates**: Only updates `models.json` if the model list changed
4. **Runtime Sync**: OpenClaw's model picker instantly reflects new/removed models

### Using Discovered Models

Once discovered, models are available in the OpenClaw chat interface:

1. In the chat, type `/models lmstudio` to see all LM Studio models
2. Type `/model lmstudio/<model-id>` to switch to a specific model

Example:

```
/models lmstudio          # Show all LM Studio models
/model lmstudio/gpt-oss-20b-mlx  # Switch to this model
```

### Checking Discovered Models

To verify what models OpenClaw has discovered:

```bash
# From inside the container
docker exec openclaw-openclaw-gateway-1 \
  node -e "const fs=require('fs');const j=JSON.parse(fs.readFileSync('/home/node/.openclaw/agents/main/agent/models.json','utf8'));console.log('Models:',j.providers.lmstudio.models.length);j.providers.lmstudio.models.forEach(m=>console.log(' -',m.id))"
```

Or from the OpenClaw web UI:

- Go to http://localhost:18789/chat
- Type `/models lmstudio` to see the paginated list

## Troubleshooting

### Models not appearing in OpenClaw

If you don't see LM Studio models in the model picker:

1. **Verify LM Studio is running**:

   ```bash
   curl -s http://localhost:1234/v1/models | jq '.data | length'
   ```

2. **Check container can reach LM Studio**:

   ```bash
   docker exec openclaw-openclaw-gateway-1 \
     curl -s http://host.docker.internal:1234/v1/models | jq '.data | length'
   ```

3. **Wait for discovery cycle**: The refresh service runs every 10 seconds. Wait up to 30 seconds for models to appear.

4. **Check gateway logs for refresh service**:
   ```bash
   docker logs openclaw-openclaw-gateway-1 | grep -i "lmstudio\|refresh" | tail -20
   ```

### Models endpoint not accessible

If you get "connection refused" when querying models:

```bash
# Verify LM Studio is running on port 1234
lsof -i :1234

# Or test from host directly
curl -s http://localhost:1234/v1/models | jq '.data[] | .id' | head -3
```

### Configuration validation errors

If you get "GatewayRequestError: invalid config":

- Ensure model name matches exactly what's returned by `/models` endpoint
- Check that `OPENAI_API_KEY` environment variable is set (`lm-studio`)
- Verify `OPENAI_API_BASE` uses the correct Docker networking path (`http://host.docker.internal:1234/v1`)

### Chat messages not being sent

- Check gateway logs: `docker logs openclaw-openclaw-gateway-1 | tail -50`
- Verify LM Studio is actually running and accepting requests
- Confirm the model is loaded in LM Studio (check webUI at http://localhost:1234)

## Implementation Details

### Automatic Model Discovery Service

OpenClaw runs a background service (`src/gateway/lmstudio-refresh.ts`) that:

1. **Starts with the gateway**: Service initializes automatically on gateway startup
2. **Polls every 10 seconds**: Queries `OPENAI_API_BASE` endpoint for available models
3. **Pauses during inference**: Uses `getActiveTaskCount()` to skip discovery during active requests
4. **Compares model lists**: Only updates config if the list changed (efficient disk I/O)
5. **Persists changes**: Updates `~/.openclaw/agents/main/agent/models.json` atomically
6. **Handles failures gracefully**: Never crashes the gateway; logs warnings instead

### Configuration Flow

```
LM Studio running on :1234
        ↓
Docker container with OPENAI_API_BASE=http://host.docker.internal:1234/v1
        ↓
OpenClaw gateway started
        ↓
Refresh service queries /v1/models endpoint every 10 seconds
        ↓
Models discovered and stored in models.json
        ↓
Chat UI shows available models from /models lmstudio command
```

### Environment Setup

The integration requires:

**docker-compose.yml** (gateway service):

```yaml
environment:
  OPENAI_API_BASE: ${OPENAI_API_BASE:-http://host.docker.internal:1234/v1}
  OPENAI_API_KEY: ${OPENAI_API_KEY}
extra_hosts:
  - "host.docker.internal:host-gateway"
```

**.env** (optional overrides):

```env
OPENAI_API_BASE=http://host.docker.internal:1234/v1
OPENAI_API_KEY=lm-studio
```

### Model Metadata

Discovered models include automatically computed properties:

- **Context Window**: 128,000 tokens (LM Studio default)
- **Max Tokens**: 8,192 output tokens
- **Cost**: $0.00 (local inference, no API charges)
- **Reasoning Detection**: Automatically enabled for models containing "reasoning", "r1", or "think" in the name
- **Input Types**: Text-only

## Next Steps
