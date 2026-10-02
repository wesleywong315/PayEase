#!/usr/bin/env node
/**
 * Prints which DB provider the current DATABASE_URL would select.
 * Usage: node scripts/print-db-provider.js
 */
require("dotenv/config");

function detectProvider(url) {
  const trimmed = String(url || "").trim().toLowerCase();
  if (trimmed.startsWith("postgres://") || trimmed.startsWith("postgresql://")) {
    return "postgresql";
  }
  if (trimmed.startsWith("file:") || trimmed === ":memory:") {
    return "sqlite";
  }
  return "unknown";
}

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL is not set");
  process.exit(1);
}
console.log(detectProvider(url));
