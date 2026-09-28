import 'server-only';
import { NextRequest, NextResponse } from 'next/server';

/**
 * AgentOS API authentication.
 * 
 * These endpoints expose read-only CRM data to AgentOS without connecting
 * AgentOS directly to the production database. Access is protected by an
 * API key stored in AGENTOS_API_KEY environment variable.
 */

export class AgentOSAuthError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AgentOSAuthError';
  }
}

/**
 * Verify the AgentOS API key from the Authorization header.
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

  const authHeader = request.headers.get('authorization');
  
  if (!authHeader) {
    throw new AgentOSAuthError('Missing Authorization header');
  }

  const match = authHeader.match(/^Bearer\s+(.+)$/i);
  if (!match) {
    throw new AgentOSAuthError('Invalid Authorization header format. Expected: Bearer <token>');
  }

  const providedKey = match[1];
  
  if (providedKey !== apiKey) {
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
