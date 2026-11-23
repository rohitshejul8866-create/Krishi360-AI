import type { AuditLog } from '../types'

export const DEMO_AUDIT_LOGS: AuditLog[] = [
  { id: 'log-01', actor: 'Dr. Anjali Deshmukh', role: 'expert', action: 'Opened case', target: 'CASE-2401', timestamp: '2026-11-21T12:30:00.000Z' },
  { id: 'log-02', actor: 'Ramesh Patil', role: 'farmer', action: 'Submitted crop image', target: 'CASE-2401', timestamp: '2026-11-21T08:24:00.000Z' },
  { id: 'log-03', actor: 'Admin User', role: 'admin', action: 'Refreshed demo mandi dataset', target: 'MandiSmart', timestamp: '2026-11-21T09:00:00.000Z' },
  { id: 'log-04', actor: 'Dr. Vikram Singh', role: 'expert', action: 'Completed review', target: 'CASE-2404', timestamp: '2026-11-18T14:10:00.000Z' },
  { id: 'log-05', actor: 'Sunita Devi', role: 'farmer', action: 'Saved scheme', target: 'scheme-02', timestamp: '2026-11-17T16:45:00.000Z' },
  { id: 'log-06', actor: 'Admin User', role: 'admin', action: 'Updated platform settings', target: 'PlatformSettings', timestamp: '2026-11-16T11:20:00.000Z' },
  { id: 'log-07', actor: 'Dr. Ravi Menon', role: 'expert', action: 'Completed review', target: 'CASE-2406', timestamp: '2026-11-17T12:00:00.000Z' },
  { id: 'log-08', actor: 'Ramesh Patil', role: 'farmer', action: 'Created storage batch', target: 'GB-2402', timestamp: '2026-11-08T10:05:00.000Z' },
]
