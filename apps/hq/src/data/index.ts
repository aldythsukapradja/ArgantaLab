import type { HQDataSource } from './HQDataSource'
import { MockDataSource } from './mock'
import { SupabaseDataSource } from './supabaseSource'
import { cloudEnabled } from '../lib/supabase'

// One line decides mock vs live. SupabaseDataSource itself falls back to mock
// per-method, so a real-but-empty project still renders.
export const data: HQDataSource = cloudEnabled
  ? new SupabaseDataSource()
  : new MockDataSource()

export { cloudEnabled }
