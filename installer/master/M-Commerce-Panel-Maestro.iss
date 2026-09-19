[Setup]
AppId={{A2F2C32A-466A-4E75-9E95-4FEFCEDB9781}
AppName=M Commerce - Panel Maestro
AppVersion=1.0.0
AppPublisher=M Commerce
AppPublisherURL=https://m-commerce-ar.vercel.app
AppSupportURL=https://m-commerce-ar.vercel.app/app-maestro/panel
DefaultDirName={localappdata}\Programs\M Commerce\Panel Maestro
DefaultGroupName=M Commerce
DisableProgramGroupPage=no
PrivilegesRequired=lowest
WizardStyle=modern
Compression=lzma2/max
SolidCompression=yes
OutputDir=..\..\dist
OutputBaseFilename=M-Commerce-Panel-Maestro-Setup
SetupIconFile=mcommerce-original.ico
UninstallDisplayIcon={app}\mcommerce-original.ico
UninstallDisplayName=M Commerce - Panel Maestro
CreateUninstallRegKey=yes
Uninstallable=yes
CloseApplications=no
RestartApplications=no
ShowLanguageDialog=no
MinVersion=10.0.17763

[Languages]
Name: "spanish"; MessagesFile: "compiler:Languages\Spanish.isl"

[Tasks]
Name: "desktopicon"; Description: "Crear un acceso directo en el escritorio"; GroupDescription: "Accesos directos:"; Flags: checkedonce

[Files]
Source: "mcommerce-original.ico"; DestDir: "{app}"; Flags: ignoreversion

[Icons]
Name: "{group}\M Commerce - Panel Maestro"; Filename: "{code:GetBrowserExe}"; Parameters: "--app=""https://m-commerce-ar.vercel.app/app-maestro/panel?desktop=1"" --start-maximized"; WorkingDir: "{app}"; IconFilename: "{app}\mcommerce-original.ico"; Comment: "M Commerce - Panel Maestro"
Name: "{autodesktop}\M Commerce - Panel Maestro"; Filename: "{code:GetBrowserExe}"; Parameters: "--app=""https://m-commerce-ar.vercel.app/app-maestro/panel?desktop=1"" --start-maximized"; WorkingDir: "{app}"; IconFilename: "{app}\mcommerce-original.ico"; Comment: "M Commerce - Panel Maestro"; Tasks: desktopicon

[Run]
Filename: "{code:GetBrowserExe}"; Parameters: "--app=""https://m-commerce-ar.vercel.app/app-maestro/panel?desktop=1"" --start-maximized"; Description: "Abrir M Commerce - Panel Maestro"; Flags: nowait postinstall skipifsilent

[Code]
function GetBrowserExe(Param: string): string;
var
  P: string;
begin
  P := ExpandConstant('{pf32}\Microsoft\Edge\Application\msedge.exe');
  if FileExists(P) then begin Result := P; Exit; end;
  P := ExpandConstant('{pf}\Microsoft\Edge\Application\msedge.exe');
  if FileExists(P) then begin Result := P; Exit; end;
  P := ExpandConstant('{localappdata}\Microsoft\Edge\Application\msedge.exe');
  if FileExists(P) then begin Result := P; Exit; end;
  P := ExpandConstant('{pf}\Google\Chrome\Application\chrome.exe');
  if FileExists(P) then begin Result := P; Exit; end;
  P := ExpandConstant('{pf32}\Google\Chrome\Application\chrome.exe');
  if FileExists(P) then begin Result := P; Exit; end;
  P := ExpandConstant('{localappdata}\Google\Chrome\Application\chrome.exe');
  if FileExists(P) then begin Result := P; Exit; end;
  Result := '';
end;

function InitializeSetup(): Boolean;
begin
  Result := GetBrowserExe('') <> '';
  if not Result then
    MsgBox('M Commerce necesita Microsoft Edge o Google Chrome para abrir el Panel Maestro en modo aplicación.'#13#10#13#10 +
      'Instalá o actualizá uno de esos navegadores y volvé a ejecutar este instalador.', mbError, MB_OK);
end;
