import {
  ClipboardList,
  FileSearch,
  FileText,
  History,
  LayoutDashboard,
  MessageSquareText,
  Settings,
  UserRound,
} from 'lucide-react'
import { PortalShell } from '../components/navigation/PortalShell'
import type { PortalNavItem } from '../components/navigation/PortalShell'
import { ProtectedRoute } from '../routes/ProtectedRoute'

const navItems: PortalNavItem[] = [
  { label: 'Expert Dashboard', to: '/expert/dashboard', icon: LayoutDashboard, group: 'Workspace' },
  { label: 'Assigned Cases', to: '/expert/cases', icon: ClipboardList, group: 'Case workflow' },
  { label: 'Crop Case Details', to: '/expert/case-details', icon: FileText, group: 'Case workflow' },
  { label: 'AI Analysis Review', to: '/expert/ai-review', icon: FileSearch, group: 'Case workflow' },
  { label: 'Expert Feedback', to: '/expert/feedback', icon: MessageSquareText, group: 'Case workflow' },
  { label: 'Case History', to: '/expert/history', icon: History, group: 'Case workflow' },
  { label: 'Expert Profile', to: '/expert/profile', icon: UserRound, group: 'Account' },
  { label: 'Settings', to: '/expert/settings', icon: Settings, group: 'Account' },
]

export function ExpertLayout() {
  return (
    <ProtectedRoute allowedRole="expert">
      <PortalShell role="expert" portalName="Expert Portal" navItems={navItems} />
    </ProtectedRoute>
  )
}
