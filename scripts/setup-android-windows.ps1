# Run from the project root. Compatible with Windows PowerShell 5.1 and PowerShell 7.
[CmdletBinding()]
param(
    [string]$ProjectRoot,
    [string]$SdkPath,
    [string]$JavaPath,
    [string]$NdkRoot = 'C:\ndk',
    [string]$CMakeVersion = '3.31.6',
    [switch]$InstallCMake,
    [switch]$EnableLongPaths,
    [switch]$CheckOnly,
    [switch]$Build,
    [switch]$SelfTest
)
$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest
$script:BackupSuffix = '.backup-' + (Get-Date -Format 'yyyyMMdd-HHmmss-fff')

function Resolve-ProjectRoot([string]$ExplicitRoot, [string]$ScriptDirectory, [string]$CurrentDirectory) {
    if (![string]::IsNullOrWhiteSpace($ExplicitRoot)) { return $ExplicitRoot }
    if (![string]::IsNullOrWhiteSpace($ScriptDirectory)) { return Split-Path -Parent $ScriptDirectory }
    return $CurrentDirectory
}

function Set-LocalProperty([string]$Path, [string]$Key, [string]$Value) {
    $lines = @()
    if (Test-Path -LiteralPath $Path) {
        $lines = @(Get-Content -LiteralPath $Path)
        if (!(Test-Path -LiteralPath ($Path + $script:BackupSuffix))) {
            Copy-Item -LiteralPath $Path -Destination ($Path + $script:BackupSuffix)
        }
    }
    $pattern = '^\s*' + [regex]::Escape($Key) + '\s*[:=]'
    $updated = @($lines | Where-Object { $_ -notmatch $pattern })
    $updated += "$Key=$Value"
    [IO.File]::WriteAllLines($Path, [string[]]$updated, (New-Object Text.UTF8Encoding($false)))
}
function Assert-True([bool]$Condition, [string]$Message) {
    if (!$Condition) { throw $Message }
}
function Java-PropertyPath([string]$Value) {
    # Java .properties uses backslash escapes, including non-ASCII characters.
    $result = $Value.Replace('\', '/').Replace(':', '\:')
    $builder = New-Object Text.StringBuilder
    foreach ($character in $result.ToCharArray()) {
        if ([int]$character -gt 127) { [void]$builder.Append(('\u{0:x4}' -f [int]$character)) }
        else { [void]$builder.Append($character) }
    }
    return $builder.ToString()
}
function Test-Ndk([string]$Path, [string]$Version) {
    $properties = Join-Path $Path 'source.properties'
    $compiler = Join-Path $Path 'toolchains\llvm\prebuilt\windows-x86_64\bin\clang++.exe'
    $runtime = Join-Path $Path 'toolchains\llvm\prebuilt\windows-x86_64\sysroot\usr\lib\x86_64-linux-android\libc++_shared.so'
    return ((Test-Path -LiteralPath $properties) -and (Test-Path -LiteralPath $compiler) -and (Test-Path -LiteralPath $runtime) -and
        ((Get-Content -LiteralPath $properties -Raw) -match ('Pkg\.Revision\s*=\s*' + [regex]::Escape($Version) + '(\s|$)')))
}
if ($SelfTest) {
    $directory = Join-Path ([IO.Path]::GetTempPath()) ('martins-setup-test-' + [guid]::NewGuid())
    [void](New-Item -ItemType Directory -Path $directory)
    try {
        Assert-True ((Resolve-ProjectRoot 'C:\dev\ma' '' 'C:\other') -eq 'C:\dev\ma') 'Explicit project root ignored.'
        Assert-True ((Resolve-ProjectRoot '' 'C:\dev\ma\scripts' 'C:\other') -eq 'C:\dev\ma') 'Script directory resolution failed.'
        Assert-True ((Resolve-ProjectRoot '' '' 'C:\dev\ma') -eq 'C:\dev\ma') 'Empty script directory fallback failed.'
        $file = Join-Path $directory 'local.properties'
        [IO.File]::WriteAllText($file, "# preserve comment`r`nsdk.dir=old`r`nother=value`r`nsdk.dir:duplicate`r`n")
        Set-LocalProperty $file 'sdk.dir' 'C\:/Android/Sdk'
        Set-LocalProperty $file 'sdk.dir' 'C\:/Android/Sdk'
        $content = Get-Content -LiteralPath $file -Raw
        Assert-True ($content.Contains('# preserve comment') -and $content.Contains('other=value')) 'Unrelated properties changed.'
        Assert-True (([regex]::Matches($content, '(?m)^sdk\.dir=')).Count -eq 1) 'Property update is not idempotent.'
        Assert-True ((Get-Content -LiteralPath ($file + $script:BackupSuffix) -Raw).Contains('sdk.dir=old')) 'Original backup was overwritten.'
        Assert-True ((Java-PropertyPath 'C:\Users\Victor Martins\Sdk') -eq 'C\:/Users/Victor Martins/Sdk') 'Path escaping failed.'
        $unicodePath = 'C:\Usu' + [char]0x00e1 + 'rio\Sdk'
        Assert-True ((Java-PropertyPath $unicodePath) -eq 'C\:/Usu\u00e1rio/Sdk') 'Unicode escaping failed.'
        Set-LocalProperty (Join-Path $directory 'new.properties') 'android.cmakeVersion' '3.31.6'
        Assert-True (Test-Path (Join-Path $directory 'new.properties')) 'New properties file not created.'
        Write-Host 'PASS: preservation, backup, idempotency, path escaping and creation.'
    } finally { Remove-Item -LiteralPath $directory -Recurse -Force }
    exit 0
}
try {
    Assert-True ($env:OS -eq 'Windows_NT') 'Execute este script no Windows.'
    # Resolve only after parameter binding. Some hosts leave PSScriptRoot empty in parameter defaults.
    $ProjectRoot = Resolve-ProjectRoot $ProjectRoot $PSScriptRoot (Get-Location).Path
    $ProjectRoot = (Resolve-Path -LiteralPath $ProjectRoot).Path
    Assert-True (Test-Path -LiteralPath (Join-Path $ProjectRoot 'package.json')) 'package.json nao encontrado. Informe -ProjectRoot C:\dev\ma.'
    $package = Get-Content -LiteralPath (Join-Path $ProjectRoot 'package.json') -Raw | ConvertFrom-Json
    Assert-True ($package.name -eq 'martins-advogados') 'Esta pasta nao e o aplicativo Martins Advogados.'
    Assert-True (Test-Path -LiteralPath (Join-Path $ProjectRoot 'android\gradlew.bat')) 'Pasta Android ausente. Execute npm ci e npx expo prebuild --platform android antes deste script.'
    Assert-True ($ProjectRoot -notmatch '\s' -and $ProjectRoot.Length -le 30) 'Use um caminho curto e sem espacos para o projeto, por exemplo C:\dev\ma.'
    $catalog = Join-Path $ProjectRoot 'node_modules\react-native\gradle\libs.versions.toml'
    Assert-True (Test-Path -LiteralPath $catalog) 'Dependencias ausentes. Execute npm ci primeiro.'
    $match = [regex]::Match((Get-Content -LiteralPath $catalog -Raw), '(?m)^ndkVersion\s*=\s*"([0-9.]+)"')
    Assert-True $match.Success 'Nao foi possivel identificar a versao do NDK exigida pelo React Native.'
    $ndkVersion = $match.Groups[1].Value
    if (!$SdkPath) {
        $candidates = @($env:ANDROID_HOME, $env:ANDROID_SDK_ROOT, (Join-Path $env:LOCALAPPDATA 'Android\Sdk'))
        $SdkPath = $candidates | Where-Object { $_ -and (Test-Path -LiteralPath (Join-Path $_ 'platform-tools\adb.exe')) } | Select-Object -First 1
    }
    Assert-True (![string]::IsNullOrWhiteSpace($SdkPath)) 'SDK nao encontrado. Use -SdkPath com o Android SDK Location do Android Studio.'
    $SdkPath = (Resolve-Path -LiteralPath $SdkPath).Path
    Assert-True (Test-Path -LiteralPath (Join-Path $SdkPath 'platform-tools\adb.exe')) 'SDK sem platform-tools/adb.exe.'
    if (!$JavaPath) {
        $candidates = @($env:JAVA_HOME, (Join-Path $env:ProgramFiles 'Android\Android Studio\jbr'))
        $JavaPath = $candidates | Where-Object { $_ -and (Test-Path -LiteralPath (Join-Path $_ 'bin\java.exe')) -and (Test-Path -LiteralPath (Join-Path $_ 'bin\javac.exe')) } | Select-Object -First 1
    }
    Assert-True (![string]::IsNullOrWhiteSpace($JavaPath)) 'JDK nao encontrado. Use -JavaPath com a pasta jbr do Android Studio.'
    $JavaPath = (Resolve-Path -LiteralPath $JavaPath).Path
    Assert-True (Test-Path -LiteralPath (Join-Path $JavaPath 'bin\javac.exe')) 'O caminho Java precisa conter um JDK (bin/javac.exe).'
    $NdkRoot = [IO.Path]::GetFullPath($NdkRoot)
    Assert-True ($NdkRoot -notmatch '\s') 'NdkRoot deve ser um caminho sem espacos.'
    $sourceNdk = Join-Path $SdkPath "ndk\$ndkVersion"
    $targetNdk = Join-Path $NdkRoot $ndkVersion
    Assert-True ((Test-Ndk $sourceNdk $ndkVersion) -or (Test-Ndk $targetNdk $ndkVersion)) "Instale NDK (Side by side) $ndkVersion pelo SDK Manager."
    $cmakeDirectory = Join-Path $SdkPath "cmake\$CMakeVersion"
    $cmake = Join-Path $cmakeDirectory 'bin\cmake.exe'
    $ninja = Join-Path $cmakeDirectory 'bin\ninja.exe'
    $longPaths = (Get-ItemProperty -Path 'HKLM:\SYSTEM\CurrentControlSet\Control\FileSystem').LongPathsEnabled
    Write-Host "Projeto: $ProjectRoot"
    Write-Host "JDK: $JavaPath"
    Write-Host "SDK: $SdkPath"
    Write-Host "NDK exigido: $ndkVersion -> $targetNdk"
    Write-Host "CMake: $CMakeVersion | instalado: $(Test-Path -LiteralPath $cmake)"
    Write-Host "Caminhos longos: $longPaths"
    if ($CheckOnly) { Write-Host 'Diagnostico concluido. Nenhum arquivo ou configuracao alterado.'; exit 0 }
    if ($EnableLongPaths -and $longPaths -ne 1) {
        $identity = [Security.Principal.WindowsIdentity]::GetCurrent()
        $principal = New-Object Security.Principal.WindowsPrincipal($identity)
        Assert-True ($principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) 'Para -EnableLongPaths, abra PowerShell como administrador.'
        New-ItemProperty -Path 'HKLM:\SYSTEM\CurrentControlSet\Control\FileSystem' -Name 'LongPathsEnabled' -Value 1 -PropertyType DWORD -Force | Out-Null
        Write-Host 'Caminhos longos habilitados. REINICIE o Windows e execute o script novamente.'
        exit 0
    }
    Assert-True ($longPaths -eq 1) 'Execute este script como administrador com -EnableLongPaths e reinicie o Windows antes de continuar.'
    $env:JAVA_HOME = $JavaPath
    $env:ANDROID_HOME = $SdkPath
    # Keep the deprecated variable consistent only if it already exists.
    if ($env:ANDROID_SDK_ROOT) { $env:ANDROID_SDK_ROOT = $SdkPath }
    $env:Path = "$JavaPath\bin;$SdkPath\platform-tools;$SdkPath\emulator;$env:Path"
    & (Join-Path $JavaPath 'bin\java.exe') -version
    Assert-True ($LASTEXITCODE -eq 0) 'Java nao executou corretamente.'
    if (!(Test-Path -LiteralPath $cmake)) {
        Assert-True ([bool]$InstallCMake) "Instale CMake $CMakeVersion no SDK Manager ou execute com -InstallCMake."
        $sdkManager = Join-Path $SdkPath 'cmdline-tools\latest\bin\sdkmanager.bat'
        Assert-True (Test-Path -LiteralPath $sdkManager) 'Instale Android SDK Command-line Tools (latest) no SDK Manager ou instale o CMake manualmente.'
        & $sdkManager "--sdk_root=$SdkPath" "cmake;$CMakeVersion"
        Assert-True ($LASTEXITCODE -eq 0) 'A instalacao do CMake falhou. Confira a rede e as licencas no SDK Manager.'
    }
    Assert-True ((Test-Path -LiteralPath $cmake) -and (Test-Path -LiteralPath $ninja)) 'Instalacao do CMake/Ninja incompleta.'
    $ninjaVersion = (& $ninja --version | Out-String).Trim()
    Assert-True ($LASTEXITCODE -eq 0) 'Ninja nao executou corretamente.'
    Assert-True ([version]$ninjaVersion -ge [version]'1.12.0') "Ninja $ninjaVersion nao suporta os caminhos necessarios."
    & (Join-Path $ProjectRoot 'android\gradlew.bat') --stop
    Assert-True ($LASTEXITCODE -eq 0) 'Nao foi possivel parar o Gradle. Feche o Android Studio e tente novamente.'
    if (!(Test-Ndk $targetNdk $ndkVersion)) {
        Assert-True (Test-Ndk $sourceNdk $ndkVersion) 'NDK de origem incompleto.'
        [void](New-Item -ItemType Directory -Path $targetNdk -Force)
        Write-Host 'Copiando NDK para um caminho sem espacos. A origem sera preservada...'
        & robocopy.exe $sourceNdk $targetNdk /E /R:1 /W:1 /NFL /NDL /NP
        Assert-True ($LASTEXITCODE -lt 8) 'Falha ao copiar NDK. Confira espaco em disco e permissoes.'
    }
    Assert-True (Test-Ndk $targetNdk $ndkVersion) 'A copia do NDK nao passou na verificacao.'
    $localProperties = Join-Path $ProjectRoot 'android\local.properties'
    Set-LocalProperty $localProperties 'sdk.dir' (Java-PropertyPath $SdkPath)
    Set-LocalProperty $localProperties 'ndk.dir' (Java-PropertyPath $targetNdk)
    Set-LocalProperty (Join-Path $ProjectRoot 'android\gradle.properties') 'android.cmakeVersion' $CMakeVersion
    $generated = @('android\.cxx','android\app\.cxx','android\.gradle','android\build','android\app\build',
        'node_modules\expo-modules-core\android\.cxx','node_modules\expo-modules-core\android\build',
        'node_modules\react-native-safe-area-context\android\.cxx','node_modules\react-native-safe-area-context\android\build')
    foreach ($relative in $generated) {
        $path = Join-Path $ProjectRoot $relative
        if (Test-Path -LiteralPath $path) {
            Assert-True (!((Get-Item -LiteralPath $path).Attributes -band [IO.FileAttributes]::ReparsePoint)) "Cache e um link; remova manualmente: $path"
            Remove-Item -LiteralPath $path -Recurse -Force
        }
    }
    [Environment]::SetEnvironmentVariable('JAVA_HOME', $JavaPath, 'User')
    [Environment]::SetEnvironmentVariable('ANDROID_HOME', $SdkPath, 'User')
    if ([Environment]::GetEnvironmentVariable('ANDROID_SDK_ROOT','User')) {
        [Environment]::SetEnvironmentVariable('ANDROID_SDK_ROOT', $SdkPath, 'User')
    }
    Write-Host 'Configuracao concluida. .env e codigo preservados; backups dos arquivos .properties criados.'
    if ($Build) {
        Push-Location $ProjectRoot
        try { & npm.cmd run android -- --device; Assert-True ($LASTEXITCODE -eq 0) 'A compilacao ainda falhou. Envie o primeiro erro e What went wrong do novo log.' }
        finally { Pop-Location }
    } else { Write-Host 'Para compilar com este ambiente: execute novamente com -Build.' }
    exit 0
} catch {
    Write-Error $_ -ErrorAction Continue
    exit 1
}
