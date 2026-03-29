const { createClient } = require('@supabase/supabase-js')

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

async function checkDefaults() {
  const { data, error } = await supabase.rpc('get_column_defaults', { table_name: 'profiles' })
  if (error) {
    // If RPC fails, try information_schema query
    const { data: schemaData, error: schemaError } = await supabase
      .from('profiles')
      .select('username, perm_images, is_admin')
      .limit(1)
    
    console.log("SAMPLE DATA:", schemaData)
    
    const { data: qData, error: qError } = await supabase.rpc('get_table_schema', { t_name: 'profiles' })
    console.log("SCHEMA:", qData || qError)
  } else {
    console.log("DEFAULTS:", data)
  }
}

checkDefaults()
