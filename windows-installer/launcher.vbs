Option Explicit
Dim shell, fso, url, edge1, edge2, edge3, chrome1, chrome2, chrome3, browser, cmd
Set shell = CreateObject("WScript.Shell")
Set fso = CreateObject("Scripting.FileSystemObject")
url = "https://m-commerce-ar.vercel.app/app-maestro/panel?desktop=1"
edge1 = shell.ExpandEnvironmentStrings("%ProgramFiles(x86)%") & "\Microsoft\Edge\Application\msedge.exe"
edge2 = shell.ExpandEnvironmentStrings("%ProgramFiles%") & "\Microsoft\Edge\Application\msedge.exe"
edge3 = shell.ExpandEnvironmentStrings("%LocalAppData%") & "\Microsoft\Edge\Application\msedge.exe"
chrome1 = shell.ExpandEnvironmentStrings("%ProgramFiles%") & "\Google\Chrome\Application\chrome.exe"
chrome2 = shell.ExpandEnvironmentStrings("%ProgramFiles(x86)%") & "\Google\Chrome\Application\chrome.exe"
chrome3 = shell.ExpandEnvironmentStrings("%LocalAppData%") & "\Google\Chrome\Application\chrome.exe"
browser = ""
If fso.FileExists(edge1) Then browser = edge1
If browser = "" And fso.FileExists(edge2) Then browser = edge2
If browser = "" And fso.FileExists(edge3) Then browser = edge3
If browser = "" And fso.FileExists(chrome1) Then browser = chrome1
If browser = "" And fso.FileExists(chrome2) Then browser = chrome2
If browser = "" And fso.FileExists(chrome3) Then browser = chrome3
If browser = "" Then
  shell.Run url, 1, False
Else
  cmd = Chr(34) & browser & Chr(34) & " --app=" & Chr(34) & url & Chr(34) & " --start-maximized"
  shell.Run cmd, 1, False
End If
