if ('Bun' in globalThis) throw new Error('❌ Use Node.js to run this test!')

const { openapi } = require('@elysiajs/openapi')

if (typeof openapi !== 'function') throw new Error('❌ CommonJS Node.js failed')

console.log('✅ CommonJS Node.js works!')
