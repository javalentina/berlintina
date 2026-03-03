#!/usr/bin/env node
/**
 * Quick test to verify OpenAI API works for this app.
 * Run from server/: node test-openai.js
 */
import 'dotenv/config';
import OpenAI from 'openai';

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const MOCK_MODE = process.env.MOCK_MODE === 'true';

async function main() {
  console.log('Checking OpenAI configuration...\n');

  if (!OPENAI_API_KEY) {
    console.log('❌ OPENAI_API_KEY is not set in .env');
    console.log('   Add OPENAI_API_KEY=sk-... to server/.env');
    process.exit(1);
  }
  console.log('✓ OPENAI_API_KEY is set');

  if (MOCK_MODE) {
    console.log('⚠ MOCK_MODE=true — OpenAI will be skipped at runtime');
  }

  try {
    const openai = new OpenAI({ apiKey: OPENAI_API_KEY });
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: 'Say "OK" if you can read this.' }],
      max_tokens: 20,
    });
    const reply = completion.choices[0]?.message?.content?.trim() || '(empty)';
    console.log('✓ OpenAI API responded:', reply);
    console.log('\n✅ OpenAI works for your app.');
  } catch (err) {
    console.error('\n❌ OpenAI API error:', err.message);
    if (err.status === 401) console.error('   → Check that your API key is valid');
    if (err.status === 429) console.error('   → Rate limit or quota exceeded');
    process.exit(1);
  }
}

main();
