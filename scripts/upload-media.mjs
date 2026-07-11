#!/usr/bin/env node

import { createHash } from "node:crypto";
import { readFile, stat } from "node:fs/promises";
import { basename, extname, resolve } from "node:path";
import process from "node:process";
import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";

dotenv.config();

const BUCKET = "images";
const MAX_BYTES = 100 * 1024 * 1024;
const MIME_BY_EXTENSION = new Map([
  [".gif", "image/gif"],
  [".html", "text/html"],
  [".jpeg", "image/jpeg"],
  [".jpg", "image/jpeg"],
  [".mp4", "video/mp4"],
  [".png", "image/png"],
  [".webp", "image/webp"],
]);

function usage() {
  console.log(`Usage:
  npm run media:upload -- --collection <name> [--json] <file...>

Uploads publishable article media to the public Supabase Storage bucket. Object
keys are content-addressed, so rerunning the command is safe and never replaces
an existing asset.

Options:
  --collection <name>  Object namespace below uploads/ (required)
  --json               Print machine-readable JSON only
  --help               Show this message`);
}

function parseArgs(argv) {
  const out = { collection: "", files: [], json: false };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--help" || arg === "-h") {
      usage();
      process.exit(0);
    }
    if (arg === "--json") {
      out.json = true;
      continue;
    }
    if (arg === "--collection") {
      out.collection = argv[++i] ?? "";
      continue;
    }
    if (arg.startsWith("--collection=")) {
      out.collection = arg.slice("--collection=".length);
      continue;
    }
    if (arg.startsWith("-")) throw new Error(`unknown option: ${arg}`);
    out.files.push(arg);
  }
  return out;
}

function slug(value, label) {
  const result = value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
  if (!result) throw new Error(`${label} must contain a letter or number`);
  return result;
}

function markdownFor({ mime, publicUrl, originalName }) {
  if (mime === "video/mp4") {
    return `<video controls width="100%">\n  <source src="${publicUrl}" type="video/mp4" />\n</video>`;
  }
  if (mime === "text/html") {
    return `<plotly-graph src="${publicUrl}" title="${slug(originalName.replace(/\.html$/i, ""), "title")}" height="500px"></plotly-graph>`;
  }
  return `![](${publicUrl})`;
}

async function uploadOne(supabase, collection, inputPath) {
  const filePath = resolve(inputPath);
  const info = await stat(filePath);
  if (!info.isFile()) throw new Error(`${inputPath} is not a file`);
  if (info.size > MAX_BYTES) throw new Error(`${inputPath} exceeds the 100MB media limit`);

  const extension = extname(filePath).toLowerCase();
  const mime = MIME_BY_EXTENSION.get(extension);
  if (!mime) throw new Error(`${inputPath} is not a supported image, MP4, or HTML file`);

  const bytes = await readFile(filePath);
  const sha256 = createHash("sha256").update(bytes).digest("hex");
  const originalName = basename(filePath);
  const stem = slug(originalName.slice(0, -extension.length), "file name");
  const objectPath = `uploads/${collection}/${sha256.slice(0, 16)}-${stem}${extension}`;
  const storage = supabase.storage.from(BUCKET);

  let uploaded = true;
  const { error } = await storage.upload(objectPath, bytes, {
    cacheControl: "31536000",
    contentType: mime,
    upsert: false,
  });
  if (error) {
    const duplicate = error.statusCode === "409" || /already exists|duplicate/i.test(error.message);
    if (!duplicate) throw new Error(`${inputPath}: ${error.message}`);
    uploaded = false;

    const { data: existing, error: downloadError } = await storage.download(objectPath);
    if (downloadError || !existing) {
      throw new Error(`${inputPath}: existing object could not be verified`);
    }
    const existingHash = createHash("sha256")
      .update(Buffer.from(await existing.arrayBuffer()))
      .digest("hex");
    if (existingHash !== sha256) {
      throw new Error(`${inputPath}: content-addressed object failed its hash check`);
    }
  }

  const {
    data: { publicUrl },
  } = storage.getPublicUrl(objectPath);
  const result = {
    originalName,
    objectPath,
    publicUrl,
    mime,
    bytes: info.size,
    sha256,
    uploaded,
  };
  return { ...result, markdown: markdownFor(result) };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const collection = slug(args.collection, "collection");
  if (!args.files.length) throw new Error("provide at least one file to upload");

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error("NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required");
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const results = [];
  for (const file of args.files) results.push(await uploadOne(supabase, collection, file));

  if (args.json) {
    console.log(JSON.stringify(results, null, 2));
    return;
  }
  for (const result of results) {
    console.log(`${result.uploaded ? "uploaded" : "exists"} ${result.originalName}`);
    console.log(`  ${result.publicUrl}`);
    console.log(`  ${result.markdown}`);
  }
}

main().catch((error) => {
  console.error(`media upload failed: ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
});
