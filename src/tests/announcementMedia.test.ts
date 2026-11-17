// Announcement board: links, video and sharing (Nov 2026).
//
// Owner request: "allow sharing to facebook and other popular sites. allow
// links and video to be uploaded and shared."
import { execFileSync } from 'node:child_process';
import { existsSync, mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  excerpt, hostLabel, linkify, parseVideo, postAppUrl, postIdFromSearch, postSharePageUrl, safeHttpUrl, shareTargets, URL_MAX,
} from '../lib/announcementMedia';
import { uploadProblem, VIDEO_MAX_BYTES, videoDownloadUrl, videoFileProblem, videoObjectPath } from '../lib/announcementVideo';
import { parseAnnouncementDoc } from '../components/AnnouncementBoard';

const read = (p: string) => readFileSync(resolve(process.cwd(), p), 'utf8');

describe('which addresses a post may carry', () => {
  it('accepts web addresses and completes a bare one', () => {
    expect(safeHttpUrl('https://example.com/a?b=1')).toBe('https://example.com/a?b=1');
    expect(safeHttpUrl('  http://example.com  ')).toBe('http://example.com/');
    expect(safeHttpUrl('www.example.com/page')).toBe('https://www.example.com/page');
    expect(safeHttpUrl('example.org')).toBe('https://example.org/');
  });

  it('refuses anything that is not a web address', () => {
    for (const bad of ['javascript:alert(1)', 'JAVASCRIPT:alert(1)', 'data:text/html;base64,PGI+', 'vbscript:x', 'file:///etc/passwd',
      'mailto:a@b.co', 'ftp://example.com/x', 'hello', 'two words.com', '', null, undefined, 'https://user:pw@example.com/', 'https://localhost/x']) {
      expect(safeHttpUrl(bad), String(bad)).toBe('');
    }
    expect(safeHttpUrl(`https://example.com/${'a'.repeat(URL_MAX)}`)).toBe('');
  });

  it('shows where a link goes', () => {
    expect(hostLabel('https://www.facebook.com/cmc')).toBe('facebook.com');
  });
});

describe('a video address becomes a player', () => {
  it('YouTube: watch, short link, Shorts, live', () => {
    const want = 'https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ?rel=0';
    for (const url of ['https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=10s', 'https://youtu.be/dQw4w9WgXcQ?si=abc', 'https://m.youtube.com/watch?v=dQw4w9WgXcQ',
      'https://www.youtube.com/embed/dQw4w9WgXcQ', 'https://www.youtube.com/live/dQw4w9WgXcQ', 'youtube.com/watch?v=dQw4w9WgXcQ']) {
      const v = parseVideo(url);
      expect(v?.provider, url).toBe('youtube');
      expect(v?.src, url).toBe(want);
      expect(v?.poster).toBe('https://i.ytimg.com/vi/dQw4w9WgXcQ/hqdefault.jpg');
    }
    expect(parseVideo('https://www.youtube.com/shorts/dQw4w9WgXcQ')?.portrait).toBe(true);
    expect(parseVideo('https://www.youtube.com/@cmc')).toBeNull();
  });

  it('Facebook: videos, watch, reels, fb.watch, share links', () => {
    for (const url of ['https://www.facebook.com/cmckhmer/videos/1234567890/', 'https://www.facebook.com/watch/?v=1234567890', 'https://fb.watch/abCdEf/',
      'https://www.facebook.com/reel/1234567890', 'https://www.facebook.com/share/v/1AbCdEf/', 'https://m.facebook.com/watch/?v=1234567890']) {
      const v = parseVideo(url);
      expect(v?.provider, url).toBe('facebook');
      expect(v?.src.startsWith('https://www.facebook.com/plugins/video.php?href=https%3A%2F%2F'), url).toBe(true);
    }
    // a Facebook page or post is a link, not a video
    expect(parseVideo('https://www.facebook.com/cmckhmer')).toBeNull();
  });

  it('TikTok, Vimeo and Google Drive', () => {
    expect(parseVideo('https://www.tiktok.com/@cmc/video/7301234567890123456')?.src).toBe('https://www.tiktok.com/embed/v2/7301234567890123456');
    expect(parseVideo('https://vm.tiktok.com/ZSabc/')).toBeNull();
    expect(parseVideo('https://vimeo.com/123456789')?.src).toBe('https://player.vimeo.com/video/123456789');
    expect(parseVideo('https://drive.google.com/file/d/1AbCdEfGhIjKlMnOp/view?usp=sharing')?.src).toBe('https://drive.google.com/file/d/1AbCdEfGhIjKlMnOp/preview');
  });

  it('a video file, and a video the board uploaded', () => {
    expect(parseVideo('https://example.com/clips/assembly.mp4')?.mode).toBe('file');
    const stored = videoDownloadUrl('bucket.example', 'announcements/uid-1/1700000000000-0a1b2c.mp4', 'tok');
    expect(parseVideo(stored)).toMatchObject({ provider: 'file', mode: 'file', src: stored });
  });

  it('is not fooled by other addresses', () => {
    for (const url of ['https://example.com/watch?v=dQw4w9WgXcQ', 'https://notyoutube.com/watch?v=dQw4w9WgXcQ', 'https://youtube.com.evil.io/watch?v=dQw4w9WgXcQ',
      'javascript:alert(1)', 'https://example.com/page.html', '']) {
      expect(parseVideo(url), url).toBeNull();
    }
    // every player address is on the video site itself
    for (const url of ['https://youtu.be/dQw4w9WgXcQ', 'https://vimeo.com/123456789', 'https://fb.watch/abCdEf/', 'https://www.tiktok.com/@a/video/7301234567890123456', 'https://drive.google.com/file/d/1AbCdEfGhIjKlMnOp/view']) {
      expect(new URL(parseVideo(url)!.src).hostname, url).toMatch(/^(www\.youtube-nocookie\.com|player\.vimeo\.com|www\.facebook\.com|www\.tiktok\.com|drive\.google\.com)$/);
    }
  });
});

describe('addresses in the text become links', () => {
  it('finds them and leaves the sentence punctuation outside', () => {
    expect(linkify('Sign up at https://example.com/form. Thanks!')).toEqual([
      { text: 'Sign up at ' }, { text: 'https://example.com/form', url: 'https://example.com/form' }, { text: '. Thanks!' },
    ]);
    expect(linkify('(see www.example.com)')).toEqual([
      { text: '(see ' }, { text: 'www.example.com', url: 'https://www.example.com/' }, { text: ')' },
    ]);
    expect(linkify('https://en.wikipedia.org/wiki/Angkor_(disambiguation)')[0].url).toBe('https://en.wikipedia.org/wiki/Angkor_(disambiguation)');
  });

  it('keeps every character of the text, in order', () => {
    for (const text of ['no links here', 'a https://a.co b http://b.co, c', 'line one\nhttps://example.com\nline three', 'ends with https://example.com!!', '']) {
      expect(linkify(text).map((p) => p.text).join(''), text).toBe(text);
    }
  });

  it('never makes a link out of script', () => {
    expect(linkify('click javascript:alert(1) now').some((p) => p.url)).toBe(false);
  });
});

describe('the address of one post', () => {
  it('opens the board at the post', () => {
    expect(postAppUrl('https://cmckhmer.github.io/Creative-Minds-/', 'abc123')).toBe('https://cmckhmer.github.io/Creative-Minds-/?post=abc123#announcements');
    expect(postAppUrl('https://cmckhmer.github.io/Creative-Minds-/#games', 'abc123')).toBe('https://cmckhmer.github.io/Creative-Minds-/?post=abc123#announcements');
    expect(postSharePageUrl('https://cmckhmer.github.io/Creative-Minds-', 'abc123')).toBe('https://cmckhmer.github.io/Creative-Minds-/post/abc123/');
  });

  it('reads the post back from the address, and nothing odd', () => {
    expect(postIdFromSearch('?post=abc123')).toBe('abc123');
    expect(postIdFromSearch('?utm=x&post=AbC_1-2')).toBe('AbC_1-2');
    expect(postIdFromSearch('?post=../../x')).toBe('');
    expect(postIdFromSearch('?post=<script>')).toBe('');
    expect(postIdFromSearch('')).toBe('');
  });

  it('the app opens the Announcements page for a shared link without its # part', () => {
    expect(read('src/App.tsx')).toContain("postIdFromSearch(window.location.search)");
  });
});

describe('share links', () => {
  const url = 'https://cmckhmer.github.io/Creative-Minds-/post/abc123/';
  const targets = shareTargets(url, 'School reopens & new timetable');

  it('offers Facebook first, then the other popular sites', () => {
    expect(targets.map((t) => t.id)).toEqual(['facebook', 'telegram', 'whatsapp', 'x', 'linkedin', 'email']);
  });

  it('hands each site the address of the post', () => {
    const by = Object.fromEntries(targets.map((t) => [t.id, t.href]));
    expect(by.facebook).toBe(`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`);
    expect(by.telegram).toBe(`https://t.me/share/url?url=${encodeURIComponent(url)}&text=School%20reopens%20%26%20new%20timetable`);
    expect(by.whatsapp.startsWith('https://wa.me/?text=School%20reopens%20%26%20new%20timetable%0Ahttps%3A')).toBe(true);
    expect(by.x).toContain(`url=${encodeURIComponent(url)}`);
    expect(by.linkedin).toBe(`https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(url)}`);
    expect(by.email.startsWith('mailto:?subject=School%20reopens')).toBe(true);
    for (const t of targets) expect(t.href, t.id).not.toMatch(/[\s<>"]/);
  });

  it('the home page does not pin every shared link to the home address', () => {
    // with og:url fixed to the home page, Facebook sends every shared post there
    expect(read('index.html')).not.toMatch(/property="og:url"/);
  });
});

describe('preview text', () => {
  it('is one line, cut at a word', () => {
    expect(excerpt('Short.\n\nSecond line.')).toBe('Short. Second line.');
    const long = excerpt('word '.repeat(100), 50);
    expect(long.length).toBeLessThanOrEqual(51);
    expect(long.endsWith('…')).toBe(true);
    expect(long).not.toMatch(/\s…$/);
  });
});

describe('uploading a video', () => {
  it('accepts video files up to the limit', () => {
    expect(videoFileProblem({ type: 'video/mp4', size: 5_000_000 })).toBeNull();
    expect(videoFileProblem({ type: 'video/quicktime', size: VIDEO_MAX_BYTES })).toBeNull();
    expect(videoFileProblem({ type: 'video/mp4', size: VIDEO_MAX_BYTES + 1 })).toMatch(/too large/);
    expect(videoFileProblem({ type: 'image/png', size: 1000 })).toMatch(/not a video/);
    expect(videoFileProblem({ type: 'text/html', size: 1000 })).toMatch(/not a video/);
    expect(videoFileProblem({ type: 'video/mp4', size: 0 })).toMatch(/empty/);
  });

  it('stores it in the uploader’s own folder under a fresh name', () => {
    expect(videoObjectPath('uid-1', 'video/mp4', 1700000000000, 0.5)).toBe('announcements/uid-1/1700000000000-7fffff.mp4');
    expect(videoObjectPath('uid-1', 'video/quicktime', 1, 0)).toBe('announcements/uid-1/1-000000.mov');
    expect(videoDownloadUrl('b.example', 'announcements/uid-1/1-000000.mov')).toBe('https://firebasestorage.googleapis.com/v0/b/b.example/o/announcements%2Fuid-1%2F1-000000.mov?alt=media');
  });

  it('says what to do when upload is not switched on', () => {
    expect(uploadProblem(403)).toMatch(/paste a video link/i);
    expect(uploadProblem(404)).toMatch(/not switched on/i);
    expect(uploadProblem(0)).toMatch(/connection/i);
  });

  it('the storage rules allow only an announcement admin, only video, only up to the limit', () => {
    const rules = read('storage.rules');
    expect(rules).toContain('match /announcements/{uid}/{fileName}');
    expect(rules).toContain('request.auth.uid == uid');
    expect(rules).toContain(`request.resource.size <= ${VIDEO_MAX_BYTES / 1048576} * 1024 * 1024`);
    expect(rules).toContain("request.resource.contentType.matches('video/(mp4|webm|quicktime|x-m4v|ogg)')");
    expect(rules).toMatch(/match \/\{allPaths=\*\*\} \{\s+allow read, write: if false;/);
    expect(rules).toContain('allow list: if false;');
    // the same owner account as the database rules
    const owner = /request\.auth\.uid == '([A-Za-z0-9]{20,})'/.exec(read('firestore.rules'))?.[1];
    expect(owner).toBeTruthy();
    expect(rules).toContain(`request.auth.uid == '${owner}'`);
    expect(JSON.parse(read('firebase.json')).storage).toEqual({ rules: 'storage.rules' });
  });
});

describe('what a post stores', () => {
  const doc = (fields: Record<string, unknown>) => ({
    name: 'projects/p/databases/(default)/documents/announcements/post-1',
    fields: { title: { stringValue: 'T' }, body: { stringValue: 'B' }, createdAt: { timestampValue: '2026-11-01T00:00:00Z' }, ...fields },
  });

  it('reads the video and the link', () => {
    const a = parseAnnouncementDoc(doc({ videoUrl: { stringValue: 'https://youtu.be/dQw4w9WgXcQ' }, linkUrl: { stringValue: 'https://example.com/form' }, linkLabel: { stringValue: 'Sign-up form' } }));
    expect(a).toMatchObject({ videoUrl: 'https://youtu.be/dQw4w9WgXcQ', linkUrl: 'https://example.com/form', linkLabel: 'Sign-up form' });
  });

  it('an older post simply has none', () => {
    expect(parseAnnouncementDoc(doc({}))).toMatchObject({ videoUrl: '', linkUrl: '', linkLabel: '' });
  });

  it('drops an address that is not a web address, whatever the database holds', () => {
    const a = parseAnnouncementDoc(doc({ videoUrl: { stringValue: 'javascript:alert(1)' }, linkUrl: { stringValue: 'data:text/html,<script>x</script>' } }));
    expect(a).toMatchObject({ videoUrl: '', linkUrl: '' });
  });

  it('the database rules accept only web addresses in the new fields', () => {
    const rules = read('firestore.rules');
    const fn = rules.slice(rules.indexOf('function announcementExtrasOk'), rules.indexOf('match /announcements/{postId}'));
    expect(fn).toContain("d.get('videoUrl', '').matches('(https?://.+)?')");
    expect(fn).toContain("d.get('linkUrl', '').matches('(https?://.+)?')");
    expect(fn).toContain(`d.get('videoUrl', '').size() <= ${URL_MAX}`);
    const block = rules.slice(rules.indexOf('match /announcements/{postId}'), rules.indexOf('match /site_config/{configId}'));
    expect(block.match(/announcementExtrasOk\(request\.resource\.data\)/g)?.length).toBe(2);
    expect(block).toContain('allow read: if true;');
  });

  it('links open in a new tab without handing the other site a way back', () => {
    const ui = read('src/components/AnnouncementExtras.tsx');
    const anchors = ui.match(/<a\b[^>]*>/gs) ?? [];
    expect(anchors.length).toBeGreaterThanOrEqual(3);
    for (const a of anchors) {
      expect(a).toContain('target="_blank"');
      expect(a).toMatch(/rel="noopener noreferrer/);
    }
    // nothing is requested from a video site until the reader presses play
    expect(ui).toMatch(/\{playing \? \(\s*<iframe/);
  });
});

describe('preview pages for shared posts (scripts/build_share_pages.mjs)', () => {
  const PNG = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==';
  const fixture = {
    documents: [
      { name: 'x/announcements/postA1', fields: { title: { stringValue: 'Sports day <moved> & "new" time' }, body: { stringValue: 'Sports day moves to Friday.\nBring a hat.' }, imageUrl: { stringValue: `data:image/png;base64,${PNG}` }, createdAt: { timestampValue: '2026-11-10T02:00:00Z' } } },
      { name: 'x/announcements/postB2', fields: { title: { stringValue: 'Watch the assembly' }, body: { stringValue: 'Recording inside.' }, imageUrl: { stringValue: '' }, videoUrl: { stringValue: 'https://youtu.be/dQw4w9WgXcQ' } } },
      { name: 'x/announcements/postC3', fields: { title: { stringValue: 'Plain' }, body: { stringValue: '</script><script>alert(1)</script>' } } },
      { name: 'x/announcements/..%2Fevil', fields: { title: { stringValue: 'bad id' }, body: { stringValue: 'x' } } },
      { name: 'x/announcements/postD4', fields: { title: { stringValue: '   ' }, body: { stringValue: 'no title' } } },
    ],
  };

  const run = (extra: string[] = []) => {
    const dir = mkdtempSync(join(tmpdir(), 'cmc-share-'));
    const out = join(dir, 'dist');
    mkdirSync(out);
    const from = join(dir, 'posts.json');
    writeFileSync(from, JSON.stringify(fixture));
    const log = execFileSync(process.execPath, ['scripts/build_share_pages.mjs', '--from', from, '--out', out, ...extra], {
      cwd: process.cwd(), encoding: 'utf8', env: { ...process.env, SITE_URL: 'https://cmckhmer.github.io/Creative-Minds-/' },
    });
    return { dir, out, log };
  };

  it('writes one page per post with the post’s own title, text and picture', () => {
    const { dir, out, log } = run();
    try {
      expect(log).toContain('wrote 3 pages');
      const a = readFileSync(join(out, 'post/postA1/index.html'), 'utf8');
      expect(a).toContain('<meta property="og:title" content="Sports day &lt;moved&gt; &amp; &quot;new&quot; time" />');
      expect(a).toContain('<meta property="og:description" content="Sports day moves to Friday. Bring a hat." />');
      expect(a).toContain('<meta property="og:url" content="https://cmckhmer.github.io/Creative-Minds-/post/postA1/" />');
      expect(a).toContain('<meta property="og:image" content="https://cmckhmer.github.io/Creative-Minds-/post/postA1/cover.png" />');
      expect(a).toContain('location.replace("https://cmckhmer.github.io/Creative-Minds-/?post=postA1#announcements");');
      expect(readFileSync(join(out, 'post/postA1/cover.png')).subarray(1, 4).toString()).toBe('PNG');
      expect(JSON.parse(readFileSync(join(out, 'post/postA1/share.json'), 'utf8')).id).toBe('postA1');
      // a post with a YouTube video and no picture uses the video's still
      expect(readFileSync(join(out, 'post/postB2/index.html'), 'utf8')).toContain('content="https://i.ytimg.com/vi/dQw4w9WgXcQ/hqdefault.jpg"');
      // a post with neither uses the site's card
      const c = readFileSync(join(out, 'post/postC3/index.html'), 'utf8');
      expect(c).toContain('content="https://cmckhmer.github.io/Creative-Minds-/images/og-card.jpg"');
      // text from a post can never close the page's script or add one
      expect(c.match(/<script>/g)?.length).toBe(1);
      expect(c).toContain('&lt;/script&gt;&lt;script&gt;alert(1)&lt;/script&gt;');
      // a post without a title, or with an id that is not a plain name, gets no page
      expect(existsSync(join(out, 'post/postD4'))).toBe(false);
      expect(existsSync(join(dir, 'evil'))).toBe(false);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('clears only its own pages: the headlines feed and anything else in the build stay', () => {
    const dir = mkdtempSync(join(tmpdir(), 'cmc-share-'));
    try {
      const out = join(dir, 'dist');
      mkdirSync(join(out, 'news'), { recursive: true });
      writeFileSync(join(out, 'news/headlines.json'), '{"items":[]}');
      const from = join(dir, 'posts.json');
      writeFileSync(from, JSON.stringify(fixture));
      const go = () => execFileSync(process.execPath, ['scripts/build_share_pages.mjs', '--from', from, '--out', out], { cwd: process.cwd(), encoding: 'utf8' });
      go();
      // a second deploy: a post that was deleted loses its page
      mkdirSync(join(out, 'post/gone'));
      writeFileSync(join(out, 'post/gone/share.json'), '{"id":"gone"}');
      expect(go()).toContain('wrote 3 pages');
      expect(existsSync(join(out, 'post/gone'))).toBe(false);
      expect(existsSync(join(out, 'post/postA1/index.html'))).toBe(true);
      expect(readFileSync(join(out, 'news/headlines.json'), 'utf8')).toBe('{"items":[]}');
      // a file in post/ that the script did not write stops it instead of being deleted
      writeFileSync(join(out, 'post/keep.txt'), 'mine');
      expect(go()).toContain('skipped');
      expect(readFileSync(join(out, 'post/keep.txt'), 'utf8')).toBe('mine');
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('does not use a folder the site already has', () => {
    expect(existsSync(resolve(process.cwd(), 'public/post'))).toBe(false);
    expect(existsSync(resolve(process.cwd(), 'public/news/headlines.json'))).toBe(true);
  });

  it('never fails the deploy when the posts cannot be read', () => {
    const log = execFileSync(process.execPath, ['scripts/build_share_pages.mjs', '--from', '/nonexistent/posts.json'], { cwd: process.cwd(), encoding: 'utf8' });
    expect(log).toContain('skipped');
  });

  it('runs in the deploy, after the build', () => {
    const flow = read('.github/workflows/static.yml');
    expect(flow.indexOf('node scripts/build_share_pages.mjs')).toBeGreaterThan(flow.indexOf('run: npm run build'));
    expect(flow.indexOf('node scripts/build_share_pages.mjs')).toBeLessThan(flow.indexOf('actions/upload-pages-artifact'));
  });
});
