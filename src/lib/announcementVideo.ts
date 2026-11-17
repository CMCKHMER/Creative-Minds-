// Uploading a video file for an announcement.
//
// A video is far too large for a database document (the picture of a post is
// shrunk into one; a video cannot be), so the file goes to the site's Firebase
// Storage bucket under announcements/<admin uid>/ and the post keeps its
// address. Who may upload is decided by storage.rules: approved announcement
// admins only, video files only, up to VIDEO_MAX_BYTES.
//
// Storage has to be switched on once by the site owner (docs/announcements.md).
// Until then an upload is refused and the composer says so; pasting a video
// link (YouTube, Facebook, TikTok…) works without it.
import { firebaseConfig } from './firebase';

/** Largest video the board accepts (storage.rules checks the same number). */
export const VIDEO_MAX_BYTES = 100 * 1024 * 1024;
const TYPES = ['video/mp4', 'video/webm', 'video/quicktime', 'video/x-m4v', 'video/ogg'];
const ENDING: Record<string, string> = { 'video/mp4': 'mp4', 'video/webm': 'webm', 'video/quicktime': 'mov', 'video/x-m4v': 'm4v', 'video/ogg': 'ogv' };

/** Why a picked file cannot be uploaded — null when it can. */
export function videoFileProblem(file: { type: string; size: number }): string | null {
  if (!TYPES.includes(file.type)) return 'That file is not a video the board can play. Choose an MP4, WebM or MOV file.';
  if (file.size > VIDEO_MAX_BYTES) return `That video is too large (${Math.round(file.size / 1048576)} MB). The limit is ${VIDEO_MAX_BYTES / 1048576} MB — shorten it, or put it on YouTube or Facebook and paste the link.`;
  if (file.size === 0) return 'That file is empty.';
  return null;
}

/** Where an upload is stored: announcements/<uid>/<time>-<random>.<ending>. */
export function videoObjectPath(uid: string, type: string, now = Date.now(), random = Math.random()): string {
  const tag = Math.floor(random * 0xffffff).toString(16).padStart(6, '0');
  return `announcements/${uid}/${now}-${tag}.${ENDING[type] ?? 'mp4'}`;
}

/** The public address of a stored object. */
export function videoDownloadUrl(bucket: string, path: string, token = ''): string {
  return `https://firebasestorage.googleapis.com/v0/b/${bucket}/o/${encodeURIComponent(path)}?alt=media${token ? `&token=${encodeURIComponent(token)}` : ''}`;
}

/** What to tell the admin when the upload was refused. */
export function uploadProblem(status: number): string {
  if (status === 401 || status === 403) return 'The video was refused. Video upload has to be switched on once for this site (Firebase Storage and its rules) — until then, paste a video link instead.';
  if (status === 404 || status === 400 || status === 412) return 'Video upload is not switched on for this site yet (Firebase Storage). Paste a video link instead.';
  if (status === 0) return 'The upload stopped. Check the connection and try again.';
  return `The video could not be uploaded (error ${status}). Try again, or paste a video link instead.`;
}

/**
 * Upload one video file and return its public address.
 * `onProgress` receives 0…1 while the file is sent. Reject with a readable
 * message when the file is unsuitable or the upload is refused.
 */
export function uploadAnnouncementVideo(
  file: File,
  who: { uid: string; idToken: string },
  onProgress?: (fraction: number) => void,
  signal?: AbortSignal,
): Promise<string> {
  return new Promise((resolve, reject) => {
    const problem = videoFileProblem(file);
    if (problem) { reject(new Error(problem)); return; }
    const bucket = firebaseConfig.storageBucket;
    if (!bucket) { reject(new Error(uploadProblem(404))); return; }
    const path = videoObjectPath(who.uid, file.type);
    const xhr = new XMLHttpRequest();
    xhr.open('POST', `https://firebasestorage.googleapis.com/v0/b/${bucket}/o?uploadType=media&name=${encodeURIComponent(path)}`);
    xhr.setRequestHeader('Authorization', `Firebase ${who.idToken}`);
    xhr.setRequestHeader('Content-Type', file.type);
    xhr.upload.onprogress = (e) => { if (e.lengthComputable && onProgress) onProgress(Math.min(1, e.loaded / e.total)); };
    xhr.onerror = () => reject(new Error(uploadProblem(0)));
    xhr.onabort = () => reject(new Error('Upload cancelled.'));
    xhr.onload = () => {
      if (xhr.status < 200 || xhr.status >= 300) { reject(new Error(uploadProblem(xhr.status))); return; }
      let token = '';
      try { token = String(JSON.parse(xhr.responseText || '{}').downloadTokens || '').split(',')[0]; } catch { /* the address works without it when reading is public */ }
      resolve(videoDownloadUrl(bucket, path, token));
    };
    signal?.addEventListener('abort', () => xhr.abort());
    xhr.send(file);
  });
}
