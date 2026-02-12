'use client';

import React, { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/contexts/AuthContext';
import { useSiteSettingsContext } from '@/contexts/SiteSettingsContext';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';
import {
  LayoutDashboard,
  BookOpen,
  Layers,
  FileText,
  MessageSquare,
  ClipboardCheck,
  FlaskConical,
  Sliders,
  Users,
  Settings,
  CreditCard,
  BarChart3,
  ScrollText,
  Flag,
  Megaphone,
  Menu,
  X,
  GraduationCap,
  ChevronLeft,
  Loader2,
  Shield,
  Globe,
} from 'lucide-react';
import { t } from '@/lib/i18n';

const adminModules = [
  { href: '/admin', label: t('admin.dashboard'), icon: LayoutDashboard, exact: true },
  { href: '/admin/courses', label: t('admin.courses'), icon: BookOpen },
  { href: '/admin/topics', label: t('admin.topics'), icon: Layers },
  { href: '/admin/notes', label: t('admin.notes'), icon: FileText },
  { href: '/admin/questions', label: t('admin.questions'), icon: MessageSquare },
  { href: '/admin/review-queue', label: t('admin.reviewQueue'), icon: ClipboardCheck },
  { href: '/admin/labs', label: t('admin.labs'), icon: FlaskConical },
  { href: '/admin/practice-settings', label: t('admin.practiceSettings'), icon: Sliders },
  { type: 'separator' },
  { href: '/admin/users', label: t('admin.users'), icon: Users },
  { href: '/admin/announcements', label: t('admin.announcements'), icon: Megaphone },
  { href: '/admin/feature-flags', label: t('admin.featureFlags'), icon: Flag },
  { href: '/admin/audit-log', label: t('admin.auditLog'), icon: ScrollText },
  { type: 'separator' },
  { href: '/admin/settings', label: t('admin.settings'), icon: Settings },
  { href: '/admin/site-content', label: 'Site Content', icon: Globe },
  { href: '/admin/analytics', label: t('admin.analytics'), icon: BarChart3 },
  { href: '/admin/monetization', label: t('admin.monetization'), icon: CreditCard },
] as const;

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const { user, userProfile, claims, loading } = useAuth();
  const { appName, logoUrl } = useSiteSettingsContext();
  const router = useRouter();
  const pathname = usePathname();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const hasAdminAccess = claims?.role === 'admin' || claims?.role === 'moderator' ||
    userProfile?.role === 'admin' || userProfile?.role === 'moderator';

  useEffect(() => {
    if (!loading && (!user || !hasAdminAccess)) {
      router.push('/');
    }
  }, [user, hasAdminAccess, loading, router]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user || !hasAdminAccess) {
    return null;
  }

  return (
    <div className="min-h-screen flex bg-muted/30">
      {/* Desktop Sidebar */}
      <aside className="hidden lg:flex w-64 flex-col border-r bg-background">
        <div className="p-4 border-b">
          <Link href="/admin" className="flex items-center gap-2 font-bold text-lg">
            <Shield className="h-6 w-6 text-primary" />
            Admin Panel
          </Link>
        </div>
        <ScrollArea className="flex-1 py-2">
          <nav className="px-2 space-y-0.5">
            {adminModules.map((item, i) => {
              if ('type' in item && item.type === 'separator') {
                return <Separator key={i} className="my-2" />;
              }
              const mod = item as { href: string; label: string; icon: any; exact?: boolean };
              const isActive = mod.exact
                ? pathname === mod.href
                : pathname?.startsWith(mod.href) && mod.href !== '/admin';
              return (
                <Link
                  key={mod.href}
                  href={mod.href}
                  className={cn(
                    'flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors',
                    isActive
                      ? 'bg-primary text-primary-foreground'
                      : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
                  )}
                >
                  <mod.icon className="h-4 w-4" />
                  {mod.label}
                </Link>
              );
            })}
          </nav>
        </ScrollArea>
        <div className="p-3 border-t">
          <Button variant="ghost" className="w-full justify-start text-sm" asChild>
            <Link href="/">
              <ChevronLeft className="h-4 w-4 mr-2" /> Back to Site
            </Link>
          </Button>
        </div>
      </aside>

      {/* Mobile Sidebar */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="fixed inset-0 bg-black/50" onClick={() => setSidebarOpen(false)} />
          <aside className="fixed left-0 top-0 bottom-0 w-72 bg-background border-r overflow-y-auto">
            <div className="p-4 border-b flex items-center justify-between">
              <span className="font-bold text-lg flex items-center gap-2">
                <Shield className="h-6 w-6 text-primary" /> Admin
              </span>
              <button onClick={() => setSidebarOpen(false)}>
                <X className="h-5 w-5" />
              </button>
            </div>
            <nav className="px-2 py-2 space-y-0.5">
              {adminModules.map((item, i) => {
                if ('type' in item && item.type === 'separator') {
                  return <Separator key={i} className="my-2" />;
                }
                const mod = item as { href: string; label: string; icon: any; exact?: boolean };
                const isActive = mod.exact ? pathname === mod.href : pathname?.startsWith(mod.href) && mod.href !== '/admin';
                return (
                  <Link
                    key={mod.href}
                    href={mod.href}
                    onClick={() => setSidebarOpen(false)}
                    className={cn(
                      'flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-medium transition-colors',
                      isActive ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-accent'
                    )}
                  >
                    <mod.icon className="h-4 w-4" />
                    {mod.label}
                  </Link>
                );
              })}
            </nav>
            <div className="p-3 border-t">
              <Button variant="ghost" className="w-full justify-start text-sm" asChild>
                <Link href="/"><ChevronLeft className="h-4 w-4 mr-2" /> Back to Site</Link>
              </Button>
            </div>
          </aside>
        </div>
      )}

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top Bar */}
        <header className="h-14 border-b bg-background flex items-center px-4 lg:px-6 gap-4">
          <button className="lg:hidden" onClick={() => setSidebarOpen(true)}>
            <Menu className="h-5 w-5" />
          </button>
          <div className="flex-1" />
          <Link href="/" className="text-sm text-muted-foreground hover:text-foreground flex items-center gap-1">
            {logoUrl ? (
              <img src={logoUrl} alt={appName} className="h-4 w-4 rounded object-contain" />
            ) : (
              <GraduationCap className="h-4 w-4" />
            )}
            {appName}
          </Link>
        </header>

        {/* Page Content */}
        <main className="flex-1 p-4 lg:p-6 overflow-auto">
          {children}
        </main>
      </div>
    </div>
  );
}
