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
  console.log('Restoring super_admin roles...');
  
  // Set all users to super_admin for this dev environment to be safe, 
  // or just the primary user.
  const { data: users, error } = await supabase.from('users').select('*');
  if (error) {
    console.error('Error fetching users:', error);
    return;
  }
  
  console.log('Current users:', users.map(u => ({ id: u.id, email: u.email, role: u.role })));
  
  if (users.length > 0) {
    for (const user of users) {
      console.log(`Setting ${user.email} to super_admin`);
      await supabase.from('users').update({ role: 'super_admin' }).eq('id', user.id);
    }
    console.log('Successfully updated roles!');
  }
}

main();
