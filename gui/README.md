# QueryBot Audio GUI

Standalone Windows audio converter. Download `QueryBotAudioGUI.exe` from the `querybot-audio-latest` release; a browser extension is optional.

## Pick a playlist inside the GUI (recommended)

Paste a YouTube URL and click **YouTube에서 목록 선택**. The app opens its own visible YouTube browser; you can also leave the URL empty and search there. Open a playlist or Mix, then click **이 목록 가져오기**. Select tracks in the existing dialog and convert using the chosen MP3/M4A/WAV/FLAC format. No page copying or extension is required.

The app captures the currently rendered playlist rows in their displayed order. Scroll the playlist to load more rows before importing. Hidden panels and recommendations outside the playlist are excluded; navigation during capture invalidates the result. The resulting snapshot is reused for conversion and resume without fetching another Mix.

This browser uses its own app-local storage, not Chrome/Edge/Brave cookies or profiles. Its personalized Mix can differ from an existing external browser, and Google may restrict sign-in in embedded browsers. The visible in-app list is the source of truth. To import an existing external browser's exact list, use the copy method below. The browser runtime is bundled, increasing EXE size. Release verification includes an offline rendered-page extraction check in the packaged EXE.

## Import the exact list shown in your browser (no extension required)

For a personalized YouTube Mix, open the playlist panel in Chrome, Edge or Brave. Click a blank area of the YouTube page (not the address/search box), then press Ctrl+A and Ctrl+C. In QueryBot click **화면 목록 붙여넣기**. The app reads the copied HTML playlist rows, preserving their video IDs, titles and order, then opens the selection dialog. It ignores recommendations elsewhere on the page and never re-queries a Mix for this path. Only rows loaded at copy time are imported; the dialog shows the imported count and original row numbers. For more rows, load them in the browser and copy again.

A copied URL alone cannot carry the browser's current Mix. Plain URLs or text without playlist rows are rejected with instructions; the app does not guess video IDs by searching titles. Raw copied page content is parsed locally and is not saved or sent to a server. If the existing URL field points to a different playlist, clear it or copy the matching list.

## Playlist URL lookup

Paste the complete YouTube URL, including `list`, `v`, and `index` when present. Choose MP3, M4A, WAV, or FLAC and load the playlist. The app shows up to 500 returned entries, removes repeated video IDs while preserving first-occurrence order, and displays thumbnails, titles, IDs, and canonical video URLs. Double-click a title to open that video. Select tracks to convert; existing files are detected for the selected output format.

YouTube Mix (`RD...`) is dynamic. Its anonymous response can differ from a signed-in browser. Review the displayed list before converting. The selected snapshot is saved and reused for conversion/resume, so the app does not silently fetch a different Mix later. FLAC stores the decoded audio losslessly but cannot restore quality lost in the original YouTube stream.

## Development and releases

Run `python -m unittest discover -s gui -p 'test_*.py' -v` after installing the dependencies listed in `.github/workflows/build-release-assets.yml`. The Chrome Native Host is built separately from `native-host/querybot_native_host.py`.

The Windows workflow tests playlist logic, builds both the standalone GUI and the Chrome Native Host, packages `QueryBotAudioSetup.exe` with Inno Setup, and replaces all matching assets in the `querybot-audio-latest` release. The build identity records commit, run, and SHA-256 values for the GUI and Setup.

The Setup installs the Native Host EXE, writes its Chrome manifest with the installed executable path, and registers `com.youtube_flac.converter` under the current user. It supports the Chrome Web Store extension ID in the manifest.

