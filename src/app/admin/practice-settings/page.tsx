'use client';

import React, { useState, useEffect } from 'react';
import { collection, query, orderBy, onSnapshot, doc, setDoc, getDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase/config';
import { Course, PracticeSettings } from '@/lib/types';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/components/ui/toast';
import { Sliders, Save, BookOpen, RotateCcw, Loader2 } from 'lucide-react';

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
  const [courses, setCourses] = useState<Course[]>([]);
  const [selectedCourse, setSelectedCourse] = useState('');
  const [settings, setSettings] = useState<PracticeSettings>(DEFAULT_SETTINGS);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const { addToast } = useToast();

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
    const loadSettings = async () => {
      const snap = await getDoc(doc(db, 'practice_settings', selectedCourse));
      if (snap.exists()) {
        setSettings({ ...DEFAULT_SETTINGS, ...snap.data() } as PracticeSettings);
      } else {
        setSettings({ ...DEFAULT_SETTINGS, courseId: selectedCourse });
      }
      setLoading(false);
    };
    loadSettings();
  }, [selectedCourse]);

  const saveSettings = async () => {
    setSaving(true);
    try {
      await setDoc(doc(db, 'practice_settings', selectedCourse), {
        ...settings,
        courseId: selectedCourse,
        updatedAt: serverTimestamp(),
      });
      addToast({ title: 'Settings saved!', variant: 'success' });
    } catch {
      addToast({ title: 'Failed to save', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const resetDefaults = () => {
    setSettings({ ...DEFAULT_SETTINGS, courseId: selectedCourse });
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

      <div className="flex gap-3">
        <Button onClick={saveSettings} disabled={saving}>
          {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
          Save Settings
        </Button>
        <Button variant="outline" onClick={resetDefaults}>
          <RotateCcw className="h-4 w-4 mr-2" /> Reset to Defaults
        </Button>
      </div>
    </div>
  );
}
