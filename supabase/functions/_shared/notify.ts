// notify.ts - phone alerts via Telegram (owner, 17 Oct). Free; the bot token lives only in the backend table
// `notify_settings` (no read access for app users; set once by the owner in the SQL editor). If the table/token is
// missing, alerts are silently skipped - they can never stop trading logic.
// Duplicate guard: `key` alerts are sent at most once per `everyMin` minutes (remembered in system_logs).

// deno-lint-ignore no-explicit-any
type Sb = any

async function settings(supabase: Sb): Promise<{ token: string; chatId: string | null; enabled: boolean } | null> {
  const { data, error } = await supabase.from('notify_settings').select('telegram_bot_token, telegram_chat_id, enabled').eq('id', 1).maybeSingle()
  if (error || !data?.telegram_bot_token) return null
  return { token: data.telegram_bot_token, chatId: data.telegram_chat_id ?? null, enabled: data.enabled !== false }
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
    const chatId = s.chatId ?? await linkChat(supabase, s.token)
    if (!chatId) return false
    const r = await fetch(`https://api.telegram.org/bot${s.token}/sendMessage`, { method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text }), signal: AbortSignal.timeout(8000) })
    if (opts.key) await supabase.from('system_logs').insert({ level: 'INFO', source: 'notify', message: opts.key, metadata: { text } })
    return r.ok
  } catch { return false }
}
