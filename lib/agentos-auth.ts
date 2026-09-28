import 'server-only';
import { createHash, timingSafeEqual } from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';

/**
 * AgentOS API authentication.
 *
 * AgentOS reads CRM data through `/api/agentos/*` without touching the
 * production database directly. Two keys, two capabilities:
 *
 * - `AGENTOS_API_KEY` — reads. Every GET route.
 * - `AGENTOS_WRITE_API_KEY` — writes. Only the PATCH routes, and it must be a
 *   different value: a leaked read key must never be enough to change data.
 *
 * Keys are compared in constant time, so response timing reveals nothing
 * about how much of a guessed key was right.
 */

export class AgentOSAuthError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AgentOSAuthError';
  }
}

/**
 * Constant-time equality for two secrets of any length.
 *
 * Both sides are hashed first so `timingSafeEqual` always compares equal-length
 * buffers — comparing lengths directly would itself leak the key's length.
 */
export function sameSecret(provided: string, expected: string): boolean {
  const a = createHash('sha256').update(provided).digest();
  const b = createHash('sha256').update(expected).digest();
  return timingSafeEqual(a, b);
}

function bearer(request: NextRequest): string {
  const authHeader = request.headers.get('authorization');

  if (!authHeader) {
    throw new AgentOSAuthError('Missing Authorization header');
  }

  const match = authHeader.match(/^Bearer\s+(.+)$/i);
  if (!match) {
    throw new AgentOSAuthError('Invalid Authorization header format. Expected: Bearer <token>');
  }

  return match[1];
}

/**
 * Verify the AgentOS read key.
 *
 * Expects: Authorization: Bearer <AGENTOS_API_KEY>
 *
 * @throws AgentOSAuthError if authentication fails
 */
export async function verifyAgentOSAuth(request: NextRequest): Promise<void> {
  const apiKey = process.env.AGENTOS_API_KEY;

  if (!apiKey) {
    console.error('AGENTOS_API_KEY is not configured');
    throw new AgentOSAuthError('AgentOS API is not configured on this deployment');
  }

  if (!sameSecret(bearer(request), apiKey)) {
    throw new AgentOSAuthError('Invalid API key');
  }
}

/**
 * Verify the AgentOS write key.
 *
 * Expects: Authorization: Bearer <AGENTOS_WRITE_API_KEY>
 *
 * Refuses to work at all when the write key is missing or equal to the read
 * key — both are configuration mistakes that would make writing as easy as
 * reading, so the routes stay closed until they are fixed.
 *
 * @throws AgentOSAuthError if authentication fails
 */
export async function verifyAgentOSWriteAuth(request: NextRequest): Promise<void> {
  const writeKey = process.env.AGENTOS_WRITE_API_KEY;

  if (!writeKey) {
    console.error('AGENTOS_WRITE_API_KEY is not configured');
    throw new AgentOSAuthError('AgentOS write API is not configured on this deployment');
  }

  if (process.env.AGENTOS_API_KEY && sameSecret(writeKey, process.env.AGENTOS_API_KEY)) {
    console.error('AGENTOS_WRITE_API_KEY must differ from AGENTOS_API_KEY');
    throw new AgentOSAuthError('AgentOS write API is not configured on this deployment (write key must differ from read key)');
  }

  if (!sameSecret(bearer(request), writeKey)) {
    throw new AgentOSAuthError('Invalid API key');
  }
}

/**
 * Handle AgentOS authentication errors with appropriate HTTP responses.
 */
export function handleAgentOSAuthError(error: unknown): NextResponse {
  if (error instanceof AgentOSAuthError) {
    const status = error.message.includes('not configured') ? 503 : 401;
    return NextResponse.json(
      { error: error.message },
      { status }
    );
  }

  console.error('Unexpected AgentOS auth error:', error);
  return NextResponse.json(
    { error: 'Authentication failed' },
    { status: 500 }
  );
}
