import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

async function findAdmins() {
  const { data, error } = await supabase.from('profiles').select('*').or('is_admin.eq.true,perm_users.eq.true,perm_content.eq.true,perm_rooms.eq.true,perm_roles.eq.true,perm_support.eq.true,perm_logs.eq.true,perm_stats.eq.true,perm_diagnostics.eq.true,perm_chat.eq.true,perm_images.eq.true')
  if (error) {
    console.error("Error:", error)
  } else if (data) {
    console.log("USERS WITH ADMIN FLAGS:")
    data.forEach(u => {
      console.log(`- ${u.username}: is_admin=${u.is_admin}, perm_images=${u.perm_images}, perm_stats=${u.perm_stats}, perm_logs=${u.perm_logs}`)
    })
  }
}

findAdmins()
