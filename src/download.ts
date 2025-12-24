import { createDecipheriv, hkdfSync } from 'crypto';
import { createWriteStream, mkdirSync } from 'fs';
import { get } from 'https';
import { join } from 'path';
import { Transform, pipeline } from 'stream';
import { promisify } from 'util';
import { WhatsAppPayload, MediaType, DecryptionResult, WhatsAppMediaMessage } from './types';

const pipe = promisify(pipeline);

function hkdf(mediaKey: Buffer, length: number, info: Buffer): Buffer {
  const salt = Buffer.alloc(32, 0);
  return Buffer.from(hkdfSync('sha256', mediaKey, salt, info, length));
}

class RemoveLastNBytes extends Transform {
  private buffer: Buffer;
  private readonly n: number;
  private readonly chunkSize: number;

  constructor(n: number, chunkSize = 64 * 1024) {
    super();
    this.n = n;
    this.buffer = Buffer.alloc(0);
    this.chunkSize = chunkSize;
  }

  _transform(chunk: Buffer, _: string, callback: (error?: Error) => void): void {
    if (this.buffer.length + chunk.length > this.chunkSize) {
      const remainingSpace = this.chunkSize - this.buffer.length;
      const firstPart = chunk.slice(0, remainingSpace);
      const secondPart = chunk.slice(remainingSpace);

      this.buffer = Buffer.concat([this.buffer, firstPart]);
      this.push(this.buffer);
      this.buffer = secondPart;
    } else {
      this.buffer = Buffer.concat([this.buffer, chunk]);
    }
    callback();
  }

  _flush(callback: (error?: Error) => void): void {
    if (this.buffer.length <= this.n) {
      return callback(new Error('File too small to remove MAC'));
    }
    const cleanData = this.buffer.slice(0, this.buffer.length - this.n);
    this.push(cleanData);
    callback();
  }
}

const MEDIA_TYPES: Record<string, MediaType> = {
  audioMessage: 'audio',
  imageMessage: 'image',
  videoMessage: 'video',
  documentMessage: 'document',
  stickerMessage: 'sticker',
  documentWithCaptionMessage: 'document',
} as const;

const INFO_MAP: Record<MediaType, string> = {
  audio: 'WhatsApp Audio Keys',
  image: 'WhatsApp Image Keys',
  video: 'WhatsApp Video Keys',
  document: 'WhatsApp Document Keys',
  sticker: 'WhatsApp Image Keys',
} as const;

/**
 * ✅ NOVA FUNÇÃO: Normaliza o payload detectando documentos que são imagens
 * e convertendo-os para imageMessage antes do processamento
 */
function normalizePayload(payload: WhatsAppPayload): {
  normalizedPayload: WhatsAppPayload;
  mediaType: MediaType;
  caption?: string;
} {
  const messageContent = payload.message;

  // 1. Tratar documentWithCaptionMessage
  if (messageContent.documentWithCaptionMessage) {
    const docMsg = messageContent.documentWithCaptionMessage.message?.documentMessage;
    if (docMsg) {
      const caption = docMsg.caption;

      // Se o documento é uma imagem (mimetype começa com "image/"), converter para imageMessage
      if (docMsg.mimetype?.startsWith('image/')) {
        return {
          normalizedPayload: {
            message: {
              imageMessage: {
                ...docMsg,
                caption: caption || docMsg.caption, // Preservar caption
              },
            },
          },
          mediaType: 'image',
          caption: caption || docMsg.caption,
        };
      }

      // Senão, manter como documentMessage mas preservar caption
      return {
        normalizedPayload: {
          message: {
            documentMessage: docMsg,
          },
        },
        mediaType: 'document',
        caption: caption || docMsg.caption,
      };
    }
  }

  // 2. Tratar documentMessage direto
  if (messageContent.documentMessage) {
    const docMsg = messageContent.documentMessage;

    // Se o documento é uma imagem, converter para imageMessage
    if (docMsg.mimetype?.startsWith('image/')) {
      return {
        normalizedPayload: {
          message: {
            imageMessage: docMsg,
          },
        },
        mediaType: 'image',
        caption: docMsg.caption,
      };
    }
  }

  // 3. Para outros tipos (imageMessage, videoMessage, audioMessage, stickerMessage)
  // retornar como está e detectar o tipo
  const typeKey = Object.keys(messageContent).find((k) => MEDIA_TYPES[k]) as
    | keyof WhatsAppPayload['message']
    | undefined;

  if (typeKey) {
    const media = messageContent[typeKey] as WhatsAppMediaMessage | undefined;
    return {
      normalizedPayload: payload,
      mediaType: MEDIA_TYPES[typeKey],
      caption: media?.caption,
    };
  }

  // Fallback: se não encontrou tipo, assumir document
  return {
    normalizedPayload: payload,
    mediaType: 'document',
  };
}

/**
 * ✅ MELHORADO: Agora detecta automaticamente documentos que são imagens
 * e usa o algoritmo de descriptografia correto
 */
export async function decryptWhatsAppMedia(
  payload: WhatsAppPayload,
  outputDir = 'output'
): Promise<DecryptionResult> {
  // ✅ NORMALIZAR payload primeiro (detecta documentos que são imagens)
  const { normalizedPayload, mediaType: detectedType, caption } = normalizePayload(payload);

  const messageContent = normalizedPayload.message;
  const typeKey = Object.keys(messageContent).find((k) => MEDIA_TYPES[k]) as
    | keyof WhatsAppPayload['message']
    | undefined;

  if (!typeKey) {
    throw new Error('Unsupported or missing media type.');
  }

  // Extrair media do payload normalizado
  let media: WhatsAppMediaMessage | undefined;
  if (typeKey === 'documentWithCaptionMessage') {
    media = messageContent.documentWithCaptionMessage?.message?.documentMessage;
  } else {
    media = messageContent[typeKey] as WhatsAppMediaMessage | undefined;
  }

  if (!media) {
    throw new Error('Media not found in payload.');
  }

  // ✅ Usar o tipo detectado (pode ser 'image' mesmo vindo de documentMessage)
  const mediaType = detectedType;

  // ✅ Construir URL corretamente (suportar directPath quando não há URL)
  const url =
    media?.url ??
    media?.URL ??
    (media?.directPath ? `https://mmg.whatsapp.net${media.directPath}` : null);

  if (!url) {
    throw new Error('URL or directPath not found in payload.');
  }

  const mediaKeyBase64 = media.mediaKey;
  const rawMime = media.mimetype || 'application/octet-stream';
  const cleanMime = rawMime.split(';')[0].trim();
  const extension = cleanMime.split('/')[1] || 'bin';
  const rawFileName = media.fileName?.split(';')[0].trim();
  const fileName = rawFileName ?? `media_${Date.now()}.${extension}`;
  const outputPath = join(outputDir, fileName);

  // ✅ Usar INFO_MAP correto baseado no tipo detectado (não no tipo original)
  const info = INFO_MAP[mediaType];
  const mediaKey = Buffer.from(mediaKeyBase64, 'base64');
  const expandedKey = hkdf(mediaKey, 112, Buffer.from(info));
  const iv = expandedKey.slice(0, 16);
  const key = expandedKey.slice(16, 48);

  mkdirSync(outputDir, { recursive: true });

  const decipher = createDecipheriv('aes-256-cbc', key, iv);
  decipher.setAutoPadding(true);

  let downloadedBytes = 0;
  let totalBytes = 0;

  await new Promise<void>((resolve, reject) => {
    get(url, async (res) => {
      try {
        totalBytes = parseInt(res.headers['content-length'] || '0', 10);

        const progressStream = new Transform({
          transform(
            chunk: Buffer,
            _: string,
            callback: (error?: Error | null, data?: Buffer) => void
          ): void {
            downloadedBytes += chunk.length;
            const progress = totalBytes
              ? ((downloadedBytes / totalBytes) * 100).toFixed(2)
              : 'unknown';
            process.stdout.write(`\rDownloading: ${progress}%`);
            callback(null, chunk);
          },
        });

        await pipe(
          res,
          progressStream,
          new RemoveLastNBytes(10),
          decipher,
          createWriteStream(outputPath)
        );

        process.stdout.write('\n');
        resolve();
      } catch (err) {
        console.error('❌ Pipeline error:', err);
        reject(err);
      }
    }).on('error', reject);
  });

  return {
    outputPath,
    mediaType,
    mimeType: rawMime,
    fileName,
    caption, // ✅ Retornar caption se existir
  };
}
