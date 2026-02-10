'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { MailCheck, RefreshCw, Loader2, CheckCircle } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/components/ui/toast';

const COOLDOWN_SECONDS = 60;

export default function VerifyEmailPage() {
  const { user, loading, sendVerificationEmail, refreshUser, logout } = useAuth();
  const router = useRouter();
  const { addToast } = useToast();

  const [resending, setResending] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [cooldown, setCooldown] = useState(COOLDOWN_SECONDS); // Start with cooldown since email was just sent on signup
  const [verified, setVerified] = useState(false);

  // Redirect unauthenticated users to login
  useEffect(() => {
    if (!loading && !user) {
      router.replace('/login');
    }
  }, [loading, user, router]);

  // If user is already verified, redirect to courses
  useEffect(() => {
    if (!loading && user?.emailVerified) {
      setVerified(true);
      const timer = setTimeout(() => router.replace('/courses'), 2000);
      return () => clearTimeout(timer);
    }
  }, [loading, user, router]);

  // Cooldown timer
  useEffect(() => {
    if (cooldown <= 0) return;
    const interval = setInterval(() => {
      setCooldown((prev) => (prev <= 1 ? 0 : prev - 1));
    }, 1000);
    return () => clearInterval(interval);
  }, [cooldown]);

  const handleResend = useCallback(async () => {
    if (cooldown > 0) return;
    setResending(true);
    try {
      await sendVerificationEmail();
      setCooldown(COOLDOWN_SECONDS);
      addToast({ title: 'Verification email sent!', description: 'Check your inbox and spam folder.', variant: 'success' });
    } catch (error: any) {
      addToast({
        title: 'Failed to resend',
        description: error?.message || 'Please try again later.',
        variant: 'destructive',
      });
    } finally {
      setResending(false);
    }
  }, [cooldown, sendVerificationEmail, addToast]);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await refreshUser();
      // After refresh, the useEffect above will detect emailVerified and redirect
      if (!user?.emailVerified) {
        addToast({
          title: 'Not verified yet',
          description: 'Please click the link in the verification email first.',
          variant: 'destructive',
        });
      }
    } catch (error: any) {
      addToast({
        title: 'Refresh failed',
        description: error?.message || 'Please try again.',
        variant: 'destructive',
      });
    } finally {
      setRefreshing(false);
    }
  }, [refreshUser, user, addToast]);

  const handleLogout = useCallback(async () => {
    await logout();
    router.replace('/login');
  }, [logout, router]);

  if (loading) {
    return (
      <div className="min-h-[80vh] flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) return null; // Redirect will fire from useEffect

  if (verified) {
    return (
      <div className="min-h-[80vh] flex items-center justify-center px-4">
        <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="text-center">
          <CheckCircle className="h-16 w-16 text-green-600 mx-auto mb-4" />
          <h2 className="text-2xl font-bold mb-2">Email Verified!</h2>
          <p className="text-muted-foreground">Redirecting you to courses...</p>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-[80vh] flex items-center justify-center px-4 py-8">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md"
      >
        <Card>
          <CardHeader className="text-center">
            <div className="flex justify-center mb-4">
              <MailCheck className="h-12 w-12 text-primary" />
            </div>
            <CardTitle className="text-2xl">Verify Your Email</CardTitle>
            <CardDescription>
              We sent a verification link to <strong>{user.email}</strong>. Please check your inbox (and spam/junk folder) and click the link to verify your account.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-col gap-3">
              <Button
                onClick={handleResend}
                disabled={resending || cooldown > 0}
                variant="outline"
                className="w-full"
              >
                {resending ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <MailCheck className="mr-2 h-4 w-4" />
                )}
                {cooldown > 0 ? `Resend in ${cooldown}s` : 'Resend Verification Email'}
              </Button>
              <Button
                onClick={handleRefresh}
                disabled={refreshing}
                className="w-full"
              >
                {refreshing ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <RefreshCw className="mr-2 h-4 w-4" />
                )}
                I Verified — Check Now
              </Button>
            </div>
          </CardContent>
          <CardFooter className="flex flex-col gap-3">
            <p className="text-xs text-muted-foreground text-center">
              Didn&apos;t receive the email? Check your spam folder or try resending. Make sure <strong>{user.email}</strong> is correct.
            </p>
            <Button variant="ghost" size="sm" onClick={handleLogout} className="text-muted-foreground">
              Sign out and use a different email
            </Button>
          </CardFooter>
        </Card>
      </motion.div>
    </div>
  );
}
