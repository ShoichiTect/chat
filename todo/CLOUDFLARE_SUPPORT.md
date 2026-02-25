# Vercel Chat SDK for Cloudflare Workers

This document outlines the plan and technical considerations for adapting the Vercel Chat SDK to run on the Cloudflare Workers environment.

## 1. Goal

The primary goal is to enable the use of the Chat SDK within a Cloudflare Workers-based architecture, leveraging Durable Objects for state management and D1 for persistence, while reusing as much of the original SDK's logic as possible.

## 2. Core Challenges & Solutions

The main obstacle is the SDK's dependency on Node.js-specific APIs. The proposed solution is to fork the SDK and create a compatibility layer.

### 2.1. Node.js API Dependencies

- **Challenge**: Adapters (e.g., `adapter-slack`) use Node.js native modules like `node:crypto` (for `createHmac`) and `node:async_hooks` (`AsyncLocalStorage`).
- **Solution**: 
  - Replace `node:crypto` functions with their **Web Crypto API** equivalents (`crypto.subtle`).
  - Remove or replace `AsyncLocalStorage` with a context management solution suitable for the runtime (e.g., Hono's context).
  - Verify that all underlying HTTP clients used by platform SDKs (like `@slack/web-api`) are compatible with the `fetch` API provided by Cloudflare Workers.

### 2.2. State Management

- **Challenge**: The official state adapters (`state-redis`, `state-ioredis`) are not compatible with the Cloudflare environment.
- **Solution**: Implement a custom `StateAdapter` that interfaces with **Durable Objects**. The `StateAdapter` interface is well-defined, making this a straightforward task. The new adapter will use `DurableObjectStub.fetch()` to communicate with a stateful Durable Object, which can in turn use its own storage (`ctx.storage`) or D1 for persistence.

### 2.3. `Buffer` Usage

- **Challenge**: The `Buffer` class is used for handling file uploads. While Cloudflare's `nodejs_compat` flag provides a `Buffer` implementation, it may not be 100% compatible.
- **Solution**: Thoroughly test file handling functionality. If issues arise, replace `Buffer` usage with Web-standard APIs like `ArrayBuffer` and `Uint8Array`.

## 3. Proposed Implementation Strategy

1.  **Fork the Repository**: Maintain a fork of `vercel/chat` dedicated to Cloudflare compatibility.
2.  **Implement `DurableObjectStateAdapter`**: Create a new package, `@chat-adapter/state-do`, which implements the `StateAdapter` interface using Durable Objects.
3.  **Patch Platform Adapters**: 
    - Create a patch or a separate version of key adapters (e.g., `adapter-slack-cf`).
    - In these patched adapters, replace Node.js-specific crypto and other API calls with Web API equivalents.
4.  **Create a `cloudflare-workers` Example**: Add a new example project under the `examples/` directory to demonstrate how to use the adapted SDK on Cloudflare Workers with Hono, Durable Objects, and D1.
5.  **Configure Build Process**: Adjust the build scripts (`tsup`, `turbo`, etc.) to correctly build the new Cloudflare-compatible packages and example.

By following this strategy, we can leverage the powerful abstractions of the Chat SDK while fully integrating with the unique strengths of the Cloudflare serverless ecosystem.
