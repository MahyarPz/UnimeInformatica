'use client';

import React, { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react';
import {
  onAuthStateChanged,
  onIdTokenChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  sendEmailVerification,
  reload,
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
  sendVerificationEmail: () => Promise<void>;
  refreshUser: () => Promise<void>;
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
  const signingUpRef = useRef(false);

  const bootstrapEmail = process.env.NEXT_PUBLIC_BOOTSTRAP_ADMIN_EMAIL || '';

  const isBootstrapAdmin = useCallback((email: string) => {
    return bootstrapEmail && email.toLowerCase() === bootstrapEmail.toLowerCase();
  }, [bootstrapEmail]);

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
        let profile = await fetchProfile(firebaseUser.uid);

        // Auto-create profile if missing (handles orphaned Auth accounts)
        // Skip if signup is in progress — the signup transaction will create the profile
        if (!profile && firebaseUser.email && !signingUpRef.current) {
          try {
            const email = firebaseUser.email;
            const baseUsername = email.split('@')[0].replace(/[^a-zA-Z0-9]/g, '');
            const defaultUsername = baseUsername + '_' + firebaseUser.uid.substring(0, 4);
            const role = isBootstrapAdmin(email) ? 'admin' : 'user';

            const userRef = doc(db, 'users', firebaseUser.uid);
            await setDoc(userRef, {
              email: email,
              username: defaultUsername,
              username_lower: defaultUsername.toLowerCase(),
              firstName: '',
              lastName: '',
              phone: '',
              role: role as UserRole,
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
            console.log('Auto-created profile for', email, 'with role', role);
            profile = await fetchProfile(firebaseUser.uid);
          } catch (e) {
            console.error('Error auto-creating profile:', e);
          }
        }

        // If bootstrap admin but role is not admin, upgrade it
        if (profile && firebaseUser.email && isBootstrapAdmin(firebaseUser.email) && profile.role !== 'admin') {
          try {
            await updateDoc(doc(db, 'users', firebaseUser.uid), {
              role: 'admin' as UserRole,
              updatedAt: serverTimestamp(),
            });
            profile = await fetchProfile(firebaseUser.uid);
            console.log('Upgraded bootstrap admin role');
          } catch (e) {
            console.error('Error upgrading admin role:', e);
          }
        }

        try {
          const tokenResult = await firebaseUser.getIdTokenResult(true);
          setClaims(tokenResult.claims as any);
        } catch (e) {
          console.error('Token refresh failed, using cached token:', e);
          try {
            const tokenResult = await firebaseUser.getIdTokenResult(false);
            setClaims(tokenResult.claims as any);
          } catch {
            setClaims(null);
          }
        }
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
  }, [fetchProfile, isBootstrapAdmin]);

  // Listen for ID token changes (role/claims changes from Cloud Functions)
  // This fires when custom claims are updated, enabling real-time role revocation.
  useEffect(() => {
    const unsubToken = onIdTokenChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        try {
          const tokenResult = await firebaseUser.getIdTokenResult();
          setClaims(tokenResult.claims as any);
        } catch {
          // Token refresh failed — handled by session guard
        }
      }
    });
    return () => unsubToken();
  }, []);

  const checkUsernameAvailable = async (username: string): Promise<boolean> => {
    const lower = username.toLowerCase().trim();
    if (lower.length < 3) return false;
    const docRef = doc(db, 'usernames', lower);
    const docSnap = await getDoc(docRef);
    return !docSnap.exists();
  };

  const signup = async (data: SignupData) => {
    const usernameLower = data.username.toLowerCase().trim();

    // Prevent onAuthStateChanged from auto-creating a profile with random username
    signingUpRef.current = true;

    // Create Firebase Auth account
    const cred = await createUserWithEmailAndPassword(auth, data.email, data.password);

    try {
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
        const assignedRole = isBootstrapAdmin(data.email) ? 'admin' : 'user';
        transaction.set(userRef, {
          email: data.email,
          username: data.username.trim(),
          username_lower: usernameLower,
          firstName: data.firstName || '',
          lastName: data.lastName || '',
          phone: data.phone || '',
          role: assignedRole as UserRole,
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
    } catch (error) {
      // Transaction failed — delete the orphaned Auth account to prevent inconsistency
      try {
        await cred.user.delete();
      } catch (deleteError) {
        console.error('Failed to clean up orphaned Auth account:', deleteError);
      }
      signingUpRef.current = false;
      throw error; // Re-throw so the caller (signup page) sees the error
    }

    signingUpRef.current = false;
    // Send verification email (best-effort, don't block signup)
    try {
      const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
      await sendEmailVerification(cred.user, {
        url: `${appUrl}/verify-email`,
        handleCodeInApp: false,
      });
    } catch (verifyError) {
      console.error('Failed to send verification email:', verifyError);
    }
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

  const sendVerificationEmailFn = async () => {
    if (!auth.currentUser) throw new Error('Not logged in');
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
    await sendEmailVerification(auth.currentUser, {
      url: `${appUrl}/verify-email`,
      handleCodeInApp: false,
    });
  };

  const refreshUserFn = async () => {
    if (!auth.currentUser) throw new Error('Not logged in');
    await reload(auth.currentUser);
    // Force React to see the updated user object
    setUser({ ...auth.currentUser } as User);
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
        sendVerificationEmail: sendVerificationEmailFn,
        refreshUser: refreshUserFn,
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
