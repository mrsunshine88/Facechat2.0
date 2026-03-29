import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

async function checkCols() {
  const { data, error } = await supabase.from('profiles').select('*').limit(1)
  if (error) {
    console.error("Error fetching columns:", error)
  } else if (data && data.length > 0) {
    console.log("Columns in PROFILES:", Object.keys(data[0]).join(', '))
  } else {
    console.log("No data in PROFILES table")
  }
}

checkCols()
