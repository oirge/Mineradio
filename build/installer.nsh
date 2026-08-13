!ifndef MUI_BGCOLOR
  !define MUI_BGCOLOR "FFFFFF"
!endif
!ifndef MUI_TEXTCOLOR
  !define MUI_TEXTCOLOR "111217"
!endif
!ifndef MUI_DIRECTORYPAGE_BGCOLOR
  !define MUI_DIRECTORYPAGE_BGCOLOR "FFFFFF"
!endif
!ifndef MUI_DIRECTORYPAGE_TEXTCOLOR
  !define MUI_DIRECTORYPAGE_TEXTCOLOR "111217"
!endif
!ifndef MUI_INSTFILESPAGE_COLORS
  !define MUI_INSTFILESPAGE_COLORS "3257F7 FFFFFF"
!endif
!ifndef MUI_FINISHPAGE_LINK_COLOR
  !define MUI_FINISHPAGE_LINK_COLOR "3257F7"
!endif
!ifndef MUI_HEADERIMAGE
  !define MUI_HEADERIMAGE
!endif
!ifndef MUI_HEADERIMAGE_BITMAP_STRETCH
  !define MUI_HEADERIMAGE_BITMAP_STRETCH "FitControl"
!endif
!ifndef MUI_HEADERIMAGE_UNBITMAP_STRETCH
  !define MUI_HEADERIMAGE_UNBITMAP_STRETCH "FitControl"
!endif
!ifndef BUILD_UNINSTALLER
  !ifndef MUI_CUSTOMFUNCTION_GUIINIT
    !define MUI_CUSTOMFUNCTION_GUIINIT MineradioGuiInit
  !endif
!endif

!include LogicLib.nsh
!include FileFunc.nsh
!include nsDialogs.nsh
!include WinMessages.nsh

!define MINERADIO_INSTALL_MARKER ".mineradio-install-root"
!define MINERADIO_PROCESS_ROOT_ENV "MINERADIO_INSTALL_ROOT"

; electron-builder 26.15.3 允许通过 customCheckAppRunning 覆盖安装和升级卸载阶段的进程检查。
; 默认实现可能退回按进程名终止；这里固定按当前安装目录、当前会话和 Mineradio.exe 精确筛选。
; 来源：https://github.com/electron-userland/electron-builder/blob/master/packages/app-builder-lib/templates/nsis/include/allowOnlyOneInstallerInstance.nsh
!macro customCheckAppRunning
  !ifdef BUILD_UNINSTALLER
    Call un.MineradioCloseInstalledProcesses
  !else
    Call MineradioCloseInstalledProcesses
  !endif
!macroend

; 定义安装器和卸载器共用的进程关闭函数：先请求窗口退出，等待后只强制结束同目录同会话的残留进程。
!macro MineradioDefineCloseInstalledProcesses _PREFIX
Function ${_PREFIX}MineradioCloseInstalledProcesses
retry:
  DetailPrint "$(appClosing)"
  System::Call 'kernel32::SetEnvironmentVariable(t "${MINERADIO_PROCESS_ROOT_ENV}", t "$INSTDIR") i .r0'
  ${If} $0 == 0
    MessageBox MB_RETRYCANCEL|MB_ICONEXCLAMATION "$(appCannotBeClosed)" /SD IDCANCEL IDRETRY retry
    Quit
  ${EndIf}

  nsExec::Exec `"$SYSDIR\WindowsPowerShell\v1.0\powershell.exe" -NoProfile -NonInteractive -ExecutionPolicy Bypass -Command "$$ErrorActionPreference = 'Stop'; try { $$root = [IO.Path]::GetFullPath($$env:${MINERADIO_PROCESS_ROOT_ENV}).TrimEnd([IO.Path]::DirectorySeparatorChar) + [IO.Path]::DirectorySeparatorChar; $$sessionId = [Diagnostics.Process]::GetCurrentProcess().SessionId; $$select = { @(Get-CimInstance -ClassName Win32_Process | Where-Object { $$_.Name -eq 'Mineradio.exe' -and $$_.ExecutablePath -and $$_.SessionId -eq $$sessionId -and [IO.Path]::GetFullPath($$_.ExecutablePath).StartsWith($$root, [StringComparison]::OrdinalIgnoreCase) }) }; $$processes = @(& $$select); foreach ($$process in $$processes) { try { $$native = Get-Process -Id $$process.ProcessId -ErrorAction Stop; if ($$native.MainWindowHandle -ne 0) { [void]$$native.CloseMainWindow() } } catch {} }; if ($$processes.Count -gt 0) { Start-Sleep -Milliseconds 1200 }; @(& $$select) | ForEach-Object { Stop-Process -Id $$_.ProcessId -Force -ErrorAction SilentlyContinue }; Start-Sleep -Milliseconds 500; if ((@(& $$select)).Count -gt 0) { exit 1 }; exit 0 } catch { exit 1 }"`
  Pop $0
  System::Call 'kernel32::SetEnvironmentVariable(t "${MINERADIO_PROCESS_ROOT_ENV}", p 0)'

  ${If} $0 == 0
    Return
  ${EndIf}

  MessageBox MB_RETRYCANCEL|MB_ICONEXCLAMATION "$(appCannotBeClosed)" /SD IDCANCEL IDRETRY retry
  Quit
FunctionEnd
!macroend

!ifdef BUILD_UNINSTALLER
  !insertmacro MineradioDefineCloseInstalledProcesses "un."
!else
  !insertmacro MineradioDefineCloseInstalledProcesses ""
!endif

!ifndef BUILD_UNINSTALLER
  Var MineradioWelcomePage
  Var MineradioHeroFont
  Var MineradioTitleFont
  Var MineradioBodyFont
  Var MineradioSmallFont
  Var MineradioDirectoryPage
  Var MineradioDirectoryInput
!endif

!macro customInit
  !ifndef BUILD_UNINSTALLER
    Call MineradioUsePreferredInstallDir
  !endif
!macroend

!macro customInstall
  Call MineradioWriteInstallMarker
!macroend

!macro customUnInit
  Call un.MineradioAbortUnsafeUninstallRoot
!macroend

!macro customWelcomePage
  Page custom MineradioWelcomeShow
!macroend

!macro customInstallMode
  StrCpy $isForceCurrentInstall "1"
!macroend

!macro customPageAfterChangeDir
  Page custom MineradioDirectoryShow MineradioDirectoryLeave
!macroend

!macro customFinishPage
  !ifndef HIDE_RUN_AFTER_FINISH
    Function MineradioFinishStartApp
      ${If} ${isUpdated}
        StrCpy $1 "--updated"
      ${Else}
        StrCpy $1 ""
      ${EndIf}
      ${StdUtils.ExecShellAsUser} $0 "$launchLink" "open" "$1"
    FunctionEnd

    !define MUI_FINISHPAGE_RUN
    !define MUI_FINISHPAGE_RUN_FUNCTION "MineradioFinishStartApp"
  !endif
  !define MUI_PAGE_CUSTOMFUNCTION_SHOW MineradioTintCommonControls
  !insertmacro MUI_PAGE_FINISH
!macroend

!ifndef BUILD_UNINSTALLER
Function MineradioGuiInit
  System::Call 'dwmapi::DwmSetWindowAttribute(p $HWNDPARENT, i 20, *i 1, i 4) i .r0'
  System::Call 'dwmapi::DwmSetWindowAttribute(p $HWNDPARENT, i 19, *i 1, i 4) i .r0'
  Call MineradioTintCommonControls
FunctionEnd

Function MineradioTintCommonControls
  SetCtlColors $HWNDPARENT "111217" "FFFFFF"

  GetDlgItem $0 $HWNDPARENT 1
  ${If} $0 <> 0
    SetCtlColors $0 "111217" "FFFFFF"
  ${EndIf}
  GetDlgItem $0 $HWNDPARENT 2
  ${If} $0 <> 0
    SetCtlColors $0 "111217" "FFFFFF"
  ${EndIf}
  GetDlgItem $0 $HWNDPARENT 3
  ${If} $0 <> 0
    SetCtlColors $0 "111217" "FFFFFF"
  ${EndIf}

  GetDlgItem $0 $HWNDPARENT 1028
  ${If} $0 <> 0
    SetCtlColors $0 "4B5263" "FFFFFF"
  ${EndIf}
  GetDlgItem $0 $HWNDPARENT 1256
  ${If} $0 <> 0
    SetCtlColors $0 "4B5263" "FFFFFF"
  ${EndIf}
  GetDlgItem $0 $HWNDPARENT 1034
  ${If} $0 <> 0
    SetCtlColors $0 "" "FFFFFF"
  ${EndIf}
  GetDlgItem $0 $HWNDPARENT 1035
  ${If} $0 <> 0
    SetCtlColors $0 "" "FFFFFF"
  ${EndIf}
  GetDlgItem $0 $HWNDPARENT 1037
  ${If} $0 <> 0
    SetCtlColors $0 "111217" "FFFFFF"
  ${EndIf}
  GetDlgItem $0 $HWNDPARENT 1038
  ${If} $0 <> 0
    SetCtlColors $0 "4B5263" "FFFFFF"
  ${EndIf}
  GetDlgItem $0 $HWNDPARENT 1039
  ${If} $0 <> 0
    SetCtlColors $0 "" "FFFFFF"
  ${EndIf}

  FindWindow $0 "#32770" "" $HWNDPARENT
  ${If} $0 <> 0
    SetCtlColors $0 "111217" "FFFFFF"

    GetDlgItem $1 $0 1000
    ${If} $1 <> 0
      SetCtlColors $1 "111217" "FFFFFF"
    ${EndIf}
    GetDlgItem $1 $0 1001
    ${If} $1 <> 0
      SetCtlColors $1 "111217" "FFFFFF"
    ${EndIf}
    GetDlgItem $1 $0 1004
    ${If} $1 <> 0
      SetCtlColors $1 "3257F7" "FFFFFF"
    ${EndIf}
    GetDlgItem $1 $0 1006
    ${If} $1 <> 0
      SetCtlColors $1 "4B5263" "FFFFFF"
    ${EndIf}
    GetDlgItem $1 $0 1016
    ${If} $1 <> 0
      SetCtlColors $1 "4B5263" "FFFFFF"
    ${EndIf}
    GetDlgItem $1 $0 1019
    ${If} $1 <> 0
      SetCtlColors $1 "111217" "FFFFFF"
    ${EndIf}
    GetDlgItem $1 $0 1020
    ${If} $1 <> 0
      SetCtlColors $1 "4B5263" "FFFFFF"
    ${EndIf}
    GetDlgItem $1 $0 1023
    ${If} $1 <> 0
      SetCtlColors $1 "4B5263" "FFFFFF"
    ${EndIf}
    GetDlgItem $1 $0 1024
    ${If} $1 <> 0
      SetCtlColors $1 "4B5263" "FFFFFF"
    ${EndIf}
    GetDlgItem $1 $0 1027
    ${If} $1 <> 0
      SetCtlColors $1 "111217" "FFFFFF"
    ${EndIf}
    GetDlgItem $1 $0 1201
    ${If} $1 <> 0
      SetCtlColors $1 "111217" "FFFFFF"
    ${EndIf}
    GetDlgItem $1 $0 1202
    ${If} $1 <> 0
      SetCtlColors $1 "4B5263" "FFFFFF"
    ${EndIf}
    GetDlgItem $1 $0 1203
    ${If} $1 <> 0
      SetCtlColors $1 "111217" "FFFFFF"
    ${EndIf}
    GetDlgItem $1 $0 1204
    ${If} $1 <> 0
      SetCtlColors $1 "4B5263" "FFFFFF"
    ${EndIf}
  ${EndIf}
FunctionEnd

Function MineradioUsePreferredInstallDir
  ; NSIS 会过滤特殊 /D= 参数，因此直接读取 Windows 原始命令行，避免显式安装目录被默认路径覆盖。
  System::Call 'kernel32::GetCommandLine() t .r0'
  ClearErrors
  ${GetOptions} $0 "/D=" $R1
  ${IfNot} ${Errors}
  ${AndIf} $R1 != ""
    Push "$R1"
    Call MineradioNormalizeInstallDir
    Pop $INSTDIR
  ${Else}
    ; initMultiUser 恢复出的安全安装根必须原位保留，避免自定义目录覆盖安装回落到默认盘。
    IfFileExists "$INSTDIR\${MINERADIO_INSTALL_MARKER}" preserveExistingInstall 0
    IfFileExists "D:\*.*" 0 +2
    StrCpy $INSTDIR "D:\Mineradio"
  ${EndIf}
  Return

preserveExistingInstall:
FunctionEnd

Function MineradioNormalizeInstallDir
  Exch $0
  ${If} $0 == ""
    StrCpy $0 "D:\Mineradio"
    Exch $0
    Return
  ${EndIf}

  StrCpy $4 "$0" 1 -1
  ${If} $4 == "\"
    StrCpy $0 "$0" -1
  ${EndIf}

  StrLen $1 "$0"
  ${If} $1 == 2
    StrCpy $2 "$0" 1 1
    ${If} $2 == ":"
      StrCpy $0 "$0\Mineradio"
    ${EndIf}
  ${ElseIf} $1 == 3
    StrCpy $2 "$0" 1 1
    StrCpy $3 "$0" 1 2
    ${If} $2 == ":"
    ${AndIf} $3 == "\"
      StrCpy $0 "$0Mineradio"
    ${EndIf}
  ${Else}
    ${GetFileName} "$0" $2
    ${If} $2 != "Mineradio"
    ${AndIf} $2 != "mineradio"
      StrCpy $0 "$0\Mineradio"
    ${EndIf}
  ${EndIf}
  Exch $0
FunctionEnd

Function MineradioWriteInstallMarker
  CreateDirectory "$INSTDIR"
  ClearErrors
  FileOpen $0 "$INSTDIR\${MINERADIO_INSTALL_MARKER}" w
  ${If} ${Errors}
    MessageBox MB_ICONSTOP|MB_OK "无法写入安装目录安全标记，安装已停止。请选择可写入的 Mineradio 专用文件夹。"
    Abort
  ${EndIf}
  FileWrite $0 "Mineradio install root marker.$\r$\n"
  FileClose $0
FunctionEnd
!endif

!ifdef BUILD_UNINSTALLER
Function un.MineradioAbortUnsafeUninstallRoot
  ${GetFileName} "$INSTDIR" $0
  ${If} $0 != "Mineradio"
  ${AndIf} $0 != "mineradio"
    MessageBox MB_ICONSTOP|MB_OK "卸载已中止：$INSTDIR 不是 Mineradio 专用安装目录。为避免误删用户文件，请手动删除 Mineradio 程序文件。"
    Abort
  ${EndIf}
  IfFileExists "$INSTDIR\${MINERADIO_INSTALL_MARKER}" safe 0
  MessageBox MB_ICONSTOP|MB_OK "卸载已中止：$INSTDIR 不是 Mineradio 专用安装目录，缺少安全标记 ${MINERADIO_INSTALL_MARKER}。为避免误删用户文件，请手动删除 Mineradio 程序文件。"
  Abort
safe:
FunctionEnd
!endif

!ifndef BUILD_UNINSTALLER
Function MineradioWelcomeShow
  Call MineradioUsePreferredInstallDir

  nsDialogs::Create 1018
  Pop $MineradioWelcomePage
  ${If} $MineradioWelcomePage == error
    Abort
  ${EndIf}

  SetCtlColors $MineradioWelcomePage "111217" "FFFFFF"
  CreateFont $MineradioHeroFont "Microsoft YaHei UI" 24 700
  CreateFont $MineradioTitleFont "Microsoft YaHei UI" 11 700
  CreateFont $MineradioBodyFont "Microsoft YaHei UI" 9 400
  CreateFont $MineradioSmallFont "Microsoft YaHei UI" 8 400

  ${NSD_CreateLabel} 22u 20u 82u 10u "MINERADIO"
  Pop $0
  SendMessage $0 ${WM_SETFONT} $MineradioSmallFont 1
  SetCtlColors $0 "3257F7" "FFFFFF"

  ${NSD_CreateLabel} 22u 42u 226u 30u "Mineradio 安装"
  Pop $0
  SendMessage $0 ${WM_SETFONT} $MineradioHeroFont 1
  SetCtlColors $0 "111217" "FFFFFF"

  ${NSD_CreateLabel} 22u 78u 36u 2u ""
  Pop $0
  SetCtlColors $0 "" "3257F7"

  ${NSD_CreateLabel} 22u 96u 238u 24u "为这台电脑安装 Mineradio。默认安装到 D:\Mineradio；选择其它位置时会自动落入专用 Mineradio 子文件夹。"
  Pop $0
  SendMessage $0 ${WM_SETFONT} $MineradioBodyFont 1
  SetCtlColors $0 "4B5263" "FFFFFF"

  ${NSD_CreateLabel} 22u 130u 238u 12u "默认位置：$INSTDIR"
  Pop $0
  SendMessage $0 ${WM_SETFONT} $MineradioTitleFont 1
  SetCtlColors $0 "3257F7" "FFFFFF"

  nsDialogs::Show
FunctionEnd

Function MineradioDirectoryBrowse
  nsDialogs::SelectFolderDialog "选择 Mineradio 安装文件夹" "$INSTDIR"
  Pop $0
  ${If} $0 != error
  ${AndIf} $0 != ""
    Push "$0"
    Call MineradioNormalizeInstallDir
    Pop $0
    StrCpy $INSTDIR "$0"
    SendMessage $MineradioDirectoryInput ${WM_SETTEXT} 0 "STR:$INSTDIR"
  ${EndIf}
FunctionEnd

Function MineradioDirectoryShow
  Call MineradioUsePreferredInstallDir

  nsDialogs::Create 1018
  Pop $MineradioDirectoryPage
  ${If} $MineradioDirectoryPage == error
    Abort
  ${EndIf}

  SetCtlColors $MineradioDirectoryPage "111217" "FFFFFF"
  CreateFont $MineradioTitleFont "Microsoft YaHei UI" 15 700
  CreateFont $MineradioBodyFont "Microsoft YaHei UI" 9 400
  CreateFont $MineradioSmallFont "Microsoft YaHei UI" 8 500

  ${NSD_CreateLabel} 22u 12u 238u 20u "选择安装位置"
  Pop $0
  SendMessage $0 ${WM_SETFONT} $MineradioTitleFont 1
  SetCtlColors $0 "111217" "FFFFFF"

  ${NSD_CreateLabel} 22u 40u 238u 24u "你可以使用默认路径，也可以选择其它磁盘或文件夹。安装器会自动创建专用 Mineradio 子目录，避免卸载时影响其它文件。"
  Pop $0
  SendMessage $0 ${WM_SETFONT} $MineradioBodyFont 1
  SetCtlColors $0 "4B5263" "FFFFFF"

  ${NSD_CreateLabel} 22u 76u 238u 10u "安装目录"
  Pop $0
  SendMessage $0 ${WM_SETFONT} $MineradioSmallFont 1
  SetCtlColors $0 "3257F7" "FFFFFF"

  ${NSD_CreateText} 22u 94u 178u 15u "$INSTDIR"
  Pop $MineradioDirectoryInput
  SendMessage $MineradioDirectoryInput ${WM_SETFONT} $MineradioBodyFont 1
  SetCtlColors $MineradioDirectoryInput "111217" "FFFFFF"

  ${NSD_CreateBrowseButton} 210u 93u 50u 17u "浏览..."
  Pop $0
  SendMessage $0 ${WM_SETFONT} $MineradioSmallFont 1
  ${NSD_OnClick} $0 MineradioDirectoryBrowse

  ${NSD_CreateLabel} 22u 122u 238u 12u "默认推荐：D:\Mineradio；选择现有文件夹会自动追加 Mineradio。"
  Pop $0
  SendMessage $0 ${WM_SETFONT} $MineradioSmallFont 1
  SetCtlColors $0 "6B7280" "FFFFFF"

  nsDialogs::Show
FunctionEnd

Function MineradioDirectoryLeave
  ${NSD_GetText} $MineradioDirectoryInput $0
  ${If} $0 == ""
    MessageBox MB_ICONEXCLAMATION|MB_OK "请选择安装文件夹。"
    Abort
  ${EndIf}
  Push "$0"
  Call MineradioNormalizeInstallDir
  Pop $0
  StrCpy $INSTDIR "$0"
  SendMessage $MineradioDirectoryInput ${WM_SETTEXT} 0 "STR:$INSTDIR"
FunctionEnd
!endif
