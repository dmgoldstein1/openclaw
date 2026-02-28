# OpenClaw + LM Studio Setup Guide

This guide documents the complete setup process for running OpenClaw in Docker with integration to a local LM Studio instance for language model inference.

**Date Created**: February 27, 2026  
**OpenClaw Version**: 2026.2.27 (dev)  
**Integration Type**: LM Studio OpenAI-compatible API

---

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Repository Setup](#repository-setup)
3. [Docker Configuration](#docker-configuration)
4. [OpenClaw Configuration](#openclaw-configuration)
5. [LM Studio Integration](#lm-studio-integration)
6. [Testing & Verification](#testing--verification)
7. [File References](#file-references)
8. [Troubleshooting](#troubleshooting)

---

## Prerequisites

- **macOS** (tested on Apple Silicon and Intel)
- **Docker Desktop** (v29.2.1 or later with Docker Compose v5.0.2+)
- **LM Studio** running on port `1234` with OpenAI-compatible API endpoint
- **Node.js** 22+ (for local development, not required for Docker)
- **Git** for repository cloning
- **curl** or similar tool for API testing

### System Requirements

- Minimum 8GB RAM (16GB+ recommended for LM Studio + OpenClaw)
- Sufficient disk space for Docker image (~2-3GB) and models
- Network connectivity for initial setup

---

## Repository Setup

### Step 1: Clone the OpenClaw Repository

```bash
cd ~/Documents/VibeCoding
git clone https://github.com/openclaw/openclaw.git
cd OpenClaw
```

**Result**: OpenClaw source code is now available locally at `/Users/danielgoldstein/Documents/VibeCoding/OpenClaw`

### Step 2: Verify Repository Structure

The repository should contain the following key directories:

- `src/` - Source code
- `dist/` - Built output (generated during Docker build)
- `docs/` - Documentation
- `.github/` - GitHub configuration and workflows

---

## Docker Configuration

### Step 1: Build Docker Image

```bash
cd /Users/danielgoldstein/Documents/VibeCoding/OpenClaw
docker build -t openclaw:local .
```

**Expected Output**: Image built successfully in approximately 60-90 seconds  
**Image Size**: ~1.5-2GB  
**Result**: Local Docker image `openclaw:local` is ready for use

### Step 2: Create Environment File (.env)

Create a `.env` file in the project root with LM Studio connection details:

**File**: `/Users/danielgoldstein/Documents/VibeCoding/OpenClaw/.env`

```env
# LM Studio Connection Configuration
OPENAI_API_BASE=http://host.docker.internal:1234/v1
OPENAI_API_KEY=lm-studio
```

**Note**:

- `host.docker.internal` is a special hostname that Docker Desktop provides to access the host machine from inside a container
- The API key can be any value; LM Studio doesn't validate it by default
- These environment variables are passed to the gateway container via docker-compose.yml

### Step 3: Create docker-compose.yml

Create a Docker Compose configuration file to manage the OpenClaw gateway container:

**File**: `/Users/danielgoldstein/Documents/VibeCoding/OpenClaw/docker-compose.yml`

```yaml
version: "3.8"

services:
  openclaw-gateway:
    image: openclaw:local
    restart: unless-stopped
    ports:
      - "18789:18789"
      - "18790:18790"
    volumes:
      - ~/.openclaw:/home/node/.openclaw
      - ~/.openclaw/workspace:/home/node/.openclaw/workspace
    environment:
      - OPENAI_API_BASE=http://host.docker.internal:1234/v1
      - OPENAI_API_KEY=lm-studio
    command: openclaw gateway run --bind 0.0.0.0 --port 18789
```

**Configuration Details**:

- **Image**: Uses the locally built `openclaw:local` image
- **Ports**:
  - `18789` - WebSocket gateway (chat interface)
  - `18790` - Alternative port for redundancy
- **Volumes**:
  - ~/.openclaw - Mounts the host's OpenClaw config directory (persistent configuration)
  - ~/.openclaw/workspace - Mounts workspace for agent file operations
- **Environment**: LM Studio connection variables
- **Bind Address**: `0.0.0.0` allows access from the host machine

### Step 4: Start the Gateway Container

```bash
cd /Users/danielgoldstein/Documents/VibeCoding/OpenClaw
docker-compose up -d openclaw-gateway
```

**Expected Output**:

```
[+] Running 2/2
 ✔ Network openclaw_default Created
 ✔ Container openclaw-openclaw-gateway-1 Created
```

**Verification**:

```bash
docker ps | grep openclaw-gateway
```

Should show the container is running with ports `18789->18789/tcp` exposed.

---

## OpenClaw Configuration

### Step 1: Create OpenClaw Configuration File

The gateway automatically creates `~/.openclaw/openclaw.json` on first run if it doesn't exist. However, we need to configure it with:

1. Gateway authentication token
2. Model provider settings
3. Default agent model

**File**: `~/.openclaw/openclaw.json`

Generate this after the container starts initially (Step 4 above), then modify it with the following structure:

```json
{
  "meta": {
    "lastTouchedVersion": "2026.2.27",
    "lastTouchedAt": "2026-02-28T03:52:36.384Z"
  },
  "agents": {
    "defaults": {
      "model": "openai/gpt-oss-20b"
    }
  },
  "models": {
    "providers": {
      "openai": {
        "baseUrl": "http://host.docker.internal:1234/v1",
        "apiKey": { "source": "env", "provider": "default", "id": "OPENAI_API_KEY" },
        "models": []
      }
    }
  },
  "commands": {
    "native": "auto",
    "nativeSkills": "auto",
    "restart": true,
    "ownerDisplay": "raw"
  },
  "gateway": {
    "mode": "local",
    "controlUi": {
      "dangerouslyAllowHostHeaderOriginFallback": true
    },
    "auth": {
      "token": "a22028b4875c9678a45ea710d4435793281f9ec1eb11b09a21c08128e4dc9b74"
    }
  }
}
```

**Key Configuration Elements**:

- **agents.defaults.model**: Set to the default LM Studio model (e.g., `openai/gpt-oss-20b`)
- **models.providers.openai.baseUrl**: LM Studio API endpoint (must reach from inside container)
- **models.providers.openai.apiKey**: References `OPENAI_API_KEY` environment variable
- **gateway.mode**: `"local"` for local-only access
- **gateway.auth.token**: Authentication token for secure access (generate new if needed)

### Step 2: Access the Web Interface

1. Open your browser and navigate to: `http://localhost:18789`
2. You should see the OpenClaw Gateway Dashboard
3. **Health Status** should show "OK"
4. **Version** should show "dev"

### Step 3: Approve Device Pairing

When first accessing the web interface:

1. You may see a pairing request or device approval dialog
2. Approve this from another authenticated device or through the gateway logs
3. Once approved, the session will be active for subsequent accesses

---

## LM Studio Integration

### Step 1: Verify LM Studio is Running

Ensure LM Studio is running on your host machine and the API is accessible on port 1234:

```bash
curl -s http://localhost:1234/v1/models | jq '.data[0]'
```

**Expected Response**:

```json
{
  "id": "openai/gpt-oss-20b",
  "object": "model",
  "owned_by": "organization_owner"
}
```

### Step 2: Query Available Models

Get a complete list of all models available in your LM Studio instance:

```bash
docker exec openclaw-openclaw-gateway-1 curl -s http://host.docker.internal:1234/v1/models | jq '.data[] | .id' | tr -d '"' | sort
```

**Expected Output**: List of 25+ model IDs (example):

```
allenai/olmo-3-32b-think
allenai/olmocr-2-7b
bytedance/seed-oss-36b
essentialai/rnj-1
gpt-oss-20b-mlx
ibm/granite-3.1-8b
...
```

### Step 3: Populate Models in Configuration

Update the `models.providers.openai.models` array in `openclaw.json` with ALL available models from LM Studio. Each model must have:

- `id`: The exact model identifier from LM Studio
- `name`: A human-readable display name

**Example Entry**:

```json
{ "id": "openai/gpt-oss-20b", "name": "OpenAI GPT OSS 20B" }
```

**Complete Models Array** (25 models):

```json
"models": [
  { "id": "allenai/olmo-3-32b-think", "name": "Allenai Olmo 3 32B Think" },
  { "id": "allenai/olmocr-2-7b", "name": "Allenai OlmoCR 2 7B" },
  { "id": "bytedance/seed-oss-36b", "name": "ByteDance Seed OSS 36B" },
  { "id": "essentialai/rnj-1", "name": "EssentialAI RNJ 1" },
  { "id": "gpt-oss-20b-mlx", "name": "GPT OSS 20B MLX" },
  { "id": "ibm/granite-3.1-8b", "name": "IBM Granite 3.1 8B" },
  { "id": "ibm/granite-4-h-tiny", "name": "IBM Granite 4 H Tiny" },
  { "id": "kimi-dev-72b", "name": "Kimi Dev 72B" },
  { "id": "llama-3.2-1b-instruct", "name": "Llama 3.2 1B Instruct" },
  { "id": "mistralai/devstral-small-2-2512", "name": "Mistral Devstral Small 2 2512" },
  { "id": "mistralai/magistral-small-2509", "name": "Mistral Magistral Small 2509" },
  { "id": "mistralai/ministral-3-14b-reasoning", "name": "Mistral Ministral 3 14B Reasoning" },
  { "id": "nvidia/nemotron-3-nano", "name": "NVIDIA Nemotron 3 Nano" },
  { "id": "openai/gpt-oss-20b", "name": "OpenAI GPT OSS 20B" },
  { "id": "qwen/qwen3-coder-30b", "name": "Qwen 3 Coder 30B" },
  { "id": "qwen/qwen3-coder-next", "name": "Qwen 3 Coder Next" },
  { "id": "qwen/qwen3-next-80b", "name": "Qwen 3 Next 80B" },
  { "id": "qwen/qwen3-vl-30b", "name": "Qwen 3 VL 30B" },
  { "id": "qwen/qwen3-vl-8b", "name": "Qwen 3 VL 8B" },
  { "id": "qwen/qwq-32b", "name": "Qwen QWQ 32B" },
  { "id": "qwen2.5-0.5b-instruct-mlx", "name": "Qwen 2.5 0.5B Instruct MLX" },
  { "id": "text-embedding-nomic-embed-text-v1.5", "name": "Nomic Embed Text v1.5" },
  { "id": "text-embedding-qwen3-embedding-0.6b", "name": "Qwen 3 Embedding 0.6B" },
  { "id": "zai-org/glm-4.6v-flash", "name": "GLM 4.6V Flash" },
  { "id": "zai-org/glm-4.7-flash", "name": "GLM 4.7 Flash" }
]
```

### Step 4: Restart the Gateway

After updating the configuration, restart the gateway container to load the new models:

```bash
cd /Users/danielgoldstein/Documents/VibeCoding/OpenClaw
docker-compose restart openclaw-gateway
```

**Verification** - Check that the gateway started with the correct model:

```bash
docker logs openclaw-openclaw-gateway-1 2>&1 | grep -E "agent model|listening on"
```

**Expected Output**:

```
2026-02-28T04:15:32.931Z [gateway] agent model: openai/gpt-oss-20b
2026-02-28T04:15:32.933Z [gateway] listening on ws://0.0.0.0:18789 (PID 7)
```

---

## Testing & Verification

### Test 1: Gateway Health

1. Navigate to `http://localhost:18789` in your browser
2. Check the header shows "Health: OK"
3. Verify the gateway dashboard loads without errors

### Test 2: Direct API Test (curl)

Test LM Studio connectivity directly:

```bash
curl -s -X POST http://localhost:1234/v1/completions \
  -H "Content-Type: application/json" \
  -d '{"model":"openai/gpt-oss-20b","prompt":"Hello world:","max_tokens":20}' \
  | jq '.choices[0].text'
```

**Expected**: Text completion from the model

### Test 3: Chat Interface

1. Navigate to the Chat section in OpenClaw (`http://localhost:18789/chat`)
2. Type a test message: "Hello! What model are you using?"
3. Click "Send" or press Enter
4. The agent should process the message and return a response from LM Studio

**Successful Integration Indicators**:

- Message appears in the chat with "You" label and timestamp
- Agent processes the message (loader appears)
- Response is generated from the LM Studio model
- Agent completes normally without errors

### Test 4: Check Gateway Logs

```bash
docker logs openclaw-openclaw-gateway-1 2>&1 | tail -50
```

Should show:

- Successful startup messages
- No configuration errors
- Model loadingsuccessfully
- WebSocket connections from the browser

---

## File References

### Files Created/Modified

#### 1. Docker Compose Configuration

- **Path**: `/Users/danielgoldstein/Documents/VibeCoding/OpenClaw/docker-compose.yml`
- **Purpose**: Define containerized OpenClaw gateway service
- **Key Changes**: Added environment variables for LM Studio connection

#### 2. Environment Variables

- **Path**: `/Users/danielgoldstein/Documents/VibeCoding/OpenClaw/.env`
- **Purpose**: Store LM Studio connection details
- **Contains**:
  - `OPENAI_API_BASE`: LM Studio API endpoint
  - `OPENAI_API_KEY`: Authentication key for API

#### 3. OpenClaw Configuration

- **Path**: `~/.openclaw/openclaw.json`
- **Purpose**: Gateway configuration including models, auth, and defaults
- **Key Sections**:
  - `agents.defaults.model`: Default language model
  - `models.providers.openai`: LM Studio provider configuration
  - `gateway.auth.token`: Authentication token
  - `gateway.mode`: Gateway mode (local/cloud)

#### 4. Documentation

- **Path**: `/Users/danielgoldstein/Documents/VibeCoding/OpenClaw/LM_STUDIO_INTEGRATION.md`
- **Purpose**: Integration documentation and troubleshooting notes
- **Path**: `/Users/danielgoldstein/Documents/VibeCoding/OpenClaw/SETUP_GUIDE.md`
- **Purpose**: This comprehensive setup guide

### Network Architecture

```
┌─────────────────────────────────────┐
│         Host Machine (macOS)        │
│                                     │
│  ┌────────────────────────────┐    │
│  │  LM Studio (port 1234)     │    │
│  │  OpenAI-compatible API     │    │
│  │  25 models available       │    │
│  └────────────────────────────┘    │
│           ↑                         │
│       localhost:1234                │
│                                     │
│  ┌────────────────────────────┐    │
│  │  Docker Desktop            │    │
│  │                            │    │
│  │  ┌──────────────────────┐  │    │
│  │  │  OpenClaw Gateway    │  │    │
│  │  │  (container)         │  │    │
│  │  │  Port: 18789         │  │    │
│  │  │                      │  │    │
│  │  │  Uses:               │  │    │
│  │  │  host.docker.internal:1234  │
│  │  └──────────────────────┘  │    │
│  └────────────────────────────┘    │
│           ↑                         │
│      localhost:18789               │
│                                     │
│  ┌────────────────────────────┐    │
│  │  Web Browser               │    │
│  │  Chat Interface            │    │
│  └────────────────────────────┘    │
└─────────────────────────────────────┘
```

---

## Troubleshooting

### Issue: "Unknown model: openai/gpt-oss-20b"

**Cause**: The models array in `openclaw.json` is missing or incorrectly formatted.

**Solution**:

1. Verify models array is populated with both `id` and `name` fields
2. Restart the gateway: `docker-compose restart openclaw-gateway`
3. Check logs: `docker logs openclaw-openclaw-gateway-1`

### Issue: Connection refused to LM Studio

**Cause**: LM Studio not running or not accessible from the container.

**Solution**:

1. Verify LM Studio is running on the host: `curl http://localhost:1234/v1/models`
2. Check that Docker can reach the host: `docker exec openclaw-openclaw-gateway-1 curl http://host.docker.internal:1234/v1/models`
3. Verify the endpoint in `.env` and `openclaw.json` is correct

### Issue: Gateway container won't start

**Cause**: Various configuration or resource issues.

**Solution**:

1. Check logs: `docker logs openclaw-openclaw-gateway-1`
2. Verify image exists: `docker images | grep openclaw:local`
3. Rebuild image if needed: `docker build -t openclaw:local .`
4. Check disk space: `docker system df`
5. Ensure ports 18789-18790 are available

### Issue: Browser can't connect to gateway

**Cause**: Gateway not accessible or misconfigured.

**Solution**:

1. Verify container is running: `docker ps | grep openclaw-gateway`
2. Check port mapping: `netstat -an | grep 18789` (or `lsof -i:18789`)
3. Try accessing via IP instead of localhost: `http://127.0.0.1:18789`
4. Clear browser cache and retry

### Issue: Models load but chat fails

**Cause**: Model exists in configuration but not available in LM Studio or has a mismatch.

**Solution**:

1. Verify the model actually exists: `curl http://localhost:1234/v1/models | jq '.data[] | select(.id=="openai/gpt-oss-20b")'`
2. Compare LM Studio model IDs with `openclaw.json` - they must match exactly
3. Check LM Studio logs to see if the model was unloaded
4. Restart LM Studio and reload the model if needed

### Debug: Check Container Logs

For detailed troubleshooting, view the full gateway logs:

```bash
# Last 50 lines
docker logs openclaw-openclaw-gateway-1 | tail -50

# Follow logs in real-time
docker logs -f openclaw-openclaw-gateway-1

# Filter for errors
docker logs openclaw-openclaw-gateway-1 2>&1 | grep -i error
```

### Debug: Verify Configuration

Check if the gateway loaded the configuration correctly:

```bash
docker exec openclaw-openclaw-gateway-1 cat /home/node/.openclaw/openclaw.json | jq '.models.providers'
```

This should show the complete models provider configuration with all 25 models.

---

## Next Steps

### Optional Enhancements

1. **Custom Models**: Add additional LM Studio models to the models array
2. **Model Switching**: Implement UI to switch between default models
3. **Performance Tuning**: Adjust Docker resource limits if needed
4. **Persistence**: Ensure `~/.openclaw` volume is backed up
5. **Scripting**: Create shell scripts for start/stop/restart automation

### Learning Resources

- [OpenClaw Documentation](https://docs.openclaw.ai/)
- [LM Studio Guide](https://lmstudio.ai/)
- [Docker Compose Reference](https://docs.docker.com/compose/)

### Support & Issues

If you encounter issues:

1. Check this troubleshooting section first
2. Review gateway logs for specific error messages
3. Verify LM Studio is functional with direct API calls
4. Check OpenClaw documentation at https://docs.openclaw.ai/

---

## Summary

You now have a fully functional OpenClaw installation with local LM Studio integration:

- ✅ OpenClaw gateway running in Docker container
- ✅ 25 models discovered and configured from LM Studio
- ✅ Web-based chat interface operational
- ✅ Persistent configuration stored in `~/.openclaw`
- ✅ Full agentic capabilities using local models
- ✅ No cloud API dependencies for language models

The setup is reproducible and can be started with a single command:

```bash
docker-compose up -d
```

And accessed at `http://localhost:18789` in your browser.
