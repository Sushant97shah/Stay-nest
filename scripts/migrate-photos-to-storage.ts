// One-time migration: uploads data/photos/* (from the old project) to a public
// Supabase Storage bucket, then rewrites image/coverImage/gallery/photos fields
// in data/bangalore-pgs.json and data/india-pgs.json to the resulting public URLs.
//
// Resumable: writes scripts/photo-migration-manifest.json as it goes, and skips
// any local filename already present there on a re-run.
//
// Usage: npx tsx scripts/migrate-photos-to-storage.ts

import fs from "node:fs";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";

const ROOT = path.resolve(__dirname, "..");
// One-time migration already ran (see photo-migration-manifest.json) — this path is kept
// accurate in case it ever needs to be re-run against the archived vanilla app's photos.
const OLD_PROJECT_PHOTOS_DIR = path.resolve(ROOT, "legacy-vanilla-app", "data", "photos");
const BUCKET = "pg-photos";
const MANIFEST_PATH = path.join(__dirname, "photo-migration-manifest.json");
const CONCURRENCY = 8;

function loadEnvLocal() {
  const envPath = path.join(ROOT, ".env.local");
  const content = fs.readFileSync(envPath, "utf8");
  for (const line of content.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    const value = trimmed.slice(eq + 1).trim();
    if (!process.env[key]) process.env[key] = value;
  }
}

loadEnvLocal();

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

type Manifest = Record<string, string>; // local filename -> public URL

function loadManifest(): Manifest {
  if (fs.existsSync(MANIFEST_PATH)) {
    return JSON.parse(fs.readFileSync(MANIFEST_PATH, "utf8"));
  }
  return {};
}

function saveManifest(manifest: Manifest) {
  fs.writeFileSync(MANIFEST_PATH, JSON.stringify(manifest, null, 2));
}

function contentTypeFor(filename: string): string {
  const ext = path.extname(filename).toLowerCase();
  if (ext === ".jpg" || ext === ".jpeg") return "image/jpeg";
  if (ext === ".png") return "image/png";
  if (ext === ".webp") return "image/webp";
  return "application/octet-stream";
}

async function ensureBucket() {
  const { data: buckets, error } = await supabase.storage.listBuckets();
  if (error) throw error;
  const exists = buckets?.some((b) => b.name === BUCKET);
  if (!exists) {
    const { error: createError } = await supabase.storage.createBucket(BUCKET, { public: true });
    if (createError) throw createError;
    console.log(`Created public bucket "${BUCKET}"`);
  } else {
    console.log(`Bucket "${BUCKET}" already exists`);
  }
}

async function uploadOne(filename: string, manifest: Manifest): Promise<void> {
  if (manifest[filename]) return; // already done
  const fullPath = path.join(OLD_PROJECT_PHOTOS_DIR, filename);
  const fileBuffer = fs.readFileSync(fullPath);
  const { error } = await supabase.storage.from(BUCKET).upload(filename, fileBuffer, {
    contentType: contentTypeFor(filename),
    upsert: true,
  });
  if (error) throw new Error(`${filename}: ${error.message}`);
  const { data } = supabase.storage.from(BUCKET).getPublicUrl(filename);
  manifest[filename] = data.publicUrl;
}

async function uploadAll() {
  const files = fs.readdirSync(OLD_PROJECT_PHOTOS_DIR).filter((f) => /\.(jpg|jpeg|png|webp)$/i.test(f));
  console.log(`Found ${files.length} photo files to migrate`);

  const manifest = loadManifest();
  let done = Object.keys(manifest).length;
  let failed = 0;

  for (let i = 0; i < files.length; i += CONCURRENCY) {
    const batch = files.slice(i, i + CONCURRENCY);
    await Promise.all(
      batch.map(async (filename) => {
        try {
          await uploadOne(filename, manifest);
          done += 1;
        } catch (err) {
          failed += 1;
          console.error(`Failed: ${filename} — ${(err as Error).message}`);
        }
      })
    );
    saveManifest(manifest);
    if ((i / CONCURRENCY) % 10 === 0) {
      console.log(`Progress: ${done}/${files.length} uploaded (${failed} failed)`);
    }
  }

  saveManifest(manifest);
  console.log(`Done. ${done}/${files.length} uploaded, ${failed} failed.`);
  return manifest;
}

function rewriteDataFile(jsonPath: string, manifest: Manifest) {
  const records = JSON.parse(fs.readFileSync(jsonPath, "utf8"));
  const toUrl = (localPath: unknown): unknown => {
    if (typeof localPath !== "string") return localPath;
    const filename = localPath.split("/").pop() || "";
    return manifest[filename] || localPath;
  };
  let rewritten = 0;
  for (const record of records) {
    if (record.image) {
      record.image = toUrl(record.image);
      rewritten += 1;
    }
    if (record.coverImage) record.coverImage = toUrl(record.coverImage);
    if (Array.isArray(record.gallery)) record.gallery = record.gallery.map(toUrl);
    if (Array.isArray(record.photos)) record.photos = record.photos.map(toUrl);
  }
  fs.writeFileSync(jsonPath, JSON.stringify(records));
  console.log(`Rewrote ${rewritten} image references in ${path.basename(jsonPath)}`);
}

async function main() {
  await ensureBucket();
  const manifest = await uploadAll();
  rewriteDataFile(path.join(ROOT, "data", "bangalore-pgs.json"), manifest);
  rewriteDataFile(path.join(ROOT, "data", "india-pgs.json"), manifest);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
