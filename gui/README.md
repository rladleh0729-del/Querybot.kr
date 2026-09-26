# QueryBot Audio GUI

Standalone Windows audio converter. Download `QueryBotAudioGUI.exe` from the `querybot-audio-latest` release; a browser extension is optional.

## Playlist workflow

Paste the complete YouTube URL, including `list`, `v`, and `index` when present. Choose MP3, M4A, WAV, or FLAC and load the playlist. The app shows up to 500 returned entries, removes repeated video IDs while preserving first-occurrence order, and displays thumbnails, titles, IDs, and canonical video URLs. Double-click a title to open that video. Select tracks to convert; existing files are detected for the selected output format.

YouTube Mix (`RD...`) is dynamic. Its anonymous response can differ from a signed-in browser. Review the displayed list before converting. The selected snapshot is saved and reused for conversion/resume, so the app does not silently fetch a different Mix later. FLAC stores the decoded audio losslessly but cannot restore quality lost in the original YouTube stream.

## Development and releases

Run `python -m unittest discover -s gui -p test_playlist.py -v` after installing the dependencies listed in `.github/workflows/build-release-assets.yml`.

The Windows workflow tests the playlist logic and selection dialog, builds the standalone executable, and publishes matching source and `QueryBotAudio-build.json` (commit, build run, SHA-256). It moves only the `querybot-audio-latest` tag. Stable backups are not part of this workflow.

`QueryBotAudioSetup.exe`, if present from an older release, is a legacy installer and is not rebuilt by this workflow. Use the standalone GUI executable for the current version.
