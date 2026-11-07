Set fso = CreateObject("Scripting.FileSystemObject")
dir = fso.GetParentFolderName(WScript.ScriptFullName)
exe = dir & "\node_modules\electron\dist\electron.exe"
If Not fso.FileExists(exe) Then
  MsgBox "Chua tim thay Electron. Hay chay chay.bat de cai dat.", 48, "Dynamic Island"
  WScript.Quit
End If
Set sh = CreateObject("WScript.Shell")
sh.CurrentDirectory = dir
' 0 = cua so an, False = khong cho: app chay doc lap, dong cua so nao cung khong anh huong
sh.Run """" & exe & """ """ & dir & """", 0, False
