import { Storage } from "@google-cloud/storage";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Initialize GCS client
// - Cloud Run: uses Application Default Credentials (service account)
// - Local: uses key file if exists, otherwise ADC
const keyFilePath = join(__dirname, "../../../mmm-lab-8dae8dbd9a6f.json");
const useKeyFile = existsSync(keyFilePath);

const storage = new Storage({
  projectId: "mmm-lab",
  ...(useKeyFile && { keyFilename: keyFilePath }),
});

const BUCKET_NAME = "chatgpt-apps";
const bucket = storage.bucket(BUCKET_NAME);

export interface UploadResult {
  publicUrl: string;
  gsUri: string;
  fileName: string;
}

/**
 * Upload CSV content to GCS and return download URL
 */
export async function uploadCSV(
  csvContent: string,
  prefix: string = "bigquery-results"
): Promise<UploadResult> {
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const fileName = `${prefix}/${timestamp}.csv`;

  console.error(`\n=== Uploading to GCS ===`);
  console.error(`Bucket: ${BUCKET_NAME}`);
  console.error(`File: ${fileName}`);

  const file = bucket.file(fileName);

  await file.save(csvContent, {
    contentType: "text/csv",
    metadata: {
      cacheControl: "public, max-age=3600",
    },
  });

  // Generate a signed URL (valid for 24 hours) for uniform bucket-level access
  const [signedUrl] = await file.getSignedUrl({
    version: "v4",
    action: "read",
    expires: Date.now() + 24 * 60 * 60 * 1000, // 24 hours
  });

  const gsUri = `gs://${BUCKET_NAME}/${fileName}`;

  console.error(`Upload complete!`);
  console.error(`Signed URL: ${signedUrl.substring(0, 100)}...`);

  return {
    publicUrl: signedUrl,
    gsUri,
    fileName,
  };
}

/**
 * Generate a signed URL for temporary access (alternative to public access)
 */
export async function getSignedUrl(
  fileName: string,
  expirationMinutes: number = 60
): Promise<string> {
  const file = bucket.file(fileName);

  const [url] = await file.getSignedUrl({
    version: "v4",
    action: "read",
    expires: Date.now() + expirationMinutes * 60 * 1000,
  });

  return url;
}
