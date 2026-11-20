# Reading room (books read on the site)

The Reading room is the page at `#library`. A visitor picks a book from the
shelves and reads it in the browser: turn pages, jump to a chapter, zoom,
change the paper colour, and come back later to the page they left. Nothing
is downloaded to the visitor's device as a file, and no sign-in is needed.

| Part | Where |
| --- | --- |
| The list of books | `public/library/catalog.json` |
| Book files kept on the site | `public/library/books/` |
| The rules (checking the list, page turning, saved place) | `src/lib/library.ts` |
| The page with the shelves | `src/components/LibraryPage.tsx` |
| The reader | `src/components/BookReader.tsx` |
| Tests | `src/tests/library.test.ts` |

## Add a book

1. Check that the school may publish it (see "Rights" below).
2. Put the PDF in `public/library/books/`. Use a short file name in lower
   case with hyphens, for example `my-first-reader.pdf`.
3. Add an entry to the `books` list in `public/library/catalog.json`:

   ```json
   {
     "title": "My First Reader",
     "author": "CMC teachers",
     "shelf": "Kids readers",
     "level": "Kid 7–9",
     "pages": 24,
     "about": "One or two sentences shown on the card.",
     "rights": "CMC original",
     "file": "library/books/my-first-reader.pdf"
   }
   ```

4. Run `npm run build`, commit and merge. The book appears on the next deploy.

No code change is needed. `title`, `rights` and one of `file` or `box` are
required; the rest is optional. `shelf` groups books under the filter chips
(books with the same `shelf` text share a chip). `id` is made from the title
unless you give one; it is the name in the book's address
(`#library/my-first-reader`), so do not change it after sharing a link.
`cover` may name a picture (for example `library/covers/my-first-reader.jpg`);
without one the card draws a plain coloured cover with the title.

An entry with a mistake is left off the shelves and the reason is written to
the browser console as `[library] …`. `npx vitest run src/tests/library.test.ts`
fails if the shipped list has a broken entry or names a file that is missing.

## Two places a book can live

**On the site (`"file"`).** The PDF sits in `public/library/books/` and opens
in the site's own reader, with every feature above. Keep each file small:

- Aim for under 10 MB. The whole file is fetched before the first page shows,
  so a 50 MB book is a long wait and a real cost on mobile data.
- GitHub refuses any single file over 100 MB, and a GitHub Pages site should
  stay under 1 GB in total. Every book is stored twice in this repository
  (`public/` and the built copy in `dist/`).
- Scanned books are the large ones. Shrink them first, for example with
  Ghostscript: `gs -sDEVICE=pdfwrite -dPDFSETTINGS=/ebook -dNOPAUSE -dBATCH -sOutputFile=small.pdf big.pdf`.

`"file"` may also be a full `https://` address of a PDF on another server,
provided that server allows other sites to read it (CORS). Box and Google
Drive share links do not, which is why Box has its own setting.

**In Box (`"box"`).** Give the share link of the file, for example
`"box": "https://app.box.com/s/<share>/file/<file id>"`. The book opens in
Box's own viewer inside the reader frame. This suits very large files. The
site's page turning, chapters, paper colours and saved place do not apply
there, because the pages are drawn by Box. The share link must allow
"People with the link" to view, and embedding must be allowed on the Box
account. This path has not been tried against a live Box file yet.

## Rights

Every entry must carry a `rights` line, and it is shown on the book's card.
Write how the school is allowed to publish the book, for example
"Public domain", "CMC original", "Creative Commons BY 4.0" or
"Licensed from <publisher>".

The site is public: anyone on the internet can open a book placed here.
Published course books, grammar books, exam books and dictionaries are
normally under copyright, and owning a copy does not include the right to
put it online. Only add a book when one of these is true:

- the school or its teachers wrote it;
- it is in the public domain or under an open licence that allows sharing;
- the publisher or author has given written permission.

## How the reader works

- The reader uses pdf.js (`pdfjs-dist`, legacy build). It is loaded only when
  a book is opened, so the rest of the site is no heavier.
- One page is shown on a narrow screen. On a wide screen in landscape the
  cover stands alone and the following pages show in pairs.
- Chapters come from the PDF's bookmarks. A PDF without bookmarks has no
  chapter list.
- The place is saved on the reader's own device (`localStorage`,
  `cmc-library-place:<book id>`). It does not follow them to another device.
- The text of the page on screen is also placed in the page for screen
  readers. A scanned book with no text layer has nothing to read aloud.

## Interactive reader workbooks (Kid 1–11, Phonics & Graded readers)

An entry in `catalog.json` may carry an optional `"workbook": "<id>"` field
matching an entry in `src/data/readerWorkbooks.ts` (including Kid 7–9 in
`src/data/readerWorkbooksUpper.ts`, Kid 10–11 in
`src/data/readerWorkbooksSenior.ts`, K–2 phonics & word-family books in
`src/data/readerWorkbooksPhonics.ts`, standalone graded readers in
`src/data/readerWorkbooksGraded.ts`, and parent/teacher study workshops in
`src/data/readerWorkbooksGuides.ts`). Books with a workbook offer both the
flip-through PDF reader (`#library/<id>`) and a lazy-loaded, auto-graded
workbook (`#library/<id>/workbook`, `src/components/ReaderWorkbook.tsx`)
covering story focus, vocabulary (interactive 6×8, 8×8, and 10×10 word
searches, crossword puzzles, word-part unscrambles, and picture vocabulary),
beginning/middle/end comprehension, graphic organizers (cause & effect,
problem & solution, main idea & events, cause & consequence, and Venn
diagrams), sentence unscramble and error-correction rewrites, story summary,
Book Report story cloze, and a printable one-page Book Report.

- Student progress saves locally under `cmc-reader-wb-state:<id>`.
- **Submit to Teacher** writes to Firestore `drill_attempts` (`drillSource: 'rfc3'`)
  with first-try snapshot tracking and a local retry outbox (`cmc-reader-wb-outbox`).
- Teachers view class scores via `KidHomeworkScores`; students check their own
  score privately via `KidMyHomeworkScore`.
- All eleven Kid 1–11 readers (*The Brave Tin Soldier*, *Hansel and Gretel*,
  *Jack and the Magic Beans*, *The Trojan Horse*, *Daedalus and Icarus*,
  *Heidi*, *Gulliver's Travels*, *Beauty and the Beast*, *The Gift of the Magi*,
  *The Last Lesson*, and *The Count of Monte Cristo*) are also cross-linked
  from the Kid Program page (`#kid-grades`).
- The **Phonics readers** shelf includes *Fill-in-the-Blank Stories: Phonics*
  and *Fill-in-the-Blank Stories: Word Families* (Linda B. Ross, Scholastic
  Teaching Resources, Grades K–2, 60 cleaned student pages each with teacher
  answer keys removed and all 50 stories bookmarked by skill group), paired
  with seven-unit auto-graded workbooks (`#library/fill-in-the-blank-stories-phonics/workbook`
  and `#library/fill-in-the-blank-stories-word-families/workbook`) featuring
  cloze stories, interactive 6×8 word searches, and printable Book Reports.
- The **Graded readers** shelf includes *Tales from the Arabian Nights*
  (Edited by David Foulds, Oxford Progressive English Readers Grade 1,
  1,400 headwords, 64 full-colour pages) with chapter bookmarks, painted cover
  art, and an interactive seven-chapter workbook (`#library/tales-from-the-arabian-nights/workbook`)
  covering all official pp. 54–57 activities (including the *Open Sesame*
  crossword puzzle and word-letter unscrambles) plus a printable Book Report.
- The **Parents & teachers** shelf includes *How to Talk So Kids Will Listen
  & Listen So Kids Will Talk* (Adele Faber & Elaine Mazlish, 30th-Anniversary
  Edition with Joanna Faber's *The Next Generation*, Scribner, 358 pages) with
  chapter and *Quick Reminder* bookmarks, painted cover art, and a 100-item
  seven-chapter interactive communication workshop
  (`#library/how-to-talk-so-kids-will-listen/workbook`) with autosaved
  reflection prompts and a printable summary sheet.
- The **Parents & teachers** shelf also includes *30 Student Activation Tactics
  You Need to Know* (an ESL teacher guide, 45 pages) with 32 bookmarks (Cover,
  Contents, and the 30 guides, linked from the Contents page), painted cover
  art, and a 138-item, seven-part interactive workshop
  (`#library/30-student-activation-tactics/workbook`) with autosaved reflection
  prompts and a printable summary sheet. The source file has no author credit,
  so the catalog author is blank and the workbook header omits it.

## The sample book

`alice-in-wonderland.pdf` is Lewis Carroll's 1865 text, taken from the
Standard Ebooks edition (text in the public domain, edition released under
CC0) and typeset for this site in Crimson Text (SIL Open Font License). It
has no illustrations. Replace or remove it freely.
