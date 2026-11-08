import type { VercelRequest, VercelResponse } from '@vercel/node';
import { Redis } from '@upstash/redis';
import { customAlphabet } from 'nanoid';

// Clean, readable, URL-safe 8-character slug (no confusing chars like 0, O, 1, l, I)
const generateSlug = customAlphabet('23456789abcdefghjkmnpqrstuvwxyz', 8);

function getRedis(): Redis | null {
  const url = process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN;
  if (!url || !token) return null;
  return new Redis({ url, token });
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { files, packages = [], activeId, type = 'project' } = req.body || {};

  if (!Array.isArray(files) || files.length === 0) {
    return res.status(400).json({ error: 'At least one file is required' });
  }

  // Guard against massive payloads (>500KB)
  const bodyString = JSON.stringify(req.body);
  if (bodyString.length > 500 * 1024) {
    return res.status(413).json({ error: 'Payload too large (max 500KB)' });
  }

  const redis = getRedis();
  if (!redis) {
    return res.status(503).json({
      error: 'Upstash Redis is not configured. Set UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN in Vercel environment variables.',
    });
  }

  const id = generateSlug();
  const snippetData = {
    id,
    type: type || (files.length === 1 ? 'file' : 'project'),
    files,
    packages,
    activeId: activeId || files[0].id,
    createdAt: Date.now(),
  };

  try {
    // Save to Upstash Redis (stored indefinitely)
    await redis.set(`snippet:${id}`, snippetData);

    return res.status(200).json({
      id,
      path: `/s/${id}`,
    });
  } catch (error: any) {
    console.error('Failed to save snippet:', error);
    return res.status(500).json({ error: 'Failed to save snippet' });
  }
}
