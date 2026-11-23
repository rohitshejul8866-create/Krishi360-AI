import { useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import {
  Bell,
  ChevronDown,
  LogOut,
  Menu,
  Search,
  Settings2,
  ShieldCheck,
  UserRound,
  X,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { useApp } from '../../services/store'
import { relativeTime } from '../../services/utils'
import type { Role } from '../../types'
import { PageTransition } from '../animations/PageTransition'
import { Badge } from '../ui/Badge'
import { Brand } from '../common/Brand'
import { Modal } from '../ui/Modal'

export interface PortalNavItem {
  label: string
  to: string
  icon: LucideIcon
  group: string
}

interface PortalShellProps {
  role: Role
  portalName: string
  navItems: PortalNavItem[]
}

const homeFor: Record<Role, string> = {
  farmer: '/farmer/dashboard',
  expert: '/expert/dashboard',
  admin: '/admin/dashboard',
}

export function PortalShell({ role, portalName, navItems }: PortalShellProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [searchOpen, setSearchOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [notificationsOpen, setNotificationsOpen] = useState(false)
  const [profileOpen, setProfileOpen] = useState(false)
  const { user, logout } = useAuth()
  const { notifications, markNotificationRead, markAllNotificationsRead } = useApp()
  const navigate = useNavigate()
  const location = useLocation()

  const visibleNotifications = useMemo(
    () => notifications.filter((item) => item.audience === role || item.audience === 'all').slice(0, 6),
    [notifications, role],
  )
  const unreadCount = visibleNotifications.filter((item) => !item.read).length

  const current =
    [...navItems]
      .sort((a, b) => b.to.length - a.to.length)
      .find((item) => location.pathname.startsWith(item.to) && item.to !== homeFor[role]) ??
    navItems.find((item) => item.to === homeFor[role]) ??
    navItems[0]

  const groups = useMemo(() => {
    const result: { name: string; items: PortalNavItem[] }[] = []
    navItems.forEach((item) => {
      const existing = result.find((group) => group.name === item.group)
      if (existing) existing.items.push(item)
      else result.push({ name: item.group, items: [item] })
    })
    return result
  }, [navItems])

  const searchResults = useMemo(() => {
    const query = searchQuery.trim().toLowerCase()
    return navItems.filter((item) => !query || item.label.toLowerCase().includes(query))
  }, [navItems, searchQuery])

  const go = (to: string) => {
    navigate(to)
    setSidebarOpen(false)
    setSearchOpen(false)
    setNotificationsOpen(false)
    setProfileOpen(false)
  }

  const doLogout = () => {
    logout()
    navigate('/login')
  }

  const profileTo = role === 'admin' ? '/admin/settings' : `/${role}/profile`
  const settingsTo = `/${role}/settings`

  return (
    <div className="min-h-screen">
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-[268px] flex-col p-4 lg:flex">
        <div className="glass-panel flex h-full flex-col overflow-hidden rounded-[28px] p-4">
          <div className="shrink-0 px-2 pb-3 pt-1">
            <Brand />
            <p className="mt-3 rounded-xl bg-soft-sage/70 px-3 py-2 text-[10px] font-extrabold tracking-[0.12em] text-forest uppercase">
              {portalName}
            </p>
          </div>
          <nav className="scroll-thin min-h-0 flex-1 space-y-3.5 overflow-y-auto pr-1 pb-2" aria-label={`${portalName} navigation`}>
            {groups.map((group) => (
              <div key={group.name}>
                <p className="mb-1.5 px-3 text-[10px] font-extrabold tracking-[0.14em] text-muted uppercase">{group.name}</p>
                <div className="space-y-1">
                  {group.items.map((item) => {
                    const Icon = item.icon
                    const active = current.to === item.to
                    return (
                      <NavLink
                        key={item.to}
                        to={item.to}
                        className={`relative flex items-center gap-3 rounded-2xl px-3 py-2 text-[13px] font-semibold transition-colors ${
                          active ? 'text-forest' : 'text-muted hover:bg-white/60 hover:text-ink'
                        }`}
                      >
                        {active ? (
                          <motion.span
                            layoutId={`portal-active-${role}`}
                            className="absolute inset-0 rounded-2xl bg-white shadow-[0_10px_24px_-18px_rgba(38,51,40,0.8)]"
                            transition={{ type: 'spring', stiffness: 420, damping: 36 }}
                          />
                        ) : null}
                        <Icon size={16} className="relative z-10 shrink-0" />
                        <span className="relative z-10 truncate">{item.label}</span>
                      </NavLink>
                    )
                  })}
                </div>
              </div>
            ))}
          </nav>
          <div className="mt-3 shrink-0 rounded-2xl bg-forest p-3.5 text-white">
            <div className="flex items-center gap-2 text-sage">
              <ShieldCheck size={16} />
              <span className="text-[10px] font-extrabold tracking-[0.12em] uppercase">{portalName}</span>
            </div>
            <p className="mt-1.5 text-[11px] leading-relaxed text-white/70">
              Signed in as <span className="font-semibold text-white">{user?.name}</span>.
            </p>
          </div>
        </div>
      </aside>

      <AnimatePresence>
        {sidebarOpen ? (
          <motion.div
            className="fixed inset-0 z-60 lg:hidden"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <button
              type="button"
              aria-label="Close navigation"
              className="absolute inset-0 bg-[#1F2B20]/35 backdrop-blur-sm"
              onClick={() => setSidebarOpen(false)}
            />
            <motion.aside
              initial={{ x: '-100%' }}
              animate={{ x: 0 }}
              exit={{ x: '-100%' }}
              transition={{ type: 'spring', stiffness: 340, damping: 36 }}
              className="glass-panel absolute inset-y-0 left-0 w-[min(20rem,88vw)] overflow-y-auto rounded-r-[28px] p-4"
            >
              <div className="mb-4 flex items-center justify-between px-1">
                <Brand />
                <button type="button" aria-label="Close navigation" onClick={() => setSidebarOpen(false)} className="flex size-9 items-center justify-center rounded-full bg-white text-forest">
                  <X size={17} />
                </button>
              </div>
              <p className="mb-4 rounded-xl bg-soft-sage/70 px-3 py-2 text-[10px] font-extrabold tracking-[0.12em] text-forest uppercase">
                {portalName}
              </p>
              <nav className="space-y-5" aria-label={`${portalName} mobile navigation`}>
                {groups.map((group) => (
                  <div key={group.name}>
                    <p className="mb-2 px-3 text-[10px] font-extrabold tracking-[0.14em] text-muted uppercase">{group.name}</p>
                    <div className="space-y-1">
                      {group.items.map((item) => {
                        const Icon = item.icon
                        return (
                          <NavLink
                            key={item.to}
                            to={item.to}
                            onClick={() => setSidebarOpen(false)}
                            className={`flex items-center gap-3 rounded-2xl px-3 py-2.5 text-[13px] font-semibold ${
                              current.to === item.to ? 'bg-white text-forest' : 'text-muted'
                            }`}
                          >
                            <Icon size={16} />
                            {item.label}
                          </NavLink>
                        )
                      })}
                    </div>
                  </div>
                ))}
              </nav>
            </motion.aside>
          </motion.div>
        ) : null}
      </AnimatePresence>

      <div className="lg:pl-[268px]">
        <header className="sticky top-2 z-30 px-3 pt-3 sm:px-5 sm:pt-5">
          <div className="glass-panel mx-auto flex max-w-[1500px] items-center gap-2 rounded-[22px] px-3 py-2 sm:px-4">
            <button
              type="button"
              onClick={() => setSidebarOpen(true)}
              aria-label="Open navigation"
              className="flex size-10 items-center justify-center rounded-2xl bg-white/70 text-forest lg:hidden"
            >
              <Menu size={18} />
            </button>
            <div className="min-w-0 flex-1">
              <p className="truncate text-[10px] font-extrabold tracking-[0.12em] text-muted uppercase">{portalName}</p>
              <p className="truncate text-sm font-extrabold text-ink">{current.label}</p>
            </div>
            <button
              type="button"
              onClick={() => setSearchOpen(true)}
              className="hidden items-center gap-2 rounded-2xl border border-line bg-white/60 px-3 py-2 text-xs font-semibold text-muted transition-colors hover:border-sage hover:text-forest sm:flex"
            >
              <Search size={15} /> Search portal
            </button>
            <button
              type="button"
              onClick={() => setSearchOpen(true)}
              aria-label="Search portal"
              className="flex size-10 items-center justify-center rounded-2xl bg-white/70 text-forest sm:hidden"
            >
              <Search size={16} />
            </button>
            <div className="relative">
              <button
                type="button"
                aria-label={`Notifications, ${unreadCount} unread`}
                onClick={() => {
                  setNotificationsOpen((value) => !value)
                  setProfileOpen(false)
                }}
                className="relative flex size-10 items-center justify-center rounded-2xl bg-white/70 text-forest transition-colors hover:bg-white"
              >
                <Bell size={17} />
                {unreadCount > 0 ? (
                  <span className="absolute -top-1 -right-1 flex min-w-5 items-center justify-center rounded-full bg-alert px-1 text-[9px] font-extrabold text-white">
                    {unreadCount}
                  </span>
                ) : null}
              </button>
              <AnimatePresence>
                {notificationsOpen ? (
                  <motion.div
                    initial={{ opacity: 0, y: 8, scale: 0.98 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 6, scale: 0.98 }}
                    className="glass-panel absolute right-0 z-50 mt-2 w-[min(22rem,calc(100vw-2rem))] rounded-2xl p-2"
                  >
                    <div className="flex items-center justify-between px-3 py-2">
                      <p className="text-sm font-extrabold text-ink">Notifications</p>
                      <button
                        type="button"
                        onClick={() => markAllNotificationsRead(role)}
                        className="text-[11px] font-bold text-forest hover:underline"
                      >
                        Mark all read
                      </button>
                    </div>
                    <div className="scroll-thin max-h-80 space-y-1 overflow-y-auto">
                      {visibleNotifications.length === 0 ? (
                        <p className="px-3 py-6 text-center text-xs text-muted">You are all caught up.</p>
                      ) : (
                        visibleNotifications.map((item) => (
                          <button
                            key={item.id}
                            type="button"
                            onClick={() => markNotificationRead(item.id)}
                            className={`w-full rounded-xl px-3 py-2.5 text-left transition-colors hover:bg-white ${
                              item.read ? 'opacity-65' : 'bg-soft-sage/50'
                            }`}
                          >
                            <div className="flex items-start justify-between gap-2">
                              <p className="text-xs font-bold text-ink">{item.title}</p>
                              <span className="shrink-0 text-[10px] text-muted">{relativeTime(item.createdAt)}</span>
                            </div>
                            <p className="mt-1 text-[11px] leading-relaxed text-muted">{item.body}</p>
                          </button>
                        ))
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={() => go(role === 'farmer' ? '/farmer/notifications' : homeFor[role])}
                      className="mt-2 w-full rounded-xl bg-soft-sage px-3 py-2 text-xs font-bold text-forest hover:bg-sage/40"
                    >
                      View all
                    </button>
                  </motion.div>
                ) : null}
              </AnimatePresence>
            </div>
            <div className="relative">
              <button
                type="button"
                onClick={() => {
                  setProfileOpen((value) => !value)
                  setNotificationsOpen(false)
                }}
                aria-expanded={profileOpen}
                className="flex items-center gap-2 rounded-2xl bg-forest py-1.5 pr-2.5 pl-1.5 text-white"
              >
                <span className="flex size-7 items-center justify-center rounded-xl bg-white/15 text-[10px] font-extrabold">
                  {user?.avatar ?? 'U'}
                </span>
                <span className="hidden text-xs font-bold sm:block">{user?.name.split(' ')[0]}</span>
                <ChevronDown size={13} />
              </button>
              <AnimatePresence>
                {profileOpen ? (
                  <motion.div
                    initial={{ opacity: 0, y: 8, scale: 0.98 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 6, scale: 0.98 }}
                    className="glass-panel absolute right-0 z-50 mt-2 w-56 rounded-2xl p-2"
                  >
                    <div className="border-b border-line/70 px-3 py-2">
                      <p className="text-xs font-extrabold text-ink">{user?.name}</p>
                      <p className="truncate text-[10px] text-muted">{user?.email}</p>
                      <Badge tone="sage" className="mt-2 capitalize">{role}</Badge>
                    </div>
                    <button type="button" onClick={() => go(profileTo)} className="mt-1 flex w-full items-center gap-2 rounded-xl px-3 py-2 text-xs font-semibold text-ink hover:bg-white">
                      <UserRound size={14} /> {role === 'admin' ? 'Platform settings' : 'My profile'}
                    </button>
                    {role !== 'admin' ? (
                      <button type="button" onClick={() => go(settingsTo)} className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-xs font-semibold text-ink hover:bg-white">
                        <Settings2 size={14} /> Settings
                      </button>
                    ) : null}
                    <button type="button" onClick={doLogout} className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-xs font-semibold text-alert hover:bg-[#FBE7E3]">
                      <LogOut size={14} /> Sign out
                    </button>
                  </motion.div>
                ) : null}
              </AnimatePresence>
            </div>
          </div>
        </header>

        <main className="mx-auto max-w-[1500px] px-3 pt-6 pb-10 sm:px-5 sm:pt-8 sm:pb-14">
          <PageTransition>
            <Outlet />
          </PageTransition>
        </main>
      </div>

      <Modal open={searchOpen} onClose={() => setSearchOpen(false)} title="Search portal" description="Jump to any page in this workspace." size="md">
        <input
          autoFocus
          value={searchQuery}
          onChange={(event) => setSearchQuery(event.target.value)}
          placeholder="Try 'mandi', 'cases', 'schemes'…"
          className="w-full rounded-2xl inset-field px-4 py-3 text-sm text-ink placeholder:text-muted focus:border-sage focus:outline-none"
        />
        <div className="mt-4 space-y-1">
          {searchResults.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted">No matching pages.</p>
          ) : (
            searchResults.map((item) => {
              const Icon = item.icon
              return (
                <button
                  key={item.to}
                  type="button"
                  onClick={() => go(item.to)}
                  className="flex w-full items-center gap-3 rounded-2xl px-3 py-3 text-left transition-colors hover:bg-soft-sage"
                >
                  <span className="flex size-9 items-center justify-center rounded-xl bg-white text-forest">
                    <Icon size={16} />
                  </span>
                  <span>
                    <span className="block text-sm font-bold text-ink">{item.label}</span>
                    <span className="block text-[11px] text-muted">{item.group}</span>
                  </span>
                </button>
              )
            })
          )}
        </div>
      </Modal>
    </div>
  )
}

export function PortalCreditLink({ children, to }: { children: ReactNode; to: string }) {
  return <Link to={to}>{children}</Link>
}
