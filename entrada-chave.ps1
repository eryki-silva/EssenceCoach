param([switch]$TrocarChave)
$ErrorActionPreference = 'Stop'
Set-Location -LiteralPath $PSScriptRoot
$savedKeyPath = Join-Path $PSScriptRoot '.gemini-key.windows'
$savedKeyNotice = ''
if (-not $TrocarChave -and (Test-Path -LiteralPath $savedKeyPath)) {
    $secretPointer = [IntPtr]::Zero
    try {
        $secureKey = Get-Content -LiteralPath $savedKeyPath -Raw | ConvertTo-SecureString
        $secretPointer = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secureKey)
        $candidate = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($secretPointer)
        if (-not $candidate -or $candidate -match '[^\x21-\x7e]') { throw 'Invalid saved credential' }
        $env:GEMINI_API_KEY = $candidate
    } catch {
        $savedKeyNotice = 'Nao foi possivel ler a chave salva neste usuario/Windows. Informe a chave novamente.'
    } finally {
        if ($secretPointer -ne [IntPtr]::Zero) { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($secretPointer) }
        if ($secureKey) { $secureKey.Dispose() }
        $candidate = $null
    }
    if (-not $savedKeyNotice) {
        try {
            Write-Host 'Usando a chave protegida salva neste Windows.'
            & $env:DOTA_NODE_EXEC --env-file-if-exists=.env --use-env-proxy launch.mjs
            exit $LASTEXITCODE
        } finally { Remove-Item Env:GEMINI_API_KEY -ErrorAction SilentlyContinue }
    }
}
Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing

$form = New-Object System.Windows.Forms.Form
$form.Text = 'Dota Coach - Chave Google Gemini'
$form.ClientSize = New-Object System.Drawing.Size(560, 265)
$form.StartPosition = 'CenterScreen'
$label = New-Object System.Windows.Forms.Label
$label.SetBounds(20, 15, 520, 45)
$label.Text = 'Cole a chave do Google AI Studio. Voce pode salva-la criptografada para este usuario do Windows e abrir o app sem digitar novamente.'
$inputKey = New-Object System.Windows.Forms.TextBox
$inputKey.SetBounds(20, 65, 520, 25)
$inputKey.UseSystemPasswordChar = $true
$inputKey.MaxLength = 4096
$status = New-Object System.Windows.Forms.Label
$remember = New-Object System.Windows.Forms.CheckBox
$remember.SetBounds(20, 100, 520, 25)
$remember.Text = 'Lembrar minha chave neste Windows (protegida pelo meu usuario)'
$remember.Checked = $true
$status.SetBounds(20, 135, 520, 50)
$status.Text = if ($savedKeyNotice) { $savedKeyNotice } else { 'Aguardando a chave.' }
$button = New-Object System.Windows.Forms.Button
$button.SetBounds(360, 210, 180, 32)
$button.Text = 'Iniciar aplicativo'
$inputKey.Add_TextChanged({ $status.Text = 'Caracteres recebidos: ' + $inputKey.Text.Length })
$button.Add_Click({
    $candidate = $inputKey.Text.Trim()
    if (-not $candidate) { $status.Text = 'Cole a chave antes de continuar.'; return }
    if ($candidate -match '[^\x21-\x7e]') {
        $status.Text = 'O texto recebido contem espacos ou caracteres invisiveis/nao ASCII. Apague o campo e copie novamente a chave original.'
        return
    }
    if ($candidate -match '["''\*\u2022]') {
        $status.Text = 'O texto contem aspas ou simbolos de mascara. Copie o valor original completo da chave.'
        return
    }
    try {
        if ($remember.Checked) {
            $secureKey = ConvertTo-SecureString -String $candidate -AsPlainText -Force
            try {
                $encryptedKey = ConvertFrom-SecureString -SecureString $secureKey
                [IO.File]::WriteAllText($savedKeyPath + '.tmp', $encryptedKey)
                Move-Item -LiteralPath ($savedKeyPath + '.tmp') -Destination $savedKeyPath -Force
            } finally { $secureKey.Dispose(); $encryptedKey = $null }
        } elseif (Test-Path -LiteralPath $savedKeyPath) {
            Remove-Item -LiteralPath $savedKeyPath -Force
        }
    } catch {
        $status.Text = 'Nao foi possivel atualizar a chave salva. Confira a permissao da pasta ou desmarque Lembrar.'
        return
    }
    $env:GEMINI_API_KEY = $candidate
    $candidate = $null
    $form.DialogResult = [System.Windows.Forms.DialogResult]::OK
    $form.Close()
})
$form.Controls.AddRange(@($label, $inputKey, $remember, $status, $button))
$form.AcceptButton = $button
try {
    if ($form.ShowDialog() -ne [System.Windows.Forms.DialogResult]::OK) { exit 0 }
    $inputKey.Clear()
    & $env:DOTA_NODE_EXEC --env-file-if-exists=.env --use-env-proxy launch.mjs
    exit $LASTEXITCODE
} finally {
    Remove-Item Env:GEMINI_API_KEY -ErrorAction SilentlyContinue
    $form.Dispose()
}
