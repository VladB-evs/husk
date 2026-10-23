# HUSK — Official Company Document & Template Studio

**HUSK** is a professional, high-fidelity macOS desktop text editor and template engine designed for creating official company documents and exporting them to publication-grade PDFs.

---

## Key Features

1. **Pixel-Perfect Official Templates**:
   - Starts with a neutral **Starter Template** (company header, metadata table, sign-off card, and confidential footer). Add your own name, logo and colors in Template Studio.
   - Create unlimited custom company templates: set them up once, and use them repeatedly to generate clean documents.

2. **Full-Featured Rich Text Editor with Tables**:
   - Built on modern TipTap / ProseMirror (industry standard for Notion / Linear).
   - Rich typography: Headings (H1, H2, H3), Paragraphs, Bold, Italic, Underline, Strikethrough, Text Color, Highlighter.
   - Comprehensive table controls: Insert tables, add/delete rows & columns, toggle tinted company header rows, merge/split cells.
   - Bulleted lists, numbered lists, blockquotes, horizontal dividers, undo/redo.
   - Pictures: use the Picture button, drop an image on the page, or paste one. Pictures are saved inside the document and appear in the PDF.

3. **Dynamic Company Color Schema**:
   - Company color schema applies automatically across document titles, subtitles, section headers, lines, and table header tints.
   - Quick one-click color palettes (Violet, Royal Indigo, Ocean Cobalt, Forest Emerald, Corporate Slate, Ruby Crimson, Warm Amber) or any custom Hex code.

4. **Reusable Digital Signatures**:
   - Draw your signature directly with a trackpad or mouse using the built-in canvas pad.
   - Or upload your official signature image (transparent PNG or SVG).
   - Saved to your company profile: reusable with 1-click in the sign-off block on every document created.

5. **Native macOS Desktop Experience & PDF Export**:
   - Native macOS frameless window with traffic lights integration (`hiddenInset`).
   - Pixel-perfect Chromium `printToPDF` engine that respects print CSS page margins, colors, and table breaks.
   - Direct save dialog with "Show in Finder" notification.

---

## Where your data lives

Everything is stored as files in `~/Documents/HUSK`. These files are the only copy the app uses.

| Folder | Content |
| --- | --- |
| `Documents/` | One `<id>.husk` file for each document |
| `Templates/` | One `<id>.json` file for each template |
| `Exports/` | Default folder for PDF exports |
| `Recovered/` | Files the app could not read, or older copies of the same item. The app never deletes them. |
| `profile.json` | Your saved signature and default name and role |

- The app writes a file about half a second after your last edit. Edits that are still waiting are written when you close the window.
- Each file is written to a temp file first and then renamed, so a crash cannot leave a half-written file.
- The first start after an upgrade imports the documents that older versions kept in the browser storage.

## How to Launch

### Option 1: Double-Click Launcher
Double-click `Launch HUSK.command` in the project folder.

### Option 2: Terminal
```bash
cd path/to/husk
pnpm start
```

### Option 3: Development Mode
```bash
pnpm app
```

## Tests

```bash
pnpm test        # unit tests: planner, store, print HTML, table widths
pnpm test:e2e    # builds the app, then drives the real app: pages, PDF, tables, storage, restart, security
```

The end-to-end tests use a scratch data folder. They never touch `~/Documents/HUSK`.

## How pages and PDF export work

- The editor shows real A4 pages. Content that would cross a page edge moves to the next page (`src/extensions/planner.ts`).
- The PDF is printed from the same HTML and CSS (`src/shared/`), so pages break at the same places.
- A table keeps its header row together with the first body row, and repeats it on every page the table continues on.
- Text is cut between lines at a page edge, like in Word: at least two lines stay at the bottom and two go to the next page (a three-line paragraph keeps two at the bottom, as Chromium does). This works for paragraphs of any length, lists (between items and between lines), and quotes.
- Rows that share a merged cell (rowspan) always stay on one page.
- The editor uses the page size that Chromium really lays out when it prints (a text column of 674 px). Lines wrap and pages break at the same words as in the PDF. `e2e/split.e2e.test.ts` checks this against real PDFs.
- In a table, Return adds a row below, Shift+Return starts a new line in the cell, and Backspace or Delete in a completely empty row removes the row.
- Known limit: a group of merged rows, or one table row, that is taller than a whole page cannot be kept on one page and runs over the page edge.

## App Modes

- **Editor**: Write and edit documents on A4 pages, with zoom, table tools, and PDF export.
- **Templates**: A gallery of all your templates with live previews. Open one to edit colors, logo, fields, sign-off, and footer.
- **All Documents**: Search, open, duplicate, export, and delete saved documents.

## Making the app and sharing it

HUSK is not signed with an Apple Developer ID (that costs $99 a year), so macOS treats it as coming from an unknown developer. When someone downloads it with a web browser, AirDrop or Mail, macOS blocks the first start, and the user must go to System Settings > Privacy & Security and click "Open Anyway". The install script below avoids this.

### 1. Build

```bash
pnpm package
```

This creates, in `release/`:

| File | Content |
| --- | --- |
| `HUSK-arm64.zip`, `HUSK-x64.zip` | The app for Apple Silicon and Intel Macs (used by the install script) |
| `HUSK-arm64.dmg`, `HUSK-x64.dmg` | The same app as a disk image, for people who download by hand |
| `SHA256SUMS` | Checksums, used by the install script |

The app gets an ad-hoc signature (`build/adhoc-sign.js`). Apple Silicon Macs refuse to start code with no signature at all. An ad-hoc signature is free but does not name a developer.

### 2. Publish

1. Make a release on GitHub and upload the five files above. Keep the file names as they are.
2. `install.sh` downloads from `https://github.com/VladB-evs/husk`. If the repository has another name, change it in `install.sh` and here.

### 3. Tell people to run one line in Terminal

```bash
curl -fsSL https://raw.githubusercontent.com/VladB-evs/husk/main/install.sh | bash
```

The script downloads the right app for the Mac, checks the checksum, puts `HUSK.app` in `~/Applications` (no admin password), and opens it. macOS shows no warning because `curl` does not add the "downloaded from the internet" mark. To update, run the same line again. Documents in `~/Documents/HUSK` are not changed.

People who download the `.dmg` in a browser still see the warning. For them, the fix is either "Open Anyway" in System Settings > Privacy & Security, or this command once:

```bash
xattr -dr com.apple.quarantine /Applications/HUSK.app
```

### Limits

- This is not notarized. A Mac that an IT department locks down (managed Gatekeeper policy) can still block it.
- Apple can change how macOS treats unsigned apps. Check the install on a new macOS version.
- The standard Mac updater (Squirrel.Mac, used by electron-updater) needs a real Apple signature, so HUSK has its own small updater (`electron/updater.ts`). See "How updates work".
- If you ever pay for an Apple Developer account, set `identity` in the `build.mac` part of `package.json` and add notarization. Nothing else changes.

### Releasing an update (one command)

```bash
pnpm release patch -m "What you changed"
```

- `patch` raises 1.0.0 to 1.0.1. Use `minor` (1.1.0) or `major` (2.0.0) for bigger changes, or an exact number such as `1.4.0`. Without a word, it means `patch`.
- `-m "..."` commits all your unsaved changes with that message first. Leave it out if everything is already committed.
- The script raises the version, makes the tag, and pushes. GitHub Actions (`.github/workflows/release.yml`) then runs the unit tests, builds the app for Apple Silicon and Intel, and publishes the release with the five files. The script waits and prints the link when it is done (about 5 to 10 minutes). It needs the `gh` login to wait; without it, it only prints the links.
- Installed copies of HUSK find the new release by themselves (see "How updates work"). The install line still works for a first install or a repair.

The app is never built on your Mac for a release: only the tag is pushed from here, and GitHub Actions does all the building and packaging.

If a build fails, nothing is published. Look at the Actions tab on GitHub, fix the problem, and run `pnpm release` again. A failed version number is skipped; the next run uses the next number.

You can still build on your own Mac with `pnpm package` (the files appear in `release/`).

### How updates work

An installed HUSK asks GitHub for the latest release 5 seconds after it starts, and every 6 hours after that. When the release is newer, a strip under the title bar says so. One click on **Update & restart** does this:

1. Downloads `HUSK-<arch>.zip` and checks it against `SHA256SUMS` from the same release.
2. Unpacks it next to the installed app and checks the signature. Until here the running app is not touched, so a failure leaves it as it was and shows the error in the strip.
3. Saves pending edits, quits, swaps `HUSK.app`, and opens the new version. If the swap fails, the old app comes back.

Notes:
- It only runs in an installed app (`app.isPackaged`). `pnpm app`, `pnpm start` and the end-to-end tests never update.
- The folder that holds `HUSK.app` must be writable by you (`~/Applications` is). If HUSK runs from a place you cannot write to, such as a mounted `.dmg`, the strip shows the error: run the install line once.
- The checksum proves the download arrived whole. It does not prove who made it; that is the same trust as the install line, since both come from this repository's releases.
- The first version that has the updater must still be installed by hand (the install line). After that, updates come by themselves.

## Writing aids

- **Right-click menu:** spelling suggestions and Add to Dictionary for a misspelled word, Cut, Copy, Paste, Select All, and Look Up. macOS adds its own entries to the same menu where it supports them (Writing Tools, AutoFill, Services, Ask Siri). Writing Tools needs macOS 15.1 or newer with Apple Intelligence turned on.
- **Autocorrect:** like on an iPhone. Type a word and a space (or `. , ; : ! ?`) and an obvious typo is fixed. Backspace right after a correction gives your word back and leaves it alone for the rest of the session. The button next to Undo/Redo turns it on or off. It only changes lowercase words, or a capital word at the start of a sentence, and only when the best suggestion is one small edit away. Names, ALL CAPS, words with numbers, and code blocks are never changed. It uses a bundled English dictionary (British or US, from the system language), and words you add with Add to Dictionary are kept.
