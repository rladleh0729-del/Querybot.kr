# QueryBot Audio GUI

Standalone Windows audio converter. Download `QueryBotAudioGUI.exe` from the `querybot-audio-latest` release; a browser extension is optional.

## Playlist workflow

Paste the complete YouTube URL, including `list`, `v`, and `index` when present. Choose MP3, M4A, WAV, or FLAC and load the playlist. The app shows up to 500 returned entries, removes repeated video IDs while preserving first-occurrence order, and displays thumbnails, titles, IDs, and canonical video URLs. Double-click a title to open that video. Select tracks to convert; existing files are detected for the selected output format.

YouTube Mix (`RD...`) is dynamic. Its anonymous response can differ from a signed-in browser. Review the displayed list before converting. The selected snapshot is saved and reused for conversion/resume, so the app does not silently fetch a different Mix later. FLAC stores the decoded audio losslessly but cannot restore quality lost in the original YouTube stream.

## Development and releases

Run `python -m unittest discover -s gui -p test_playlist.py -v` after installing the dependencies listed in `.github/workflows/build-release-assets.yml`. The Chrome Native Host is built separately from `native-host/querybot_native_host.py`.

The Windows workflow tests playlist logic, builds both the standalone GUI and the Chrome Native Host, packages `QueryBotAudioSetup.exe` with Inno Setup, and replaces all matching assets in the `querybot-audio-latest` release. The build identity records commit, run, and SHA-256 values for the GUI and Setup.

The Setup installs the Native Host EXE, writes its Chrome manifest with the installed executable path, and registers `com.youtube_flac.converter` under the current user. It supports the Chrome Web Store extension ID in the manifest.
