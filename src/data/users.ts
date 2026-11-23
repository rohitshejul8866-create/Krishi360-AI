import type { DemoUser } from '../types'
import { DEMO_EXPERTS } from './experts'
import { DEMO_FARMERS } from './farmers'

export const DEMO_ADMINS: DemoUser[] = [
  {
    id: 'admin-001',
    name: 'Admin User',
    email: 'admin@demo.krishi360.in',
    role: 'admin',
    location: 'Platform Operations',
    phone: '+91 80•••••360',
    status: 'active',
    joinedAt: '2026-02-01',
    avatar: 'AU',
    organisation: 'KRISHI360 AI Demo Operations',
    specialisation: 'Platform administration',
  },
  {
    id: 'admin-002',
    name: 'Neha Gupta',
    email: 'neha@demo.krishi360.in',
    role: 'admin',
    location: 'Platform Operations',
    phone: '+91 80•••••361',
    status: 'invited',
    joinedAt: '2026-10-11',
    avatar: 'NG',
    organisation: 'KRISHI360 AI Demo Operations',
    specialisation: 'Data quality',
  },
]

export const DEMO_USERS: DemoUser[] = [...DEMO_ADMINS, ...DEMO_EXPERTS, ...DEMO_FARMERS]
