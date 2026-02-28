# OpenClaw + LM Studio: Bypassing Harmony (openai-completions) Format

## What Was Changed

You were previously using the **OpenAI Completions API** (legacy "Harmony" format), which severely limits what OpenClaw can do with LM Studio. This has been **upgraded to the OpenAI Responses API**, a modern structured format that supports:

### ✨ New Capabilities Enabled

- **Tool Use & Function Calling**: Full support for structured tool invocation and results
- **Streaming Responses**: Better streaming of structured outputs
- **Content Blocks**: Proper separation of reasoning, text, and tool calls
- **Better Context Management**: Automatic compaction and token management
- **Flexible Output Handling**: Support for different content types and formats
- **Improved Error Handling**: Better error reporting and recovery

## Configuration Changes

### Before (Limited Harmony Format)

```json
{
  "models": {
    "providers": {
      "openai": {
        "baseUrl": "http://host.docker.internal:1234/v1",
        "api": "openai-completions" // ❌ Legacy, limited
      }
    }
  }
}
```

### After (Modern Responses API)

```json
{
  "models": {
    "providers": {
      "openai": {
        "baseUrl": "http://host.docker.internal:1234/v1",
        "api": "openai-responses", // ✅ Modern, full-featured
        "models": [
          {
            "id": "openai/gpt-oss-20b",
            "reasoning": false,
            "input": ["text"],
            "cost": { "input": 0, "output": 0, "cacheRead": 0, "cacheWrite": 0 },
            "contextWindow": 128000,
            "maxTokens": 8192
          }
          // ... all 20+ models now properly configured
        ]
      }
    }
  }
}
```

## Next Steps

### 1. Restart the OpenClaw Gateway

The gateway automatically picks up configuration changes:

```bash
# If running in Docker:
docker compose down
docker compose up -d

# If running native on Mac:
pkill -f "openclaw.*gateway"
openclaw gateway run --bind loopback --port 18789
```

### 2. Test the New API Format

```bash
# Send a test message through the web interface at:
http://localhost:18789

# Or via CLI:
openclaw message send "Hello, can you help me with a task?"
```

### 3. Verify Tool Support

The new responses API enables full tool support. Try:

- Running commands with the bash tool
- Using file operations
- Calling other structured tools

## Technical Details

### API Format Differences

**Legacy openai-completions (Harmony)**:

- Simple text completion format
- Limited to basic string responses
- No structured tool definitions
- Missing streaming event types

**Modern openai-responses**:

- Item-based messages with multiple content types
- Streaming semantic events (output_item.added, content_part.done, etc.)
- Full tool call support with proper call_id tracking
- Reasoning blocks separated from final output
- Better error handling and status tracking

### What LM Studio Needs to Support

Your LM Studio instance already supports both formats via its OpenAI-compatible endpoint. The `openai-responses` format is the **modern standard** and OpenClaw now expects:

```
POST http://localhost:1234/v1/chat/completions
Headers: Authorization: Bearer lm-studio
Body: {
  "model": "openai/gpt-oss-20b",
  "messages": [...],
  "tools": [...],
  "stream": true,
  "max_tokens": 8192
}
```

## Troubleshooting

### If models fail to load:

1. Verify LM Studio is running: `curl http://localhost:1234/v1/models`
2. Check gateway logs: `tail -f ~/.openclaw/logs/*.log`
3. Ensure the model ID matches exactly what LM Studio reports

### If streaming seems broken:

- The responses API uses SSE (Server-Sent Events) - more robust than raw streaming
- Check that your LM Studio version supports the standard OpenAI endpoint
- Verify network connectivity between gateway and LM Studio

### Performance considerations:

- The responses format has minimal overhead over completions
- Better streaming reduces perceived latency
- Token accounting is more accurate

## Reverting (If Needed)

If you need to revert to the old format:

```bash
# Edit config manually or run:
cat ~/.openclaw/openclaw.json | jq '.models.providers.openai.api = "openai-completions"' > ~/.openclaw/openclaw.json.tmp
mv ~/.openclaw/openclaw.json.tmp ~/.openclaw/openclaw.json
```

But we recommend staying on responses API - it's the future standard!

## Further Optimization

Once you've confirmed the responses API works, consider:

1. **Load a better model** that supports tool use natively
   - Qwen and Deepseek models have better reasoning
   - Check available models: `curl http://localhost:1234/v1/models`

2. **Enable reasoning** for models that support it:

   ```json
   { "id": "model-with-reasoning", "reasoning": true, ... }
   ```

3. **Fine-tune context windows** based on your model:

   ```json
   { "contextWindow": 65536, "maxTokens": 4096 }
   ```

4. **Add model-specific compat flags** if needed:
   ```json
   {
     "id": "special-model",
     "compat": {
       "thinkingFormat": "qwen",
       "maxTokensField": "max_completion_tokens"
     }
   }
   ```

## Questions?

Check the OpenClaw docs:

- Gateway Configuration: https://docs.openclaw.ai/gateway/configuration
- Local Models: https://docs.openclaw.ai/gateway/local-models
- Model Providers: https://docs.openclaw.ai/concepts/model-providers
