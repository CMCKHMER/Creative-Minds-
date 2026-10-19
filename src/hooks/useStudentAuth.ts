// React hook for student authentication via Firebase Auth.
// Separate from useMemberAuth (which uses Supabase for teachers).

import { useEffect, useState } from 'react';
import { firebaseConfigured } from '../lib/firebase';
import { onStudentAuthChange, type StudentProfile } from '../lib/studentAuth';

export interface StudentAuthHookState {
  status: 'loading' | 'not-configured' | 'signed-out' | 'signed-in';
  student: StudentProfile | null;
  isConfigured: boolean;
}

export function useStudentAuth(): StudentAuthHookState {
  const [student, setStudent] = useState<StudentProfile | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!firebaseConfigured) {
      setReady(true);
      return;
    }
    const unsub = onStudentAuthChange((s) => {
      setStudent(s);
      setReady(true);
    });
    return () => unsub();
  }, []);

  if (!firebaseConfigured) return { status: 'not-configured', student: null, isConfigured: false };
  if (!ready) return { status: 'loading', student: null, isConfigured: true };
  return {
    status: student ? 'signed-in' : 'signed-out',
    student,
    isConfigured: true,
  };
}
