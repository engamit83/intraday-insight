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

/** Constant-time string comparison (avoids leaking how much of a secret matched). */
function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  let diff = 0
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return diff === 0
}

/**
 * Exact-match check that the request carries the SERVICE ROLE key as its
 * Bearer token (i.e. it comes from a trusted internal job, not a browser).
 *
 * SECURITY FIX: several functions previously used
 *   authHeader.includes(serviceRoleKey.substring(0, 30))
 * The first 30 characters of every Supabase HS256 JWT are the same standard
 * header, and the public anon key (shipped in the frontend) starts with exactly
 * those characters — so that check passed for anyone holding the anon key.
 * This compares the whole token, in constant time.
 */
export function isServiceRoleRequest(req: Request): boolean {
  const authHeader = req.headers.get('authorization') ?? ''
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  if (!serviceRoleKey || !authHeader.startsWith('Bearer ')) return false
  return timingSafeEqual(authHeader.slice(7).trim(), serviceRoleKey)
}

/**
 * Trusted internal caller: either the service-role key, OR a scheduled database
 * job presenting the private `x-job-token` header (the project convention, see
 * AGENTS.md — the service-role key is not available to SQL). The expected token
 * lives in `internal_job_tokens` (row name = 'cron'), a table only the backend
 * can read.
 */
export async function isTrustedInternalRequest(req: Request): Promise<boolean> {
  if (isServiceRoleRequest(req)) return true

  const jobToken = req.headers.get('x-job-token') ?? ''
  if (jobToken.length < 32) return false

  const url = Deno.env.get('SUPABASE_URL')
  const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  if (!url || !key) return false

  const admin = createClient(url, key)
  const { data } = await admin.from('internal_job_tokens').select('token').eq('name', 'cron').maybeSingle()
  const expected = (data as { token?: string } | null)?.token
  return typeof expected === 'string' && timingSafeEqual(jobToken, expected)
}
