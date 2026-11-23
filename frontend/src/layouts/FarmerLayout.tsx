import {
  Bell,
  Bot,
  Droplets,
  LayoutDashboard,
  Map,
  MessageSquareText,
  ScanSearch,
  Settings,
  Sprout,
  Store,
  UserRound,
  Warehouse,
} from 'lucide-react'
import { PortalShell } from '../components/navigation/PortalShell'
import type { PortalNavItem } from '../components/navigation/PortalShell'
import { ProtectedRoute } from '../routes/ProtectedRoute'

const navItems: PortalNavItem[] = [
  { label: 'Dashboard', to: '/farmer/dashboard', icon: LayoutDashboard, group: 'Workspace' },
  { label: 'My Farm', to: '/farmer/my-farm', icon: Map, group: 'Workspace' },
  { label: 'My Crops', to: '/farmer/my-crops', icon: Sprout, group: 'Workspace' },
  { label: 'CropDoctor AI', to: '/farmer/crop-doctor', icon: ScanSearch, group: 'AI modules' },
  { label: 'MandiSmart', to: '/farmer/mandi-smart', icon: Store, group: 'AI modules' },
  { label: 'JalSense', to: '/farmer/jal-sense', icon: Droplets, group: 'AI modules' },
  { label: 'GrainGuard', to: '/farmer/grain-guard', icon: Warehouse, group: 'AI modules' },
  { label: 'SchemeSaathi', to: '/farmer/scheme-saathi', icon: MessageSquareText, group: 'AI modules' },
  { label: 'AI Assistant', to: '/farmer/assistant', icon: Bot, group: 'Support' },
  { label: 'Notifications', to: '/farmer/notifications', icon: Bell, group: 'Support' },
  { label: 'Profile', to: '/farmer/profile', icon: UserRound, group: 'Support' },
  { label: 'Settings', to: '/farmer/settings', icon: Settings, group: 'Support' },
]

export function FarmerLayout() {
  return (
    <ProtectedRoute allowedRole="farmer">
      <PortalShell role="farmer" portalName="Farmer Portal" navItems={navItems} />
    </ProtectedRoute>
  )
}
