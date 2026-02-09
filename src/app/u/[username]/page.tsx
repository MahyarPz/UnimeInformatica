'use client';

import React, { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { collection, query, where, getDocs, orderBy } from 'firebase/firestore';
import { db } from '@/lib/firebase/config';
import { UserProfile, Question } from '@/lib/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Loader2, User, MessageSquare } from 'lucide-react';
import { getInitials, formatDate } from '@/lib/utils';
import Link from 'next/link';

export default function PublicProfilePage() {
  const params = useParams();
  const username = params?.username as string;
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [contributions, setContributions] = useState<Question[]>([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    if (!username) return;

    const loadProfile = async () => {
      try {
        // Find user by username
        const usernameQ = query(
          collection(db, 'users'),
          where('username_lower', '==', username.toLowerCase())
        );
        const snap = await getDocs(usernameQ);

        if (snap.empty) {
          setNotFound(true);
          setLoading(false);
          return;
        }

        const userData = { uid: snap.docs[0].id, ...snap.docs[0].data() } as UserProfile;

        if (!userData.publicProfile) {
          setNotFound(true);
          setLoading(false);
          return;
        }

        setProfile(userData);

        // Load public contributions if enabled
        if (userData.showContributions) {
          const contribQ = query(
            collection(db, 'questions_public'),
            where('creatorUsername', '==', userData.username),
            where('status', '==', 'published'),
            orderBy('createdAt', 'desc')
          );
          const contribSnap = await getDocs(contribQ);
          setContributions(contribSnap.docs.map((d) => ({ id: d.id, ...d.data() } as Question)));
        }
      } catch (error) {
        console.error('Failed to load profile:', error);
        setNotFound(true);
      }
      setLoading(false);
    };

    loadProfile();
  }, [username]);

  if (loading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (notFound || !profile) {
    return (
      <div className="container py-16 text-center">
        <User className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
        <h2 className="text-2xl font-bold mb-2">Profile Not Found</h2>
        <p className="text-muted-foreground">This user either doesn't exist or has a private profile.</p>
      </div>
    );
  }

  return (
    <div className="container py-8 max-w-3xl">
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col items-center text-center">
            <Avatar className="h-20 w-20 mb-4">
              <AvatarImage src={profile.avatar} />
              <AvatarFallback className="text-2xl">{getInitials(profile.username)}</AvatarFallback>
            </Avatar>
            <h1 className="text-2xl font-bold">@{profile.username}</h1>
            {profile.showDisplayName && (profile.firstName || profile.lastName) && (
              <p className="text-muted-foreground">{profile.firstName} {profile.lastName}</p>
            )}
            {profile.bio && <p className="text-sm text-muted-foreground mt-2 max-w-md">{profile.bio}</p>}
            <div className="flex gap-2 mt-3">
              {profile.supporterTier && <Badge>Supporter</Badge>}
              {profile.showContributions && (
                <Badge variant="secondary">{contributions.length} contributions</Badge>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Contributions */}
      {profile.showContributions && contributions.length > 0 && (
        <div className="mt-6">
          <h2 className="text-xl font-bold mb-4">Public Contributions</h2>
          <div className="space-y-3">
            {contributions.map((q) => (
              <Card key={q.id}>
                <CardContent className="py-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium text-sm">{q.questionText}</p>
                      <div className="flex items-center gap-2 mt-1">
                        <Badge variant="outline" className="text-xs">{q.type}</Badge>
                        <Badge variant="outline" className="text-xs">{q.difficulty}</Badge>
                        {q.tags?.map((tag) => (
                          <Badge key={tag} variant="secondary" className="text-xs">{tag}</Badge>
                        ))}
                        <span className="text-xs text-muted-foreground">{formatDate(q.createdAt)}</span>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
