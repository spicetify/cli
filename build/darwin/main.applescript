on setupEnvironment(binFolder, binPath, launchAgentName)
   on fileContains(filePath, searchString)
      set fileContent to do shell script "cat " & filePath
      return (fileContent contains searchString)
   end fileContains

   set bashProfilePath to "~/.bash_profile"
   set zshrcPath to "~/.zshrc"
   set exportString to "export PATH=\"$PATH:" & binFolder & "\""

   if not (fileContains(bashProfilePath, exportString)) then
      do shell script "echo '" & exportString & "' >> " & bashProfilePath
      do shell script "source " & bashProfilePath
   end if

   if not (fileContains(zshrcPath, exportString)) then
      do shell script "echo '" & exportString & "' >> " & zshrcPath
      do shell script "source " & zshrcPath
   end if


   set homeFolder to (POSIX path of (path to home folder))
   set plistPath to homeFolder & "/Library/LaunchAgents/" & launchAgentName & ".plist"
   set plistContent to "
<?xml version=\"1.0\" encoding=\"UTF-8\"?>
<!DOCTYPE plist PUBLIC \"-//Apple//DTD PLIST 1.0//EN\" \"http://www.apple.com/DTDs/PropertyList-1.0.dtd\">
<plist version=\"1.0\">
<dict>
    <key>Label</key>
    <string>" & launchAgentName & "</string>
    <key>ProgramArguments</key>
    <array>
        <string>" & binPath & "</string>
        <string>daemon</string>
    </array>
    <key>RunAtLoad</key>
    <true/>
</dict>
</plist>"

   try
      do shell script "launchctl list | grep " & launchAgentName
   on error
      do shell script "echo '" & plistContent & "' > " & plistPath
      do shell script "launchctl load -w " & plistPath
      do shell script binPath & " init"
   end try
end setupEnvironment

on open location input
   set dirname to POSIX path of (path to me)
   set binary to dirname & "/Contents/MacOS/bin/spicetify"

   do shell script quoted form of (binary & " protocol " & input)
end open location

on run
   set dirname to POSIX path of (path to me)
   set binFolder to dirname & "/Contents/MacOS/bin"
   set binPath to binFolder & "/spicetify"

   setupEnvironment(binFolder, binPath, "app.spicetify.daemon")

   tell application "Terminal"
      activate
      do script binary
   end tell
end run
