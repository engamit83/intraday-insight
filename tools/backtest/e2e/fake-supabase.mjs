// A tiny fake of the Supabase client: records every call, answers from `globalThis.__DB`.
export function createClient() {
  const db = globalThis.__DB
  const from = (table) => {
    const q = { table, op: 'select', filters: [], payload: null, order: null, limit: null }
    const b = new Proxy({}, {
      get(_t, prop) {
        if (prop === 'then') return (res, rej) => Promise.resolve(db.answer(q)).then(res, rej)
        if (prop === 'maybeSingle') return () => Promise.resolve(db.answer({ ...q, single: true }))
        return (...args) => {
          if (['insert', 'update', 'upsert', 'delete'].includes(String(prop))) { q.op = String(prop); q.payload = args[0] }
          else q.filters.push([String(prop), ...args])
          return b
        }
      },
    })
    db.calls.push(q)
    return b
  }
  return { from, auth: { getUser: async (t) => (globalThis.__VALID_USER_TOKEN && t === globalThis.__VALID_USER_TOKEN ? { data: { user: { id: 'u1' } }, error: null } : { data: { user: null }, error: { message: 'no' } }) } }
}
