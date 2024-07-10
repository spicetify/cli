dotnet tool install -g wix
wix extension add -g WixToolset.Util.wixext
wix extension add -g WixToolset.UI.wixext

wix build -d ProductVersion=3.0.0 -d Platform=x64 -ext WixToolset.Util.wixext -ext WixToolset.UI.wixext .\installer.wxs -o .\installer.msi
