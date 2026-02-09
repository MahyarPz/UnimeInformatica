'use client';

import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  User,
} from 'firebase/auth';
import {
  doc,
  getDoc,
  setDoc,
  runTransaction,
  serverTimestamp,
  updateDoc,
} from 'firebase/firestore';
import { auth, db } from '@/lib/firebase/config';
import { UserProfile, UserRole } from '@/lib/types';

interface AuthContextType {
  user: User | null;
  userProfile: UserProfile | null;
  loading: boolean;
  claims: { role?: UserRole } | null;
  login: (email: string, password: string) => Promise<void>;
  signup: (data: SignupData) => Promise<void>;
  logout: () => Promise<void>;
  checkUsernameAvailable: (username: string) => Promise<boolean>;
  refreshProfile: () => Promise<void>;
}

interface SignupData {
  email: string;
  password: string;
  username: string;
  firstName?: string;
  lastName?: string;
  phone?: string;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [claims, setClaims] = useState<{ role?: UserRole } | null>(null);

  const fetchProfile = useCallback(async (uid: string) => {
    try {
      const docRef = doc(db, 'users', uid);
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        const profile = { uid, ...docSnap.data() } as UserProfile;
        setUserProfile(profile);
        return profile;
      }
    } catch (error) {
      console.error('Error fetching profile:', error);
    }
    return null;
  }, []);

  const refreshProfile = useCallback(async () => {
    if (user) {
      await fetchProfile(user.uid);
      const tokenResult = await user.getIdTokenResult(true);
      setClaims(tokenResult.claims as any);
    }
  }, [user, fetchProfile]);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      setUser(firebaseUser);
      if (firebaseUser) {
        await fetchProfile(firebaseUser.uid);
        const tokenResult = await firebaseUser.getIdTokenResult();
        setClaims(tokenResult.claims as any);
        // Update last login
        try {
          await updateDoc(doc(db, 'users', firebaseUser.uid), {
            lastLoginAt: serverTimestamp(),
          });
        } catch (e) {
          // Profile might not exist yet during signup flow
        }
      } else {
        setUserProfile(null);
        setClaims(null);
      }
      setLoading(false);
    });
    return () => unsubscribe();
  }, [fetchProfile]);

  const checkUsernameAvailable = async (username: string): Promise<boolean> => {
    const lower = username.toLowerCase().trim();
    if (lower.length < 3) return false;
    const docRef = doc(db, 'usernames', lower);
    const docSnap = await getDoc(docRef);
    return !docSnap.exists();
  };

  const signup = async (data: SignupData) => {
    const usernameLower = data.username.toLowerCase().trim();

    // Create Firebase Auth account
    const cred = await createUserWithEmailAndPassword(auth, data.email, data.password);

    // Atomically reserve username using a transaction
    await runTransaction(db, async (transaction) => {
      const usernameRef = doc(db, 'usernames', usernameLower);
      const usernameDoc = await transaction.get(usernameRef);

      if (usernameDoc.exists()) {
        throw new Error('Username is already taken. Please choose another.');
      }

      // Reserve username
      transaction.set(usernameRef, {
        uid: cred.user.uid,
        createdAt: serverTimestamp(),
      });

      // Create user profile
      const userRef = doc(db, 'users', cred.user.uid);
      transaction.set(userRef, {
        email: data.email,
        username: data.username.trim(),
        username_lower: usernameLower,
        firstName: data.firstName || '',
        lastName: data.lastName || '',
        phone: data.phone || '',
        role: 'user' as UserRole,
        publicProfile: true,
        showDisplayName: false,
        showContributions: true,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        lastLoginAt: serverTimestamp(),
        streak: 0,
        goals: {
          dailyQuestions: 10,
          weeklyPracticeMinutes: 120,
          targetScore: 80,
        },
      });
    });

    // Fetch profile
    await fetchProfile(cred.user.uid);
  };

  const login = async (email: string, password: string) => {
    await signInWithEmailAndPassword(auth, email, password);
  };

  const logout = async () => {
    await signOut(auth);
    setUserProfile(null);
    setClaims(null);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        userProfile,
        loading,
        claims,
        login,
        signup,
        logout,
        checkUsernameAvailable,
        refreshProfile,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
