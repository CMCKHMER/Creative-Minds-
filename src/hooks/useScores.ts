import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import {
  listMyAttempts,
  listBestScoresPerDrill,
  listMyClasses,
  submitDrillAttempt,
} from '../lib/scores';
import type { Class, DrillAttempt, NewDrillAttemptInput, ScoreBestPerDrill } from '../types/scores';

interface UseScoresState {
  ready: boolean;
  signedIn: boolean;
  attempts: DrillAttempt[];
  bestScores: ScoreBestPerDrill[];
  classes: Class[];
}

/**
 * useScores — convenience hook for the CMC React app to load the signed-in
 * user's drill attempts, best scores per drill, and their classes.
 *
 * Returns nothing meaningful when Supabase is not configured.
 */
export function useScores(): UseScoresState & {
  refresh: () => Promise<void>;
  submit: (input: NewDrillAttemptInput) => Promise<DrillAttempt | null>;
} {
  const [state, setState] = useState<UseScoresState>({
    ready: false,
    signedIn: false,
    attempts: [],
    bestScores: [],
    classes: [],
  });

  const load = useCallback(async () => {
    if (!supabase) {
      setState({ ready: true, signedIn: false, attempts: [], bestScores: [], classes: [] });
      return;
    }
    const { data: userData } = await supabase.auth.getUser();
    const signedIn = Boolean(userData?.user);
    if (!signedIn) {
      setState({ ready: true, signedIn: false, attempts: [], bestScores: [], classes: [] });
      return;
    }
    const [attempts, bestScores, classes] = await Promise.all([
      listMyAttempts(50),
      listBestScoresPerDrill(),
      listMyClasses(),
    ]);
    setState({ ready: true, signedIn: true, attempts, bestScores, classes });
  }, []);

  useEffect(() => {
    if (!supabase) {
      setState({ ready: true, signedIn: false, attempts: [], bestScores: [], classes: [] });
      return;
    }
    let mounted = true;
    void load();
    const { data: { subscription } } = supabase.auth.onAuthStateChange(() => {
      if (mounted) void load();
    });
    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, [load]);

  const submit = useCallback(async (input: NewDrillAttemptInput) => {
    const result = await submitDrillAttempt(input);
    // Refresh local state so the new attempt appears immediately
    void load();
    return result;
  }, [load]);

  return { ...state, refresh: load, submit };
}
