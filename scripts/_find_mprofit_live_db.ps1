$mprofitData = "C:\Users\Admin\AppData\Local\MProfit"
if (Test-Path $mprofitData) {
    Get-ChildItem -Path $mprofitData -Filter "*.db" -Recurse | Select-Object FullName, Length, LastWriteTime
}
$mprofitRoaming = "C:\Users\Admin\AppData\Roaming\MProfit"
if (Test-Path $mprofitRoaming) {
    Get-ChildItem -Path $mprofitRoaming -Filter "*.db" -Recurse | Select-Object FullName, Length, LastWriteTime
}
$mprofitDocs = "C:\Users\Admin\Documents\MProfit"
if (Test-Path $mprofitDocs) {
    Get-ChildItem -Path $mprofitDocs -Filter "*.db" -Recurse | Select-Object FullName, Length, LastWriteTime
}
