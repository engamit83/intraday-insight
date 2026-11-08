// kite-login.mjs - owner 8 Nov: one Zerodha (Kite Connect) login on the laptop, for the history download. RECORD ONLY - no orders ever.
// How it works: opens Zerodha's login page in the browser; the OWNER logs in (password/OTP typed only by him); Zerodha sends a one-time
// code back to THIS laptop (http://127.0.0.1:5005/kite, the redirect URL set in the Kite app); we swap it for today's access token and save it
// to data\kite-token.json (laptop only). Keys come from .env (KITE_API_KEY, KITE_API_SECRET) and are never printed.
import fs from 'node:fs'
import path from 'node:path'
import http from 'node:http'
import crypto from 'node:crypto'
import { exec } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const here = path.dirname(fileURLToPath(import.meta.url))
const envFile = path.join(here, '.env')
if (fs.existsSync(envFile)) for (const line of fs.readFileSync(envFile, 'utf8').split(/\r?\n/)) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/)
  if (m && !line.trim().startsWith('#') && !(m[1] in process.env)) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '')
}
const KEY = process.env.KITE_API_KEY, SECRET = process.env.KITE_API_SECRET
if (!KEY || !SECRET) { console.log('KITE_API_KEY / KITE_API_SECRET missing in .env'); process.exit(1) }
const PORT = 5005, tokenFile = path.join(here, 'data', 'kite-token.json')
const loginUrl = `https://kite.zerodha.com/connect/login?v=3&api_key=${encodeURIComponent(KEY)}`

const server = http.createServer(async (req, res) => {
  const u = new URL(req.url, `http://127.0.0.1:${PORT}`)
  if (u.pathname !== '/kite') { res.writeHead(404); return res.end() }
  const rt = u.searchParams.get('request_token'), status = u.searchParams.get('status')
  const page = (msg) => { res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' }); res.end(`<h2>${msg}</h2><p>You can close this tab.</p>`) }
  if (status !== 'success' || !rt) { page('Zerodha login was not completed.'); console.log('Login not completed:', status); return }
  try {
    const checksum = crypto.createHash('sha256').update(KEY + rt + SECRET).digest('hex')
    const r = await fetch('https://api.kite.trade/session/token', { method: 'POST', headers: { 'X-Kite-Version': '3', 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ api_key: KEY, request_token: rt, checksum }) })
    const j = await r.json()
    if (!r.ok || !j.data?.access_token) throw new Error(j.message || `HTTP ${r.status}`)
    fs.mkdirSync(path.dirname(tokenFile), { recursive: true })
    fs.writeFileSync(tokenFile, JSON.stringify({ access_token: j.data.access_token, user_id: j.data.user_id, saved: new Date().toISOString() }))
    page('Zerodha login done. The history download can start now.')
    console.log(`Login done for ${j.data.user_id}. Token saved on this laptop (data\\kite-token.json, valid until about 6 AM tomorrow).`)
  } catch (e) { page('Login failed: ' + String(e.message).replace(/[<>]/g, '')); console.log('Login failed:', e.message) }
  setTimeout(() => process.exit(0), 500)
})
server.listen(PORT, '127.0.0.1', () => {
  console.log('Opening the Zerodha login page in your browser. Log in there yourself (user ID, password, OTP).')
  exec(`start "" "${loginUrl}"`)
})
setTimeout(() => { console.log('No login within 10 minutes - closing. Run kite-login.bat again.'); process.exit(1) }, 10 * 60_000)
