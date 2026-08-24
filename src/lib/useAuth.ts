import { useCallback, useEffect, useRef, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase } from './supabase';
import type { Profile } from './types';

export function useAuth() {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const profileFetchedFor = useRef<string | null>(null);

  const fetchProfile = useCallback(async (userId: string, email: string | undefined) => {
    const { data: existing } = await supabase.from('profiles').select('*').eq('id', userId).maybeSingle();
    if (existing) {
      setProfile(existing as Profile);
      profileFetchedFor.current = userId;
      return;
    }
    const newProfile = {
      id: userId,
      email: email ?? '',
      full_name: '',
      avatar_color: '#315CFF',
    };
    const { data: created, error } = await supabase.from('profiles').insert(newProfile).select('*').maybeSingle();
    if (!error && created) {
      setProfile(created as Profile);
      profileFetchedFor.current = userId;
    }
  }, []);

  useEffect(() => {
    let active = true;
    supabase.auth.getSession().then(({ data }) => {
      if (!active) return;
      setSession(data.session);
      if (data.session?.user) {
        fetchProfile(data.session.user.id, data.session.user.email);
      }
      setLoading(false);
    });
    const { data } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession);
      if (newSession?.user) {
        if (profileFetchedFor.current !== newSession.user.id) {
          fetchProfile(newSession.user.id, newSession.user.email);
        }
      } else {
        setProfile(null);
        profileFetchedFor.current = null;
      }
    });
    return () => {
      active = false;
      data.subscription.unsubscribe();
    };
  }, [fetchProfile]);

  const signIn = useCallback(async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw new Error(mapAuthError(error.message));
  }, []);

  const signUp = useCallback(async (email: string, password: string, fullName: string) => {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { full_name: fullName } },
    });
    if (error) throw new Error(mapAuthError(error.message));
    if (data.user) {
      await supabase.from('profiles').upsert({
        id: data.user.id,
        email,
        full_name: fullName,
        avatar_color: '#315CFF',
      });
    }
  }, []);

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
    setProfile(null);
    profileFetchedFor.current = null;
  }, []);

  const updateProfile = useCallback(async (patch: Partial<Pick<Profile, 'full_name' | 'avatar_color'>>) => {
    if (!session?.user) return;
    const { data, error } = await supabase.from('profiles').update(patch).eq('id', session.user.id).select('*').maybeSingle();
    if (error) throw new Error('Could not update profile.');
    if (data) setProfile(data as Profile);
  }, [session]);

  return { session, profile, loading, signIn, signUp, signOut, updateProfile };
}

function mapAuthError(message: string): string {
  if (message.includes('Invalid login credentials')) return 'Incorrect email or password.';
  if (message.includes('User already registered')) return 'An account with this email already exists.';
  if (message.includes('Password should be at least')) return 'Password must be at least 6 characters.';
  if (message.includes('Email rate limit')) return 'Too many attempts. Please wait a moment and try again.';
  return 'Something went wrong. Please try again.';
}
