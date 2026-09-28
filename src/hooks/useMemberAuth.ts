import { useEffect, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import type { MemberAccessStatus, MemberProfile } from '../types/member';
import { supabase, supabaseConfigured } from '../lib/supabase';

interface MemberAuthState {
  status: MemberAccessStatus;
  member: MemberProfile | null;
  email: string | null;
  error: string | null;
}

const initialStatus: MemberAccessStatus = supabaseConfigured ? 'loading' : 'not-configured';

export function useMemberAuth() {
  const [session, setSession] = useState<Session | null>(null);
  const [sessionReady, setSessionReady] = useState(!supabaseConfigured);
  const [state, setState] = useState<MemberAuthState>({
    status: initialStatus,
    member: null,
    email: null,
    error: null,
  });

  useEffect(() => {
    if (!supabase) {
      setSessionReady(true);
      setState({ status: 'not-configured', member: null, email: null, error: null });
      return;
    }

    let mounted = true;
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      if (mounted) setSession(nextSession);
    });

    void supabase.auth.getSession().then(({ data, error }) => {
      if (!mounted) return;
      if (error) setState({ status: 'error', member: null, email: null, error: 'We could not restore your sign-in. Please sign in again.' });
      setSession(data.session);
      setSessionReady(true);
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (!sessionReady) return;
    if (!supabase) {
      setState({ status: 'not-configured', member: null, email: null, error: null });
      return;
    }
    if (!session?.user) {
      setState({ status: 'signed-out', member: null, email: null, error: null });
      return;
    }

    if (!session.user.email_confirmed_at) {
      setState({
        status: 'unverified',
        member: null,
        email: session.user.email ?? null,
        error: null,
      });
      return;
    }

    let mounted = true;
    const userId = session.user.id;
    setState({ status: 'loading', member: null, email: session.user.email ?? null, error: null });

    void Promise.all([
      supabase
        .from('member_profiles')
        .select('user_id, member_id, display_name, school_name, role')
        .eq('user_id', userId)
        .maybeSingle(),
      supabase
        .from('member_entitlements')
        .select('user_id, status, expires_at')
        .eq('user_id', userId)
        .eq('status', 'active')
        .maybeSingle(),
    ]).then(([profileResult, entitlementResult]) => {
      if (!mounted) return;
      if (profileResult.error || entitlementResult.error) {
        setState({
          status: 'error',
          member: null,
          email: session.user.email ?? null,
          error: 'We could not verify member access. Please try again.',
        });
        return;
      }

      const profile = profileResult.data;
      const entitlement = entitlementResult.data;
      const entitlementCurrent = entitlement && (!entitlement.expires_at || Date.parse(entitlement.expires_at) > Date.now());
      if (!profile || !entitlementCurrent) {
        setState({ status: 'pending', member: null, email: session.user.email ?? null, error: null });
        return;
      }

      setState({
        status: 'active',
        email: session.user.email ?? null,
        error: null,
        member: {
          userId: profile.user_id,
          memberId: profile.member_id,
          name: profile.display_name,
          email: session.user.email ?? '',
          school: profile.school_name,
          role: profile.role,
        },
      });
    }).catch(() => {
      if (mounted) setState({ status: 'error', member: null, email: session.user.email ?? null, error: 'We could not verify member access. Please try again.' });
    });

    return () => {
      mounted = false;
    };
  }, [session, sessionReady]);

  return { ...state, sessionReady, session, isConfigured: supabaseConfigured };
}