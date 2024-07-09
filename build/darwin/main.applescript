on open location input
	set dirname to POSIX path of (path to me)
	set binary to dirname & "/Contents/MacOS/bin/spicetify"
	do shell script quoted form of (binary & " protocol " & input)
end open location

on run
	set dirname to POSIX path of (path to me)
	set binary to dirname & "/Contents/MacOS/bin/spicetify"
	tell application "Terminal"
		activate
		do script binary
	end tell
end run
