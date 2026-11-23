import { useEffect, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { ArrowUpRight, Globe2, Menu, X } from 'lucide-react'
import { Link } from 'react-router-dom'
import { useToast } from '../../context/ToastContext'
import { buttonClasses } from '../ui/Button'
import { Brand } from '../common/Brand'

const links = [
  { id: 'platform', label: 'Platform' },
  { id: 'modules', label: 'Modules' },
  { id: 'how-it-works', label: 'How it works' },
  { id: 'roles', label: 'Portals' },
  { id: 'trust', label: 'Responsible AI' },
]

const languages = ['English', 'हिन्दी', 'मराठी']

export function MarketingNav() {
  const [active, setActive] = useState('hero')
  const [mobileOpen, setMobileOpen] = useState(false)
  const [languageOpen, setLanguageOpen] = useState(false)
  const [language, setLanguage] = useState('English')
  const { show } = useToast()

  useEffect(() => {
    const targets = ['hero', ...links.map((link) => link.id)]
      .map((id) => document.getElementById(id))
      .filter((element): element is HTMLElement => Boolean(element))
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries.filter((entry) => entry.isIntersecting)
        if (visible.length > 0) setActive(visible[0].target.id)
      },
      { rootMargin: '-30% 0px -60% 0px', threshold: 0 },
    )
    targets.forEach((target) => observer.observe(target))
    return () => observer.disconnect()
  }, [])

  return (
    <header className="fixed inset-x-0 top-3 z-50 px-3 sm:top-5 sm:px-6">
      <nav className="glass-panel mx-auto flex max-w-7xl items-center justify-between rounded-full px-3 py-2 sm:px-4" aria-label="Main navigation">
        <Brand />

        <div className="hidden items-center gap-1 lg:flex">
          {links.map((link) => (
            <a
              key={link.id}
              href={`#${link.id}`}
              onClick={() => setActive(link.id)}
              className={`relative rounded-full px-3.5 py-2 text-[13px] font-semibold transition-colors ${
                active === link.id ? 'text-forest' : 'text-muted hover:text-ink'
              }`}
            >
              {active === link.id ? (
                <motion.span
                  layoutId="marketing-nav-active"
                  className="absolute inset-0 rounded-full bg-white/85 shadow-[0_6px_18px_-12px_rgba(38,51,40,0.7)]"
                  transition={{ type: 'spring', stiffness: 420, damping: 35 }}
                />
              ) : null}
              <span className="relative z-10">{link.label}</span>
            </a>
          ))}
        </div>

        <div className="flex items-center gap-2">
          <div className="relative hidden sm:block">
            <button
              type="button"
              onClick={() => setLanguageOpen((value) => !value)}
              aria-expanded={languageOpen}
              className="flex items-center gap-1.5 rounded-full px-3 py-2 text-xs font-bold text-forest transition-colors hover:bg-white/70"
            >
              <Globe2 size={15} />
              {language}
            </button>
            <AnimatePresence>
              {languageOpen ? (
                <motion.div
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 6 }}
                  className="glass-panel absolute right-0 mt-2 w-36 rounded-2xl p-1.5"
                >
                  {languages.map((item) => (
                    <button
                      key={item}
                      type="button"
                      onClick={() => {
                        setLanguage(item)
                        setLanguageOpen(false)
                        show('Language preference saved (demo)', `${item} selected for this session.`, 'info')
                      }}
                      className={`w-full rounded-xl px-3 py-2 text-left text-xs font-semibold hover:bg-white ${item === language ? 'bg-soft-sage text-forest' : 'text-ink'}`}
                    >
                      {item}
                    </button>
                  ))}
                </motion.div>
              ) : null}
            </AnimatePresence>
          </div>
          <Link to="/admin/login" className={`${buttonClasses('ghost', 'sm')} hidden md:inline-flex`}>
            Admin & Expert
          </Link>
          <Link to="/login" className={`${buttonClasses('ghost', 'sm')} hidden sm:inline-flex`}>
            Farmer Login
          </Link>
          <Link to="/register" className={`${buttonClasses('primary', 'sm')} rounded-full`}>
            Farmer Register <ArrowUpRight size={14} />
          </Link>
          <button
            type="button"
            aria-label={mobileOpen ? 'Close menu' : 'Open menu'}
            onClick={() => setMobileOpen((value) => !value)}
            className="flex size-10 items-center justify-center rounded-full bg-white/70 text-forest lg:hidden"
          >
            {mobileOpen ? <X size={18} /> : <Menu size={18} />}
          </button>
        </div>
      </nav>

      <AnimatePresence>
        {mobileOpen ? (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="glass-panel mx-auto mt-2 max-w-7xl rounded-3xl p-3 lg:hidden"
          >
            {links.map((link) => (
              <a
                key={link.id}
                href={`#${link.id}`}
                onClick={() => {
                  setActive(link.id)
                  setMobileOpen(false)
                }}
                className="block rounded-2xl px-4 py-3 text-sm font-semibold text-ink hover:bg-white"
              >
                {link.label}
              </a>
            ))}
            <div className="mt-2 flex flex-wrap gap-2 border-t border-line/70 px-2 pt-3">
              <Link to="/login" className={buttonClasses('outline', 'sm', 'flex-1')} onClick={() => setMobileOpen(false)}>
                Farmer Login
              </Link>
              <Link to="/register" className={buttonClasses('primary', 'sm', 'flex-1')} onClick={() => setMobileOpen(false)}>
                Farmer Register
              </Link>
              <Link to="/admin/login" className={buttonClasses('ghost', 'sm', 'w-full')} onClick={() => setMobileOpen(false)}>
                Admin & Crop Expert Login
              </Link>
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </header>
  )
}
