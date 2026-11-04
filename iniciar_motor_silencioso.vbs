Set WshShell = CreateObject("WScript.Shell")
Set fso = CreateObject("Scripting.FileSystemObject")
strFolder = fso.GetParentFolderName(WScript.ScriptFullName)
WshShell.CurrentDirectory = strFolder

pythonPath = "pythonw.exe"
If fso.FileExists("C:\Python314\pythonw.exe") Then
    pythonPath = """C:\Python314\pythonw.exe"""
End If

WshShell.Run pythonPath & " server_ffmpeg.py", 0, False
