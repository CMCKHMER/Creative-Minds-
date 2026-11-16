/**
 * Typed access to `public/assets/js/cmc-google.js` — Google Drive + Classroom.
 *
 * The script is loaded by `index.html` (and can be included by any standalone
 * page). It stays INERT until an OAuth client id is configured in
 * `VITE_GOOGLE_CLIENT_ID`: with no id it loads nothing from Google, makes no
 * network call, and every call rejects with `code: 'not-configured'`. The
 * level-0 `shareToClassroom()` opener always works because it needs no
 * credentials at all.
 *
 * Setup (Google Cloud clicks, scopes, verification tiers):
 * docs/google-classroom-drive.md.
 */

export interface GoogleDriveFile {
  id: string;
  name?: string;
  mimeType?: string;
  webViewLink?: string;
}

export interface GoogleCourse {
  id: string;
  name: string;
  section?: string;
  room?: string;
  courseState?: string;
  ownerId?: string;
}

export interface GoogleCourseWork {
  id: string;
  title?: string;
  state?: string;
  maxPoints?: number;
  alternateLink?: string;
}

export interface GoogleSubmission {
  id: string;
  userId?: string;
  state?: string;
  assignedGrade?: number;
  draftGrade?: number;
  late?: boolean;
}

export interface GoogleAccountToken {
  /** Bearer token value. Never log it. */
  value: string;
  expiresAt: number;
  scopes: string;
}

export interface CmcGoogleClient {
  readonly version: string;
  /** True once a client id is configured. */
  readonly configured: boolean;
  readonly clientId: string;
  readonly scopes: Record<'drive' | 'courses' | 'coursework' | 'courseworkRead' | 'announcements', string>;

  /** Ask the teacher for Google access. Call from a click handler. */
  connect(opts?: { force?: boolean; scopes?: string[]; prompt?: string }): Promise<GoogleAccountToken>;
  disconnect(): Promise<void>;
  /** Disconnect *and* withdraw the grant at Google. */
  revoke(): Promise<void>;
  isConnected(): boolean;

  /** Level 0 — Google's own Classroom share dialog. Needs no credentials. */
  shareToClassroom(url?: string, title?: string): string;

  readonly drive: {
    saveFile(opts: {
      name: string;
      mimeType?: string;
      content?: string;
      /** 'sheet' converts a CSV upload into a Google Sheet. */
      convertTo?: 'sheet';
      parents?: string[];
    }): Promise<GoogleDriveFile>;
    saveCsvAsSheet(opts: { name?: string; csv: string; parents?: string[] }): Promise<GoogleDriveFile>;
  };

  readonly classroom: {
    listCourses(): Promise<GoogleCourse[]>;
    postAssignment(opts: {
      courseId: string;
      title: string;
      description?: string;
      url?: string;
      driveFileId?: string;
      dueDate?: string | Date;
      maxPoints?: number;
      topicId?: string;
      draft?: boolean;
    }): Promise<GoogleCourseWork>;
    postAnnouncement(opts: {
      courseId: string;
      text?: string;
      title?: string;
      url?: string;
      driveFileId?: string;
      draft?: boolean;
    }): Promise<{ id: string }>;
    postMaterial(opts: {
      courseId: string;
      title: string;
      description?: string;
      url?: string;
      driveFileId?: string;
      draft?: boolean;
    }): Promise<{ id: string }>;
    listSubmissions(opts: { courseId: string; courseWorkId: string }): Promise<GoogleSubmission[]>;
    /** Grade passback: the score Classroom shows to the student. */
    setGrade(opts: {
      courseId: string;
      courseWorkId: string;
      submissionId: string;
      grade: number;
    }): Promise<GoogleSubmission>;
  };
}

declare global {
  interface Window {
    CMCG?: CmcGoogleClient;
    CMC_GOOGLE?: CmcGoogleClient;
    CMC_GOOGLE_APP?: { clientId?: string; scopes?: string[] };
  }
}

/**
 * Load `public/assets/js/cmc-google.js` with the build's client id.
 *
 * No id → does nothing at all (no script tag, no Google, no network). Called
 * once from `src/main.tsx`; standalone pages include the script themselves.
 */
export function loadGoogleClient(clientId: string | undefined = import.meta.env.VITE_GOOGLE_CLIENT_ID): void {
  if (typeof window === 'undefined' || !clientId) return;
  if (window.CMCG || document.querySelector('script[data-cmc-google]')) return;
  window.CMC_GOOGLE_APP = { clientId };
  const script = document.createElement('script');
  script.src = new URL('assets/js/cmc-google.js', document.baseURI).href;
  script.async = true;
  script.dataset.cmcGoogle = '';
  document.head.appendChild(script);
}

/** The client, or null when the script is not on the page. */
export function googleClient(): CmcGoogleClient | null {
  if (typeof window === 'undefined') return null;
  return window.CMCG || window.CMC_GOOGLE || null;
}

/** True only when a client id has been configured — gate any Google button on it. */
export function isGoogleConfigured(): boolean {
  return !!googleClient()?.configured;
}
