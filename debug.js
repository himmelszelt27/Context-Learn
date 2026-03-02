import fs from 'fs';
fs.writeFileSync('api_key_debug.txt', `Type: ${typeof process.env.GEMINI_API_KEY}, Value: "${process.env.GEMINI_API_KEY}"`);
console.log("Debug file written.");
