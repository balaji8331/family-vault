import fs from 'fs';
import { createClient } from '@supabase/supabase-js';

const env = fs.readFileSync('.env.local', 'utf8');
const lines = env.split('\n');
let SUPABASE_URL = '';
let SUPABASE_SERVICE_ROLE_KEY = '';

lines.forEach(line => {
  if (line.startsWith('NEXT_PUBLIC_SUPABASE_URL=')) SUPABASE_URL = line.split('=')[1].trim();
  if (line.startsWith('SUPABASE_SERVICE_ROLE_KEY=')) SUPABASE_SERVICE_ROLE_KEY = line.split('=')[1].trim();
});

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

async function main() {
  const { data, error } = await supabase.from('encryption_keys').select('*').limit(1);
  console.log('Keys table columns:', error || Object.keys(data[0] || {}));
}

main();
