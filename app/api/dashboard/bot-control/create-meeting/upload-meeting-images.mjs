#!/usr/bin/env node
/**
 * Upload bot meeting cover images to Supabase Storage.
 *
 * Usage:
 *   node upload-meeting-images.mjs
 *   node upload-meeting-images.mjs --dry-run
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const assetsDir = path.resolve(__dirname, "../../../../../assets/meetingsBot");
const bucket = "lets-meet";
const storagePrefix = "meetingsBot";

function loadEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return;
  for (const line of fs.readFileSync(filePath, "utf8").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq < 0) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (!process.env[key]) process.env[key] = value;
  }
}

async function main() {
  const dryRun = process.argv.includes("--dry-run");
  loadEnvFile(path.resolve(__dirname, "../../../../../.env.local"));
  loadEnvFile(path.resolve(__dirname, "../../../../../.env"));

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceKey) {
    throw new Error("NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY required");
  }

  const files = fs
    .readdirSync(assetsDir)
    .filter((name) => name.endsWith(".png"))
    .sort();

  if (files.length === 0) {
    throw new Error(`No PNG files in ${assetsDir}`);
  }

  const supabase = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false },
  });

  const uploaded = [];
  for (const fileName of files) {
    const filePath = path.join(assetsDir, fileName);
    const storagePath = `${storagePrefix}/${fileName}`;
    const body = fs.readFileSync(filePath);

    if (dryRun) {
      console.log(`[dry-run] ${fileName} → ${storagePath} (${body.length} bytes)`);
      continue;
    }

    const { error } = await supabase.storage.from(bucket).upload(storagePath, body, {
      contentType: "image/png",
      upsert: true,
    });
    if (error) throw new Error(`${fileName}: ${error.message}`);

    const { data } = supabase.storage.from(bucket).getPublicUrl(storagePath);
    uploaded.push({ fileName, url: data.publicUrl });
    console.log(`✓ ${fileName}`);
  }

  if (!dryRun) {
    console.log("\nPublic URLs:");
    for (const item of uploaded) {
      console.log(item.url);
    }
  }
}

main().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});
