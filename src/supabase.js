import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL || 'https://avyddfdnqoqfgwvdwfwe.supabase.co'
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || 'sb_publishable_J8mcxYnWkgPtN8S9UAynpg_bI0xgDG0'

export const supabase = createClient(url, key)
