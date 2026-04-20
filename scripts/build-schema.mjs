#!/usr/bin/env node
// Concatenate supabase/sql/*.sql partials (per index.sql order) into the
// committed schema.sql at the repo root. Run via `npm run build:schema`
// (also triggered by `prebuild` so every production build refreshes it).

import { readFile, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, "..");
const sqlDir = join(repoRoot, "supabase", "sql");
const indexPath = join(sqlDir, "index.sql");
const outPath = join(repoRoot, "schema.sql");

const BANNER = [
  "-- ============================================================================",
  "-- GENERATED FILE — do not edit by hand.",
  "-- Source partials live in supabase/sql/*.sql; run `npm run build:schema` to",
  "-- regenerate this file after editing them. The Supabase workflow (paste this",
  "-- file into the SQL Editor) is unchanged — this file is the artifact, not",
  "-- the source of truth.",
  "-- ============================================================================",
  "",
  "-- Run this in Supabase SQL Editor (Project → SQL Editor → New query)",
  "-- It is idempotent and safe to re-run.",
  "",
].join("\n");

const INCLUDE_RE = /^\s*\\i\s+(\S+)\s*$/;

const index = await readFile(indexPath, "utf8");
const parts = [BANNER];

for (const line of index.split(/\r?\n/)) {
  const m = line.match(INCLUDE_RE);
  if (!m) continue;
  const partialPath = join(sqlDir, m[1]);
  const body = await readFile(partialPath, "utf8");
  parts.push(`-- >>> supabase/sql/${m[1]}`);
  parts.push(body.trimEnd());
  parts.push("");
}

const output = parts.join("\n") + "\n";
await writeFile(outPath, output, "utf8");

console.log(`Wrote ${outPath} (${output.length} bytes)`);
