import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import type { Config } from '@netlify/functions';

import {
  deleteStoredFile,
  DOWNLOAD_LINK_LIFETIME,
  downloadCommand,
  errorResponse,
  getStorage,
  jsonResponse,
  promoteStoredFile,
  UploadValidationError,
  validateStoredFile,
  verifyUploadTicket,
} from './_lib/contact-upload.mjs';

export default async (request: Request): Promise<Response> => {
  if (request.method !== 'POST') {
    return jsonResponse({ error: 'Méthode non autorisée.' }, 405);
  }

  try {
    const contentLength = Number(request.headers.get('content-length') || 0);
    if (contentLength > 8192) {
      return jsonResponse({ error: 'Requête trop volumineuse.' }, 413);
    }

    const body = (await request.json()) as Record<string, unknown>;
    const requestedUploads = body['uploads'];
    if (!Array.isArray(requestedUploads) || requestedUploads.length === 0 || requestedUploads.length > 5) {
      throw new UploadValidationError('La liste des fichiers est invalide.');
    }

    const { client, bucket, signingSecret } = getStorage();
    const files = [];

    for (const requestedUpload of requestedUploads) {
      if (!requestedUpload || typeof requestedUpload !== 'object') {
        throw new UploadValidationError('Les informations d’un fichier sont invalides.');
      }

      const candidate = requestedUpload as Record<string, unknown>;
      const stagingKey = typeof candidate['key'] === 'string' ? candidate['key'] : '';
      const ticket = verifyUploadTicket(
        candidate['ticket'],
        stagingKey,
        signingSecret,
      );

      try {
        await validateStoredFile(client, bucket, ticket);
      } catch (error: unknown) {
        await deleteStoredFile(client, bucket, stagingKey).catch(() => undefined);
        throw error;
      }

      const finalKey = await promoteStoredFile(client, bucket, ticket);
      const downloadUrl = await getSignedUrl(
        client,
        downloadCommand(bucket, finalKey, ticket.fileName),
        { expiresIn: DOWNLOAD_LINK_LIFETIME },
      );
      const expiresAt = new Date(
        Date.now() + DOWNLOAD_LINK_LIFETIME * 1000,
      ).toISOString();

      files.push({
        downloadUrl,
        expiresAt,
        fileName: ticket.fileName,
        fileSize: ticket.fileSize,
      });
    }

    return jsonResponse({ files });
  } catch (error: unknown) {
    if (error instanceof SyntaxError) {
      return errorResponse(new UploadValidationError('La requête est invalide.'));
    }

    return errorResponse(error);
  }
};

export const config: Config = {
  path: '/api/contact-upload/complete',
  rateLimit: {
    windowLimit: 2,
    windowSize: 180,
    aggregateBy: ['ip', 'domain'],
  },
};
