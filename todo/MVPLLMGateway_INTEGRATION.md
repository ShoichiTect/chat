# mvp-llm-gateway Integration with Chat SDK on Cloudflare Workers

This document summarizes the investigation findings and proposed implementation plan for integrating the Chat SDK into `mvp-llm-gateway`, targeting Slack and other Chat SaaS platforms, with full support for Cloudflare Workers and Durable Objects.

## 1. Background

The `mvp-llm-gateway` project already runs on Cloudflare Workers with Hono and uses Durable Objects (`ChatSessionDO`) for stateful agent sessions. The goal is to integrate the Chat SDK's adapter layer (starting with `adapter-slack`) into this architecture, enabling Slack-triggered LLM agent interactions managed through Durable Objects.

Existing plans in `mvp-llm-gateway/docs-2/plans/` include:
- `impl-slack-integration/` — phased Slack integration plan
- `2026-02-migrate-to-durable-objects.md` — DO migration plan
- `2026-02-cloudflare-workers-stabilization.md` — Workers stabilization plan
- `2026-02-migrate-to-cloudflare-agents-sdk.md` — Cloudflare Agents SDK migration plan

These plans are directly relevant and should be read alongside this document.

## 2. Key Technical Challenges

### 2.1. `node:crypto` Dependency in `adapter-slack`

- **Location**: `packages/adapter-slack/src/crypto.ts`, `packages/adapter-slack/src/index.ts`
- **Issue**: The `verifySignature` function uses `node:crypto`'s `createHmac` to verify Slack request signatures. This API is unavailable in Cloudflare Workers.
- **Solution**: Replace with the **Web Crypto API** (`crypto.subtle.importKey` + `crypto.subtle.sign`). A working reference implementation already exists in `mvp-llm-gateway/apps/server/src/lib/crypto.ts` (used for JWT verification).

### 2.2. `@slack/web-api` Incompatibility

- **Location**: `packages/adapter-slack/src/index.ts`
- **Issue**: `@slack/web-api` uses Node.js `http` internally and is not compatible with the `fetch`-based Cloudflare Workers runtime.
- **Solution (Option A — Recommended)**: Implement a minimal Slack API client using the standard `fetch` API, covering only the endpoints actually used (primarily `chat.postMessage`, `reactions.add`, etc.). This approach is already outlined in `mvp-llm-gateway/docs-2/plans/impl-slack-integration/`.
- **Solution (Option B)**: Replace with `slack-edge/slack-cloudflare-workers`, a community library designed for Workers compatibility. Evaluate maintenance status and feature coverage before adopting.

### 2.3. `AsyncLocalStorage` Usage

- **Location**: `packages/adapter-slack/src/index.ts` (request context management)
- **Issue**: `AsyncLocalStorage` from `node:async_hooks` is used to propagate per-request context (e.g., logging, workspace token). This API is not supported in Cloudflare Workers.
- **Solution**: Refactor to pass context explicitly as function arguments. In `mvp-llm-gateway`, Hono's `c` (Context) object already serves this purpose and should be used as the context carrier throughout the request lifecycle.

### 2.4. Missing `DurableObjectStateAdapter`

- **Location**: `packages/chat/src/types.ts` (interface definition)
- **Issue**: The `StateAdapter` interface is well-defined, and implementations exist for in-memory (`state-memory`) and Redis (`state-redis`, `state-ioredis`), but no Durable Objects implementation exists.
- **Solution**: Implement a new `DurableObjectStateAdapter` that uses `ctx.storage` (Durable Object storage API) for persistence. The existing `ChatSessionDO` in `mvp-llm-gateway/apps/server/src/durable-objects/ChatSessionDO.ts` demonstrates the storage patterns to follow.

## 3. Proposed Architecture

```
Slack Events API
      │
      ▼
[Cloudflare Worker — Hono Router]
  POST /api/slack/events
      │
      ├─ 1. Verify signature (Web Crypto HMAC-SHA256)
      ├─ 2. Route to Chat SDK adapter-slack handler
      │
      ▼
[PatchedSlackAdapter]  ←── fetch-based Slack API client
      │
      ├─ Resolves workspace token from DO storage
      │
      ▼
[Chat Core Logic]
      │
      ▼
[DurableObjectStateAdapter]
      │
      ▼
[ChatStateDO — Durable Object]
  ctx.storage: conversation history, subscriptions, locks
      │
      ▼
[ChatSessionDO — existing]
  runAgentLoopStream() → LLM call → response
      │
      ▼
[PatchedSlackAdapter.postMessage()]
  fetch("https://slack.com/api/chat.postMessage", ...)
```

## 4. Implementation Steps

### Step 1: Implement `DurableObjectStateAdapter`

Create a new package `packages/state-do` (or implement directly in `mvp-llm-gateway`) that satisfies the `StateAdapter` interface. Key methods to implement:

- `getState(key)` → `this.ctx.storage.get(key)`
- `setState(key, value)` → `this.ctx.storage.put(key, value)`
- `deleteState(key)` → `this.ctx.storage.delete(key)`
- Subscription management using DO alarms or in-memory maps within the DO

### Step 2: Patch `adapter-slack` for Workers Compatibility

Create `adapter-slack-cf` (or a conditional build target) with the following changes:

- **`crypto.ts`**: Replace `createHmac` with `crypto.subtle` HMAC-SHA256
- **`index.ts`**: Remove `AsyncLocalStorage`; pass context via function parameters
- **HTTP client**: Replace `@slack/web-api` with a minimal `fetch`-based client

Reference for HMAC-SHA256 with Web Crypto API:
```typescript
async function verifySignature(
  signingSecret: string,
  signature: string,
  timestamp: string,
  body: string
): Promise<boolean> {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(signingSecret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const data = encoder.encode(`v0:${timestamp}:${body}`);
  const signatureBuffer = await crypto.subtle.sign("HMAC", key, data);
  const computedSig = "v0=" + Array.from(new Uint8Array(signatureBuffer))
    .map(b => b.toString(16).padStart(2, "0"))
    .join("");
  return computedSig === signature;
}
```

### Step 3: Add Slack Event Endpoints in `mvp-llm-gateway`

In `apps/server/src/routes/` (or `apps/server/src/index.ts`), add:

```typescript
app.post("/api/slack/events", async (c) => {
  // 1. Verify Slack signature using Web Crypto
  // 2. Parse event payload
  // 3. Dispatch to Chat SDK adapter-slack handler
  // 4. Return 200 OK immediately (async processing via DO)
});
```

### Step 4: Wire `Chat` Instance with Adapters

In the Worker entry point, initialize the `Chat` instance with:
- `DurableObjectStateAdapter` backed by a `ChatStateDO`
- `PatchedSlackAdapter` using the fetch-based Slack client

### Step 5: Connect to Existing Agent Loop

Within the Slack event handler, after resolving the session via `DurableObjectStateAdapter`:
1. Get or create a `ChatSessionDO` stub for the thread
2. Call `chatSessionDO.runAgentLoopStream(message)` 
3. Stream the response back via `PatchedSlackAdapter.postMessage()`

## 5. Files to Create / Modify

| File | Action | Description |
|------|--------|-------------|
| `packages/state-do/src/index.ts` | Create | `DurableObjectStateAdapter` implementation |
| `packages/adapter-slack/src/crypto.ts` | Modify | Replace `node:crypto` with Web Crypto API |
| `packages/adapter-slack/src/index.ts` | Modify | Remove `AsyncLocalStorage`, add fetch-based Slack client |
| `mvp-llm-gateway/apps/server/src/routes/slack.ts` | Create | Hono route handlers for Slack Events API |
| `mvp-llm-gateway/apps/server/src/durable-objects/ChatStateDO.ts` | Create | DO for Chat SDK state management |
| `mvp-llm-gateway/apps/server/wrangler.toml` | Modify | Register new DO bindings |

## 6. References

- `chat/todo/CLOUDFLARE_SUPPORT.md` — Core Cloudflare adaptation strategy
- `mvp-llm-gateway/docs-2/plans/impl-slack-integration/` — Phased Slack integration plan
- `mvp-llm-gateway/apps/server/src/lib/crypto.ts` — Web Crypto API usage reference
- `mvp-llm-gateway/apps/server/src/durable-objects/ChatSessionDO.ts` — DO state management reference
- `chat/packages/chat/src/types.ts` — `StateAdapter` interface definition
- `chat/packages/state-memory/src/index.ts` — `StateAdapter` implementation reference
