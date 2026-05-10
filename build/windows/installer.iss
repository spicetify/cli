#ifndef ProductVersion
  #error ProductVersion not defined
#endif

#ifndef Arch
  #error Arch not defined
#endif

#ifndef OutputArch
  #define OutputArch "amd64"
#endif

#define AppName "Spicetify"
#define AppPublisher "spicetify.app"
#define AppURL "https://spicetify.app"

#if Arch == "x64"
  #define AppId "{{5e60b260-206a-4571-8413-8b8b9bddbf65}"
#elif Arch == "arm64"
  #define AppId "{{d95e1271-27ad-4231-a852-409cdec998e3}"
#else
  #error Unsupported architecture: Arch
#endif

[Setup]
AppId={#AppId}
AppName={#AppName}
AppVersion={#ProductVersion}
AppPublisher={#AppPublisher}
AppPublisherURL={#AppURL}
AppSupportURL={#AppURL}/docs/faq
AppUpdatesURL={#AppURL}
AppReadmeFile={#AppURL}/docs/getting-started
DefaultDirName={localappdata}\Spicetify
DisableProgramGroupPage=yes
DisableWelcomePage=no
PrivilegesRequired=admin
OutputDir=dist
OutputBaseFilename=installer-{#ProductVersion}-windows-{#OutputArch}
Compression=lzma2/ultra64
SolidCompression=yes
WizardStyle=modern
ChangesEnvironment=yes
MinVersion=10.0
UninstallDisplayName={#AppName}
#if Arch == "x64"
ArchitecturesAllowed=x64compatible
ArchitecturesInstallIn64BitMode=x64compatible
#elif Arch == "arm64"
ArchitecturesAllowed=arm64
ArchitecturesInstallIn64BitMode=arm64
#endif
UninstallDisplayIcon={app}\spicetify.ico
UsedUserAreasWarning=no

[Languages]
Name: "english"; MessagesFile: "compiler:Default.isl"

[Files]
Source: "bin\spicetify.exe"; DestDir: "{app}\bin"; Flags: ignoreversion
Source: "bin\st-daemon.xml"; DestDir: "{app}\bin"; Flags: ignoreversion
Source: "installer\spicetify.ico"; DestDir: "{app}"; Flags: ignoreversion

[Dirs]
Name: "{app}\bin"

[Registry]
Root: HKCU; Subkey: "Software\{#AppName}"; ValueType: string; ValueName: "InstallDir"; ValueData: "{app}"; Flags: uninsdeletekey

Root: HKCU; Subkey: "Software\Classes\spicetify"; ValueType: string; ValueData: "URL:spicetify"; Flags: uninsdeletekey
Root: HKCU; Subkey: "Software\Classes\spicetify"; ValueType: string; ValueName: "URL Protocol"
Root: HKCU; Subkey: "Software\Classes\spicetify\shell\open\command"; ValueType: string; ValueData: """{app}\bin\spicetify.exe"" protocol ""%1"""

[Run]
Filename: "{app}\bin\spicetify.exe"; Parameters: "init"; WorkingDir: "{app}"; Flags: runhidden; StatusMsg: "Initializing Spicetify..."; Check: IsFreshInstall
Filename: "{sys}\schtasks.exe"; Parameters: "/Create /TN ""Spicetify daemon"" /XML ""{app}\bin\st-daemon.xml"" /F"; Flags: runhidden; StatusMsg: "Creating scheduled task..."; Check: IsFreshInstall
Filename: "{sys}\schtasks.exe"; Parameters: "/Change /TN ""Spicetify daemon"" /TR ""\""{app}\bin\spicetify.exe\"" daemon"""; Flags: runhidden; StatusMsg: "Configuring daemon..."; Check: IsFreshInstall
Filename: "{sys}\schtasks.exe"; Parameters: "/Run /TN ""Spicetify daemon"""; Flags: runhidden; StatusMsg: "Starting daemon..."; Check: IsFreshInstall

[UninstallRun]
Filename: "{app}\bin\spicetify.exe"; Parameters: "fix"; WorkingDir: "{app}"; Flags: runhidden; StatusMsg: "Reverting Spicetify changes..."; RunOnceId: "FixSpicetify"
Filename: "{sys}\schtasks.exe"; Parameters: "/Delete /TN ""Spicetify daemon"" /F"; Flags: runhidden; RunOnceId: "DeleteDaemonTask"

[Code]
var
  IsFresh: Boolean;

function InitializeSetup: Boolean;
begin
  IsFresh := not RegKeyExists(HKCU, 'Software\{#AppName}');
  Result := True;
end;

function IsFreshInstall: Boolean;
begin
  Result := IsFresh;
end;

procedure CurStepChanged(CurStep: TSetupStep);
var
  CurrentPath, Entry: string;
begin
  if CurStep = ssPostInstall then
  begin
    Entry := ExpandConstant('{app}\bin');

    if RegQueryStringValue(HKCU, 'Environment', 'Path', CurrentPath) then
    begin
      if Pos(';' + UpperCase(Entry) + ';', ';' + UpperCase(CurrentPath) + ';') = 0 then
      begin
        CurrentPath := CurrentPath + ';' + Entry;
        RegWriteExpandStringValue(HKCU, 'Environment', 'Path', CurrentPath);
      end;
    end
    else
      RegWriteExpandStringValue(HKCU, 'Environment', 'Path', Entry);

    RegWriteStringValue(HKCU, 'Software\{#AppName}', 'Installed', '1');
  end;
end;

procedure CurUninstallStepChanged(CurUninstallStep: TUninstallStep);
var
  CurrentPath, Entry, NewPath, Part: string;
  i: Integer;
begin
  if CurUninstallStep = usPostUninstall then
  begin
    Entry := ExpandConstant('{app}\bin');

    if RegQueryStringValue(HKCU, 'Environment', 'Path', CurrentPath) then
    begin
      NewPath := '';
      Part := '';
      for i := 1 to Length(CurrentPath) do
      begin
        if CurrentPath[i] = ';' then
        begin
          if (Part <> '') and (UpperCase(Part) <> UpperCase(Entry)) then
          begin
            if NewPath <> '' then
              NewPath := NewPath + ';';
            NewPath := NewPath + Part;
          end;
          Part := '';
        end
        else
          Part := Part + CurrentPath[i];
      end;
      if (Part <> '') and (UpperCase(Part) <> UpperCase(Entry)) then
      begin
        if NewPath <> '' then
          NewPath := NewPath + ';';
        NewPath := NewPath + Part;
      end;

      RegWriteExpandStringValue(HKCU, 'Environment', 'Path', NewPath);
    end;
  end;
end;
