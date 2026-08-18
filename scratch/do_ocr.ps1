[CmdletBinding()]
param (
    [string]$ImagePath
)

Add-Type -AssemblyName System.Runtime.WindowsRuntime

$asTaskGeneric = [System.Windows.Foundation.WindowsRuntimeSystemExtensions].GetMethods() | 
    Where-Object { $_.Name -eq 'AsTask' -and $_.GetParameters().Count -eq 1 -and $_.GetParameters()[0].ParameterType.Name -eq 'IAsyncOperation`1' } | 
    Select-Object -First 1

function AwaitOperation ($asyncOp) {
    $argType = $asyncOp.GetType().GetGenericArguments()[0]
    $asTask = $asTaskGeneric.MakeGenericMethod($argType)
    $task = $asTask.Invoke($null, @($asyncOp))
    $task.Wait()
    return $task.Result
}

[Windows.Globalization.Language, Windows.Foundation.UniversalApiContract, ContentType = WindowsRuntime] | Out-Null
[Windows.Media.Ocr.OcrEngine, Windows.Foundation.UniversalApiContract, ContentType = WindowsRuntime] | Out-Null
[Windows.Graphics.Imaging.BitmapDecoder, Windows.Foundation.UniversalApiContract, ContentType = WindowsRuntime] | Out-Null
[Windows.Storage.StorageFile, Windows.Foundation.UniversalApiContract, ContentType = WindowsRuntime] | Out-Null

$lang = New-Object Windows.Globalization.Language("en-US")
$engine = [Windows.Media.Ocr.OcrEngine]::TryCreateFromLanguage($lang)

$fullPath = [System.IO.Path]::GetFullPath($ImagePath)
$file = AwaitOperation ([Windows.Storage.StorageFile]::GetFileFromPathAsync($fullPath))
$stream = AwaitOperation ($file.OpenAsync([Windows.Storage.FileAccessMode]::Read))
$decoder = AwaitOperation ([Windows.Graphics.Imaging.BitmapDecoder]::CreateAsync($stream))
$bitmap = AwaitOperation ($decoder.GetSoftwareBitmapAsync())

$result = AwaitOperation ($engine.RecognizeAsync($bitmap))
Write-Output $result.Text
