import {
  CopyObjectCommand,
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { createHmac, randomUUID, timingSafeEqual } from 'node:crypto';

export const MAX_FILE_SIZE = 50 * 1024 * 1024;
export const MAX_FILE_COUNT = 5;
export const DOWNLOAD_LINK_LIFETIME = 7 * 24 * 60 * 60;
export const UPLOAD_LINK_LIFETIME = 60 * 60;

interface FileTypeDefinition {
  contentType: string;
  acceptedContentTypes: ReadonlySet<string>;
}

export interface ValidatedFile {
  fileName: string;
  extension: string;
  fileSize: number;
  contentType: string;
}

export interface UploadTicketPayload extends ValidatedFile {
  stagingKey: string;
  expiresAt: number;
}

export class UploadValidationError extends Error {}
export class UploadConfigurationError extends Error {}

const OFFICE_DOCUMENT =
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
const OFFICE_SPREADSHEET =
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

const FILE_TYPES: Readonly<Record<string, FileTypeDefinition>> = {
  pdf: {
    contentType: 'application/pdf',
    acceptedContentTypes: new Set(['application/pdf']),
  },
  doc: {
    contentType: 'application/msword',
    acceptedContentTypes: new Set(['application/msword']),
  },
  docx: {
    contentType: OFFICE_DOCUMENT,
    acceptedContentTypes: new Set([OFFICE_DOCUMENT]),
  },
  xls: {
    contentType: 'application/vnd.ms-excel',
    acceptedContentTypes: new Set(['application/vnd.ms-excel']),
  },
  xlsx: {
    contentType: OFFICE_SPREADSHEET,
    acceptedContentTypes: new Set([OFFICE_SPREADSHEET]),
  },
  jpg: {
    contentType: 'image/jpeg',
    acceptedContentTypes: new Set(['image/jpeg']),
  },
  jpeg: {
    contentType: 'image/jpeg',
    acceptedContentTypes: new Set(['image/jpeg']),
  },
  png: {
    contentType: 'image/png',
    acceptedContentTypes: new Set(['image/png']),
  },
  webp: {
    contentType: 'image/webp',
    acceptedContentTypes: new Set(['image/webp']),
  },
};

function requiredEnvironmentVariable(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new UploadConfigurationError(`La variable Netlify ${name} est absente.`);
  }

  return value;
}

export function getStorage(): {
  client: S3Client;
  bucket: string;
  signingSecret: string;
} {
  const accountId = requiredEnvironmentVariable('R2_ACCOUNT_ID');
  const accessKeyId = requiredEnvironmentVariable('R2_ACCESS_KEY_ID');
  const secretAccessKey = requiredEnvironmentVariable('R2_SECRET_ACCESS_KEY');
  const bucket = requiredEnvironmentVariable('R2_BUCKET_NAME');

  return {
    client: new S3Client({
      region: 'auto',
      endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
      credentials: { accessKeyId, secretAccessKey },
    }),
    bucket,
    signingSecret: secretAccessKey,
  };
}

export function validateFileMetadata(input: unknown): ValidatedFile {
  if (!input || typeof input !== 'object') {
    throw new UploadValidationError('Les informations du fichier sont invalides.');
  }

  const candidate = input as Record<string, unknown>;
  const rawName =
    typeof candidate['fileName'] === 'string' ? candidate['fileName'] : '';
  const fileName = sanitizeFileName(rawName);
  const extension = fileName.split('.').pop()?.toLowerCase() ?? '';
  const definition = FILE_TYPES[extension];
  const fileSize = Number(candidate['fileSize']);
  const suppliedContentType =
    typeof candidate['contentType'] === 'string'
      ? candidate['contentType'].toLowerCase()
      : '';

  if (!definition) {
    throw new UploadValidationError('Ce format de fichier n’est pas autorisé.');
  }

  if (!Number.isSafeInteger(fileSize) || fileSize <= 0 || fileSize > MAX_FILE_SIZE) {
    throw new UploadValidationError('Le fichier doit peser entre 1 octet et 50 Mo.');
  }

  if (
    suppliedContentType &&
    suppliedContentType !== 'application/octet-stream' &&
    !definition.acceptedContentTypes.has(suppliedContentType)
  ) {
    throw new UploadValidationError('Le type du fichier ne correspond pas à son extension.');
  }

  return {
    fileName,
    extension,
    fileSize,
    contentType: definition.contentType,
  };
}

export function validateFileBatch(input: unknown): ValidatedFile[] {
  if (!Array.isArray(input) || input.length === 0) {
    throw new UploadValidationError('Aucun fichier n’a été fourni.');
  }

  if (input.length > MAX_FILE_COUNT) {
    throw new UploadValidationError(`Vous pouvez envoyer ${MAX_FILE_COUNT} fichiers maximum.`);
  }

  const files = input.map(validateFileMetadata);
  const totalSize = files.reduce((total, file) => total + file.fileSize, 0);

  if (totalSize > MAX_FILE_SIZE) {
    throw new UploadValidationError('La taille totale des fichiers dépasse 50 Mo.');
  }

  return files;
}

export function buildStagingKey(fileName: string): string {
  const month = new Date().toISOString().slice(0, 7);
  return `contact-staging/${month}/${randomUUID()}/${fileName}`;
}

export function createUploadTicket(
  file: ValidatedFile,
  stagingKey: string,
  signingSecret: string,
): string {
  const payload: UploadTicketPayload = {
    ...file,
    stagingKey,
    expiresAt: Date.now() + 75 * 60 * 1000,
  };
  const encodedPayload = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const signature = sign(encodedPayload, signingSecret);
  return `${encodedPayload}.${signature}`;
}

export function verifyUploadTicket(
  ticket: unknown,
  stagingKey: unknown,
  signingSecret: string,
): UploadTicketPayload {
  if (typeof ticket !== 'string' || typeof stagingKey !== 'string') {
    throw new UploadValidationError('Le justificatif de téléversement est invalide.');
  }

  const [encodedPayload, receivedSignature, extra] = ticket.split('.');
  if (!encodedPayload || !receivedSignature || extra) {
    throw new UploadValidationError('Le justificatif de téléversement est invalide.');
  }

  const expectedSignature = sign(encodedPayload, signingSecret);
  const receivedBuffer = Buffer.from(receivedSignature);
  const expectedBuffer = Buffer.from(expectedSignature);

  if (
    receivedBuffer.length !== expectedBuffer.length ||
    !timingSafeEqual(receivedBuffer, expectedBuffer)
  ) {
    throw new UploadValidationError('Le justificatif de téléversement est invalide.');
  }

  let payload: UploadTicketPayload;
  try {
    payload = JSON.parse(Buffer.from(encodedPayload, 'base64url').toString('utf8'));
  } catch {
    throw new UploadValidationError('Le justificatif de téléversement est illisible.');
  }

  if (payload.stagingKey !== stagingKey || payload.expiresAt < Date.now()) {
    throw new UploadValidationError('Le lien de téléversement a expiré.');
  }

  return payload;
}

export async function validateStoredFile(
  client: S3Client,
  bucket: string,
  ticket: UploadTicketPayload,
): Promise<void> {
  const object = await client.send(
    new HeadObjectCommand({ Bucket: bucket, Key: ticket.stagingKey }),
  );

  if (
    object.ContentLength !== ticket.fileSize ||
    object.ContentLength > MAX_FILE_SIZE ||
    object.ContentType !== ticket.contentType
  ) {
    throw new UploadValidationError('Le fichier reçu ne correspond pas au fichier annoncé.');
  }

  const header = await readObjectRange(
    client,
    bucket,
    ticket.stagingKey,
    'bytes=0-63',
  );
  let archiveIndex: Uint8Array | undefined;

  if (ticket.extension === 'docx' || ticket.extension === 'xlsx') {
    const start = Math.max(0, ticket.fileSize - 1024 * 1024);
    archiveIndex = await readObjectRange(
      client,
      bucket,
      ticket.stagingKey,
      `bytes=${start}-${ticket.fileSize - 1}`,
    );
  }

  if (!hasValidSignature(ticket.extension, header, archiveIndex)) {
    throw new UploadValidationError('Le contenu du fichier ne correspond pas à son extension.');
  }
}

export async function promoteStoredFile(
  client: S3Client,
  bucket: string,
  ticket: UploadTicketPayload,
): Promise<string> {
  const finalKey = ticket.stagingKey.replace('contact-staging/', 'contact-files/');

  await client.send(
    new CopyObjectCommand({
      Bucket: bucket,
      Key: finalKey,
      CopySource: `${bucket}/${ticket.stagingKey}`,
      ContentDisposition: `attachment; filename="${ticket.fileName}"`,
      ContentType: ticket.contentType,
      MetadataDirective: 'REPLACE',
      Metadata: {
        originalname: ticket.fileName,
        expires: new Date(Date.now() + DOWNLOAD_LINK_LIFETIME * 1000).toISOString(),
      },
    }),
  );
  await deleteStoredFile(client, bucket, ticket.stagingKey);

  return finalKey;
}

export async function deleteStoredFile(
  client: S3Client,
  bucket: string,
  key: string,
): Promise<void> {
  await client.send(new DeleteObjectCommand({ Bucket: bucket, Key: key }));
}

export function downloadCommand(
  bucket: string,
  key: string,
  fileName: string,
): GetObjectCommand {
  return new GetObjectCommand({
    Bucket: bucket,
    Key: key,
    ResponseContentDisposition: `attachment; filename="${fileName}"`,
  });
}

export function jsonResponse(body: object, status = 200): Response {
  return Response.json(body, {
    status,
    headers: {
      'Cache-Control': 'no-store',
      'Content-Security-Policy': "default-src 'none'",
      'X-Content-Type-Options': 'nosniff',
    },
  });
}

export function errorResponse(error: unknown): Response {
  if (error instanceof UploadConfigurationError) {
    console.error(error.message);
    return jsonResponse({ error: 'Le stockage sécurisé n’est pas configuré.' }, 503);
  }

  if (error instanceof UploadValidationError) {
    return jsonResponse({ error: error.message }, 422);
  }

  console.error('Erreur du stockage des pièces jointes :', error);
  return jsonResponse({ error: 'Le stockage sécurisé est momentanément indisponible.' }, 502);
}

function sanitizeFileName(fileName: string): string {
  const normalized = fileName
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9._-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(-120);

  if (!normalized || normalized.startsWith('.')) {
    throw new UploadValidationError('Le nom du fichier est invalide.');
  }

  return normalized;
}

function sign(payload: string, secret: string): string {
  return createHmac('sha256', secret).update(payload).digest('base64url');
}

async function readObjectRange(
  client: S3Client,
  bucket: string,
  key: string,
  range: string,
): Promise<Uint8Array> {
  const response = await client.send(
    new GetObjectCommand({ Bucket: bucket, Key: key, Range: range }),
  );

  if (!response.Body) {
    throw new UploadValidationError('Le fichier téléversé est vide.');
  }

  return response.Body.transformToByteArray();
}

function hasValidSignature(
  extension: string,
  header: Uint8Array,
  archiveIndex?: Uint8Array,
): boolean {
  const startsWith = (...signature: number[]) =>
    signature.every((byte, index) => header[index] === byte);

  switch (extension) {
    case 'pdf':
      return startsWith(0x25, 0x50, 0x44, 0x46, 0x2d);
    case 'jpg':
    case 'jpeg':
      return startsWith(0xff, 0xd8, 0xff);
    case 'png':
      return startsWith(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a);
    case 'webp':
      return (
        startsWith(0x52, 0x49, 0x46, 0x46) &&
        header[8] === 0x57 &&
        header[9] === 0x45 &&
        header[10] === 0x42 &&
        header[11] === 0x50
      );
    case 'doc':
    case 'xls':
      return startsWith(0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1);
    case 'docx':
    case 'xlsx': {
      if (!startsWith(0x50, 0x4b, 0x03, 0x04) || !archiveIndex) {
        return false;
      }

      const decodedIndex = new TextDecoder('latin1').decode(archiveIndex);
      return extension === 'docx'
        ? decodedIndex.includes('word/') && decodedIndex.includes('[Content_Types].xml')
        : decodedIndex.includes('xl/') && decodedIndex.includes('[Content_Types].xml');
    }
    default:
      return false;
  }
}
