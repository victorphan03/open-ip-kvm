Set WshShell = CreateObject("WScript.Shell")
WshShell.Run "cmd /c npm run electron", 0, False
Set WshShell = Nothing
