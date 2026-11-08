import type { VercelRequest, VercelResponse } from '@vercel/node';
import { Redis } from '@upstash/redis';

function getRedis(): Redis | null {
  const url = process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN;
  if (!url || !token) return null;
  return new Redis({ url, token });
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { id } = req.query;
  if (!id || typeof id !== 'string') {
    return res.status(400).json({ error: 'Missing snippet ID' });
  }

  const redis = getRedis();
  if (!redis) {
    return res.status(503).json({
      error: 'Upstash Redis is not configured. Set UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN in Vercel environment variables.',
    });
  }

  try {
    const data = await redis.get(`snippet:${id}`);
    if (!data) {
      return res.status(404).json({ error: 'Snippet not found' });
    }

    return res.status(200).json({
      snippet: typeof data === 'string' ? JSON.parse(data) : data,
    });
  } catch (error: any) {
    console.error('Failed to get snippet:', error);
    return res.status(500).json({ error: 'Failed to fetch snippet' });
  }
}
