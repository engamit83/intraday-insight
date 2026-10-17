// notify.ts - phone alerts via ntfy and/or Telegram (owner, 17 Oct: keep both so we can switch at once).
// Free. Settings live only in the backend table `notify_settings` (no read access for app users; set by the owner in
// the SQL editor). `channel` = 'ntfy' | 'telegram' | 'both' chooses where alerts go (switch = one SQL line).
// If the table/settings are missing, alerts are silently skipped - they can never stop trading logic.
// Duplicate guard: `key` alerts are sent at most once per `everyMin` minutes (remembered in system_logs).

// deno-lint-ignore no-explicit-any
type Sb = any

type Settings = { token: string | null; chatId: string | null; topic: string | null; channel: string; enabled: boolean }
async function settings(supabase: Sb): Promise<Settings | null> {
  const { data, error } = await supabase.from('notify_settings').select('*').eq('id', 1).maybeSingle()
  if (error || !data) return null
  return { token: data.telegram_bot_token ?? null, chatId: data.telegram_chat_id ?? null, topic: data.ntfy_topic ?? null,
    channel: data.channel ?? 'both', enabled: data.enabled !== false }
}

/** ntfy: free push app, no account. The topic name is the private address (long random name). */
async function sendNtfy(topic: string, text: string): Promise<boolean> {
  try {
    const r = await fetch(`https://ntfy.sh/${encodeURIComponent(topic)}`, { method: 'POST', body: text, headers: { Title: 'TRD App' }, signal: AbortSignal.timeout(8000) })
    return r.ok
  } catch { return false }
}

async function sendTelegram(supabase: Sb, s: Settings, text: string): Promise<boolean> {
  if (!s.token) return false
  const chatId = s.chatId ?? await linkChat(supabase, s.token)
  if (!chatId) return false
  try {
    const r = await fetch(`https://api.telegram.org/bot${s.token}/sendMessage`, { method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text }), signal: AbortSignal.timeout(8000) })
    return r.ok
  } catch { return false }
}

/** First message the owner sends to the bot gives us the chat id (no copying ids by hand). */
async function linkChat(supabase: Sb, token: string): Promise<string | null> {
  try {
    const r = await fetch(`https://api.telegram.org/bot${token}/getUpdates`, { signal: AbortSignal.timeout(8000) })
    const j = await r.json()
    const chat = (j?.result ?? []).map((u: Record<string, any>) => u.message?.chat?.id ?? u.my_chat_member?.chat?.id).find((x: unknown) => x != null)
    if (chat == null) return null
    await supabase.from('notify_settings').update({ telegram_chat_id: String(chat), updated_at: new Date().toISOString() }).eq('id', 1)
    await fetch(`https://api.telegram.org/bot${token}/sendMessage`, { method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ chat_id: chat, text: '✅ TRD App alerts are linked. You will get paper-trade, feed and Sharekhan alerts here.' }), signal: AbortSignal.timeout(8000) })
    return String(chat)
  } catch { return null }
}

export async function notify(supabase: Sb, text: string, opts: { key?: string; everyMin?: number } = {}): Promise<boolean> {
  try {
    const s = await settings(supabase)
    if (!s || !s.enabled) return false
    if (opts.key) {
      const since = new Date(Date.now() - (opts.everyMin ?? 30) * 60_000).toISOString()
      const { data: seen } = await supabase.from('system_logs').select('id').eq('source', 'notify').eq('message', opts.key).gte('created_at', since).limit(1)
      if (seen?.length) return false
    }
    const useNtfy = (s.channel === 'ntfy' || s.channel === 'both') && !!s.topic
    const useTg = (s.channel === 'telegram' || s.channel === 'both') && !!s.token
    if (!useNtfy && !useTg) return false
    const [a, b] = await Promise.all([useNtfy ? sendNtfy(s.topic!, text) : false, useTg ? sendTelegram(supabase, s, text) : false])
    if (opts.key) await supabase.from('system_logs').insert({ level: 'INFO', source: 'notify', message: opts.key, metadata: { text } })
    return a || b
  } catch { return false }
}
