import type { FastifyInstance } from 'fastify';
import { bot } from '../../bot/bot.js';
import { logger } from '../../utils/logger.js';

/**
 * Media proxy routes - proxies Telegram files to avoid CORS issues
 * and hide bot token from client
 */
export function mediaRoutes(fastify: FastifyInstance): void {
  /**
   * GET /api/media/:fileId
   * Proxies file from Telegram servers
   */
  fastify.get<{
    Params: { fileId: string };
  }>('/api/media/:fileId', async (request, reply) => {
    const { fileId } = request.params;

    if (!fileId || fileId.length < 10) {
      return await reply.status(400).send({ error: 'Invalid file ID' });
    }

    try {
      // Get file info from Telegram
      const file = await bot.api.getFile(fileId);

      if (!file.file_path) {
        return await reply.status(404).send({ error: 'File not found' });
      }

      // Construct Telegram file URL
      const fileUrl = `https://api.telegram.org/file/bot${bot.token}/${file.file_path}`;

      // Fetch file from Telegram
      const response = await fetch(fileUrl);

      if (!response.ok) {
        logger.warn({ fileId, status: response.status }, 'Failed to fetch file from Telegram');
        return await reply.status(502).send({ error: 'Failed to fetch file' });
      }

      // Determine content type from file path
      const contentType = getContentType(file.file_path);

      // Set headers
      reply.header('Content-Type', contentType);
      reply.header('Cache-Control', 'public, max-age=86400'); // Cache for 24 hours
      reply.header('Access-Control-Allow-Origin', '*');

      // Stream the response
      const buffer = await response.arrayBuffer();
      return await reply.send(Buffer.from(buffer));
    } catch (error) {
      logger.error({ error, fileId }, 'Error proxying media file');
      return await reply.status(500).send({ error: 'Internal server error' });
    }
  });
}

function getContentType(filePath: string): string {
  const ext = filePath.split('.').pop()?.toLowerCase();

  const mimeTypes: Record<string, string> = {
    // Images
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    png: 'image/png',
    gif: 'image/gif',
    webp: 'image/webp',
    // Audio
    ogg: 'audio/ogg',
    oga: 'audio/ogg',
    mp3: 'audio/mpeg',
    wav: 'audio/wav',
    // Video
    mp4: 'video/mp4',
    // Documents
    pdf: 'application/pdf',
  };

  return mimeTypes[ext ?? ''] ?? 'application/octet-stream';
}
