import type { MiniMockQuestion } from '../data/miniMockTest';
import { parseMiniMockQuestions } from '../data/miniMockTest';
import { supabase } from './supabase';

export async function fetchMemberMiniMock(): Promise<MiniMockQuestion[]> {
  if (!supabase) throw new Error('Member access is not configured for this deployment.');
  const { data, error } = await supabase.functions.invoke<{ questions?: unknown; error?: string }>('member-mini-mock', { body: {} });
  if (error) throw new Error(error.message || 'Member questions could not be loaded.');
  const questions = parseMiniMockQuestions(data?.questions);
  if (!questions) throw new Error(data?.error || 'The member practice bank is unavailable or invalid.');
  return questions;
}