# Domain Availability MCP Server

Check whether domain names are available to register — from Claude, Cursor, Codex, VS Code or any MCP client.

Every answer comes from a live registry lookup (RDAP / WHOIS), with first-year and renewal prices and a link to register.

Hosted by [Namechan](https://namechan.com/domain-availability-mcp).

## Tools

| Tool | What it does |
| --- | --- |
| `check_domains` | Check a list of complete names (`acme.com`, `getacme.io`, …) in one call. Each result is `available`, `taken`, `reserved`, `unsupported` or `unknown`, with price and register link for free names and the registration date for taken ones. |
| `check_name` | Check one keyword across many extensions (defaults: com, ai, net, org, io, co, xyz, app, dev, run). |
| `whois_lookup` | Registration and expiry dates, age, registrar, status codes and nameservers of one domain. |
| `get_usage` | Lookups used and left today. |

All tools are read-only. `unknown` means the registry did not answer in time — it is never reported as available. A price with `basis: "list"` is the extension's standard rate (the registrar did not quote this exact name in time), so a premium name could cost more; `basis: "quote"` is the registrar's price for that name.

## Free, no key needed

Every tool works without an account or API key, within a per-address limit (the same as using namechan.com without signing in). For more, sign in at <https://namechan.com/api-keys> and create a free key (it starts with `nck_`): calls with it count against your account instead, with a larger allowance. `get_usage` shows what is left either way.

## Connect

### Remote (recommended)

The server runs at `https://namechan.com/mcp` (Streamable HTTP). With a key, add the header `Authorization: Bearer <key>`; without one, leave it out.

**Claude Code**

```sh
claude mcp add -s user --transport http domain-availability https://namechan.com/mcp
```

With a key — also the way to add one to an existing setup, since `add` refuses a name that is already there:

```sh
claude mcp remove -s user domain-availability 2>/dev/null; \
claude mcp add -s user --transport http domain-availability https://namechan.com/mcp \
  --header "Authorization: Bearer nck_YOUR_API_KEY"
```

**Cursor** — `~/.cursor/mcp.json`

```json
{
  "mcpServers": {
    "domain-availability": {
      "url": "https://namechan.com/mcp"
    }
  }
}
```

Add `"headers": { "Authorization": "Bearer nck_YOUR_API_KEY" }` next to `url` to use a key.

**VS Code** — `.vscode/mcp.json`

```json
{
  "servers": {
    "domain-availability": {
      "type": "http",
      "url": "https://namechan.com/mcp"
    }
  }
}
```

### Local (stdio)

For clients that only start local servers, this package bridges stdio to the remote endpoint. It has no dependencies and needs Node.js 18+.

**Claude Desktop** — `claude_desktop_config.json`

```json
{
  "mcpServers": {
    "domain-availability": {
      "command": "npx",
      "args": ["-y", "domain-availability-mcp"]
    }
  }
}
```

**Codex** — `~/.codex/config.toml`

```toml
[mcp_servers.domain-availability]
command = "npx"
args = ["-y", "domain-availability-mcp"]
# optional: env = { NAMECHAN_API_KEY = "nck_YOUR_API_KEY" }
```

With a key, the package reads it from `NAMECHAN_API_KEY` (add `"env": { "NAMECHAN_API_KEY": "nck_…" }` to the config above), or from `~/.config/namechan/api-key` (keep it `chmod 600`) when the variable is not set.

## Example prompts

- "Find a short name for a budgeting app and check which .com and .ai domains are free."
- "Which of these are available: brightnest.com, brightnest.io, getbrightnest.com?"
- "When does example.com expire?"

## HTTP API

The same lookups are available without MCP:

```sh
curl "https://namechan.com/api/v1/check?domains=acme.com,acme.io"
# add  -H "Authorization: Bearer nck_YOUR_API_KEY"  to use a key
```

See also the [Namechan agent skill](https://github.com/plusye/domain-availability-skill), which adds a naming workflow on top of these lookups.

## License

MIT
