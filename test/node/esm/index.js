if ('Bun' in globalThis) throw new Error('❌ Use Node.js to run this test!')

import { openapi } from '@elysiajs/openapi'

if (typeof openapi !== 'function') throw new Error('❌ ESM Node.js failed')

console.log('✅ ESM Node.js works!')
