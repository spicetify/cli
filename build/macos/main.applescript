on ensureLineInFileIfExists(filePath, lineToAdd)
   set ok to false
   try
      set fileAlias to POSIX file filePath as alias
      local fileDescriptor
      set fileDescriptor to open for access fileAlias with write permission
      try
         set lns to paragraphs of (read fileDescriptor)
         repeat with ln in lns
            if ln is lineToAdd then
               set ok to true
               exit repeat
            end if
         end repeat
         if ok is false then
            write return & lineToAdd & return to fileDescriptor starting at eof
            set ok to true
         end if
      end try
      close access fileDescriptor
   end try
   return ok
end findLineInFile

on addLineToShellConfigs(lineToAdd)
   set homeFolder to POSIX path of (path to home folder)
   set configFiles to {homeFolder & ".bash_profile", homeFolder & ".zshrc"}

   repeat with configFile in configFiles
      ensureLineInFileIfExists(configFile, lineToAdd)
   end repeat
end addLineToShellConfigs

on launchAgentExists(agentName)
   try
      do shell script "launchctl list | grep " & quoted form of agentName
      return true
   on error
      return false
   end try
end launchAgentExists

on createLaunchAgent(plistPath, agentName, binPath)
   set plistPathQ to quoted form of plistPath
   do shell script "plutil -create xml1 " & plistPathQ
   do shell script "plutil -insert Label -string " & quoted form of agentName & " " & plistPathQ
   do shell script "plutil -insert ProgramArguments -array -string " & quoted form of binPath & " -string daemon " & plistPathQ
   do shell script "plutil -insert RunAtLoad -bool true " & plistPathQ
end createLaunchAgent

on setupEnvironment(binFolder, binPath, launchAgentName)
   set homeFolder to POSIX path of (path to home folder)

   set exportString to "export PATH=" & quote & binFolder & ":$PATH" & quote & " # Added by Spicetify"
   addLineToShellConfigs(exportString)

   set launchAgentsFolder to homeFolder & "Library/LaunchAgents/"
   set plistPath to launchAgentsFolder & launchAgentName & ".plist"
   if not launchAgentExists(launchAgentName) then
      createLaunchAgent(plistPath, launchAgentName, binPath)
      do shell script "launchctl load -w " & quoted form of plistPath
      do shell script quoted form of binPath & " init"
   end if
end setupEnvironment

on open location input
   set dirname to POSIX path of (path to me)
   set binFolder to dirname & "Contents/MacOS/bin/"
   set binPath to binFolder & "spicetify"

   do shell script (quoted form of binPath) & " protocol " & (quoted form of input)
end open location

on run
   set dirname to POSIX path of (path to me)
   set binFolder to dirname & "Contents/MacOS/bin/"
   set binPath to binFolder & "spicetify"

   setupEnvironment(binFolder, binPath, "app.spicetify.daemon")

   do shell script "open -a Terminal " & quoted form of binPath
   -- tell application "Terminal"
   --    activate
   --    do script quoted form of binPath
   -- end tell
end run
