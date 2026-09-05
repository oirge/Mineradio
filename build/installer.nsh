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

; 二创版与原项目 XxHuberrr/Mineradio 必须能同时装、同时跑，所以安装身份全部单独一套：
; 安装目录叶子名、进程名、显示名都带 oirge 后缀，appId 也换过（见 package.json）。
!define MINERADIO_DISPLAY_NAME "Mineradio 二创"
!define MINERADIO_INSTALL_DIR_NAME "Mineradio-oirge"
!define MINERADIO_INSTALL_DIR_NAME_LOWER "mineradio-oirge"
!define MINERADIO_DEFAULT_INSTALL_DIR "D:\${MINERADIO_INSTALL_DIR_NAME}"
!define MINERADIO_PROCESS_EXE_NAME "Mineradio-oirge.exe"
; 换身份之前（appId com.mineradio.desktop）本仓库留下的卸载记录 GUID，实测取自本机注册表。
; 原项目用的是同一个 appId，所以只靠这个键判断会误伤原项目的安装，必须再按版本号和安装标记二次确认。
!define MINERADIO_LEGACY_UNINSTALL_KEY "Software\Microsoft\Windows\CurrentVersion\Uninstall\9733721a-009e-52bc-b705-49059cd80258"

; electron-builder 26.15.3 允许通过 customCheckAppRunning 覆盖安装和升级卸载阶段的进程检查。
; 默认实现可能退回按进程名终止；这里固定按当前安装目录、当前会话和 Mineradio-oirge.exe 精确筛选。
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

  nsExec::Exec `"$SYSDIR\WindowsPowerShell\v1.0\powershell.exe" -NoProfile -NonInteractive -ExecutionPolicy Bypass -Command "$$ErrorActionPreference = 'Stop'; try { $$root = [IO.Path]::GetFullPath($$env:${MINERADIO_PROCESS_ROOT_ENV}).TrimEnd([IO.Path]::DirectorySeparatorChar) + [IO.Path]::DirectorySeparatorChar; $$sessionId = [Diagnostics.Process]::GetCurrentProcess().SessionId; $$select = { @(Get-CimInstance -ClassName Win32_Process | Where-Object { $$_.Name -eq '${MINERADIO_PROCESS_EXE_NAME}' -and $$_.ExecutablePath -and $$_.SessionId -eq $$sessionId -and [IO.Path]::GetFullPath($$_.ExecutablePath).StartsWith($$root, [StringComparison]::OrdinalIgnoreCase) }) }; $$processes = @(& $$select); foreach ($$process in $$processes) { try { $$native = Get-Process -Id $$process.ProcessId -ErrorAction Stop; if ($$native.MainWindowHandle -ne 0) { [void]$$native.CloseMainWindow() } } catch {} }; if ($$processes.Count -gt 0) { Start-Sleep -Milliseconds 1200 }; @(& $$select) | ForEach-Object { Stop-Process -Id $$_.ProcessId -Force -ErrorAction SilentlyContinue }; Start-Sleep -Milliseconds 500; if ((@(& $$select)).Count -gt 0) { exit 1 }; exit 0 } catch { exit 1 }"`
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
  Call MineradioOfferLegacyUninstall
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
    StrCpy $INSTDIR "${MINERADIO_DEFAULT_INSTALL_DIR}"
  ${EndIf}
  Return

preserveExistingInstall:
FunctionEnd

Function MineradioNormalizeInstallDir
  Exch $0
  ${If} $0 == ""
    StrCpy $0 "${MINERADIO_DEFAULT_INSTALL_DIR}"
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
      StrCpy $0 "$0\${MINERADIO_INSTALL_DIR_NAME}"
    ${EndIf}
  ${ElseIf} $1 == 3
    StrCpy $2 "$0" 1 1
    StrCpy $3 "$0" 1 2
    ${If} $2 == ":"
    ${AndIf} $3 == "\"
      StrCpy $0 "$0${MINERADIO_INSTALL_DIR_NAME}"
    ${EndIf}
  ${Else}
    ${GetFileName} "$0" $2
    ${If} $2 != "${MINERADIO_INSTALL_DIR_NAME}"
    ${AndIf} $2 != "${MINERADIO_INSTALL_DIR_NAME_LOWER}"
      StrCpy $0 "$0\${MINERADIO_INSTALL_DIR_NAME}"
    ${EndIf}
  ${EndIf}
  Exch $0
FunctionEnd

Function MineradioWriteInstallMarker
  CreateDirectory "$INSTDIR"
  ClearErrors
  FileOpen $0 "$INSTDIR\${MINERADIO_INSTALL_MARKER}" w
  ${If} ${Errors}
    MessageBox MB_ICONSTOP|MB_OK "无法写入安装目录安全标记，安装已停止。请选择可写入的 ${MINERADIO_INSTALL_DIR_NAME} 专用文件夹。"
    Abort
  ${EndIf}
  FileWrite $0 "Mineradio install root marker.$\r$\n"
  FileClose $0
FunctionEnd

; 换身份之前装过的旧版本（appId com.mineradio.desktop、安装在 D:\Mineradio）不会被新安装器当成升级，
; 会变成两份共存。这里在文件装完后问一次用户，同意才调用旧版自带的卸载器。
; 判断必须足够严：原项目 XxHuberrr/Mineradio 用的是同一个 appId、同一个卸载 GUID，
; 只有版本号是 1.x（本仓库的版本线）且目录里有本仓库写的安全标记时才敢提示，最终仍由用户确认。
Function MineradioOfferLegacyUninstall
  Push $0
  Push $1
  Push $2
  Push $3
  Push $4
  Push $5

  ReadRegStr $0 HKCU "${MINERADIO_LEGACY_UNINSTALL_KEY}" "QuietUninstallString"
  ${If} $0 == ""
    ReadRegStr $0 HKCU "${MINERADIO_LEGACY_UNINSTALL_KEY}" "UninstallString"
    ${If} $0 == ""
      Goto legacyDone
    ${EndIf}
    StrCpy $0 "$0 /S"
  ${EndIf}

  ReadRegStr $1 HKCU "${MINERADIO_LEGACY_UNINSTALL_KEY}" "DisplayVersion"
  StrCpy $2 "$1" 2
  ${If} $2 != "1."
    ; 2.x 是原项目的版本线，绝不能碰。
    Goto legacyDone
  ${EndIf}

  ; 该卸载记录没有 InstallLocation，只能从 DisplayIcon（卸载器同目录的图标）反推安装根目录。
  ReadRegStr $3 HKCU "${MINERADIO_LEGACY_UNINSTALL_KEY}" "DisplayIcon"
  ${If} $3 == ""
    Goto legacyDone
  ${EndIf}
  ${GetParent} "$3" $4
  ${If} $4 == ""
    Goto legacyDone
  ${EndIf}
  IfFileExists "$4\${MINERADIO_INSTALL_MARKER}" 0 legacyDone

  ; 新目录如果就在旧目录里面（例如用户手动选了 D:\Mineradio 作为父目录），卸载旧版会把刚装好的一起删掉。
  StrLen $5 "$4"
  StrCpy $2 "$INSTDIR" $5
  ${If} $2 == "$4"
    Goto legacyDone
  ${EndIf}

  ReadRegStr $2 HKCU "${MINERADIO_LEGACY_UNINSTALL_KEY}" "DisplayName"
  ${If} $2 == ""
    StrCpy $2 "Mineradio"
  ${EndIf}

  MessageBox MB_YESNO|MB_ICONQUESTION|MB_DEFBUTTON2 "检测到换身份之前安装的旧版本：$\r$\n$2（$1）$\r$\n$4$\r$\n$\r$\n${MINERADIO_DISPLAY_NAME} 已安装到 $INSTDIR，拥有独立的开始菜单项、进程名和卸载入口，可以和原项目的 Mineradio 同时使用。$\r$\n$\r$\n要现在卸载上面这个旧版本吗？曲库、设置和播放记录都保存在别处，不会被删除。$\r$\n如果它其实是原项目（XxHuberrr/Mineradio）的安装，请选择「否」。" /SD IDNO IDYES doLegacyUninstall
  Goto legacyDone

doLegacyUninstall:
  DetailPrint "正在卸载旧版本：$4"
  ExecWait '$0'

legacyDone:
  Pop $5
  Pop $4
  Pop $3
  Pop $2
  Pop $1
  Pop $0
FunctionEnd
!endif

!ifdef BUILD_UNINSTALLER
Function un.MineradioAbortUnsafeUninstallRoot
  ${GetFileName} "$INSTDIR" $0
  ${If} $0 != "${MINERADIO_INSTALL_DIR_NAME}"
  ${AndIf} $0 != "${MINERADIO_INSTALL_DIR_NAME_LOWER}"
    MessageBox MB_ICONSTOP|MB_OK "卸载已中止：$INSTDIR 不是 ${MINERADIO_DISPLAY_NAME} 专用安装目录。为避免误删用户文件，请手动删除程序文件。"
    Abort
  ${EndIf}
  IfFileExists "$INSTDIR\${MINERADIO_INSTALL_MARKER}" safe 0
  MessageBox MB_ICONSTOP|MB_OK "卸载已中止：$INSTDIR 不是 ${MINERADIO_DISPLAY_NAME} 专用安装目录，缺少安全标记 ${MINERADIO_INSTALL_MARKER}。为避免误删用户文件，请手动删除程序文件。"
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

  ${NSD_CreateLabel} 22u 20u 110u 10u "MINERADIO 二创"
  Pop $0
  SendMessage $0 ${WM_SETFONT} $MineradioSmallFont 1
  SetCtlColors $0 "3257F7" "FFFFFF"

  ${NSD_CreateLabel} 22u 42u 226u 30u "${MINERADIO_DISPLAY_NAME}"
  Pop $0
  SendMessage $0 ${WM_SETFONT} $MineradioHeroFont 1
  SetCtlColors $0 "111217" "FFFFFF"

  ${NSD_CreateLabel} 22u 78u 36u 2u ""
  Pop $0
  SetCtlColors $0 "" "3257F7"

  ${NSD_CreateLabel} 22u 96u 238u 24u "为这台电脑安装 ${MINERADIO_DISPLAY_NAME}。默认位置 ${MINERADIO_DEFAULT_INSTALL_DIR}，与原项目 Mineradio 完全独立，可同时安装使用。"
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
  nsDialogs::SelectFolderDialog "选择 ${MINERADIO_DISPLAY_NAME} 安装文件夹" "$INSTDIR"
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

  ${NSD_CreateLabel} 22u 40u 238u 24u "可以使用默认路径，也可以换其它磁盘。安装器会自动创建专用 ${MINERADIO_INSTALL_DIR_NAME} 子目录，卸载更安全。"
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

  ${NSD_CreateLabel} 22u 122u 238u 12u "默认推荐 ${MINERADIO_DEFAULT_INSTALL_DIR}，会自动追加子目录。"
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
