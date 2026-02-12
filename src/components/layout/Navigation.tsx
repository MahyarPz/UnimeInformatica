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
    <header className="sticky top-0 z-40 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container flex h-16 items-center justify-between">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-2 font-bold text-xl">
          {logoUrl ? (
            <img src={logoUrl} alt={appName} className="h-7 w-7 rounded object-contain" />
          ) : (
            <GraduationCap className="h-7 w-7 text-primary" />
          )}
          <span className="hidden sm:inline">{appName}</span>
          <span className="sm:hidden">{appName.split(' ')[0]}</span>
        </Link>

        {/* Desktop Nav */}
        <nav className="hidden md:flex items-center gap-1">
          {navLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={cn(
                'flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium transition-colors hover:bg-accent',
                pathname === link.href || pathname?.startsWith(link.href + '/')
                  ? 'bg-accent text-accent-foreground'
                  : 'text-muted-foreground'
              )}
            >
              <link.icon className="h-4 w-4" />
              {link.label}
            </Link>
          ))}
        </nav>

        {/* Desktop Right */}
        <div className="hidden md:flex items-center gap-2">
          {user && userProfile ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="relative h-9 w-9 rounded-full">
                  <Avatar className="h-9 w-9">
                    <AvatarImage src={userProfile.avatar} alt={userProfile.username} />
                    <AvatarFallback>{getInitials(userProfile.username)}</AvatarFallback>
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
                <DropdownMenuItem onClick={logout}>
                  <LogOut className="mr-2 h-4 w-4" /> {t('nav.logout')}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            <div className="flex items-center gap-2">
              {showLogin && (
                <Button variant="ghost" asChild size="sm">
                  <Link href="/login">{t('nav.login')}</Link>
                </Button>
              )}
              {showSignup && (
                <Button asChild size="sm">
                  <Link href="/signup">{t('nav.signup')}</Link>
                </Button>
              )}
            </div>
          )}
        </div>

        {/* Mobile Menu Button */}
        <button className="md:hidden p-2" onClick={() => setMobileOpen(!mobileOpen)}>
          {mobileOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
        </button>
      </div>

      {/* Mobile Menu */}
      <AnimatePresence>
        {mobileOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="md:hidden border-t bg-background"
          >
            <nav className="container py-4 flex flex-col gap-2">
              {navLinks.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  onClick={() => setMobileOpen(false)}
                  className={cn(
                    'flex items-center gap-3 px-3 py-3 rounded-md text-sm font-medium transition-colors',
                    pathname === link.href ? 'bg-accent text-accent-foreground' : 'text-muted-foreground hover:bg-accent'
                  )}
                >
                  <link.icon className="h-5 w-5" />
                  {link.label}
                </Link>
              ))}
              {user && userProfile ? (
                <>
                  <Link href="/profile" onClick={() => setMobileOpen(false)} className="flex items-center gap-3 px-3 py-3 rounded-md text-sm font-medium text-muted-foreground hover:bg-accent">
                    <User className="h-5 w-5" /> {t('nav.profile')}
                  </Link>
                  <Link href="/dashboard" onClick={() => setMobileOpen(false)} className="flex items-center gap-3 px-3 py-3 rounded-md text-sm font-medium text-muted-foreground hover:bg-accent">
                    <LayoutDashboard className="h-5 w-5" /> {t('nav.dashboard')}
                  </Link>
                  <Link href="/ai" onClick={() => setMobileOpen(false)} className="flex items-center gap-3 px-3 py-3 rounded-md text-sm font-medium text-muted-foreground hover:bg-accent">
                    <Bot className="h-5 w-5" /> AI Assistant
                  </Link>
                  <Link href="/support" onClick={() => setMobileOpen(false)} className="flex items-center gap-3 px-3 py-3 rounded-md text-sm font-medium text-muted-foreground hover:bg-accent">
                    <Heart className="h-5 w-5" /> Support
                  </Link>
                  {(isAdmin || isMod) && (
                    <Link href="/admin" onClick={() => setMobileOpen(false)} className="flex items-center gap-3 px-3 py-3 rounded-md text-sm font-medium text-muted-foreground hover:bg-accent">
                      <Shield className="h-5 w-5" /> {t('nav.admin')}
                    </Link>
                  )}
                  <button onClick={() => { logout(); setMobileOpen(false); }} className="flex items-center gap-3 px-3 py-3 rounded-md text-sm font-medium text-red-600 hover:bg-red-50 w-full text-left">
                    <LogOut className="h-5 w-5" /> {t('nav.logout')}
                  </button>
                </>
              ) : (
                <div className="flex gap-2 px-3 pt-2">
                  {showLogin && (
                    <Button variant="outline" asChild className="flex-1" onClick={() => setMobileOpen(false)}>
                      <Link href="/login">{t('nav.login')}</Link>
                    </Button>
                  )}
                  {showSignup && (
                    <Button asChild className="flex-1" onClick={() => setMobileOpen(false)}>
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
