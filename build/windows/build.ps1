heat.exe dir . -nologo -gg -g1 -srd -sfrag -sreg -cg AppFiles -template fragment -dr INSTALLDIR -var var.SourceDir -out AppFiles.wxs
candle.exe -nologo -arch x64 -dProductVersion=1.0.0 -dPlatform=x64 -dSourceDir=. .\installer.wxs AppFiles.wxs
light.exe -b . -nologo -dcl:high -ext WixUIExtension -ext WixUIExtension AppFiles.wixobj installer.wixobj -o spicetify-setup.msi
