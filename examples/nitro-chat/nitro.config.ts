import { defineConfig } from "nitro";

export default defineConfig({
  serverDir: "./server",
  compatibilityDate: "2025-01-20",
  traceDeps: [
    "discord.js",
    "@discordjs/ws",
    "@discordjs/voice",
    "zlib-sync",
    "tslib",
    "@microsoft/microsoft-graph-client"
  ],
});
