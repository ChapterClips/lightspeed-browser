; Register Lightspeed Browser with Windows so it can be chosen as the
; default browser (Settings > Apps > Default apps). Per-user (HKCU), no admin.

!macro customInstall
  ; Capabilities advertised to Windows
  WriteRegStr HKCU "Software\Clients\StartMenuInternet\LightspeedBrowser\Capabilities" "ApplicationName" "Lightspeed Browser"
  WriteRegStr HKCU "Software\Clients\StartMenuInternet\LightspeedBrowser\Capabilities" "ApplicationDescription" "A focused desktop browser."
  WriteRegStr HKCU "Software\Clients\StartMenuInternet\LightspeedBrowser\Capabilities" "ApplicationIcon" "$INSTDIR\LightspeedBrowser.exe,0"
  WriteRegStr HKCU "Software\Clients\StartMenuInternet\LightspeedBrowser\Capabilities\URLAssociations" "http" "LightspeedHTM"
  WriteRegStr HKCU "Software\Clients\StartMenuInternet\LightspeedBrowser\Capabilities\URLAssociations" "https" "LightspeedHTM"
  WriteRegStr HKCU "Software\Clients\StartMenuInternet\LightspeedBrowser\Capabilities\StartMenu" "StartMenuInternet" "LightspeedBrowser"

  WriteRegStr HKCU "Software\Clients\StartMenuInternet\LightspeedBrowser" "" "Lightspeed Browser"
  WriteRegStr HKCU "Software\Clients\StartMenuInternet\LightspeedBrowser\DefaultIcon" "" "$INSTDIR\LightspeedBrowser.exe,0"
  WriteRegStr HKCU "Software\Clients\StartMenuInternet\LightspeedBrowser\shell\open\command" "" '"$INSTDIR\LightspeedBrowser.exe"'

  ; ProgId that actually opens links
  WriteRegStr HKCU "Software\Classes\LightspeedHTM" "" "Lightspeed Browser Document"
  WriteRegStr HKCU "Software\Classes\LightspeedHTM\DefaultIcon" "" "$INSTDIR\LightspeedBrowser.exe,0"
  WriteRegStr HKCU "Software\Classes\LightspeedHTM\shell\open\command" "" '"$INSTDIR\LightspeedBrowser.exe" "%1"'

  ; Make the app show up in the Windows "Default apps" list
  WriteRegStr HKCU "Software\RegisteredApplications" "LightspeedBrowser" "Software\Clients\StartMenuInternet\LightspeedBrowser\Capabilities"
!macroend

!macro customUnInstall
  DeleteRegKey HKCU "Software\Clients\StartMenuInternet\LightspeedBrowser"
  DeleteRegKey HKCU "Software\Classes\LightspeedHTM"
  DeleteRegValue HKCU "Software\RegisteredApplications" "LightspeedBrowser"
!macroend
