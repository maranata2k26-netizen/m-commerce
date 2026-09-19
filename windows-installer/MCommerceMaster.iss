#define MyAppName "M Commerce - Panel Maestro"
#define MyAppVersion "1.0.0"
#define MyAppPublisher "M Commerce"
#define MyAppURL "https://m-commerce-ar.vercel.app/app-maestro/panel"

[Setup]
AppId={{D6B33893-CC19-4D7A-8A2E-AF4555B1893A}
AppName={#MyAppName}
AppVersion={#MyAppVersion}
AppPublisher={#MyAppPublisher}
AppPublisherURL={#MyAppURL}
AppSupportURL={#MyAppURL}
DefaultDirName={localappdata}\Programs\M Commerce\Panel Maestro
DisableProgramGroupPage=yes
PrivilegesRequired=lowest
OutputDir=output
OutputBaseFilename=M-Commerce-Panel-Maestro-Setup
SetupIconFile=icon.ico
UninstallDisplayIcon={app}\icon.ico
Compression=lzma2
SolidCompression=yes
WizardStyle=modern
ArchitecturesAllowed=x64compatible
CloseApplications=no
RestartApplications=no
AllowNoIcons=yes
CreateAppDir=yes

[Languages]
Name: "spanish"; MessagesFile: "compiler:Languages\Spanish.isl"

[Files]
Source: "launcher.vbs"; DestDir: "{app}"; Flags: ignoreversion
Source: "icon.ico"; DestDir: "{app}"; Flags: ignoreversion

[Icons]
Name: "{autodesktop}\M Commerce - Panel Maestro"; Filename: "{sys}\wscript.exe"; Parameters: """{app}\launcher.vbs"""; WorkingDir: "{app}"; IconFilename: "{app}\icon.ico"; Tasks: desktopicon
Name: "{userprograms}\M Commerce\Panel Maestro"; Filename: "{sys}\wscript.exe"; Parameters: """{app}\launcher.vbs"""; WorkingDir: "{app}"; IconFilename: "{app}\icon.ico"

[Tasks]
Name: "desktopicon"; Description: "Crear un acceso directo en el Escritorio"; GroupDescription: "Accesos directos:"; Flags: checkedonce

[Run]
Filename: "{sys}\wscript.exe"; Parameters: """{app}\launcher.vbs"""; Description: "Abrir M Commerce - Panel Maestro"; Flags: nowait postinstall skipifsilent
