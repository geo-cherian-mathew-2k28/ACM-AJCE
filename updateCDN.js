import dotenv from "dotenv";
import fs from "node:fs";
import path from "node:path";
import mime from "mime-types";
import pLimit from "p-limit";
import {
  S3Client,
  ListObjectsV2Command,
  DeleteObjectsCommand,
  PutObjectCommand,
} from "@aws-sdk/client-s3";
import {
  CloudFrontClient,
  CreateInvalidationCommand,
} from "@aws-sdk/client-cloudfront";

dotenv.config();

const isProduction =
  process.env.NODE_ENV === "production" || process.env.ENV === "production";

if (!isProduction) {
  console.log(
    "Skipped post-build process. Set NODE_ENV=production to run this script."
  );
  process.exit(0);
}

const {
  promises: { readdir, stat: getStats },
} = fs;
const { resolve, join, extname } = path;

const UPLOAD_CONCURRENCY_LIMIT =
  Number(process.env.UPLOAD_CONCURRENCY_LIMIT) || 5;
const limit = pLimit(UPLOAD_CONCURRENCY_LIMIT);
const BUCKET_NAME = process.env.AWS_BUCKET_NAME;
const OUTPUT_DIR = process.env.ASTRO_OUTPUT_DIR || "./dist";
const DISTRIBUTION_ID = process.env.AWS_DISTRIBUTION_ID;

const hasAwsCredentials =
  process.env.AWS_ACCESS_KEY_ID &&
  process.env.AWS_SECRET_ACCESS_KEY &&
  process.env.AWS_REGION &&
  BUCKET_NAME;

if (!hasAwsCredentials) {
  console.log(
    "Skipped CDN sync. Set AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, AWS_REGION, and AWS_BUCKET_NAME to upload build assets."
  );
  process.exit(0);
}

const AWS_CONFIG = {
  region: process.env.AWS_REGION,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  },
};

const s3Client = new S3Client(AWS_CONFIG);
const cloudfrontClient = new CloudFrontClient(AWS_CONFIG);

const LONG_CACHE_CONTROL = "public, max-age=31556926, immutable";
const SHORT_CACHE_CONTROL = "public, max-age=0, must-revalidate";
const NO_CACHE_EXTENSIONS = new Set([
  ".html",
  ".xml",
  ".txt",
  ".json",
  ".webmanifest",
]);

// Function to normalize paths (Fix Windows `\` issue)
const normalizeS3Key = (key) => key.replace(/\\/g, "/");
const getMimeType = (filePath) =>
  mime.lookup(filePath) || "application/octet-stream";

// List all files in S3 bucket with their sizes
const listS3Files = async () => {
  try {
    let continuationToken;
    const files = new Map(); // Key -> Size

    do {
      const { Contents, IsTruncated, NextContinuationToken } =
        await s3Client.send(
          new ListObjectsV2Command({
            Bucket: BUCKET_NAME,
            ContinuationToken: continuationToken,
          })
        );

      if (Contents) {
        for (const file of Contents) {
          files.set(file.Key, file.Size);
        }
      }

      continuationToken = IsTruncated ? NextContinuationToken : undefined;
    } while (continuationToken);

    return files;
  } catch (error) {
    console.error("❌ Failed to list S3 files:", error);
    return new Map();
  }
};

// Recursively get all local files and their details
const getLocalFiles = async (dir, rootKey = "", filesList = []) => {
  const filenames = await readdir(dir);
  await Promise.all(
    filenames.map(async (filename) => {
      const filePath = join(dir, filename);
      const fileStats = await getStats(filePath);
      const key = normalizeS3Key(join(rootKey, filename));

      if (fileStats.isFile()) {
        filesList.push({ filePath, key, size: fileStats.size });
      } else if (fileStats.isDirectory()) {
        await getLocalFiles(filePath, key, filesList);
      }
    })
  );
  return filesList;
};

// Delete specific obsolete files from S3 bucket
const deleteObsoleteFiles = async (keysToDelete) => {
  if (keysToDelete.length === 0) {
    console.log("✅ No old obsolete files to delete in S3.");
    return;
  }

  try {
    // S3 delete objects supports up to 1000 keys at once
    const chunks = [];
    for (let i = 0; i < keysToDelete.length; i += 1000) {
      chunks.push(keysToDelete.slice(i, i + 1000));
    }

    for (const chunk of chunks) {
      await s3Client.send(
        new DeleteObjectsCommand({
          Bucket: BUCKET_NAME,
          Delete: { Objects: chunk },
        })
      );
    }
    console.log(`🗑️ Pruned ${keysToDelete.length} obsolete files from S3 bucket ${BUCKET_NAME}`);
  } catch (error) {
    console.error("❌ Failed to prune obsolete S3 files:", error.message);
  }
};

let errors = [];
// Upload a single file to S3
const uploadFile = async (filePath, key) => {
  try {
    const normalizedKey = normalizeS3Key(key);
    const extension = extname(normalizedKey).toLowerCase();
    const cacheControl = NO_CACHE_EXTENSIONS.has(extension)
      ? SHORT_CACHE_CONTROL
      : LONG_CACHE_CONTROL;
    const fileStream = fs.createReadStream(filePath);
    const params = {
      Bucket: BUCKET_NAME,
      Key: normalizedKey,
      Body: fileStream,
      ContentType: getMimeType(filePath),
      CacheControl: cacheControl,
    };

    await s3Client.send(new PutObjectCommand(params));
    console.log(`✅ Uploaded: ${normalizedKey}`);
    return normalizedKey; // Return key for CloudFront invalidation tracking
  } catch (err) {
    console.error(`❌ Upload failed for ${filePath}:`, err.message);
    errors.push({ filePath, key });
    return null;
  }
};

// Optimize CloudFront invalidation
const invalidateCloudFrontCache = async () => {
  if (!DISTRIBUTION_ID) {
    console.warn("⚠️ Missing AWS_DISTRIBUTION_ID; skipping invalidation.");
    return;
  }

  const invalidationPaths = ["/*"];

  try {
    await cloudfrontClient.send(
      new CreateInvalidationCommand({
        DistributionId: DISTRIBUTION_ID,
        InvalidationBatch: {
          CallerReference: `${Date.now()}`,
          Paths: {
            Quantity: invalidationPaths.length,
            Items: invalidationPaths,
          },
        },
      })
    );
    console.log(
      `🚀 CloudFront invalidation requested for ${invalidationPaths.length} files.`
    );
  } catch (error) {
    console.error("❌ CloudFront invalidation failed:", error);
  }
};

const retryUploads = async () => {
  console.log("Retrying failed uploads...");
  const failedUploads = [...errors];
  errors = [];
  const retryUploads = await Promise.all(
    failedUploads.map(({ filePath, key }) =>
      limit(() => uploadFile(filePath, key))
    )
  );

  const retryErrors = retryUploads.filter((file) => !file);
  if (retryErrors.length > 0) {
    console.error("❌ Failed to upload files:", retryErrors);
    errors = [...retryErrors];
  } else {
    console.log("✅ Retry uploads completed successfully!");
  }
};

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// Main Deployment Function
(async () => {
  try {
    console.time("S3 Indexing");
    const s3Files = await listS3Files();
    console.log(`📂 Found ${s3Files.size} existing files in S3 bucket.`);
    
    const localFiles = await getLocalFiles(OUTPUT_DIR);
    console.log(`📁 Found ${localFiles.length} local files in build output.`);
    console.timeEnd("S3 Indexing");

    // 1. Identify files to upload (new or changed size)
    const filesToUpload = localFiles.filter((localFile) => {
      const s3Size = s3Files.get(localFile.key);
      if (s3Size === undefined) return true; // File doesn't exist in S3
      if (s3Size !== localFile.size) return true; // Size mismatch (file changed)
      return false; // Already matches exactly, skip!
    });

    console.log(`⏭️  Skipping ${localFiles.length - filesToUpload.length} unchanged files.`);
    console.log(`⚡ Uploading ${filesToUpload.length} new/changed files to S3...`);

    if (filesToUpload.length > 0) {
      console.time("S3 Upload");
      await Promise.all(
        filesToUpload.map(({ filePath, key }) =>
          limit(() => uploadFile(filePath, key))
        )
      );

      while (errors.length > 0) {
        await sleep(1000);
        await retryUploads();
      }
      console.timeEnd("S3 Upload");
    } else {
      console.log("✅ No new uploads required!");
    }

    // 2. Identify and prune obsolete files no longer present in local build
    const localKeysSet = new Set(localFiles.map((f) => f.key));
    const keysToDelete = Array.from(s3Files.keys())
      .filter((s3Key) => !localKeysSet.has(s3Key))
      .map((key) => ({ Key: key }));

    if (keysToDelete.length > 0) {
      console.time("S3 Cleanup");
      await deleteObsoleteFiles(keysToDelete);
      console.timeEnd("S3 Cleanup");
    }

    // 3. Invalidate CloudFront (only if anything changed)
    if (filesToUpload.length > 0 || keysToDelete.length > 0) {
      console.time("CloudFront Invalidation");
      await invalidateCloudFrontCache();
      console.timeEnd("CloudFront Invalidation");
    } else {
      console.log("✅ Distribution in sync. Invalidation skipped.");
    }

    console.log("🚀 Deployment completed successfully!");
    process.exit(0);
  } catch (error) {
    console.error("❌ Deployment failed:", error);
    process.exit(1);
  }
})();
