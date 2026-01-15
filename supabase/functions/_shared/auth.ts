// Shared authentication utilities for Edge Functions

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

export const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

export interface AuthResult {
  authenticated: boolean
  userId?: string
  error?: string
}

/**
 * Verify JWT token from Authorization header
 * Returns the authenticated user ID if valid
 */
export async function verifyAuth(req: Request): Promise<AuthResult> {
  const authHeader = req.headers.get('authorization')
  
  if (!authHeader?.startsWith('Bearer ')) {
    return { authenticated: false, error: 'Missing or invalid Authorization header' }
  }

  const token = authHeader.replace('Bearer ', '')
  
  const supabaseUrl = Deno.env.get('SUPABASE_URL')!
  const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!

  // When the client is not logged in, the SDK uses the anon key as a Bearer token.
  // That token is NOT a user session JWT, so treat it as unauthenticated.
  if (token === supabaseAnonKey) {
    return { authenticated: false, error: 'Missing user session' }
  }
  
  const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: authHeader } }
  })

  try {
    const { data, error } = await supabase.auth.getUser(token)
    
    if (error || !data.user) {
      return { authenticated: false, error: 'Invalid or expired token' }
    }

    return { authenticated: true, userId: data.user.id }
  } catch (err) {
    return { authenticated: false, error: 'Token verification failed' }
  }
}

/**
 * Create a service role Supabase client for database operations
 */
export function getServiceClient() {
  return createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  )
}

/**
 * Validate UUID format
 */
export function isValidUUID(str: string): boolean {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
  return uuidRegex.test(str)
}

/**
 * Validate stock symbol format (alphanumeric, 1-20 chars)
 */
export function isValidSymbol(symbol: string): boolean {
  const symbolRegex = /^[A-Z0-9&-]{1,20}$/
  return symbolRegex.test(symbol.toUpperCase())
}

/**
 * Sanitize symbol input
 */
export function sanitizeSymbol(symbol: string): string {
  return symbol.toUpperCase().replace(/\.(NS|NSE|BSE)$/i, '').replace(/[^A-Z0-9&-]/g, '').substring(0, 20)
}

/**
 * Validate action against allowed list
 */
export function isValidAction(action: string, allowedActions: string[]): boolean {
  return allowedActions.includes(action)
}
