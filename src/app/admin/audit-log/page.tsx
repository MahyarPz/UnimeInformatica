'use client';

import React, { useState, useEffect } from 'react';
import { collection, query, orderBy, onSnapshot, limit, where, startAfter, getDocs } from 'firebase/firestore';
import { db } from '@/lib/firebase/config';
import { AuditLog } from '@/lib/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';
import { ScrollText, Search, Loader2, ChevronDown, Filter } from 'lucide-react';
import { formatDateTime } from '@/lib/utils';

export default function AdminAuditLogPage() {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterAction, setFilterAction] = useState('all');
  const [filterCategory, setFilterCategory] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [pageSize] = useState(50);

  useEffect(() => {
    const constraints: any[] = [orderBy('timestamp', 'desc'), limit(pageSize)];
    if (filterCategory !== 'all') constraints.unshift(where('category', '==', filterCategory));

    const q = query(collection(db, 'audit_log'), ...constraints);
    const unsub = onSnapshot(q, (snap) => {
      setLogs(snap.docs.map((d) => ({ id: d.id, ...d.data() } as AuditLog)));
      setLoading(false);
    });
    return () => unsub();
  }, [filterCategory, pageSize]);

  const filtered = logs.filter((log) => {
    if (filterAction !== 'all' && log.action !== filterAction) return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      return (
        log.actorUsername?.toLowerCase().includes(q) ||
        log.action?.toLowerCase().includes(q) ||
        JSON.stringify(log.details || {}).toLowerCase().includes(q)
      );
    }
    return true;
  });

  const uniqueActions = [...new Set(logs.map((l) => l.action))].sort();

  const actionColors: Record<string, string> = {
    course_created: 'bg-green-100 text-green-700',
    role_changed: 'bg-blue-100 text-blue-700',
    user_banned: 'bg-red-100 text-red-700',
    user_unbanned: 'bg-yellow-100 text-yellow-700',
    question_approved: 'bg-green-100 text-green-700',
    question_rejected: 'bg-red-100 text-red-700',
    settings_changed: 'bg-purple-100 text-purple-700',
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Audit Log</h1>
        <p className="text-muted-foreground">Track all administrative actions</p>
      </div>

      <Card>
        <CardContent className="pt-4 pb-3">
          <div className="flex flex-wrap gap-3 items-end">
            <div className="flex-1 min-w-[200px]">
              <Label className="text-xs">Search</Label>
              <div className="relative">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder="User, action, details..." className="pl-9" />
              </div>
            </div>
            <div>
              <Label className="text-xs">Category</Label>
              <Select value={filterCategory} onValueChange={setFilterCategory}>
                <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  <SelectItem value="courses">Courses</SelectItem>
                  <SelectItem value="questions">Questions</SelectItem>
                  <SelectItem value="admin">Admin</SelectItem>
                  <SelectItem value="auth">Auth</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Action</Label>
              <Select value={filterAction} onValueChange={setFilterAction}>
                <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Actions</SelectItem>
                  {uniqueActions.map((a) => <SelectItem key={a} value={a}>{a.replace(/_/g, ' ')}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="space-y-1">
        {loading ? (
          <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin" /></div>
        ) : filtered.length === 0 ? (
          <Card><CardContent className="py-12 text-center text-muted-foreground">No audit entries found.</CardContent></Card>
        ) : (
          filtered.map((log) => (
            <Card key={log.id}>
              <CardContent className="py-2.5">
                <div className="flex items-center gap-3">
                  <ScrollText className="h-4 w-4 text-muted-foreground shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium text-sm">@{log.actorUsername}</span>
                      <Badge className={`text-xs ${actionColors[log.action] || 'bg-gray-100 text-gray-700'}`}>
                        {log.action?.replace(/_/g, ' ')}
                      </Badge>
                      <Badge variant="outline" className="text-xs">{log.actorRole}</Badge>
                      {log.targetUid && <span className="text-xs text-muted-foreground">→ {log.targetUid.substring(0, 8)}</span>}
                    </div>
                    {log.details && Object.keys(log.details).length > 0 && (
                      <p className="text-xs text-muted-foreground mt-0.5 truncate">
                        {JSON.stringify(log.details).substring(0, 120)}
                      </p>
                    )}
                  </div>
                  <span className="text-xs text-muted-foreground whitespace-nowrap shrink-0">
                    {log.timestamp ? formatDateTime(log.timestamp) : ''}
                  </span>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}
