'use client';

import React, { useState, useEffect } from 'react';
import {
  collection, query, orderBy, onSnapshot, updateDoc, doc,
  serverTimestamp, where, getDocs, limit, startAfter,
} from 'firebase/firestore';
import { db } from '@/lib/firebase/config';
import { UserProfile, UserRole, ModeratorPermissions, DEFAULT_MODERATOR_PERMISSIONS, PermissionTemplate } from '@/lib/types';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogClose } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { useToast } from '@/components/ui/toast';
import { logAudit } from '@/lib/firebase/activity';
import {
  Users, Search, Shield, ShieldCheck, ShieldAlert, UserCheck, Ban,
  Crown, Edit, Loader2, ChevronDown, ChevronUp, Settings, Zap,
} from 'lucide-react';

const PERMISSION_TEMPLATES: PermissionTemplate[] = [
  {
    name: 'Content Manager',
    description: 'Can manage courses, topics, notes, and questions',
    permissions: {
      ...DEFAULT_MODERATOR_PERMISSIONS,
      canManageCourses: true,
      canManageTopics: true,
      canManageNotes: true,
      canManageQuestions: true,
      canReviewQuestions: true,
    },
  },
  {
    name: 'Reviewer',
    description: 'Can only review submitted questions',
    permissions: {
      ...DEFAULT_MODERATOR_PERMISSIONS,
      canReviewQuestions: true,
    },
  },
  {
    name: 'Full Moderator',
    description: 'All permissions except user management',
    permissions: {
      ...DEFAULT_MODERATOR_PERMISSIONS,
      canManageCourses: true,
      canManageTopics: true,
      canManageNotes: true,
      canManageQuestions: true,
      canReviewQuestions: true,
      canManageLabs: true,
      canManageAnnouncements: true,
      canViewUsers: true,
      canViewAnalytics: true,
      canViewAuditLog: true,
      canViewActivityFeed: true,
      canManageUsers: false,
      canManageSettings: false,
    },
  },
];

export default function AdminUsersPage() {
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState<string>('all');
  const [loading, setLoading] = useState(true);
  const { user, userProfile, claims } = useAuth();
  const { addToast } = useToast();
  const isAdmin = claims?.role === 'admin';

  useEffect(() => {
    const q = query(collection(db, 'users'), orderBy('createdAt', 'desc'));
    const unsub = onSnapshot(q, (snap) => {
      setUsers(snap.docs.map((d) => ({ uid: d.id, ...d.data() } as UserProfile)));
      setLoading(false);
    }, (err) => { console.error('users query failed:', err); setLoading(false); });
    return () => unsub();
  }, []);

  const filtered = users.filter((u) => {
    if (roleFilter !== 'all' && u.role !== roleFilter) return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      return (
        u.username.toLowerCase().includes(q) ||
        (u.firstName || '').toLowerCase().includes(q) ||
        (u.lastName || '').toLowerCase().includes(q) ||
        u.email.toLowerCase().includes(q)
      );
    }
    return true;
  });

  const changeRole = async (targetUser: UserProfile, newRole: UserRole) => {
    if (!isAdmin) {
      addToast({ title: 'Only admins can change roles', variant: 'destructive' });
      return;
    }
    if (targetUser.uid === user?.uid) {
      addToast({ title: 'Cannot change your own role', variant: 'destructive' });
      return;
    }
    try {
      await updateDoc(doc(db, 'users', targetUser.uid), {
        role: newRole,
        updatedAt: serverTimestamp(),
        ...(newRole === 'moderator' ? { permissions: DEFAULT_MODERATOR_PERMISSIONS } : {}),
      });

      await logAudit({
        action: 'role_changed',
        category: 'admin',
        actorUid: user!.uid,
        actorUsername: userProfile!.username,
        actorRole: userProfile!.role,
        targetId: targetUser.uid,
        details: { oldRole: targetUser.role, newRole, username: targetUser.username },
      });

      addToast({ title: `${targetUser.username} is now ${newRole}`, variant: 'success' });
    } catch {
      addToast({ title: 'Failed to change role', variant: 'destructive' });
    }
  };

  const updatePermissions = async (targetUser: UserProfile, permissions: ModeratorPermissions) => {
    try {
      await updateDoc(doc(db, 'users', targetUser.uid), {
        permissions,
        updatedAt: serverTimestamp(),
      });
      addToast({ title: 'Permissions updated', variant: 'success' });
    } catch {
      addToast({ title: 'Failed to update permissions', variant: 'destructive' });
    }
  };

  const applyTemplate = async (targetUser: UserProfile, template: PermissionTemplate) => {
    await updatePermissions(targetUser, template.permissions);
  };

  const toggleBan = async (targetUser: UserProfile) => {
    const newBanned = !targetUser.banned;
    try {
      await updateDoc(doc(db, 'users', targetUser.uid), {
        banned: newBanned,
        updatedAt: serverTimestamp(),
      });
      await logAudit({
        action: newBanned ? 'user_banned' : 'user_unbanned',
        category: 'admin',
        actorUid: user!.uid,
        actorUsername: userProfile!.username,
        actorRole: userProfile!.role,
        targetId: targetUser.uid,
        details: { username: targetUser.username },
      });
      addToast({ title: newBanned ? 'User banned' : 'User unbanned', variant: 'success' });
    } catch {
      addToast({ title: 'Action failed', variant: 'destructive' });
    }
  };

  const roleIcons: Record<string, any> = {
    admin: Crown,
    moderator: ShieldCheck,
    student: UserCheck,
  };

  const roleColors: Record<string, string> = {
    admin: 'bg-red-100 text-red-700',
    moderator: 'bg-blue-100 text-blue-700',
    student: 'bg-gray-100 text-gray-700',
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Users &amp; Roles</h1>
        <p className="text-muted-foreground">{users.length} registered users</p>
      </div>

      {/* Promote by username */}
      {isAdmin && <PromoteByUsernameCard addToast={addToast} user={user} userProfile={userProfile} />}

      <Card>
        <CardContent className="pt-4 pb-3">
          <div className="flex flex-wrap gap-3 items-end">
            <div className="flex-1 min-w-[200px]">
              <Label className="text-xs">Search</Label>
              <div className="relative">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder="Username, name, or email..." className="pl-9" />
              </div>
            </div>
            <div>
              <Label className="text-xs">Role</Label>
              <Select value={roleFilter} onValueChange={setRoleFilter}>
                <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Roles</SelectItem>
                  <SelectItem value="admin">Admin</SelectItem>
                  <SelectItem value="moderator">Moderator</SelectItem>
                  <SelectItem value="user">User</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="space-y-2">
        <p className="text-sm text-muted-foreground px-1">Showing {filtered.length} users</p>
        {loading ? (
          <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin" /></div>
        ) : (
          filtered.map((u) => (
            <UserCard
              key={u.uid}
              targetUser={u}
              isAdmin={isAdmin}
              currentUid={user?.uid || ''}
              roleColors={roleColors}
              onChangeRole={(role) => changeRole(u, role)}
              onToggleBan={() => toggleBan(u)}
              onUpdatePermissions={(p) => updatePermissions(u, p)}
              onApplyTemplate={(t) => applyTemplate(u, t)}
            />
          ))
        )}
      </div>
    </div>
  );
}

function PromoteByUsernameCard({ addToast, user, userProfile }: any) {
  const [username, setUsername] = useState('');
  const [role, setRole] = useState<UserRole>('moderator');
  const [loading, setLoading] = useState(false);

  const handlePromote = async () => {
    if (!username) return;
    setLoading(true);
    try {
      const q = query(collection(db, 'users'), where('username_lower', '==', username.replace('@', '').toLowerCase()));
      const snap = await getDocs(q);
      if (snap.empty) {
        addToast({ title: `User @${username} not found`, variant: 'destructive' });
        return;
      }
      const targetDoc = snap.docs[0];
      await updateDoc(doc(db, 'users', targetDoc.id), {
        role,
        updatedAt: serverTimestamp(),
        ...(role === 'moderator' ? { permissions: DEFAULT_MODERATOR_PERMISSIONS } : {}),
      });
      await logAudit({
        action: 'role_changed',
        category: 'admin',
        actorUid: user.uid,
        actorUsername: userProfile.username,
        actorRole: userProfile.role,
        targetId: targetDoc.id,
        details: { username, newRole: role },
      });
      addToast({ title: `@${username} promoted to ${role}`, variant: 'success' });
      setUsername('');
    } catch {
      addToast({ title: 'Promotion failed', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-lg">Quick Promote</CardTitle>
        <CardDescription>Promote a user by their username</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex gap-3 items-end">
          <div className="flex-1">
            <Label className="text-xs">Username</Label>
            <Input value={username} onChange={(e) => setUsername(e.target.value)} placeholder="@username" />
          </div>
          <div>
            <Label className="text-xs">Role</Label>
            <Select value={role} onValueChange={(v) => setRole(v as UserRole)}>
              <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="moderator">Moderator</SelectItem>
                <SelectItem value="admin">Admin</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Button onClick={handlePromote} disabled={!username || loading}>
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Promote'}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function UserCard({
  targetUser,
  isAdmin,
  currentUid,
  roleColors,
  onChangeRole,
  onToggleBan,
  onUpdatePermissions,
  onApplyTemplate,
}: {
  targetUser: UserProfile;
  isAdmin: boolean;
  currentUid: string;
  roleColors: Record<string, string>;
  onChangeRole: (role: UserRole) => void;
  onToggleBan: () => void;
  onUpdatePermissions: (p: ModeratorPermissions) => void;
  onApplyTemplate: (t: PermissionTemplate) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [permissions, setPermissions] = useState<ModeratorPermissions>(
    targetUser.permissions || DEFAULT_MODERATOR_PERMISSIONS
  );

  const isSelf = targetUser.uid === currentUid;

  const permissionKeys: { key: keyof ModeratorPermissions; label: string }[] = [
    { key: 'canManageCourses', label: 'Manage Courses' },
    { key: 'canManageTopics', label: 'Manage Topics' },
    { key: 'canManageNotes', label: 'Manage Notes' },
    { key: 'canManageQuestions', label: 'Manage Questions' },
    { key: 'canReviewQuestions', label: 'Review Questions' },
    { key: 'canManageLabs', label: 'Manage Labs' },
    { key: 'canManageAnnouncements', label: 'Manage Announcements' },
    { key: 'canViewAnalytics', label: 'View Analytics' },
    { key: 'canManageUsers', label: 'Manage Users' },
    { key: 'canManageSettings', label: 'Manage Settings' },
  ];

  return (
    <Card className={targetUser.banned ? 'border-red-200 bg-red-50/30' : ''}>
      <CardContent className="py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-full bg-primary/10 flex items-center justify-center font-bold text-primary">
              {targetUser.username.charAt(0).toUpperCase()}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-medium">{targetUser.firstName ? `${targetUser.firstName} ${targetUser.lastName || ''}`.trim() : targetUser.username}</span>
                <span className="text-sm text-muted-foreground">@{targetUser.username}</span>
                {targetUser.banned && <Badge variant="destructive">Banned</Badge>}
                {targetUser.plan === 'pro' && <Badge className="bg-amber-100 text-amber-700 text-xs"><Crown className="h-3 w-3 mr-1" />PRO</Badge>}
                {targetUser.plan === 'supporter' && <Badge className="bg-blue-100 text-blue-700 text-xs"><Zap className="h-3 w-3 mr-1" />SUPPORTER</Badge>}
              </div>
              <p className="text-xs text-muted-foreground">{targetUser.email}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Badge className={roleColors[targetUser.role] || ''}>
              {targetUser.role}
            </Badge>
            {isAdmin && !isSelf && (
              <>
                <Select
                  value={targetUser.role}
                  onValueChange={(v) => onChangeRole(v as UserRole)}
                >
                  <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="user">User</SelectItem>
                    <SelectItem value="moderator">Moderator</SelectItem>
                    <SelectItem value="admin">Admin</SelectItem>
                  </SelectContent>
                </Select>
                <Button
                  variant={targetUser.banned ? 'outline' : 'destructive'}
                  size="sm"
                  onClick={onToggleBan}
                >
                  <Ban className="h-4 w-4 mr-1" />
                  {targetUser.banned ? 'Unban' : 'Ban'}
                </Button>
              </>
            )}
            {targetUser.role === 'moderator' && isAdmin && (
              <Button variant="ghost" size="sm" onClick={() => setExpanded(!expanded)}>
                <Settings className="h-4 w-4 mr-1" />
                {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
              </Button>
            )}
          </div>
        </div>

        {expanded && targetUser.role === 'moderator' && (
          <div className="mt-4 pt-4 border-t space-y-4">
            <div className="flex gap-2 flex-wrap">
              <span className="text-sm font-medium">Templates:</span>
              {PERMISSION_TEMPLATES.map((t) => (
                <Button
                  key={t.name}
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setPermissions(t.permissions);
                    onApplyTemplate(t);
                  }}
                >
                  {t.name}
                </Button>
              ))}
            </div>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              {permissionKeys.map(({ key, label }) => (
                <div key={key} className="flex items-center gap-2">
                  <Switch
                    checked={permissions[key]}
                    onCheckedChange={(v) => {
                      const updated = { ...permissions, [key]: v };
                      setPermissions(updated);
                      onUpdatePermissions(updated);
                    }}
                  />
                  <Label className="text-sm">{label}</Label>
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
