# Announcement board — sharing, links and video

Added Nov 2026 on the owner's request: "allow sharing to facebook and other
popular sites. allow links and video to be uploaded and shared."

## For readers

- **Share** under every post: Facebook, Telegram, WhatsApp, X, LinkedIn,
  email, Copy link, and on a phone "More apps…" (the phone's own share sheet:
  Messenger, TikTok, anything installed). No account on this site is needed.
- Every post has its own address, `…/?post=<id>#announcements`. Opening it
  shows the board at that post, marked with a ring.
- Web addresses typed in a post are links. A post can also carry one attached
  link and one video.
- A video on another site is loaded only after the reader presses play. Until
  then nothing is requested from YouTube, Facebook or TikTok.

## For admins (the composer)

- **Video**: paste the address of a YouTube, Facebook, TikTok, Vimeo or
  Google Drive video, or press **Upload a video** (MP4, WebM or MOV, up to
  100 MB). The composer shows the player before publishing.
  - Facebook and Drive videos must be public, or readers see an error from
    that site inside the player.
  - A short `vm.tiktok.com` address cannot be played; use the full address of
    the video page.
- **Link**: an address and, optionally, the words to show for it.

## What is stored

`announcements/{id}` gained three optional text fields: `videoUrl`, `linkUrl`,
`linkLabel`. Posts written before have none. Only `http` and `https`
addresses are accepted: by the composer, by `firestore.rules`
(`announcementExtrasOk`) and again when a post is shown.

An uploaded video goes to Firebase Storage, `announcements/<admin uid>/<file>`,
and the post keeps its address. `storage.rules` allows uploads by approved
announcement admins only (the same list as posting), video files only, up to
100 MB; anyone with the address can play it; nothing else can be stored.

## Preview cards on Facebook and the others

Those sites do not run the site's JavaScript; they read `<meta>` lines from
the page at the shared address. `scripts/build_share_pages.mjs` runs in the
deploy (after the build) and writes one small page per post:

    news/<id>/index.html   title, first lines and picture of the post
    news/<id>/cover.jpg    the post's picture (or the YouTube still, or the site card)
    news/<id>/share.json   marker the Share menu looks for

The Share menu shares `news/<id>/` when that page exists, otherwise the
`?post=<id>` address. A post published after the last deploy therefore shows
the site's general card until the next deploy (the site deploys daily, and on
every push). To refresh a card Facebook has already cached, paste the address
into Facebook's Sharing Debugger and press "Scrape again".

`index.html` no longer sets `og:url`: with it fixed to the home page, Facebook
treated every address of the site as the home page.

## One-time setup by the site owner

1. Publish `firestore.rules` (Firestore → Rules). Sharing, links and pasted
   video links work without this; it adds the address check on the new fields.
2. For **uploaded** video only:
   - Firebase console → Storage → Get started (the project is on Blaze;
     Storage is billed by what is stored and downloaded).
   - Publish `storage.rules` (Storage → Rules, or
     `npx firebase-tools deploy --only storage`). The console asks once to let
     Storage rules read Firestore; accept, it is how the admin list is checked.
   Until this is done, "Upload a video" answers that upload is not switched
   on, and pasted links keep working.

## Checks

- `npx vitest run src/tests/announcementMedia.test.ts`
- `npm run build && npm run verify:announcements` — readers, sharing, shared
  addresses, the composer, upload, phone and light theme, in browsers against
  an in-memory database and a stand-in for Storage.

Not exercised against the real services: `storage.rules` and the Storage
upload call, the Firestore rules, and the deploy step reading the live
database. Publish one test post with an uploaded video after setup.
