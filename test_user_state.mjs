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

const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

async function main() {
  const userId = '02803aa3-9451-4b23-b229-9823a8a79cac'; // Current user

  // Get user's email from admin
  const { data: { user }, error: userError } = await supabaseAdmin.auth.admin.getUserById(userId);
  if (userError || !user) {
    console.error("Could not find user:", userError);
    return;
  }
  
  console.log("User email:", user.email);

  // We can't easily get their JWT without their password, but we can query pg_policies using postgres standard client... 
  // Wait, I can use the supabase admin to query the user's family id.
  const { data: profile } = await supabaseAdmin.from('users').select('family_id').eq('id', userId).single();
  console.log("User family_id:", profile?.family_id);

  // Let's check if there's any RLS policy preventing access.
  // Actually, I can check all policies via postgres!
  // I'll execute a raw SQL query if possible.
}

main();
