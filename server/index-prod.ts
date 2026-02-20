// Enable require() shim for packages that need it (googleapis)
import "./esm-require-shim";

import fs from "node:fs";
import path from "node:path";
import { type Server } from "node:http";
import { fileURLToPath } from "node:url";

import express, { type Express } from "express";
import runApp from "./app";

// Support both ESM and CJS builds
const __dirname = typeof import.meta !== 'undefined' && import.meta.dirname 
  ? import.meta.dirname 
  : path.dirname(fileURLToPath(import.meta.url));

export async function serveStatic(app: Express, _server: Server) {
  const distPath = path.resolve(__dirname, "public");

  if (!fs.existsSync(distPath)) {
    throw new Error(
      `Could not find the build directory: ${distPath}, make sure to build the client first`,
    );
  }

  app.use(express.static(distPath, { extensions: ['html'] }));

  // fall through to index.html if the file doesn't exist
  app.use("*", (_req, res) => {
    res.sendFile(path.resolve(distPath, "index.html"));
  });
}

(async () => {
  await runApp(serveStatic);
})();
