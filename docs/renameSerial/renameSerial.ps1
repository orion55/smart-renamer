[string]$curDir = Split-Path -Path $myInvocation.MyCommand.Path -Parent
. $curDir/libs/lib.ps1
. $curDir/libs/PSMultiLog.ps1

#$inDir = "$curDir\in"
#$inDir = "g:\MamulFilms"
$inDir = "f:\Сериалы"

[string]$logName = (Get-Item $PSCommandPath ).DirectoryName + "\log\serial.log"

function getToken() {
	# https://yandex.cloud/ru/docs/iam/operations/iam-token/create
    $yandexPassportOauthToken = "YOUR_YANDEX_PASSPORT_OAUTH_TOKEN_HERE"
    $Body = @{ yandexPassportOauthToken = "$yandexPassportOauthToken" } | ConvertTo-Json -Compress
    Try {
        $response = Invoke-RestMethod -Method 'POST' -Uri 'https://iam.api.cloud.yandex.net/iam/v1/tokens' -Body $Body -ContentType 'Application/json'
        return  $response.iamToken    
    }
    Catch {                        
        $text = "StatusCode:" + $_.Exception.Response.StatusCode.value__ + " ReasonPhrase: " + $_.Exception.Response.ReasonPhrase
        Write-Log -EntryType Error -Message $text     
    }    
}

function translate() {
    Param(
        [string]$text
    )
    $text = $text.Trim()
    $headers = New-Object "System.Collections.Generic.Dictionary[[String],[String]]"
    $headers.Add("Content-Type", "application/json; charset=utf-8")
    $headers.Add("Authorization", "Bearer " + $token)
    
    $body = @{ 
        folderId           = "b1ge1vr81g330igour00"
        texts              = @($text)
        targetLanguageCode = "ru" 
    } | ConvertTo-Json -Compress
    
    Try {
        $response = Invoke-RestMethod 'https://translate.api.cloud.yandex.net/translate/v2/translate' -Method 'POST' -Headers $headers -Body $body
        $result = $response.translations[0].text
        if ($result.IndexOf("??") -eq -1) {
            return $result
        }
        else {
            return $text
        }  
    }    
    Catch {                        
        $text = "StatusCode:" + $_.Exception.Response.StatusCode.value__ + " ReasonPhrase: " + $_.Exception.Response.ReasonPhrase
        Write-Log -EntryType Error -Message $text
        throw        
    } 
}

Set-Location $curDir

testDir(@($inDir))
createDir($("$curDir\log"))

Start-HostLog -LogLevel Information
Start-FileLog -LogLevel Information -FilePath $logName -Append

$token = getToken

$aviFormats = @("*.mkv", "*.avi", "*.mp4", "*.ts") 

$fileList = Get-ChildItem -Path $inDir -Directory
$directoryCount = ($fileList | Measure-Object).count

if ($directoryCount -gt 0) {
    #Устраняем многоуровневость папок и удаляем невидео файлы
    $tmpDir = "$inDir\tmp"
    New-Item -ItemType directory -Path $tmpDir | out-Null

    foreach ($file in $fileList) {
        #если вложенность папок больше 0
        if ((Get-ChildItem -LiteralPath $file.FullName -Directory -Recurse | Measure-Object).count -gt 0) {
            Get-ChildItem -LiteralPath $file.FullName -File -Recurse | Move-Item -Destination $tmpDir -Force
            Get-ChildItem $tmpDir -Exclude $aviFormats | Remove-item
            Get-ChildItem -LiteralPath $file.FullName -Recurse -Directory | Remove-Item -Force -Confirm:$false -Recurse
            Get-ChildItem $tmpDir -File -Recurse | Move-Item -Destination $file.FullName -Force
        }
    }

    Remove-Item $tmpDir -Force

    foreach ($file in $fileList) {
        $videoFiles = Get-ChildItem -LiteralPath $file.FullName -File | Where-Object { $_.extension -in ".avi", ".mkv", ".mp4", ".ts" }
        $videoCount = ($videoFiles | Measure-Object).count
        if ($videoCount -eq 1) {
            Move-Item -LiteralPath $videoFiles.FullName -Destination $inDir        
            Write-Log -EntryType Information -Message "Перемещено $videoFiles"
            Remove-Item -LiteralPath $file.FullName -Recurse -Force
            Write-Log -EntryType Warning -Message "Удалено $file"
        }
        if ($videoCount -gt 1) {
            Get-ChildItem -LiteralPath $file.FullName -File | Where-Object { $_.extension -in ".srt" } | Remove-Item
            foreach ($video in $videoFiles) {
                $numberRange = "['s', 'S'](\d{2})['e', 'E'](\d{2})"
                if ($video.name -match $numberRange) {
                    $i = $Matches[1] 
                    $j = $Matches[2]                
                    if ($i -eq "01") {
                        $name = "$($video.DirectoryName)\$j$($video.Extension)"
                    }
                    else {
                        $name = "$($video.DirectoryName)\$i$j$($video.Extension)"
                    }
                    Rename-Item -LiteralPath $video.FullName -NewName $name
                }
                
                $numberRange = "\.(\d{2})\."
                if ($video.name -match $numberRange) {
                    $k = $Matches[1]                     
                    $name = "$($video.DirectoryName)\$k$($video.Extension)"
                    Rename-Item -LiteralPath $video.FullName -NewName $name
                }

                $numberRange = "\.['s', 'S'](\d{2})\.['e', 'E'](\d{2})\."
                if ($video.name -match $numberRange) {
                    $i = $Matches[1] 
                    $j = $Matches[2]                
                    if ($i -eq "01") {
                        $name = "$($video.DirectoryName)\$j$($video.Extension)"
                    }
                    else {
                        $name = "$($video.DirectoryName)\$i$j$($video.Extension)"
                    }
                    Rename-Item -LiteralPath $video.FullName -NewName $name
                }               
            }        
        }
    }

    $fileList = Get-ChildItem -Path $inDir -Directory
    foreach ($file in $fileList) {
        $fileName = $file.Name
        $season = "['.', '_']['S', 's']\d{2}['.', '_']"
        $newName = $fileName

        if ($fileName -match $season) {
            $index = $fileName.IndexOf($Matches[0])
            $newName = $fileName.Substring(0, $index)
        }

        $newName = $newName.Replace(".", " ").Replace("_", " ").Replace("[", " ").Replace("]", " ")    
        
        Try {
            $newName = translate -text $newName

            $name = "$inDir\$newName"
            if ($name -ne $file.FullName) {
                Rename-Item -LiteralPath $file.FullName -NewName $name -Force -ErrorAction 'Stop'
                Write-Log -EntryType Information -Message "Переименован $($file.FullName) --> $name"                
            } 
        }
        Catch {                
            Write-Log -EntryType Error -Message "Ошибка перевода $fileName"
        }         
    }
}

$fileList = Get-ChildItem -Path $inDir -File
foreach ($file in $fileList) {
    $fileName = $file.BaseName
    $year = "['.', '_', '(', ' ']\d{4}['.', '_', ')', ' ']"
    $newName = $fileName

    if ($file -match $year) {
        $index = $fileName.IndexOf($Matches[0])
        if ($index -gt 0) {
            $newName = $fileName.Substring(0, $index)
        }
    }
        
    $newName = $newName.Replace(".", " ").Replace("_", " ")            
    if (!($file -is [System.IO.DirectoryInfo])) {
        Try {
            $translateName = translate -text $newName
            $name = "$($file.DirectoryName)\$translateName$($file.Extension)"
            if ($name -ne $file.FullName) {                
                try {
                    Rename-Item -LiteralPath $file.FullName -NewName $name -ErrorAction 'Stop'
                    Write-Log -EntryType Information -Message "Переименован $($file.FullName) --> $name"
                }               
                catch {
                    Write-Log -EntryType Error -Message $_.Exception.Message
                    Remove-Item -LiteralPath $file.FullName
                    Write-Log -EntryType Information -Message "Дублирующий файл удалён $($file.FullName)"
                }
            }
        }
        Catch {            
            Write-Log -EntryType Error -Message "Ошибка перевода $fileName"
        }        
    }
}

Stop-FileLog
Stop-HostLog