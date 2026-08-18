[CmdletBinding()]
param ([string]$ImagePath)

$fullPath = [System.IO.Path]::GetFullPath($ImagePath)

$null = [Windows.Storage.StorageFile, Windows.Storage, ContentType = WindowsRuntime]
$null = [Windows.Media.Ocr.OcrEngine, Windows.Media.Ocr, ContentType = WindowsRuntime]
$null = [Windows.Graphics.Imaging.BitmapDecoder, Windows.Graphics.Imaging, ContentType = WindowsRuntime]

$fileOp = [Windows.Storage.StorageFile]::GetFileFromPathAsync($fullPath)
while ($fileOp.Status -eq 'Started') { Start-Sleep -Milliseconds 20 }
$file = $fileOp.GetResults()

$streamOp = $file.OpenAsync([Windows.Storage.FileAccessMode]::Read)
while ($streamOp.Status -eq 'Started') { Start-Sleep -Milliseconds 20 }
$stream = $streamOp.GetResults()

$decoderOp = [Windows.Graphics.Imaging.BitmapDecoder]::CreateAsync($stream)
while ($decoderOp.Status -eq 'Started') { Start-Sleep -Milliseconds 20 }
$decoder = $decoderOp.GetResults()

$bitmapOp = $decoder.GetSoftwareBitmapAsync()
while ($bitmapOp.Status -eq 'Started') { Start-Sleep -Milliseconds 20 }
$bitmap = $bitmapOp.GetResults()

$engine = [Windows.Media.Ocr.OcrEngine]::TryCreateFromUserProfileLanguages()
$ocrOp = $engine.RecognizeAsync($bitmap)
while ($ocrOp.Status -eq 'Started') { Start-Sleep -Milliseconds 20 }
$ocrResult = $ocrOp.GetResults()

Write-Output $ocrResult.Text
