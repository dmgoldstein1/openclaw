# OpenClaw Docker Setup - Access Guide

## Status: Running ✓

Your OpenClaw gateway is now running in Docker and accessible from your browser!

## Web Access

**Open your browser and navigate to:**

```
http://localhost:18789
```

This will open the OpenClaw Control UI where you can:

- Manage configuration
- Set up channels (WhatsApp, Telegram, Discord, Slack, etc.)
- Configure AI models and API keys
- Monitor agent activity
- Manage workspace settings

## Gateway Details

- **Gateway Address**: http://localhost:18789
- **Gateway Port**: 18789
- **Gateway Token**: `a22028b4875c9678a45ea710d4435793281f9ec1eb11b09a21c08128e4dc9b74`
- **Binding**: LAN (accessible from this machine and local network)
- **Config Directory**: `~/.openclaw/`
- **Workspace Directory**: `~/.openclaw/workspace/`

## Docker Commands

### View logs

```bash
cd /Users/danielgoldstein/Documents/VibeCoding/OpenClaw
docker-compose logs -f openclaw-gateway
```

### Stop the gateway

```bash
cd /Users/danielgoldstein/Documents/VibeCoding/OpenClaw
docker-compose down
```

### Restart the gateway

```bash
cd /Users/danielgoldstein/Documents/VibeCoding/OpenClaw
docker-compose restart openclaw-gateway
```

### Start the gateway

```bash
cd /Users/danielgoldstein/Documents/VibeCoding/OpenClaw
docker-compose up -d openclaw-gateway
```

## Configuration Files

- **Docker Compose**: `/Users/danielgoldstein/Documents/VibeCoding/OpenClaw/docker-compose.yml`
- **Environment**: `/Users/danielgoldstein/Documents/VibeCoding/OpenClaw/.env`
- **OpenClaw Config**: `~/.openclaw/openclaw.json`

## Next Steps

1. Open http://localhost:18789 in your browser
2. You will be prompted for authentication using the gateway token
3. Complete the setup wizard to configure:
   - AI model provider (OpenAI, Anthropic, etc.)
   - Communication channels (WhatsApp, Telegram, Discord, etc.)
   - Skills and extensions

## Important Notes

⚠️ **Security Warning**: The current configuration uses `dangerouslyAllowHostHeaderOriginFallback=true` for development convenience. For production use, configure specific allowed origins in `~/.openclaw/openclaw.json`.

## Troubleshooting

If you don't see the web interface:

1. Check that the container is running: `docker-compose ps`
2. Check logs for errors: `docker-compose logs openclaw-gateway`
3. Ensure port 18789 is not blocked by firewall
4. Try accessing from a different browser or incognito mode

## Documentation

- Main docs: https://docs.openclaw.ai
- Getting Started: https://docs.openclaw.ai/start/getting-started
- Docker Guide: https://docs.openclaw.ai/install/docker
- Discord: https://discord.gg/clawd
