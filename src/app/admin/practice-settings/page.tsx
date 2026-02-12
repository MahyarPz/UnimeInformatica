'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { collection, query, orderBy, onSnapshot, doc, setDoc, getDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase/config';
import { useAuth } from '@/contexts/AuthContext';
import { Course, PracticeSettings } from '@/lib/types';
import { logAudit } from '@/lib/firebase/activity';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/components/ui/toast';
import { Sliders, Save, BookOpen, RotateCcw, Loader2, AlertCircle, Check } from 'lucide-react';

const DEFAULT_SETTINGS: PracticeSettings = {
  courseId: '',
  defaultQuestionCount: 10,
  timeLimitMinutes: 30,
  allowHints: true,
  showExplanations: true,
  enableSpacedRepetition: true,
  difficultyRange: { min: 1, max: 5 },
  shuffleOptions: true,
  shuffleQuestions: true,
  enableTimer: true,
  passingScore: 60,
};

export default function AdminPracticeSettingsPage() {
  const { user, userProfile, refreshProfile } = useAuth();
  const [courses, setCourses] = useState<Course[]>([]);
  const [selectedCourse, setSelectedCourse] = useState('');
  const [settings, setSettings] = useState<PracticeSettings>(DEFAULT_SETTINGS);
  const [savedSettings, setSavedSettings] = useState<PracticeSettings>(DEFAULT_SETTINGS);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const { addToast } = useToast();

  // Force token refresh on mount to pick up latest custom claims
  useEffect(() => {
    refreshProfile?.();
  }, [refreshProfile]);

  // Dirty detection
  const dirty = useMemo(
    () => JSON.stringify(settings) !== JSON.stringify(savedSettings),
    [settings, savedSettings],
  );

  useEffect(() => {
    const unsub = onSnapshot(query(collection(db, 'courses'), orderBy('order')), (snap) => {
      const c = snap.docs.map((d) => ({ id: d.id, ...d.data() } as Course));
      setCourses(c);
      if (c.length > 0 && !selectedCourse) setSelectedCourse(c[0].id);
    }, (err) => { console.error('courses query failed:', err); });
    return () => unsub();
  }, []);

  useEffect(() => {
    if (!selectedCourse) return;
    setLoading(true);
    setSaveStatus('idle');
    const loadSettings = async () => {
      try {
        const snap = await getDoc(doc(db, 'practice_settings', selectedCourse));
        const loaded = snap.exists()
          ? { ...DEFAULT_SETTINGS, ...snap.data() } as PracticeSettings
          : { ...DEFAULT_SETTINGS, courseId: selectedCourse };
        setSettings(loaded);
        setSavedSettings(loaded);
      } catch (err) {
        console.error('Failed to load practice settings:', err);
        setSettings({ ...DEFAULT_SETTINGS, courseId: selectedCourse });
        setSavedSettings({ ...DEFAULT_SETTINGS, courseId: selectedCourse });
      } finally {
        setLoading(false);
      }
    };
    loadSettings();
  }, [selectedCourse]);

  const saveSettings = async () => {
    if (!selectedCourse) return;
    setSaving(true);
    setSaveStatus('idle');
    try {
      const payload = {
        ...settings,
        courseId: selectedCourse,
        updatedAt: serverTimestamp(),
      };
      await setDoc(doc(db, 'practice_settings', selectedCourse), payload);

      // Update saved snapshot so dirty resets
      setSavedSettings({ ...settings, courseId: selectedCourse });
      setSaveStatus('success');

      // Audit log
      if (user && userProfile) {
        await logAudit({
          action: 'practice_settings.update',
          category: 'admin',
          actorUid: user.uid,
          actorUsername: userProfile.username,
          actorRole: userProfile.role,
          targetType: 'practice_settings',
          targetId: selectedCourse,
          details: { courseId: selectedCourse },
        }).catch(() => {});
      }

      addToast({ title: 'Settings saved!', variant: 'success' });

      // Clear success indicator after 3s
      setTimeout(() => setSaveStatus('idle'), 3000);
    } catch (err: any) {
      console.error('Failed to save practice settings:', err);
      setSaveStatus('error');
      addToast({
        title: 'Failed to save',
        description: err?.code === 'permission-denied'
          ? 'Permission denied. Please sign out and sign back in.'
          : err?.message || 'Unknown error',
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  const resetDefaults = () => {
    setSettings({ ...DEFAULT_SETTINGS, courseId: selectedCourse });
    setSaveStatus('idle');
    addToast({ title: 'Reset to defaults', description: 'Click Save to persist.', variant: 'default' });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Practice Settings</h1>
          <p className="text-muted-foreground">Configure practice behavior per course</p>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <Label>Course:</Label>
        <Select value={selectedCourse} onValueChange={setSelectedCourse}>
          <SelectTrigger className="w-64"><SelectValue placeholder="Select course" /></SelectTrigger>
          <SelectContent>
            {courses.map((c) => (
              <SelectItem key={c.id} value={c.id}>{c.title}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {loading ? (
        <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin" /></div>
      ) : (
        <div className="grid md:grid-cols-2 gap-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg">Session Defaults</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label>Default Question Count</Label>
                <Input
                  type="number"
                  value={settings.defaultQuestionCount}
                  onChange={(e) => setSettings({ ...settings, defaultQuestionCount: parseInt(e.target.value) || 10 })}
                  min={1}
                  max={100}
                />
              </div>
              <div>
                <Label>Time Limit (minutes, 0 = unlimited)</Label>
                <Input
                  type="number"
                  value={settings.timeLimitMinutes}
                  onChange={(e) => setSettings({ ...settings, timeLimitMinutes: parseInt(e.target.value) || 0 })}
                  min={0}
                  max={300}
                />
              </div>
              <div>
                <Label>Passing Score (%)</Label>
                <Input
                  type="number"
                  value={settings.passingScore}
                  onChange={(e) => setSettings({ ...settings, passingScore: parseInt(e.target.value) || 60 })}
                  min={0}
                  max={100}
                />
              </div>
              <div>
                <Label>Difficulty Range</Label>
                <div className="flex gap-2 items-center">
                  <Input
                    type="number"
                    value={settings.difficultyRange?.min ?? 1}
                    onChange={(e) =>
                      setSettings({ ...settings, difficultyRange: { ...(settings.difficultyRange || { min: 1, max: 5 }), min: parseInt(e.target.value) || 1 } })
                    }
                    min={1} max={5} className="w-20"
                  />
                  <span className="text-muted-foreground">to</span>
                  <Input
                    type="number"
                    value={settings.difficultyRange?.max ?? 5}
                    onChange={(e) =>
                      setSettings({ ...settings, difficultyRange: { ...(settings.difficultyRange || { min: 1, max: 5 }), max: parseInt(e.target.value) || 5 } })
                    }
                    min={1} max={5} className="w-20"
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg">Features</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <Label>Enable Timer</Label>
                <Switch checked={settings.enableTimer} onCheckedChange={(v) => setSettings({ ...settings, enableTimer: v })} />
              </div>
              <div className="flex items-center justify-between">
                <Label>Allow Hints</Label>
                <Switch checked={settings.allowHints} onCheckedChange={(v) => setSettings({ ...settings, allowHints: v })} />
              </div>
              <div className="flex items-center justify-between">
                <Label>Show Explanations After Answer</Label>
                <Switch checked={settings.showExplanations} onCheckedChange={(v) => setSettings({ ...settings, showExplanations: v })} />
              </div>
              <div className="flex items-center justify-between">
                <Label>Shuffle Questions</Label>
                <Switch checked={settings.shuffleQuestions} onCheckedChange={(v) => setSettings({ ...settings, shuffleQuestions: v })} />
              </div>
              <div className="flex items-center justify-between">
                <Label>Shuffle Options</Label>
                <Switch checked={settings.shuffleOptions} onCheckedChange={(v) => setSettings({ ...settings, shuffleOptions: v })} />
              </div>
              <div className="flex items-center justify-between">
                <Label>Spaced Repetition</Label>
                <Switch checked={settings.enableSpacedRepetition} onCheckedChange={(v) => setSettings({ ...settings, enableSpacedRepetition: v })} />
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      <div className="flex items-center gap-3">
        <Button onClick={saveSettings} disabled={saving || !dirty}>
          {saving ? (
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          ) : saveStatus === 'success' ? (
            <Check className="h-4 w-4 mr-2 text-green-500" />
          ) : saveStatus === 'error' ? (
            <AlertCircle className="h-4 w-4 mr-2 text-red-500" />
          ) : (
            <Save className="h-4 w-4 mr-2" />
          )}
          {saveStatus === 'success' ? 'Saved!' : saveStatus === 'error' ? 'Failed — Retry' : 'Save Settings'}
        </Button>
        <Button variant="outline" onClick={resetDefaults} disabled={saving}>
          <RotateCcw className="h-4 w-4 mr-2" /> Reset to Defaults
        </Button>
        {dirty && (
          <span className="text-xs text-yellow-600 font-medium">Unsaved changes</span>
        )}
      </div>
    </div>
  );
}
