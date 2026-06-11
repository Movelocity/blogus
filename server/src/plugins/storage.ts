import { createHash, randomUUID } from "node:crypto";
import {
  CreateBucketCommand,
  HeadBucketCommand,
  S3Client,
  type PutObjectCommandInput
} from "@aws-sdk/client-s3";
import { Upload } from "@aws-sdk/lib-storage";
import fp from "fastify-plugin";
import { config, getMinioEndpointUrl } from "../config.js";

export interface PutFileInput {
  filename: string;
  contentType?: string;
  stream: NodeJS.ReadableStream;
}

export interface StoredFile {
  bucket: string;
  key: string;
  url: string;
}

function cleanFilename(filename: string) {
  return filename.replace(/[^a-zA-Z0-9._-]+/g, "-").replace(/^-|-$/g, "") || "file";
}

function createObjectKey(filename: string) {
  const now = new Date();
  const yyyy = String(now.getUTCFullYear());
  const mm = String(now.getUTCMonth() + 1).padStart(2, "0");
  const id = createHash("sha1").update(`${randomUUID()}:${filename}`).digest("hex").slice(0, 16);
  return `uploads/${yyyy}/${mm}/${id}-${cleanFilename(filename)}`;
}

export const storagePlugin = fp(async (app) => {
  const endpoint = getMinioEndpointUrl();
  const s3 = new S3Client({
    credentials: {
      accessKeyId: config.minio.accessKey,
      secretAccessKey: config.minio.secretKey
    },
    endpoint,
    forcePathStyle: true,
    region: "us-east-1"
  });

  let ensureBucketPromise: Promise<void> | undefined;

  async function ensureBucket() {
    ensureBucketPromise ??= s3
      .send(new HeadBucketCommand({ Bucket: config.minio.bucket }))
      .then(() => undefined)
      .catch(async () => {
        await s3.send(new CreateBucketCommand({ Bucket: config.minio.bucket }));
      });
    return ensureBucketPromise;
  }

  app.decorate("storage", {
    async putFile(input: PutFileInput): Promise<StoredFile> {
      await ensureBucket();
      const key = createObjectKey(input.filename);
      const uploadInput: PutObjectCommandInput = {
        Bucket: config.minio.bucket,
        Key: key,
        Body: input.stream,
        ContentType: input.contentType ?? "application/octet-stream"
      };

      await new Upload({
        client: s3,
        params: uploadInput,
        queueSize: 4,
        partSize: Math.max(config.upload.chunkSizeMb, 5) * 1024 * 1024
      }).done();

      return {
        bucket: config.minio.bucket,
        key,
        url: `${endpoint}/${config.minio.bucket}/${key}`
      };
    }
  });

  app.addHook("onClose", () => {
    s3.destroy();
  });
});
