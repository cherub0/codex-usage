Set shell = CreateObject("WScript.Shell")
Set fileSystem = CreateObject("Scripting.FileSystemObject")
scriptPath = WScript.ScriptFullName
repoRoot = fileSystem.GetParentFolderName(fileSystem.GetParentFolderName(scriptPath))
command = "cmd /c cd /d """ & repoRoot & """ && npm run app"
windowStyle = 0
waitOnReturn = False
shell.Run command, windowStyle, waitOnReturn
