on ensureLineInFileIfExists(filePath, searchLine)
   set ok to false
   try
      set fileAlias to POSIX file filePath as alias
      local fileDescriptor
      set fileDescriptor to open for access fileAlias with write permission
      try
         set lns to paragraphs of (read file srcFile as Çclass utf8È)
         repeat with ln in lns
            if ln is searchTerm then
               set ok to true
               exit repeat
            end if
         end repeat
         if ok is false then
            write searchLine to file fileDescriptor starting at eof as Çclass utf8È
            set of to true
         end if
      end try
      close access fileDescriptor
   end try
   return ok
end findLineInFile

on setupEnvironment(binFolder, binPath, launchAgentName)
   set homeFolder to POSIX path of (path to home folder)

   set bashProfilePath to homeFolder & ".bash_profile"
   set zshrcPath to homeFolder & ".zshrc"
   set exportString to "export PATH=" & quote & binFolder & ":$PATH" & quote & " # Added by Spicetify"

   ensureLineInFileIfExists(bashProfilePath, exportString)
   ensureLineInFileIfExists(zshrcPath, exportString)

   set plistPathQ to quoted form of (homeFolder & "/Library/LaunchAgents/" & launchAgentName & ".plist")
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
      do shell script "echo " & quoted form of plistContent & " > " & plistPathQ
      do shell script "launchctl load -w " & plistPathQ
      do shell script (quoted form of binPath) & " init"
   end try
end setupEnvironment

on open location input
   set dirname to POSIX path of (path to me)
   set binFolder to dirname & "/Contents/MacOS/bin"
   set binPath to binFolder & "/spicetify"

   do shell script (quoted form of binPath) & " protocol " & (quoted form of input)
end open location

on run
   set dirname to POSIX path of (path to me)
   set binFolder to dirname & "/Contents/MacOS/bin"
   set binPath to binFolder & "/spicetify"

   setupEnvironment(binFolder, binPath, "app.spicetify.daemon")

   tell application "Terminal"
      activate
      do script quoted form of binPath
   end tell
end run
