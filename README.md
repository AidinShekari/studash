# StuDash

StuDash is a Persian-language Chrome new-tab dashboard for student planning. It combines a Jalali/Gregorian calendar, weekly class schedule, tasks, course notes, quick links, and a focus timer. Optional integrations import class information from Ferdowsi University of Mashhad's Pooya portal and show assignments and quizzes from VU.

> **Beta:** StuDash is distributed as an unpacked Manifest V3 extension. The university integrations depend on those sites' current login flows and may need updates when the portals change.

## Install the release ZIP

1. Download `StuDash-v1.0.0-beta.1.zip` from the [v1.0.0-beta.1 release](https://github.com/AidinShekari/studash/releases/tag/v1.0.0-beta.1) and extract it to a folder you will keep. `manifest.json` should be directly inside that folder.
2. Open `chrome://extensions` in Chrome and turn on **Developer mode**.
3. Select **Load unpacked** and choose the extracted folder.
4. Open a new tab to start StuDash. Pin the extension if you want quick access to its popup.

Chrome reads the extracted files in place. Keep that folder after installation; to update, extract a newer release and use **Reload** on the extension card. If Chrome gives the update a different extension ID, locally stored StuDash data will not transfer automatically.

## Use StuDash

- **Plan your week:** add courses and meeting times to the class schedule. Open a course to keep its assignments, notes, useful links, and attendance count together. The calendar can display Jalali or Gregorian dates.
- **Track work:** add personal tasks by date, review course deadlines, and use the focus timer. The timer can appear as a movable widget on ordinary web pages.
- **Customize the dashboard:** rearrange quick links and change theme, color, spacing, and corner style under **Settings → Appearance**.
- **Connect VU (optional):** open the extension popup, sign in to VU or use an existing browser session, and sync. The dashboard shows courses, assignments, quizzes, and due dates. Change the sync interval and notifications in the dashboard settings, or disconnect from the popup.
- **Import from Pooya (optional):** use the Pooya section in the popup to import your weekly timetable and week parity. It can use the VU credentials you provided, a separate Pooya login, or an existing browser session.
- **View Google Calendar (optional):** select the Google Calendar connection button in the dashboard and authorize read-only access. StuDash displays events; it does not edit your calendar. The link on a VU item opens Google's event creation page for you to review.

The interface is in Persian and is designed for Ferdowsi University of Mashhad students. The core planner works without connecting university or Google accounts.

## Build from source

You need Node.js 20 or newer, npm, and Chrome for the optional browser UI tests. The repository includes the generated CSS and React island used by the extension, so **building is not required to load the checked-out source**.

```bash
git clone https://github.com/AidinShekari/studash.git
cd studash
npm ci
npm run build
npm test
npm run test:browser
```

After changing source files, run `npm run build` and click **Reload** in `chrome://extensions`. `npm run build:css` rebuilds `styles/studash.css`; `npm run build:islands` rebuilds `islands/islands.js`. Both generated files are committed because extension pages load them directly. Set `CHROME_PATH` if the browser test cannot find Chrome automatically.

To load a source checkout, use **Load unpacked** on the repository root, where `manifest.json` lives. Do not select `node_modules` or a parent folder.

## Permissions and local data

StuDash replaces Chrome's new-tab page and stores planner data and appearance settings in `chrome.storage.local`. Its popup uses access to the VU, OAuth, and Pooya domains for sign-in and sync. It requests Google Calendar API access for the optional read-only calendar view. The content script runs on web pages so the movable focus timer can appear there; it does not need a website account for the core dashboard. Alarms, notifications, and an offscreen document support timer and VU updates.

If you sign in with a VU or Pooya password, StuDash stores that password in `chrome.storage.local` in your browser profile so it can reconnect and sync. This is **not encrypted by StuDash**. Using an existing portal session avoids saving a password, although background sync may stop when that session expires. Disconnect from the popup to remove saved portal credentials. Google Calendar access tokens are also stored locally; revoke access in your Google account if needed.

Google Calendar sign-in uses the OAuth client ID in `app.js` and the extension identity defined by `manifest.json`. A fork or repackaged build with a different extension ID needs its own authorized OAuth configuration. VU and Pooya features require access to those university services and are not covered by the automated tests.

## Project layout

| Path | Purpose |
| --- | --- |
| `manifest.json`, `newtab.html`, `popup.html` | Extension entry points |
| `app.js`, `background.js`, `content_script.js` | Dashboard, background work, and floating timer |
| `vu-client.js`, `vu-dashboard.js`, `pooya-client.js` | University portal integrations |
| `jalali.js`, `theme.js`, `appearance.js`, `ui-kit.js` | Date, appearance, and shared UI behavior |
| `styles/src/`, `islands/src/` | CSS and React island source |
| `styles/studash.css`, `islands/islands.js` | Built files required at runtime |
| `tests/` | Date conversion and browser UI tests |

The UI uses HeroUI v3 styles and a small React island for select and date controls. Most of the dashboard is plain JavaScript.

## Credits

Originally developed by Iliya Abdollahzadeh ([email](mailto:iliyaabdollahzade@gmail.com)).
