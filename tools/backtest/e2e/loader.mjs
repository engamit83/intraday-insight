// Maps the edge function's remote imports to local fakes so it can run in Node.
const here = new URL('.', import.meta.url).href
export async function resolve(specifier, context, next) {
  if (specifier.startsWith('https://esm.sh/@supabase/supabase-js')) return { url: here + 'fake-supabase.mjs', shortCircuit: true }
  if (specifier.startsWith('https://esm.sh/crypto-js')) return { url: here + 'fake-cryptojs.mjs', shortCircuit: true }
  return next(specifier, context)
}
