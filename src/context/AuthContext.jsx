import { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { seedQuizzesForNewUser } from '../data/quizService';

const AuthContext = createContext(null);

// The URL Supabase will redirect to after email confirmation / password reset.
// VITE_SITE_URL is set in .env for local dev and baked in at build time for production.
const SITE_URL = import.meta.env.VITE_SITE_URL || 'https://matchaorcoffee.github.io/quizly';
const REDIRECT_URL = `${SITE_URL}/`;

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  async function loadProfile(userId) {
    const { data } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single();
    setProfile(data || null);
    // Fire-and-forget: seed example quizzes for brand-new users
    seedQuizzesForNewUser(userId).catch(() => {});
  }

  useEffect(() => {
    // Get initial session — this also picks up the #access_token hash
    // that Supabase appends to the redirect URL after email confirmation.
    supabase.auth.getSession().then(({ data: { session } }) => {
      const u = session?.user ?? null;
      setUser(u);
      if (u) {
        loadProfile(u.id).finally(() => setLoading(false));
      } else {
        setLoading(false);
      }
    });

    // Listen for auth state changes (handles the hash token on landing)
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      const u = session?.user ?? null;
      setUser(u);
      if (u) {
        loadProfile(u.id);
      } else {
        setProfile(null);
      }

      // After Supabase processes the hash token, clean it from the URL
      // so the access_token is not visible in the address bar.
      if (event === 'SIGNED_IN' && window.location.hash.includes('access_token')) {
        window.history.replaceState(null, '', window.location.pathname);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  async function signIn(email, password) {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
    return data;
  }

  async function signUp(email, password, fullName) {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { full_name: fullName },
        // Tell Supabase where to redirect after the user clicks the confirmation link.
        emailRedirectTo: REDIRECT_URL,
      },
    });
    if (error) throw error;
    // Create profile row (trigger also does this — belt-and-suspenders)
    if (data.user) {
      await supabase.from('profiles').upsert({
        id: data.user.id,
        email,
        full_name: fullName,
      });
    }
    return data;
  }

  async function signOut() {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
  }

  async function resetPassword(email) {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: REDIRECT_URL,
    });
    if (error) throw error;
  }

  return (
    <AuthContext.Provider value={{ user, profile, loading, signIn, signUp, signOut, resetPassword }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within an AuthProvider');
  return ctx;
}
