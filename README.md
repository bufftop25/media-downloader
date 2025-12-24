# media-downloader

A simple library to decrypt and download WhatsApp media files directly from message payloads. Enhanced version with automatic detection of images sent as documents.

## ✨ New Features (v1.1.0)

- **Automatic Image Detection**: Automatically detects when a `documentMessage` contains an image (based on `mimetype`) and converts it to `imageMessage` for proper decryption
- **Document with Caption Support**: Properly handles `documentWithCaptionMessage` and preserves captions
- **DirectPath Support**: Supports `directPath` field to construct URLs when `url` is not available
- **Enhanced Type Safety**: Expanded interfaces with all necessary fields for images (thumbnails, captions, etc.)

## Installation

```bash
npm install @w3nder/media-downloader
```

## Usage

### Basic Example

```javascript
import { decryptWhatsAppMedia } from '@w3nder/media-downloader';

// Example with a document message
const payload = {
  message: {
    documentMessage: {
      url: "https://mmg.whatsapp.net/...",
      mimetype: "application/pdf",
      mediaKey: "base64EncodedKey...",
      fileName: "document.pdf"
    }
  }
};

async function downloadMedia() {
  try {
    const result = await decryptWhatsAppMedia(payload, 'downloads');
    console.log('File saved at:', result.outputPath);
  } catch (error) {
    console.error('Error downloading media:', error);
  }
}
```

### Example with Image Sent as Document

```javascript
// ✅ Now automatically handled! The library detects that this document is an image
// and converts it internally to imageMessage for proper decryption
const payload = {
  message: {
    documentMessage: {
      url: "https://mmg.whatsapp.net/...",
      mimetype: "image/png", // ✅ Detected as image!
      mediaKey: "base64EncodedKey...",
      fileName: "image.png",
      jpegThumbnail: "...",
      thumbnailDirectPath: "..."
    }
  }
};

// The library will automatically:
// 1. Detect mimetype starts with "image/"
// 2. Convert to imageMessage internally
// 3. Use correct decryption algorithm (WhatsApp Image Keys)
// 4. Return mediaType: 'image'
```

### Example with Document with Caption

```javascript
const payload = {
  message: {
    documentWithCaptionMessage: {
      message: {
        documentMessage: {
          url: "https://mmg.whatsapp.net/...",
          mimetype: "image/png",
          mediaKey: "base64EncodedKey...",
          fileName: "image.png",
          caption: "My image caption" // ✅ Preserved!
        }
      }
    }
  }
};

const result = await decryptWhatsAppMedia(payload, 'downloads');
console.log(result.caption); // "My image caption"
```

## Supported Media Types

- ✅ Audio Messages
- ✅ Images (including images sent as documents)
- ✅ Videos
- ✅ Documents
- ✅ Stickers
- ✅ Documents with Captions

## API

### decryptWhatsAppMedia(payload, outputDir?)

Decrypts and saves WhatsApp media. Automatically detects and handles images sent as documents.

#### Parameters

- `payload`: Message payload containing media information
- `outputDir`: Directory to save the file (default: 'output')

#### Returns

```javascript
{
  outputPath: string,    // Path where the file was saved
  mediaType: string,     // Type of media (audio, image, video, document, sticker)
  mimeType: string,      // File MIME type
  fileName: string,      // Name of the saved file
  caption?: string       // Caption if present (new in v1.1.0)
}
```

## Improvements in v1.1.0

1. **Automatic Image Detection**: Documents with `mimetype` starting with `"image/"` are automatically converted to `imageMessage`
2. **Correct Decryption Algorithm**: Uses `WhatsApp Image Keys` instead of `WhatsApp Document Keys` for images
3. **DirectPath Support**: Constructs URLs from `directPath` when `url` is not available
4. **Caption Preservation**: Preserves and returns captions from `documentWithCaptionMessage`
5. **Enhanced Type Safety**: All image-specific fields are now properly typed

## License

MIT
