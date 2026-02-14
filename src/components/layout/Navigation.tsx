'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import {
  BookOpen,
  Bot,
  GraduationCap,
  Heart,
  LayoutDashboard,
  LogIn,
  LogOut,
  Menu,
  Shield,
  User,
  X,
  Zap,
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useSiteSettingsContext } from '@/contexts/SiteSettingsContext';
import { useSiteContentContext } from '@/contexts/SiteContentContext';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { ThemeToggle } from '@/components/layout/ThemeToggle';
import { cn, getInitials } from '@/lib/utils';
import { t } from '@/lib/i18n';

// Icon map for nav links from CMS
const NAV_ICON_MAP: Record<string, React.ElementType> = {
  '/courses': BookOpen,
  '/practice': Zap,
  '/ai': Bot,
  '/support': Heart,
};

export function Navigation() {
  const { user, userProfile, claims, logout } = useAuth();
  const { appName, logoUrl } = useSiteSettingsContext();
  const { nav } = useSiteContentContext();
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  const isAdmin = claims?.role === 'admin' || userProfile?.role === 'admin';
  const isMod = claims?.role === 'moderator' || userProfile?.role === 'moderator';

  // Build nav links from CMS, fall back to hardcoded
  const navLinks = React.useMemo(() => {
    if (nav && nav.links && nav.links.length > 0) {
      return nav.links
        .filter((l) => l.enabled)
        .sort((a, b) => a.order - b.order)
        .map((l) => ({
          href: l.href,
          label: l.label?.en || '',
          icon: NAV_ICON_MAP[l.href] || BookOpen,
        }));
    }
    // Fallback
    return [
      { href: '/courses', label: t('nav.courses'), icon: BookOpen },
      { href: '/practice', label: t('nav.practice'), icon: Zap },
    ];
  }, [nav]);

  const showLogin = nav?.showLogin ?? true;
  const showSignup = nav?.showSignup ?? true;

  // Don't show nav on admin pages (admin has its own layout)
  if (pathname?.startsWith('/admin')) return null;

  return (
    <header className="sticky top-0 z-40 border-b border-border/50 bg-background/80 backdrop-blur-xl supports-[backdrop-filter]:bg-background/60">
      <div className="container flex h-16 items-center justify-between">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-2.5 font-bold text-lg group">
          {logoUrl ? (
            <img src={logoUrl} alt={appName || 'Unime Informatica'} className="h-8 sm:h-9 md:h-10 w-auto rounded-lg object-contain transition-transform group-hover:scale-110" />
          ) : (
            <div className="flex items-center justify-center h-8 sm:h-9 md:h-10 w-8 sm:w-9 md:w-10 rounded-lg bg-primary text-primary-foreground transition-transform group-hover:scale-110">
              <GraduationCap className="h-5 w-5 sm:h-6 sm:w-6" />
            </div>
          )}
          <span className="hidden sm:inline tracking-tight">{appName}</span>
          <span className="sm:hidden tracking-tight">{appName.split(' ')[0]}</span>
        </Link>

        {/* Desktop Nav — centered */}
        <nav className="hidden md:flex items-center gap-1 rounded-full border border-border/50 bg-muted/50 px-1.5 py-1">
          {navLinks.map((link) => {
            const isActive = pathname === link.href || pathname?.startsWith(link.href + '/');
            return (
              <Link
                key={link.href}
                href={link.href}
                className={cn(
                  'flex items-center gap-2 px-3.5 py-1.5 rounded-full text-sm font-medium transition-all duration-200',
                  isActive
                    ? 'bg-background text-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground'
                )}
              >
                <link.icon className="h-4 w-4" />
                {link.label}
              </Link>
            );
          })}
        </nav>

        {/* Desktop Right */}
        <div className="hidden md:flex items-center gap-2">
          <ThemeToggle />
          {user && userProfile ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="relative h-9 w-9 rounded-full ring-1 ring-border/50 hover:ring-primary/30 transition-all">
                  <Avatar className="h-9 w-9">
                    <AvatarImage src={userProfile.avatar} alt={userProfile.username} />
                    <AvatarFallback className="bg-primary/10 text-primary text-xs font-semibold">{getInitials(userProfile.username)}</AvatarFallback>
                  </Avatar>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="w-56" align="end" forceMount>
                <DropdownMenuLabel className="font-normal">
                  <div className="flex flex-col space-y-1">
                    <p className="text-sm font-medium">@{userProfile.username}</p>
                    <p className="text-xs text-muted-foreground">{userProfile.email}</p>
                  </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild>
                  <Link href="/profile">
                    <User className="mr-2 h-4 w-4" /> {t('nav.profile')}
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link href="/dashboard">
                    <LayoutDashboard className="mr-2 h-4 w-4" /> {t('nav.dashboard')}
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link href="/ai">
                    <Bot className="mr-2 h-4 w-4" /> AI Assistant
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link href="/support">
                    <Heart className="mr-2 h-4 w-4" /> Support
                  </Link>
                </DropdownMenuItem>
                {(isAdmin || isMod) && (
                  <DropdownMenuItem asChild>
                    <Link href="/admin">
                      <Shield className="mr-2 h-4 w-4" /> {t('nav.admin')}
                    </Link>
                  </DropdownMenuItem>
                )}
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={logout} className="text-destructive focus:text-destructive">
                  <LogOut className="mr-2 h-4 w-4" /> {t('nav.logout')}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            <div className="flex items-center gap-2">
              {showLogin && (
                <Button variant="ghost" asChild size="sm" className="rounded-full">
                  <Link href="/login">{t('nav.login')}</Link>
                </Button>
              )}
              {showSignup && (
                <Button asChild size="sm" className="rounded-full shadow-sm">
                  <Link href="/signup">{t('nav.signup')}</Link>
                </Button>
              )}
            </div>
          )}
        </div>

        {/* Mobile Right: theme toggle + menu button */}
        <div className="md:hidden flex items-center gap-1">
          <ThemeToggle />
          <button
            className="p-2 rounded-lg hover:bg-accent transition-colors"
            onClick={() => setMobileOpen(!mobileOpen)}
            aria-label="Toggle menu"
          >
            {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </div>

      {/* Mobile Menu */}
      <AnimatePresence>
        {mobileOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.2, ease: 'easeInOut' }}
            className="md:hidden border-t border-border/50 bg-background/95 backdrop-blur-xl"
          >
            <nav className="container py-4 flex flex-col gap-1">
              {navLinks.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  onClick={() => setMobileOpen(false)}
                  className={cn(
                    'flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-colors',
                    pathname === link.href ? 'bg-primary/10 text-primary' : 'text-muted-foreground hover:bg-accent hover:text-foreground'
                  )}
                >
                  <link.icon className="h-5 w-5" />
                  {link.label}
                </Link>
              ))}
              <div className="h-px bg-border/50 my-2" />
              {user && userProfile ? (
                <>
                  <Link href="/profile" onClick={() => setMobileOpen(false)} className="flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium text-muted-foreground hover:bg-accent hover:text-foreground">
                    <User className="h-5 w-5" /> {t('nav.profile')}
                  </Link>
                  <Link href="/dashboard" onClick={() => setMobileOpen(false)} className="flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium text-muted-foreground hover:bg-accent hover:text-foreground">
                    <LayoutDashboard className="h-5 w-5" /> {t('nav.dashboard')}
                  </Link>
                  <Link href="/ai" onClick={() => setMobileOpen(false)} className="flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium text-muted-foreground hover:bg-accent hover:text-foreground">
                    <Bot className="h-5 w-5" /> AI Assistant
                  </Link>
                  <Link href="/support" onClick={() => setMobileOpen(false)} className="flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium text-muted-foreground hover:bg-accent hover:text-foreground">
                    <Heart className="h-5 w-5" /> Support
                  </Link>
                  {(isAdmin || isMod) && (
                    <Link href="/admin" onClick={() => setMobileOpen(false)} className="flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium text-muted-foreground hover:bg-accent hover:text-foreground">
                      <Shield className="h-5 w-5" /> {t('nav.admin')}
                    </Link>
                  )}
                  <div className="h-px bg-border/50 my-2" />
                  <button onClick={() => { logout(); setMobileOpen(false); }} className="flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium text-destructive hover:bg-destructive/10 w-full text-left">
                    <LogOut className="h-5 w-5" /> {t('nav.logout')}
                  </button>
                </>
              ) : (
                <div className="flex gap-2 px-3 pt-2">
                  {showLogin && (
                    <Button variant="outline" asChild className="flex-1 rounded-full" onClick={() => setMobileOpen(false)}>
                      <Link href="/login">{t('nav.login')}</Link>
                    </Button>
                  )}
                  {showSignup && (
                    <Button asChild className="flex-1 rounded-full" onClick={() => setMobileOpen(false)}>
                      <Link href="/signup">{t('nav.signup')}</Link>
                    </Button>
                  )}
                </div>
              )}
            </nav>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  );
}
