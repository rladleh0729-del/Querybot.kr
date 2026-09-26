# QueryBot GUI packaging optimization — 2026-09-26

This change repackages the exact uploaded executable, identified by SHA-256
`0274936a1a2bee5b4add1cfc7571a116411a319cdb5e0abb4705cd4b14ed63b5`.
Its six application modules match repository commit
`08988315b8a1208c0d8d0d6dc2ee5628b6a6a422` at the compiled-code level.

The application bytecode, Python runtime, bundled FFmpeg, WebEngine, all yt-dlp
extractors, release browser resources and all translations stay byte-identical.
The optimizer removes unused QML resources, QML debugging/virtual-keyboard plugins,
debug-only browser resources, duplicate yt-dlp source files already in PYZ, and Qt
DLLs that are not reachable from retained native imports or explicit dynamic roots.
Regular and delay-load DLL dependencies are both checked. Original compressed
payloads are copied without recompression and verified with PyInstaller's reader.

Run on Windows with Python 3.12:

```powershell
python -m pip install PyInstaller==6.22.3 pefile==2024.8.26 Pillow==12.3.0 psutil
python tools/optimize_gui.py QueryBotAudioGUI.exe dist/QueryBotAudioGUI_optimized.exe --metadata --report dist/QueryBotAudioGUI_optimization.json
python tools/verify_optimized_gui.py dist/QueryBotAudioGUI_optimized.exe dist/QueryBotAudioGUI_optimization.json
```

The workflow produces an Actions artifact only; it does not modify the public
download release, website or Chrome Native Host. It includes product/version
resources, a validation report and a screenshot of the running Windows GUI.
Product metadata does not constitute an Authenticode signature. Signing requires
the publisher's signing credentials; none are available to this build.

Checks cover archive integrity, DLL dependency closure, packaged startup,
WebEngine rendering and playlist DOM parsing, packaged UI Automation, actual main
window responsiveness and clean close, and FFmpeg encoding/decoding for six output
formats. A live YouTube download and every interactive workflow are outside these
checks. This remains a one-file EXE, so startup still extracts bundled files.

This optimizer deliberately rejects any other input hash. For a later release,
review its source/dependencies and repeat the Windows checks before adapting it.
