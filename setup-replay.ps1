param([switch]$RebuildOnly)
$ErrorActionPreference = 'Stop'
Set-Location -LiteralPath $PSScriptRoot
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
$runtime = Join-Path $PSScriptRoot '.runtime'
New-Item -ItemType Directory -Path $runtime -Force | Out-Null
function Download-Checked($url, $path, $expected, $algorithm) {
    if (-not (Test-Path -LiteralPath $path)) { Invoke-WebRequest -UseBasicParsing -Uri $url -OutFile $path -TimeoutSec 600 }
    if ((Get-FileHash -LiteralPath $path -Algorithm $algorithm).Hash -ne $expected.Trim().ToUpperInvariant()) { throw 'Falha de integridade do download. Nenhum executavel foi iniciado.' }
}
if (-not $RebuildOnly) {
Write-Host 'Obtendo Java 21 portatil da Eclipse Adoptium...'
$assets = Invoke-RestMethod 'https://api.adoptium.net/v3/assets/latest/21/hotspot?architecture=x64&image_type=jdk&os=windows&vendor=eclipse'
$package = $assets[0].binary.package
$jdkZip = Join-Path $runtime $package.name
Download-Checked $package.link $jdkZip $package.checksum 'SHA256'
$jdkFolder = Join-Path $runtime 'jdk'
if (-not (Test-Path -LiteralPath $jdkFolder)) { Expand-Archive -LiteralPath $jdkZip -DestinationPath $jdkFolder }
$javaRoot = Get-ChildItem -LiteralPath $jdkFolder -Directory | Select-Object -First 1
$javaPath = Join-Path $javaRoot.FullName 'bin\java.exe'
Write-Host 'Obtendo Maven portatil do Maven Central...'
$mavenUrl = 'https://repo.maven.apache.org/maven2/org/apache/maven/apache-maven/3.9.12/apache-maven-3.9.12-bin.zip'
$checksum = (Invoke-WebRequest -UseBasicParsing ($mavenUrl + '.sha512')).Content.Trim()
$mavenZip = Join-Path $runtime 'maven.zip'
Download-Checked $mavenUrl $mavenZip $checksum 'SHA512'
$mavenFolder = Join-Path $runtime 'maven'
if (-not (Test-Path -LiteralPath $mavenFolder)) { Expand-Archive -LiteralPath $mavenZip -DestinationPath $mavenFolder }
$mavenRoot = Get-ChildItem -LiteralPath $mavenFolder -Directory | Select-Object -First 1
Write-Host 'Obtendo fonte versionada do parser OpenDota (licenca MIT)...'
$revision = (Invoke-RestMethod 'https://api.github.com/repos/odota/parser/commits/master').sha
if ($revision -notmatch '^[a-f0-9]{40}$') { throw 'Revisao do parser invalida' }
$sourceZip = Join-Path $runtime ('parser-' + $revision + '.zip')
if (-not (Test-Path -LiteralPath $sourceZip)) { Invoke-WebRequest -UseBasicParsing ('https://codeload.github.com/odota/parser/zip/' + $revision) -OutFile $sourceZip -TimeoutSec 180 }
$sourceParent = Join-Path $runtime 'source'
$sourceRoot = Join-Path $sourceParent ('parser-' + $revision)
if (-not (Test-Path -LiteralPath $sourceRoot)) { Expand-Archive -LiteralPath $sourceZip -DestinationPath $sourceParent }
} else {
    $installed = Get-Content -LiteralPath (Join-Path $runtime 'parser.json') -Raw | ConvertFrom-Json
    $revision = $installed.parser_revision
    if ($revision -notmatch '^[a-f0-9]{40}$') { throw 'Revisao instalada invalida' }
    $sourceRoot = Join-Path $runtime ('source\parser-' + $revision)
    $javaPath = $installed.java
    $javaRoot = Get-Item -LiteralPath (Split-Path (Split-Path $javaPath -Parent) -Parent)
    $mavenRoot = Get-ChildItem -LiteralPath (Join-Path $runtime 'maven') -Directory | Select-Object -First 1
}
# Add our stdin/stdout adapter; the upstream server is never exposed or started.
Copy-Item -LiteralPath (Join-Path $PSScriptRoot 'parser-adapter\CoachCli.java') -Destination (Join-Path $sourceRoot 'src\main\java\opendota\CoachCli.java') -Force
Copy-Item -LiteralPath (Join-Path $PSScriptRoot 'parser-adapter\CoachTelemetry.java') -Destination (Join-Path $sourceRoot 'src\main\java\opendota\CoachTelemetry.java') -Force
$parseFile = Join-Path $sourceRoot 'src\main\java\opendota\Parse.java'
$parseSource = [IO.File]::ReadAllText($parseFile)
if (-not $parseSource.Contains('coach_match_id')) {
    $anchor = 'public void onFileInfo(Context ctx, CDemoFileInfo message) {'
    if (-not $parseSource.Contains($anchor)) { throw 'O parser mudou de formato. Revise o adaptador antes de compilar.' }
    $replacement = $anchor + "`n        Entry coachId = new Entry(); coachId.type = `"coach_match_id`"; coachId.key = Long.toString(message.getGameInfo().getDota().getMatchId()); output(coachId);"
    [IO.File]::WriteAllText($parseFile, $parseSource.Replace($anchor, $replacement))
}
$parseSource = [IO.File]::ReadAllText($parseFile)
if (-not $parseSource.Contains('coachTelemetry.capture')) {
    $lifeAnchor = 'entry.life_state = getEntityProperty(e, "m_lifeState", null);'
    $filterAnchor = 'default -> n.startsWith("CDOTA_Unit_Hero_")'
    if (-not $parseSource.Contains($lifeAnchor) -or -not $parseSource.Contains($filterAnchor)) { throw 'Estrutura do parser mudou: adaptacao de estado requer revisao.' }
    $parseSource = $parseSource.Replace('float INTERVAL = 1;', "private final CoachTelemetry coachTelemetry = new CoachTelemetry(this);`n    float INTERVAL = 1;")
    $parseSource = $parseSource.Replace($lifeAnchor, $lifeAnchor + "`n                        coachTelemetry.capture(ctx, e, entry.slot, time);")
    $parseSource = $parseSource.Replace($filterAnchor, 'default -> n.contains("Creep_") || n.contains("Tower") || n.startsWith("CDOTA_Unit_Hero_")')
    [IO.File]::WriteAllText($parseFile, $parseSource)
}
$originalJavaHome = $env:JAVA_HOME
$originalMavenOptions = $env:MAVEN_OPTS
try {
    $env:JAVA_HOME = $javaRoot.FullName
    # Honor the Windows trust store (including corporate CAs); keep TLS validation enabled.
    $env:MAVEN_OPTS = ($originalMavenOptions + ' -Djavax.net.ssl.trustStoreType=Windows-ROOT -Djavax.net.ssl.trustStore=NONE').Trim()
    & (Join-Path $mavenRoot.FullName 'bin\mvn.cmd') -q -f (Join-Path $sourceRoot 'pom.xml') '-Dmaven.repo.local=.runtime-m2' '-DskipTests' package
    if ($LASTEXITCODE -ne 0) { throw 'A compilacao do parser falhou.' }
} finally { $env:JAVA_HOME = $originalJavaHome; $env:MAVEN_OPTS = $originalMavenOptions }
$jar = Join-Path $runtime 'replay-parser.jar'
Copy-Item -LiteralPath (Join-Path $sourceRoot 'target\stats-0.1.0.jar') -Destination $jar -Force
$config = @{ java = $javaPath; jar = $jar; parser_revision = $revision; adapter = 'CoachCli-v3'; installed_at = [DateTime]::UtcNow.ToString('o') }
$config | ConvertTo-Json | Set-Content -LiteralPath (Join-Path $runtime 'parser.json') -Encoding UTF8
Write-Host 'Parser instalado na pasta do projeto. Nenhuma chave foi lida ou alterada.'
