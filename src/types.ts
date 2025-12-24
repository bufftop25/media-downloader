export interface WhatsAppMediaMessage {
  url?: string;
  URL?: string;
  directPath?: string; // ✅ ADICIONADO: Caminho direto quando não há URL completa
  mimetype?: string;
  mediaKey: string;
  fileLength?: string;
  fileName?: string;
  fileSha256?: string;
  fileEncSha256?: string;
  // ✅ ADICIONADOS: Campos específicos de imagem
  jpegThumbnail?: string;
  thumbnailDirectPath?: string;
  thumbnailSha256?: string;
  thumbnailEncSha256?: string;
  thumbnailHeight?: number;
  thumbnailWidth?: number;
  caption?: string; // ✅ ADICIONADO: Legenda da mensagem
  mediaKeyTimestamp?: string; // ✅ ADICIONADO: Timestamp da chave
}

export interface WhatsAppPayload {
  message: {
    audioMessage?: WhatsAppMediaMessage;
    imageMessage?: WhatsAppMediaMessage;
    videoMessage?: WhatsAppMediaMessage;
    documentMessage?: WhatsAppMediaMessage;
    stickerMessage?: WhatsAppMediaMessage;
    documentWithCaptionMessage?: {
      message?: {
        documentMessage?: WhatsAppMediaMessage;
      };
    };
  };
}

export type MediaType = 'audio' | 'image' | 'video' | 'document' | 'sticker';

export interface DecryptionResult {
  outputPath: string;
  mediaType: MediaType;
  mimeType: string;
  fileName: string;
  caption?: string; // ✅ ADICIONADO: Retornar caption se existir
}
