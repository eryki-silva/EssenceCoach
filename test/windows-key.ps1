$ErrorActionPreference = 'Stop'
$tokens = $null
$parseErrors = $null
$scriptPath = Join-Path $PSScriptRoot '..\entrada-chave.ps1'
$null = [System.Management.Automation.Language.Parser]::ParseFile($scriptPath, [ref]$tokens, [ref]$parseErrors)
if ($parseErrors.Count) { throw 'PowerShell syntax validation failed' }
# Exercise Windows DPAPI with a synthetic credential, never the user's key.
$plain = 'test-only-fake-gemini-key'
$secure = ConvertTo-SecureString $plain -AsPlainText -Force
$encrypted = ConvertFrom-SecureString $secure
if ($encrypted.Contains($plain)) { throw 'Plaintext persisted' }
$restored = ConvertTo-SecureString $encrypted
$pointer = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($restored)
try {
    if ([Runtime.InteropServices.Marshal]::PtrToStringBSTR($pointer) -ne $plain) { throw 'DPAPI round trip failed' }
} finally {
    [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($pointer)
    $secure.Dispose()
    $restored.Dispose()
}
Write-Host 'PowerShell syntax and Windows DPAPI round trip: OK (synthetic key).'
