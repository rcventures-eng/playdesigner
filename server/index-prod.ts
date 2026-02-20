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

// Route-specific meta tags injected server-side so crawlers see the correct
// title and description for each React route without needing JavaScript.
// Zero UX impact — users still get the full React app; only the <head> differs.
const routeMeta: Record<string, { title: string; description: string }> = {
  '/about': {
    title: 'About RC Football — Free Flag Football Play Designer for Coaches',
    description: "RC Football is a free flag football play design tool built by a coach, for coaches. Learn how it works and who it's for.",
  },
  '/contact': {
    title: 'Contact RC Football — Flag Football Play Design Tool',
    description: "Get in touch with the RC Football team. Questions about the play designer or playbook tool? We'd love to hear from you.",
  },
  '/privacy-policy': {
    title: 'Privacy Policy — RC Football',
    description: 'Read the RC Football privacy policy to learn how we collect, use, and protect your data.',
  },
};

export async function serveStatic(app: Express, _server: Server) {
  const distPath = path.resolve(__dirname, "public");

  if (!fs.existsSync(distPath)) {
    throw new Error(
      `Could not find the build directory: ${distPath}, make sure to build the client first`,
    );
  }

  app.use(express.static(distPath, { extensions: ['html'] }));

  // Read index.html once at startup and cache it in memory
  const indexHtml = fs.readFileSync(path.resolve(distPath, "index.html"), 'utf-8');

  // Inject route-specific meta for known React routes, then fall through to index.html
  app.use("*", (req, res) => {
    const meta = routeMeta[req.path];
    if (meta) {
      const html = indexHtml
        .replace(
          '<title>Flag Football Play Designer — Free Playbook Tool for Coaches</title>',
          `<title>${meta.title}</title>`
        )
        .replace(
          'content="Design flag football plays and build your playbook online — free. Drag-and-drop play designer built for flag football coaches at every level."',
          `content="${meta.description}"`
        );
      res.send(html);
    } else {
      res.send(indexHtml);
    }
  });
}

(async () => {
  await runApp(serveStatic);
})();
