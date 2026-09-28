export interface MemberProfile {
  userId: string;
  name: string;
  email: string;
  school: string;
  role: string;
  memberId: string;
}

export type MemberAccessStatus =
  | 'loading'
  | 'not-configured'
  | 'signed-out'
  | 'unverified'
  | 'pending'
  | 'active'
  | 'error';