import { PutObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import type { Config } from '@netlify/functions';

import {
  buildStagingKey,
  createUploadTicket,
  errorResponse,
  getStorage,
  jsonResponse,
  UPLOAD_LINK_LIFETIME,
  validateFileBatch,
} from './_lib/contact-upload.mjs';

export default async (request: Request): Promise<Response> => {
  if (request.method !== 'POST') {
    return jsonResponse({ error: 'Méthode non autorisée.' }, 405);
  }

  try {
    const contentLength = Number(request.headers.get('content-length') || 0);
    if (contentLength > 4096) {
      return jsonResponse({ error: 'Requête trop volumineuse.' }, 413);
    }

    const body = (await request.json()) as Record<string, unknown>;
    const files = validateFileBatch(body['files']);
    const { client, bucket, signingSecret } = getStorage();
    const uploads = await Promise.all(
      files.map(async (file) => {
        const key = buildStagingKey(file.fileName);
        const ticket = createUploadTicket(file, key, signingSecret);
        const uploadUrl = await getSignedUrl(
          client,
          new PutObjectCommand({
            Bucket: bucket,
            Key: key,
            ContentLength: file.fileSize,
            ContentType: file.contentType,
          }),
          { expiresIn: UPLOAD_LINK_LIFETIME },
        );

        return { uploadUrl, key, ticket, contentType: file.contentType };
      }),
    );

    return jsonResponse({ uploads });
  } catch (error: unknown) {
    return errorResponse(error);
  }
};

export const config: Config = {
  path: '/api/contact-upload/create',
  rateLimit: {
    windowLimit: 1,
    windowSize: 180,
    aggregateBy: ['ip', 'domain'],
  },
};
