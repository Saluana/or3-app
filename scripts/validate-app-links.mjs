#!/usr/bin/env node
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = process.cwd();

function readJSON(path) {
  return JSON.parse(readFileSync(resolve(root, path), "utf8"));
}

const aasa = readJSON("public/.well-known/apple-app-site-association");
const assetlinks = readJSON("public/.well-known/assetlinks.json");

const iosAppIDs = new Set(
  (aasa.applinks?.details || []).flatMap((item) =>
    item.appID ? [item.appID] : item.appIDs || [],
  ),
);
if (![...iosAppIDs].some((id) => id.endsWith(".com.or3.app"))) {
  throw new Error("AASA does not include the com.or3.app application ID.");
}
if (!aasa.webcredentials?.apps?.some((id) => id.endsWith(".com.or3.app"))) {
  throw new Error("AASA does not include webcredentials for com.or3.app.");
}

const androidPackages = new Set(
  assetlinks.map((item) => item.target?.package_name).filter(Boolean),
);
if (!androidPackages.has("com.or3.app")) {
  throw new Error("assetlinks.json does not include com.or3.app.");
}
for (const item of assetlinks) {
  const certs = item.target?.sha256_cert_fingerprints || [];
  if (item.target?.package_name === "com.or3.app" && certs.length === 0) {
    throw new Error(
      "assetlinks.json entry for com.or3.app has no fingerprints.",
    );
  }
}

console.log("App-link and passkey domain files look structurally valid.");
