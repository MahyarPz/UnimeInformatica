'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useSiteSettingsContext } from '@/contexts/SiteSettingsContext';
import { useUserPlan } from '@/lib/hooks/useUserPlan';
import { useAIUsage } from '@/lib/hooks/useAIUsage';
import { apiFetch } from '@/lib/utils/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Progress } from '@/components/ui/progress';
import {
  Bot,
  Send,
  Lock,
  Sparkles,
  AlertTriangle,
  Loader2,
  User,
  Crown,
  Zap,
} from 'lucide-react';
import Link from 'next/link';

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

const PLAN_LABELS: Record<string, { label: string; icon: React.ElementType; color: string }> = {
  free: { label: 'Free', icon: User, color: 'text-muted-foreground' },
  supporter: { label: 'Supporter', icon: Zap, color: 'text-blue-500' },
  pro: { label: 'Pro', icon: Crown, color: 'text-amber-500' },
};

export default function AIPage() {
  const { user, loading: authLoading } = useAuth();
  const { settings, loading: settingsLoading } = useSiteSettingsContext();
  const { effectiveTier, loading: planLoading } = useUserPlan();
  const { remaining, count, limit, loading: usageLoading } = useAIUsage();

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const monetization = settings?.monetization;
  const aiEnabled = monetization?.aiEnabled !== false;
  const paidFeaturesEnabled = monetization?.paidFeaturesEnabled !== false;
  const isLoading = authLoading || settingsLoading || planLoading || usageLoading;

  const quota = monetization?.aiQuotas?.[effectiveTier] ?? 0;
  const hasAccess = aiEnabled && paidFeaturesEnabled && quota > 0;

  // Compute remaining display: use live data if available, else computed from quota
  const displayRemaining = remaining !== null ? remaining : quota;
  const displayUsed = count;
  const displayLimit = limit || quota;

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  const sendMessage = async () => {
    if (!input.trim() || sending || !user) return;

    const userMessage = input.trim();
    setInput('');
    setError(null);

    setMessages((prev) => [
      ...prev,
      { role: 'user', content: userMessage, timestamp: new Date() },
    ]);

    setSending(true);

    try {
      const res = await apiFetch<{ response?: string; error?: string; code?: string }>('/api/ai/chat', {
        method: 'POST',
        body: JSON.stringify({ message: userMessage }),
      });

      if (!res.ok) {
        // 401/403 are handled globally by apiFetch (session expired dialog)
        // Show other errors locally
        if (res.status !== 401 && res.status !== 403) {
          setError(res.data?.error || 'Something went wrong');
          if (res.data?.code === 'QUOTA_EXCEEDED') {
            setError('Daily quota exceeded. Resets at midnight (Europe/Rome).');
          }
        }
        return;
      }

      setMessages((prev) => [
        ...prev,
        { role: 'assistant', content: res.data.response || '', timestamp: new Date() },
      ]);
    } catch (e: any) {
      setError(e.message || 'Failed to send message');
    } finally {
      setSending(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  if (isLoading) {
    return (
      <div className="container max-w-4xl py-12 flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="container max-w-4xl py-12">
        <Card>
          <CardContent className="py-12 text-center">
            <Lock className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h2 className="text-xl font-semibold mb-2">Sign in required</h2>
            <p className="text-muted-foreground mb-4">
              You need to sign in to use the AI Study Assistant.
            </p>
            <Button asChild>
              <Link href="/login">Sign In</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Locked: AI disabled globally
  if (!aiEnabled || !paidFeaturesEnabled) {
    return (
      <div className="container max-w-4xl py-12">
        <Card>
          <CardContent className="py-12 text-center">
            <AlertTriangle className="h-12 w-12 text-yellow-500 mx-auto mb-4" />
            <h2 className="text-xl font-semibold mb-2">AI Assistant Unavailable</h2>
            <p className="text-muted-foreground">
              The AI Study Assistant is currently disabled by the administrator. Check back later.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Locked: Free plan
  if (!hasAccess) {
    const planInfo = PLAN_LABELS[effectiveTier] || PLAN_LABELS.free;
    return (
      <div className="container max-w-4xl py-12">
        <div className="space-y-6">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Bot className="h-7 w-7 text-primary" />
              AI Study Assistant
            </h1>
            <p className="text-muted-foreground mt-1">
              Get help with concepts, problem-solving, and exam preparation.
            </p>
          </div>

          <Card>
            <CardContent className="py-12 text-center">
              <Lock className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <h2 className="text-xl font-semibold mb-2">Upgrade to Unlock AI</h2>
              <p className="text-muted-foreground mb-2">
                Your current plan: <Badge variant="secondary">{planInfo.label}</Badge>
              </p>
              <p className="text-muted-foreground mb-6">
                The AI Study Assistant is available for Supporter and Pro plans.
                Supporter gets 20 prompts/day, Pro gets 120 prompts/day.
              </p>
              <Button asChild>
                <Link href="/support">
                  <Sparkles className="h-4 w-4 mr-2" />
                  View Plans & Support
                </Link>
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  // Full access
  const planInfo = PLAN_LABELS[effectiveTier] || PLAN_LABELS.free;
  const PlanIcon = planInfo.icon;
  const usagePercent = displayLimit > 0 ? (displayUsed / displayLimit) * 100 : 0;

  return (
    <div className="container max-w-4xl py-6">
      <div className="space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Bot className="h-7 w-7 text-primary" />
              AI Study Assistant
            </h1>
            <p className="text-muted-foreground text-sm mt-1">
              Ask anything about your courses, concepts, or exam prep.
            </p>
          </div>
          <div className="text-right">
            <div className="flex items-center gap-2 justify-end">
              <PlanIcon className={`h-4 w-4 ${planInfo.color}`} />
              <Badge variant="outline">{planInfo.label}</Badge>
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {displayRemaining}/{displayLimit} remaining today
            </p>
          </div>
        </div>

        {/* Quota bar */}
        <div className="space-y-1">
          <Progress value={usagePercent} className="h-2" />
          <p className="text-xs text-muted-foreground">
            {displayUsed} of {displayLimit} prompts used today
            {usagePercent >= 80 && (
              <span className="text-yellow-600 ml-1">— running low!</span>
            )}
          </p>
        </div>

        {/* Chat area */}
        <Card className="flex flex-col" style={{ height: 'calc(100vh - 300px)', minHeight: '400px' }}>
          <CardHeader className="py-3 border-b">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Conversation
            </CardTitle>
          </CardHeader>
          <CardContent className="flex-1 overflow-y-auto p-4 space-y-4">
            {messages.length === 0 && (
              <div className="flex-1 flex items-center justify-center text-center py-12">
                <div>
                  <Sparkles className="h-10 w-10 text-primary/30 mx-auto mb-3" />
                  <p className="text-muted-foreground">
                    Start a conversation! Ask about any topic from your courses.
                  </p>
                  <div className="mt-4 flex flex-wrap gap-2 justify-center">
                    {[
                      'Explain limits in calculus',
                      'How does binary search work?',
                      'What is the Central Limit Theorem?',
                    ].map((suggestion) => (
                      <Button
                        key={suggestion}
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setInput(suggestion);
                          textareaRef.current?.focus();
                        }}
                      >
                        {suggestion}
                      </Button>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {messages.map((msg, i) => (
              <div
                key={i}
                className={`flex gap-3 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                {msg.role === 'assistant' && (
                  <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                    <Bot className="h-4 w-4 text-primary" />
                  </div>
                )}
                <div
                  className={`max-w-[80%] rounded-lg p-3 text-sm whitespace-pre-wrap ${
                    msg.role === 'user'
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-muted'
                  }`}
                >
                  {msg.content}
                </div>
                {msg.role === 'user' && (
                  <div className="h-8 w-8 rounded-full bg-primary flex items-center justify-center shrink-0">
                    <User className="h-4 w-4 text-primary-foreground" />
                  </div>
                )}
              </div>
            ))}

            {sending && (
              <div className="flex gap-3 justify-start">
                <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                  <Bot className="h-4 w-4 text-primary" />
                </div>
                <div className="bg-muted rounded-lg p-3">
                  <Loader2 className="h-4 w-4 animate-spin" />
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </CardContent>

          {/* Input */}
          <div className="border-t p-3">
            {error && (
              <div className="mb-2 text-sm text-red-500 flex items-center gap-1">
                <AlertTriangle className="h-3 w-3" />
                {error}
              </div>
            )}
            <div className="flex gap-2">
              <Textarea
                ref={textareaRef}
                placeholder="Ask a question..."
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                disabled={sending || displayRemaining === 0}
                className="resize-none min-h-[44px] max-h-[120px]"
                rows={1}
              />
              <Button
                onClick={sendMessage}
                disabled={!input.trim() || sending || displayRemaining === 0}
                size="icon"
                className="shrink-0 h-11 w-11"
              >
                {sending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Send className="h-4 w-4" />
                )}
              </Button>
            </div>
            {displayRemaining === 0 && (
              <p className="text-xs text-yellow-600 mt-1">
                Daily quota reached. Resets at midnight (Europe/Rome).
              </p>
            )}
          </div>
        </Card>
      </div>
    </div>
  );
}
