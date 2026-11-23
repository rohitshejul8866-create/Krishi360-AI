import {
  Activity,
  Database,
  FileBarChart,
  LayoutDashboard,
  MessageSquareText,
  ScrollText,
  Server,
  SlidersHorizontal,
  Users,
  Warehouse,
} from 'lucide-react'
import { PortalShell } from '../components/navigation/PortalShell'
import type { PortalNavItem } from '../components/navigation/PortalShell'
import { ProtectedRoute } from '../routes/ProtectedRoute'

const navItems: PortalNavItem[] = [
  { label: 'Admin Dashboard', to: '/admin/dashboard', icon: LayoutDashboard, group: 'Overview' },
  { label: 'Backend & AWS DB', to: '/admin/backend', icon: Server, group: 'Overview' },
  { label: 'User Management', to: '/admin/users', icon: Users, group: 'People' },
  { label: 'Farmer Management', to: '/admin/farmers', icon: Users, group: 'People' },
  { label: 'Expert Management', to: '/admin/experts', icon: Users, group: 'People' },
  { label: 'Crop Case Management', to: '/admin/cases', icon: Activity, group: 'Operations' },
  { label: 'Mandi Data', to: '/admin/mandi', icon: Database, group: 'Operations' },
  { label: 'Storage Monitoring', to: '/admin/storage', icon: Warehouse, group: 'Operations' },
  { label: 'Scheme Management', to: '/admin/schemes', icon: MessageSquareText, group: 'Operations' },
  { label: 'Reports & Analytics', to: '/admin/analytics', icon: FileBarChart, group: 'Insights' },
  { label: 'Audit Logs', to: '/admin/audit-logs', icon: ScrollText, group: 'Insights' },
  { label: 'Platform Settings', to: '/admin/settings', icon: SlidersHorizontal, group: 'Insights' },
]

export function AdminLayout() {
  return (
    <ProtectedRoute allowedRole="admin">
      <PortalShell role="admin" portalName="Admin Portal" navItems={navItems} />
    </ProtectedRoute>
  )
}
