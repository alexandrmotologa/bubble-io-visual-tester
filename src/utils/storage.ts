import { S3Client, PutObjectCommand, GetObjectCommand, ListObjectsV2Command } from '@aws-sdk/client-s3';
import fs from 'node:fs';
import path from 'node:path';
import { pipeline } from 'node:stream/promises';
import pc from 'picocolors';
import { logger } from './logger.js';
import type { VisualConfig } from '../config.js';

const BASELINE_DIR = path.resolve(process.cwd(), 'snapshots', 'baseline');

export async function pushBaselines(config: VisualConfig): Promise<void> {
  if (!config.storage || config.storage.provider !== 's3') {
    logger.warn('No S3 storage configured in visual.config.json. Skipping push.');
    return;
  }

  const { bucket, region, prefix } = config.storage;
  const s3 = new S3Client({ region });

  if (!fs.existsSync(BASELINE_DIR)) {
    logger.warn('No baseline directory found. Nothing to push.');
    return;
  }

  const files = fs.readdirSync(BASELINE_DIR).filter(f => f.endsWith('.png'));
  if (files.length === 0) {
    logger.warn('No baseline images found. Nothing to push.');
    return;
  }

  logger.info(`Pushing ${files.length} baselines to S3 (s3://${bucket}/${prefix})...`);

  for (const file of files) {
    const filePath = path.join(BASELINE_DIR, file);
    const fileContent = fs.readFileSync(filePath);
    const key = `${prefix}${file}`;

    try {
      await s3.send(
        new PutObjectCommand({
          Bucket: bucket,
          Key: key,
          Body: fileContent,
          ContentType: 'image/png',
        })
      );
      console.log(`  ${pc.green('✓')} Uploaded ${file}`);
    } catch (err) {
      logger.error(`Failed to upload ${file} to S3: ${String(err)}`);
    }
  }

  logger.success('Finished pushing baselines to S3.');
}

export async function pullBaselines(config: VisualConfig): Promise<void> {
  if (!config.storage || config.storage.provider !== 's3') {
    logger.warn('No S3 storage configured in visual.config.json. Skipping pull.');
    return;
  }

  const { bucket, region, prefix } = config.storage;
  const s3 = new S3Client({ region });

  logger.info(`Pulling baselines from S3 (s3://${bucket}/${prefix})...`);

  try {
    let continuationToken: string | undefined = undefined;
    let count = 0;

    if (!fs.existsSync(BASELINE_DIR)) {
      fs.mkdirSync(BASELINE_DIR, { recursive: true });
    }

    do {
      const response: any = await s3.send(
        new ListObjectsV2Command({
          Bucket: bucket,
          Prefix: prefix,
          ContinuationToken: continuationToken,
        })
      );

      const items = response.Contents || [];

      for (const item of items) {
        if (!item.Key || item.Key.endsWith('/')) continue; // skip directories

        const fileName = item.Key.replace(prefix, '');
        const outputPath = path.join(BASELINE_DIR, fileName);

        const obj = await s3.send(
          new GetObjectCommand({
            Bucket: bucket,
            Key: item.Key,
          })
        );

        if (obj.Body) {
          const bodyStream = obj.Body as unknown as NodeJS.ReadableStream;
          await pipeline(bodyStream, fs.createWriteStream(outputPath));
          console.log(`  ${pc.green('✓')} Downloaded ${fileName}`);
          count++;
        }
      }

      continuationToken = response.NextContinuationToken;
    } while (continuationToken);

    if (count === 0) {
      logger.warn('No baselines found in S3.');
    } else {
      logger.success(`Successfully pulled ${count} baselines from S3.`);
    }
  } catch (err) {
    logger.error(`Failed to pull baselines from S3: ${String(err)}`);
    throw err; // Stop execution if pulling baselines fails
  }
}
