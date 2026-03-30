import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL as string, process.env.SUPABASE_SERVICE_ROLE_KEY as string);

async function run() {
  const { data } = await supabase.from('profiles').select('username, is_root, is_admin, perm_content, perm_roles, perm_manage_users').eq('username', 'helenahult').single();
  console.log('Helena:', data);
}
run();
