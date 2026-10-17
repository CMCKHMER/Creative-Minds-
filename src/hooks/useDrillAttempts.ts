// React hook for real-time drill attempt tracking via Firestore.
// Teachers see live class results; students see their own attempt history.

import { useEffect, useState } from 'react';
import { db, firebaseConfigured } from '../lib/firebase';
import { subscribeToClassAttempts, subscribeToStudentAttempts } from '../lib/firebaseDb';

export function useClassAttempts(classId: string | null) {
  const [attempts, setAttempts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!db || !firebaseConfigured || !classId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    const unsub = subscribeToClassAttempts(classId, (data) => {
      setAttempts(data);
      setLoading(false);
    });
    return () => unsub();
  }, [classId]);

  return { attempts, loading };
}

export function useStudentAttempts(studentUid: string | null) {
  const [attempts, setAttempts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!db || !firebaseConfigured || !studentUid) {
      setLoading(false);
      return;
    }
    setLoading(true);
    const unsub = subscribeToStudentAttempts(studentUid, (data) => {
      setAttempts(data);
      setLoading(false);
    });
    return () => unsub();
  }, [studentUid]);

  return { attempts, loading };
}
