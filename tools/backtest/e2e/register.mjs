globalThis.__V42_PAPER__ = true // 25 Oct: the old v4.2 paper trading is off in production; its tests still check it
import { register } from 'node:module'
register(new URL('./loader.mjs', import.meta.url).href)
