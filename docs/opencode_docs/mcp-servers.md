# MCP Servers

Add local and remote MCP tools.

You can add external tools to OpenCode using the *Model Context Protocol*, or MCP. OpenCode supports both local and remote servers.

Once added, MCP tools are automatically available to the LLM alongside built-in tools.

> MCP servers add to your context, so you want to be careful with which ones you enable.

---

## Enable

You can define MCP servers in your OpenCode Config under `mcp`. Add each MCP with a unique name.

```jsonc
{
  "$schema": "https://opencode.ai/config.json",
  "mcp": {
    "name-of-mcp-server": {
      // ...
      "enabled": true,
    },
    "name-of-other-mcp-server": {
      // ...
    },
  },
}
```

You can also disable a server by setting `enabled` to `false`.

### Overriding remote defaults

Organizations can provide default MCP servers via their `.well-known/opencode` endpoint. To enable a specific server from your organization's remote config, add it to your local config with `enabled: true`.

---

## Local

Add local MCP servers using `type` to `"local"` within the MCP object.

```jsonc
{
  "$schema": "https://opencode.ai/config.json",
  "mcp": {
    "my-local-mcp-server": {
      "type": "local",
      "command": ["npx", "-y", "my-mcp-command"],
      "enabled": true,
      "environment": {
        "MY_ENV_VAR": "my_env_var_value",
      },
    },
  },
}
```

### Local Options

| Option | Type | Required | Description |
|--------|------|----------|-------------|
| `type` | String | Y | Must be `"local"` |
| `command` | Array | Y | Command and arguments to run the MCP server |
| `cwd` | String | | Working directory for the MCP server process |
| `environment` | Object | | Environment variables to set |
| `enabled` | Boolean | | Enable or disable on startup |
| `timeout` | Number | | Timeout in ms for fetching tools (default: 5000) |

---

## Remote

Add remote MCP servers by setting `type` to `"remote"`.

```json
{
  "$schema": "https://opencode.ai/config.json",
  "mcp": {
    "my-remote-mcp": {
      "type": "remote",
      "url": "https://my-mcp-server.com",
      "enabled": true,
      "headers": {
        "Authorization": "Bearer MY_API_KEY"
      }
    }
  }
}
```

### Remote Options

| Option | Type | Required | Description |
|--------|------|----------|-------------|
| `type` | String | Y | Must be `"remote"` |
| `url` | String | Y | URL of the remote MCP server |
| `enabled` | Boolean | | Enable or disable on startup |
| `headers` | Object | | Headers to send with the request |
| `oauth` | Object | | OAuth authentication configuration |
| `timeout` | Number | | Timeout in ms for fetching tools (default: 5000) |

---

## OAuth

OpenCode automatically handles OAuth authentication for remote MCP servers:

1. Detect the 401 response and initiate the OAuth flow
2. Use **Dynamic Client Registration (RFC 7591)** if supported
3. Store tokens securely for future requests

### Automatic

For most OAuth-enabled MCP servers, no special configuration is needed. Just configure the remote server and OpenCode will prompt you to authenticate when first used.

### Pre-registered

```json
{
  "mcp": {
    "my-oauth-server": {
      "type": "remote",
      "url": "https://mcp.example.com/mcp",
      "oauth": {
        "clientId": "{env:MY_MCP_CLIENT_ID}",
        "clientSecret": "{env:MY_MCP_CLIENT_SECRET}",
        "scope": "tools:read tools:execute"
      }
    }
  }
}
```

### Authenticating

```bash
# Authenticate with a specific MCP server
opencode mcp auth my-oauth-server

# List all MCP servers and their auth status
opencode mcp list

# Remove stored credentials
opencode mcp logout my-oauth-server
```

### Disabling OAuth

Set `oauth` to `false` for servers that use API keys instead:

```json
{
  "mcp": {
    "my-api-key-server": {
      "type": "remote",
      "url": "https://mcp.example.com/mcp",
      "oauth": false,
      "headers": {
        "Authorization": "Bearer {env:MY_API_KEY}"
      }
    }
  }
}
```

---

## Manage

### Global

Enable or disable MCP tools globally:

```json
{
  "tools": {
    "my-mcp-foo": false
  }
}
```

Use glob pattern to disable all matching MCPs:

```json
{
  "tools": {
    "my-mcp*": false
  }
}
```

### Per agent

Disable globally, enable per agent:

```json
{
  "tools": {
    "my-mcp*": false
  },
  "agent": {
    "my-agent": {
      "tools": {
        "my-mcp*": true
      }
    }
  }
}
```

### Glob patterns

- `*` matches zero or more of any character
- `?` matches exactly one character
- MCP server tools are registered with server name as prefix: `"mymcpservername_*": false`

---

## Examples

### Sentry

```json
{
  "mcp": {
    "sentry": {
      "type": "remote",
      "url": "https://mcp.sentry.dev/mcp",
      "oauth": {}
    }
  }
}
```

Authenticate: `opencode mcp auth sentry`

### Context7

```json
{
  "mcp": {
    "context7": {
      "type": "remote",
      "url": "https://mcp.context7.com/mcp"
    }
  }
}
```

With API key for higher rate-limits:

```json
{
  "mcp": {
    "context7": {
      "type": "remote",
      "url": "https://mcp.context7.com/mcp",
      "headers": {
        "CONTEXT7_API_KEY": "{env:CONTEXT7_API_KEY}"
      }
    }
  }
}
```

### Grep by Vercel

```json
{
  "mcp": {
    "gh_grep": {
      "type": "remote",
      "url": "https://mcp.grep.app"
    }
  }
}
```

Add to AGENTS.md: `If you are unsure how to do something, use gh_grep to search code examples from GitHub.`
