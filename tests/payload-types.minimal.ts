/**
 * This interface was referenced by `Config`'s JSON-Schema
 * via the `definition` "categories".
 */
export interface Category {
  id: string
  name: string
  isFriskvardsEligible?: boolean | null
  type: 'PHYSICAL_HEALTH' | 'EMOTIONAL_HEALTH'
  providers?: (string | Provider)[] | null
  updatedAt: string
  createdAt: string
}
/**
 * This interface was referenced by `Config`'s JSON-Schema
 * via the `definition` "providers".
 */
export interface Provider {
  id: string
  status?: ('draft' | 'ready-for-review' | 'published') | null
  name: string
  bio?: string | null
  categories: (string | Category)[]
}
