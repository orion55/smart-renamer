#Очищаем экран и устанавливаем цвета
function ClearUI{
	$bckgrnd = "DarkBlue"
	$Host.UI.RawUI.BackgroundColor = $bckgrnd
	$Host.UI.RawUI.ForegroundColor = 'White'
	$Host.PrivateData.ErrorForegroundColor = 'Red'
	$Host.PrivateData.ErrorBackgroundColor = $bckgrnd
	$Host.PrivateData.WarningForegroundColor = 'Magenta'
	$Host.PrivateData.WarningBackgroundColor = $bckgrnd
	$Host.PrivateData.DebugForegroundColor = 'Yellow'
	$Host.PrivateData.DebugBackgroundColor = $bckgrnd
	$Host.PrivateData.VerboseForegroundColor = 'Green'
	$Host.PrivateData.VerboseBackgroundColor = $bckgrnd
	Clear-Host
}

#Проверяем существуют ли каталоги?
function testDir($dirList){	
	foreach ($curPath in $dirList){
		#проверка существования путей
		if (!(Test-Path -Path $curPath)){
			Write-Host -ForegroundColor Red "Путь $curPath не найден!"
			Write-Host -ForegroundColor Red "Нажмите любую клавишу для продолжения" 
			Read-Host "Нажмите Enter"			
			Exit
		}
	}
}

#Проверяем существуют ли файлы?
function testFiles($filesList){	
	foreach ($curFile in $filesList){
		#проверка существования файлов
		if (!(Test-Path $curFile)){
			Write-Host -ForegroundColor Red "Файл $curFile не найден!"
			Write-Host -ForegroundColor Red "Нажмите любую клавишу для продолжения"  
			Read-Host "Нажмите Enter"			
			Exit
		}
	}
}

#Проверяем существуют ли каталоги, если не существует, то создаём?
function createDir($dirList){	
	foreach ($curPath in $dirList){
		#проверка существования путей
		if (!(Test-Path -Path $curPath)){
			New-Item -ItemType directory -Path $curPath | out-Null
		}
	}
}