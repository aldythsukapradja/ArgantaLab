import type { ProductId } from './Portfolio'

export type ReactorSignalState = 'live' | 'partial' | 'offline'

export const PRODUCT_ORBIT_META: readonly {
  id: ProductId
  color: string
  role: 'primary' | 'governance' | 'distribution'
}[] = [
  { id: 'arganta', color: '#3f8cff', role: 'primary' },
  { id: 'kinetik', color: '#35d8ed', role: 'primary' },
  { id: 'lashira', color: '#42dfb8', role: 'primary' },
  { id: 'hq', color: '#9d77ff', role: 'governance' },
  { id: 'landing', color: '#f5b54f', role: 'distribution' },
]
