#ifndef AppVersion
  #error AppVersion not defined
#endif

#ifndef Arch
  #error Arch not defined
#endif

#ifndef OutputArch
  #error OutputArch not defined
#endif

#define AppName "Spicetify"
#define OutputDir "dist"

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
AppVerName={#AppName}
AppVersion={#AppVersion}
VersionInfoVersion={#AppVersion}
AppPublisher=Spicetify
AppPublisherURL=https://spicetify.app
AppSupportURL=https://spicetify.app
AppUpdatesURL=https://spicetify.app
DefaultDirName={localappdata}\Spicetify
DisableProgramGroupPage=yes
PrivilegesRequired=lowest
OutputDir={#OutputDir}
OutputBaseFilename=installer-{#AppVersion}-windows-{#OutputArch}
Compression=lzma2/ultra64
SolidCompression=yes
WizardStyle=modern dynamic windows11
ChangesEnvironment=yes
UsedUserAreasWarning=no
CloseApplications=force
RestartApplications=no
SetupMutex=Spicetify-Installer-Setup

WizardImageFile=installer\spicetify.png
WizardImageFileDynamicDark=installer\spicetify.png
WizardSmallImageFile=installer\spicetify.png
WizardSmallImageFileDynamicDark=installer\spicetify.png

SetupIconFile=installer\spicetify.ico
UninstallDisplayIcon={app}\spicetify.ico

#if Arch == "x64"
ArchitecturesAllowed=x64os
ArchitecturesInstallIn64BitMode=x64os
#elif Arch == "arm64"
ArchitecturesAllowed=arm64
ArchitecturesInstallIn64BitMode=arm64
#endif

[Messages]
ReadyLabel1=Setup is now ready to begin installing Spicetify on your computer.
ReadyLabel2a=Click Install to continue with the installation, or click Back if you want to review or change any settings.
ReadyMemoDir=Destination location:

[Languages]
Name: "english"; MessagesFile: "compiler:Default.isl"

[Tasks]
Name: "addtopath"; Description: "Add to PATH (requires shell restart)"; GroupDescription: "Additional tasks:"; Flags: checkedonce

[Files]
Source: "bin\spicetify.exe"; DestDir: "{app}\bin"; Flags: ignoreversion
Source: "bin\spicetify-daemon.exe"; DestDir: "{app}\bin"; Flags: ignoreversion
Source: "installer\spicetify.ico"; DestDir: "{app}"; Flags: ignoreversion

[Dirs]
Name: "{app}\bin"

[Registry]
Root: HKCU; Subkey: "Software\{#AppName}"; ValueType: string; ValueName: "InstallDir"; ValueData: "{app}"; Flags: uninsdeletekey

[Icons]
Name: "{autoprograms}\Spicetify"; Filename: "{app}\bin\spicetify.exe"; WorkingDir: "{app}"; IconFilename: "{app}\spicetify.ico"

[Run]
Filename: "{app}\bin\spicetify.exe"; Parameters: "init --yes"; WorkingDir: "{app}"; Flags: runhidden; StatusMsg: "Initializing Spicetify..."; Check: IsFreshInstall and not IsUpdating
Filename: "{app}\bin\spicetify.exe"; Parameters: "apply"; WorkingDir: "{app}"; Flags: runhidden; StatusMsg: "Applying Spicetify..."; Check: IsFreshInstall and not IsUpdating
Filename: "{app}\bin\spicetify.exe"; Description: "Launch Spicetify"; Flags: nowait postinstall shellexec; WorkingDir: "{app}"; Check: not IsUpdating

[UninstallRun]
Filename: "{app}\bin\spicetify.exe"; Parameters: "daemon stop"; WorkingDir: "{app}"; Flags: runhidden; RunOnceId: "StopDaemon"
Filename: "{app}\bin\spicetify.exe"; Parameters: "daemon uninstall"; WorkingDir: "{app}"; Flags: runhidden; RunOnceId: "UninstallDaemon"
Filename: "{app}\bin\spicetify.exe"; Parameters: "restore"; WorkingDir: "{app}"; Flags: runhidden; StatusMsg: "Reverting Spicetify changes..."; RunOnceId: "RestoreSpicetify"

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

function SwitchHasValue(Name: string; Value: string): Boolean;
begin
  Result := CompareText(ExpandConstant('{param:' + Name + '}'), Value) = 0;
end;

function IsUpdating(): Boolean;
begin
  Result := SwitchHasValue('update', 'true') and WizardSilent();
end;

function GetInstallDir(Param: string): string;
begin
  Result := ExpandConstant('{app}');
end;

procedure CurStepChanged(CurStep: TSetupStep);
var
  CurrentPath, Entry: string;
begin
  if CurStep = ssPostInstall then
  begin
    if IsUpdating() then
    begin
      SaveStringToFile(ExpandConstant('{app}\updates\versions.txt'), '{#AppVersion}' + #13#10, True);
    end;

    if WizardIsTaskSelected('addtopath') then
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
    end;

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
