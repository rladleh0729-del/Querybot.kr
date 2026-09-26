#define ProductName "QueryBot Audio Native Host"
#define ProductVersion "1.0.0"
#define HostName "com.youtube_flac.converter"

[Setup]
AppId={{27F3B6E2-5B4D-4E11-9B0F-1B497A6C4E2D}
AppName={#ProductName}
AppVersion={#ProductVersion}
DefaultDirName={localappdata}\Programs\QueryBotAudio
DefaultGroupName=QueryBot Audio
UninstallDisplayName={#ProductName}
OutputDir=.
OutputBaseFilename=QueryBotAudioSetup
Compression=lzma2/ultra64
SolidCompression=yes
WizardStyle=modern
PrivilegesRequired=lowest
ArchitecturesAllowed=x64
ArchitecturesInstallIn64BitMode=x64
Uninstallable=yes

[Languages]
Name: "english"; MessagesFile: "compiler:Default.isl"

[Tasks]
Name: "desktopicon"; Description: "Create a desktop shortcut for the download folder"; GroupDescription: "Additional shortcuts:"; Flags: unchecked

[Files]
Source: "dist\native\QueryBotNativeHost.exe"; DestDir: "{app}"; Flags: ignoreversion
Source: "native-host\com.youtube_flac.converter.json.in"; DestDir: "{app}"; DestName: "com.youtube_flac.converter.json.in"; Flags: ignoreversion

[Registry]
Root: HKCU; Subkey: "Software\Google\Chrome\NativeMessagingHosts\{#HostName}"; ValueType: string; ValueName: ""; ValueData: "{app}\com.youtube_flac.converter.json"; Flags: uninsdeletevalue uninsdeletekeyifempty

[Icons]
Name: "{group}\Open audio folder"; Filename: "explorer.exe"; Parameters: "{userdocs}\..\Downloads\YouTube_FLAC"
Name: "{autodesktop}\QueryBot Audio folder"; Filename: "explorer.exe"; Parameters: "{userdocs}\..\Downloads\YouTube_FLAC"; Tasks: desktopicon

[Code]
procedure CurStepChanged(CurStep: TSetupStep);
var
  ManifestText, HostPath: String;
  ManifestBytes: AnsiString;
begin
  if CurStep = ssPostInstall then
  begin
    HostPath := ExpandConstant('{app}\QueryBotNativeHost.exe');
    StringChangeEx(HostPath, '\', '\\', True);
    if not LoadStringFromFile(ExpandConstant('{app}\com.youtube_flac.converter.json.in'), ManifestBytes) then
      RaiseException('Could not read the Native Messaging manifest template.');
    ManifestText := Utf8Decode(ManifestBytes);
    StringChangeEx(ManifestText, '__HOST_EXE_PATH__', HostPath, True);
    if not SaveStringToFile(ExpandConstant('{app}\com.youtube_flac.converter.json'), Utf8Encode(ManifestText), False) then
      RaiseException('Could not write the Native Messaging manifest.');
    DeleteFile(ExpandConstant('{app}\com.youtube_flac.converter.json.in'));
  end;
end;
