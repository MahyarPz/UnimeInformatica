'use client';

import React, { useState, useEffect } from 'react';
import { collection, query, onSnapshot, doc, setDoc, deleteDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase/config';
import { FeatureFlag } from '@/lib/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogClose } from '@/components/ui/dialog';
import { useToast } from '@/components/ui/toast';
import { Flag, Plus, Trash2, Loader2, ToggleRight } from 'lucide-react';

export default function AdminFeatureFlagsPage() {
  const [flags, setFlags] = useState<FeatureFlag[]>([]);
  const [loading, setLoading] = useState(true);
  const { addToast } = useToast();

  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'feature_flags'), (snap) => {
      setFlags(snap.docs.map((d) => ({ id: d.id, ...d.data() } as unknown as FeatureFlag)));
      setLoading(false);
    }, (err) => { console.error('feature_flags query failed:', err); setLoading(false); });
    return () => unsub();
  }, []);

  const toggleFlag = async (flag: FeatureFlag) => {
    await setDoc(doc(db, 'feature_flags', flag.id), { ...flag, enabled: !flag.enabled, updatedAt: serverTimestamp() }, { merge: true });
    addToast({ title: `${flag.name} ${!flag.enabled ? 'enabled' : 'disabled'}`, variant: 'success' });
  };

  const createFlag = async (data: { name: string; key: string; description: string }) => {
    await setDoc(doc(db, 'feature_flags', data.key), {
      name: data.name,
      key: data.key,
      description: data.description,
      enabled: false,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    addToast({ title: 'Flag created!', variant: 'success' });
  };

  const deleteFlag = async (id: string) => {
    if (!confirm('Delete this feature flag?')) return;
    await deleteDoc(doc(db, 'feature_flags', id));
    addToast({ title: 'Flag deleted', variant: 'success' });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Feature Flags</h1>
          <p className="text-muted-foreground">Toggle platform features on/off</p>
        </div>
        <FlagFormDialog onSubmit={createFlag}>
          <Button><Plus className="h-4 w-4 mr-2" /> Add Flag</Button>
        </FlagFormDialog>
      </div>

      <div className="space-y-2">
        {loading ? (
          <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin" /></div>
        ) : flags.length === 0 ? (
          <Card><CardContent className="py-12 text-center text-muted-foreground">No feature flags configured.</CardContent></Card>
        ) : (
          flags.map((flag) => (
            <Card key={flag.id}>
              <CardContent className="py-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Flag className={`h-4 w-4 ${flag.enabled ? 'text-green-500' : 'text-muted-foreground'}`} />
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="font-medium">{flag.name}</p>
                        <code className="text-xs bg-muted px-1.5 py-0.5 rounded">{flag.key}</code>
                      </div>
                      {flag.description && <p className="text-xs text-muted-foreground">{flag.description}</p>}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant={flag.enabled ? 'success' : 'secondary'}>{flag.enabled ? 'ON' : 'OFF'}</Badge>
                    <Switch checked={flag.enabled} onCheckedChange={() => toggleFlag(flag)} />
                    <Button variant="ghost" size="icon" onClick={() => deleteFlag(flag.id)}>
                      <Trash2 className="h-4 w-4 text-red-500" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}

function FlagFormDialog({ children, onSubmit }: { children: React.ReactNode; onSubmit: (d: any) => void }) {
  const [name, setName] = useState('');
  const [key, setKey] = useState('');
  const [description, setDescription] = useState('');

  return (
    <Dialog>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>New Feature Flag</DialogTitle></DialogHeader>
        <div className="space-y-4">
          <div><Label>Name *</Label><Input value={name} onChange={(e) => { setName(e.target.value); setKey(e.target.value.toLowerCase().replace(/\s+/g, '_')); }} placeholder="Dark Mode" /></div>
          <div><Label>Key</Label><Input value={key} onChange={(e) => setKey(e.target.value)} placeholder="dark_mode" /></div>
          <div><Label>Description</Label><Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} /></div>
        </div>
        <DialogFooter>
          <DialogClose asChild><Button variant="outline">Cancel</Button></DialogClose>
          <DialogClose asChild><Button disabled={!name || !key} onClick={() => onSubmit({ name, key, description })}>Create</Button></DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
