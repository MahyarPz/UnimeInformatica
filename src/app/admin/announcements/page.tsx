'use client';

import React, { useState, useEffect } from 'react';
import {
  collection, query, orderBy, onSnapshot, addDoc, updateDoc, deleteDoc,
  doc, serverTimestamp,
} from 'firebase/firestore';
import { db } from '@/lib/firebase/config';
import { Announcement } from '@/lib/types';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogClose } from '@/components/ui/dialog';
import { useToast } from '@/components/ui/toast';
import { Plus, Megaphone, Trash2, Edit, Eye, EyeOff } from 'lucide-react';
import { timeAgo } from '@/lib/utils';

export default function AdminAnnouncementsPage() {
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [loading, setLoading] = useState(true);
  const { user, userProfile } = useAuth();
  const { addToast } = useToast();

  useEffect(() => {
    const q = query(collection(db, 'announcements'), orderBy('createdAt', 'desc'));
    const unsub = onSnapshot(q, (snap) => {
      setAnnouncements(snap.docs.map((d) => ({ id: d.id, ...d.data() } as Announcement)));
      setLoading(false);
    });
    return () => unsub();
  }, []);

  const createAnnouncement = async (data: Partial<Announcement>) => {
    try {
      await addDoc(collection(db, 'announcements'), {
        ...data,
        authorUid: user!.uid,
        authorUsername: userProfile!.username,
        active: true,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      addToast({ title: 'Announcement created!', variant: 'success' });
    } catch {
      addToast({ title: 'Failed to create', variant: 'destructive' });
    }
  };

  const toggleActive = async (id: string, active: boolean) => {
    await updateDoc(doc(db, 'announcements', id), { active: !active, updatedAt: serverTimestamp() });
  };

  const deleteAnnouncement = async (id: string) => {
    if (!confirm('Delete this announcement?')) return;
    await deleteDoc(doc(db, 'announcements', id));
    addToast({ title: 'Deleted', variant: 'success' });
  };

  const typeColors: Record<string, string> = {
    info: 'bg-blue-100 text-blue-700',
    warning: 'bg-yellow-100 text-yellow-700',
    success: 'bg-green-100 text-green-700',
    error: 'bg-red-100 text-red-700',
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Announcements</h1>
          <p className="text-muted-foreground">Site-wide announcements and banners</p>
        </div>
        <AnnouncementFormDialog onSubmit={createAnnouncement}>
          <Button><Plus className="h-4 w-4 mr-2" /> New Announcement</Button>
        </AnnouncementFormDialog>
      </div>

      <div className="space-y-2">
        {announcements.map((a) => (
          <Card key={a.id}>
            <CardContent className="py-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Megaphone className="h-4 w-4 text-primary" />
                  <div>
                    <p className="font-medium">{a.title}</p>
                    <p className="text-xs text-muted-foreground line-clamp-1">{a.message}</p>
                    <div className="flex gap-1.5 mt-1">
                      <Badge className={typeColors[a.type] || ''}>{a.type}</Badge>
                      <Badge variant="outline">{a.audience || 'all'}</Badge>
                      <Badge variant="outline">{a.placement || 'banner'}</Badge>
                      <span className="text-xs text-muted-foreground">{a.createdAt ? timeAgo(a.createdAt) : ''}</span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant={a.active ? 'success' : 'secondary'}>{a.active ? 'Live' : 'Hidden'}</Badge>
                  <Switch checked={a.active} onCheckedChange={() => toggleActive(a.id, a.active)} />
                  <Button variant="ghost" size="icon" onClick={() => deleteAnnouncement(a.id)}>
                    <Trash2 className="h-4 w-4 text-red-500" />
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
        {announcements.length === 0 && !loading && (
          <Card><CardContent className="py-12 text-center text-muted-foreground">No announcements.</CardContent></Card>
        )}
      </div>
    </div>
  );
}

function AnnouncementFormDialog({ children, onSubmit }: { children: React.ReactNode; onSubmit: (data: any) => void }) {
  const [title, setTitle] = useState('');
  const [message, setMessage] = useState('');
  const [type, setType] = useState('info');
  const [audience, setAudience] = useState('all');
  const [placement, setPlacement] = useState('banner');
  const [linkUrl, setLinkUrl] = useState('');
  const [linkText, setLinkText] = useState('');

  return (
    <Dialog>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>New Announcement</DialogTitle></DialogHeader>
        <div className="space-y-4">
          <div><Label>Title *</Label><Input value={title} onChange={(e) => setTitle(e.target.value)} /></div>
          <div><Label>Message *</Label><Textarea value={message} onChange={(e) => setMessage(e.target.value)} rows={3} /></div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <Label>Type</Label>
              <Select value={type} onValueChange={setType}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="info">Info</SelectItem>
                  <SelectItem value="warning">Warning</SelectItem>
                  <SelectItem value="success">Success</SelectItem>
                  <SelectItem value="error">Error</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Audience</Label>
              <Select value={audience} onValueChange={setAudience}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  <SelectItem value="students">Students</SelectItem>
                  <SelectItem value="admins">Admins</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Placement</Label>
              <Select value={placement} onValueChange={setPlacement}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="banner">Banner</SelectItem>
                  <SelectItem value="modal">Modal</SelectItem>
                  <SelectItem value="toast">Toast</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><Label>Link URL</Label><Input value={linkUrl} onChange={(e) => setLinkUrl(e.target.value)} placeholder="https://..." /></div>
            <div><Label>Link Text</Label><Input value={linkText} onChange={(e) => setLinkText(e.target.value)} placeholder="Learn more" /></div>
          </div>
        </div>
        <DialogFooter>
          <DialogClose asChild><Button variant="outline">Cancel</Button></DialogClose>
          <DialogClose asChild>
            <Button disabled={!title || !message} onClick={() => onSubmit({ title, message, type, audience, placement, linkUrl, linkText })}>
              Create
            </Button>
          </DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
