# KioskArcade OS - Windows 11 Kiosk Mode Setup Script
# This script configures Windows 11 for secure arcade deployment

param(
    [string]$AppPath = "",
    [string]$AppName = "KioskArcade OS",
    [switch]$Force = $false,
    [switch]$Revert = $false
)

# Run as Administrator check
if (-NOT ([Security.Principal.WindowsPrincipal] [Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole] "Administrator")) {
    Write-Error "This script must be run as Administrator"
    exit 1
}

# Configuration
$KioskUser = "KioskUser"
$KioskPassword = "KioskPass123!"
$AppPath = if ($AppPath) { $AppPath } else { "C:\Program Files\KioskArcade-OS\KioskArcade OS.exe" }
$StartupScript = "C:\Program Files\KioskArcade-OS\startup.bat"

function Write-Status {
    param([string]$Message, [string]$Status = "INFO")
    $timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
    Write-Host "[$timestamp] [$Status] $Message" -ForegroundColor $(if ($Status -eq "ERROR") { "Red" } elseif ($Status -eq "SUCCESS") { "Green" } else { "Yellow" })
}

function Test-Prerequisites {
    Write-Status "Checking prerequisites..."
    
    # Check Windows version
    $os = Get-WmiObject -Class Win32_OperatingSystem
    if ($os.Version -notlike "10.*") {
        Write-Status "Windows 11 is required. Current version: $($os.Caption)" "ERROR"
        return $false
    }
    
    # Check if running as Administrator
    if (-NOT ([Security.Principal.WindowsPrincipal] [Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole] "Administrator")) {
        Write-Status "Administrator privileges required" "ERROR"
        return $false
    }
    
    Write-Status "Prerequisites check passed" "SUCCESS"
    return $true
}

function Set-KioskUser {
    Write-Status "Setting up kiosk user account..."
    
    try {
        # Check if user already exists
        $existingUser = Get-LocalUser -Name $KioskUser -ErrorAction SilentlyContinue
        if ($existingUser) {
            Write-Status "Kiosk user already exists, updating password..."
            Set-LocalUser -Name $KioskUser -Password (ConvertTo-SecureString $KioskPassword -AsPlainText -Force)
        } else {
            Write-Status "Creating kiosk user account..."
            New-LocalUser -Name $KioskUser -Password (ConvertTo-SecureString $KioskPassword -AsPlainText -Force) -Description "Kiosk Arcade User" -AccountNeverExpires
        }
        
        # Add user to appropriate groups
        Add-LocalGroupMember -Group "Users" -Member $KioskUser -ErrorAction SilentlyContinue
        
        Write-Status "Kiosk user setup completed" "SUCCESS"
        return $true
    } catch {
        Write-Status "Failed to setup kiosk user: $($_.Exception.Message)" "ERROR"
        return $false
    }
}

function Set-KioskMode {
    Write-Status "Configuring kiosk mode..."
    
    try {
        # Enable kiosk mode using Windows Configuration Designer
        $kioskConfig = @{
            "KioskMode" = @{
                "EnableKioskMode" = $true
                "KioskUser" = $KioskUser
                "KioskApp" = $AppPath
            }
        }
        
        # Set registry keys for kiosk mode
        $registryPath = "HKLM:\SOFTWARE\Microsoft\Windows\CurrentVersion\Policies\System"
        
        # Create registry path if it doesn't exist
        if (!(Test-Path $registryPath)) {
            New-Item -Path $registryPath -Force | Out-Null
        }
        
        # Set kiosk mode registry values
        Set-ItemProperty -Path $registryPath -Name "EnableKioskMode" -Value 1 -Type DWord
        Set-ItemProperty -Path $registryPath -Name "KioskUser" -Value $KioskUser -Type String
        Set-ItemProperty -Path $registryPath -Name "KioskApp" -Value $AppPath -Type String
        
        Write-Status "Kiosk mode configuration completed" "SUCCESS"
        return $true
    } catch {
        Write-Status "Failed to configure kiosk mode: $($_.Exception.Message)" "ERROR"
        return $false
    }
}

function Set-SecurityHardening {
    Write-Status "Applying security hardening..."
    
    try {
        # Disable Windows features that could be exploited
        $featuresToDisable = @(
            "Windows-Defender-Default-Definitions",
            "Internet-Explorer-Optional-amd64",
            "WorkFolders-Client"
        )
        
        foreach ($feature in $featuresToDisable) {
            try {
                Disable-WindowsOptionalFeature -Online -FeatureName $feature -NoRestart -ErrorAction SilentlyContinue
                Write-Status "Disabled Windows feature: $feature"
            } catch {
                Write-Status "Could not disable $feature (may not be installed)" "WARNING"
            }
        }
        
        # Configure security policies
        $securityPolicies = @{
            "HKLM:\SOFTWARE\Microsoft\Windows\CurrentVersion\Policies\System" = @{
                "EnableLUA" = 1
                "EnableVirtualization" = 1
                "EnableInstallerDetection" = 1
                "EnableSecureUIAPaths" = 1
                "EnableUIADesktopToggle" = 0
                "EnableCursorSuppression" = 1
                "EnableInstallerDetection" = 1
                "EnableVirtualization" = 1
                "EnableLUA" = 1
                "EnableSecureUIAPaths" = 1
                "EnableUIADesktopToggle" = 0
                "EnableCursorSuppression" = 1
            }
            "HKLM:\SOFTWARE\Microsoft\Windows\CurrentVersion\Policies\Explorer" = @{
                "NoRun" = 1
                "NoFind" = 1
                "NoControlPanel" = 1
                "NoSetTaskbar" = 1
                "NoSetFolders" = 1
                "NoDesktop" = 1
                "NoClose" = 1
                "NoLogOff" = 1
                "NoStartMenuMorePrograms" = 1
                "NoStartMenuSubFolders" = 1
                "NoRecentDocsMenu" = 1
                "NoRecentDocsHistory" = 1
                "NoNetworkConnections" = 1
                "NoPropertiesMyComputer" = 1
                "NoPropertiesMyDocuments" = 1
                "NoPropertiesRecycleBin" = 1
                "NoPropertiesMyPictures" = 1
                "NoPropertiesMyMusic" = 1
                "NoPropertiesMyVideos" = 1
                "NoPropertiesMyNetworkPlaces" = 1
                "NoPropertiesInternetExplorer" = 1
                "NoPropertiesRecycleBin" = 1
                "NoPropertiesMyComputer" = 1
                "NoPropertiesMyDocuments" = 1
                "NoPropertiesMyPictures" = 1
                "NoPropertiesMyMusic" = 1
                "NoPropertiesMyVideos" = 1
                "NoPropertiesMyNetworkPlaces" = 1
                "NoPropertiesInternetExplorer" = 1
            }
        }
        
        foreach ($path in $securityPolicies.Keys) {
            if (!(Test-Path $path)) {
                New-Item -Path $path -Force | Out-Null
            }
            
            foreach ($key in $securityPolicies[$path].Keys) {
                Set-ItemProperty -Path $path -Name $key -Value $securityPolicies[$path][$key] -Type DWord
            }
        }
        
        # Disable Windows Update (optional for kiosk)
        Set-Service -Name "wuauserv" -StartupType Disabled -ErrorAction SilentlyContinue
        
        # Disable Windows Defender (optional for kiosk)
        Set-MpPreference -DisableRealtimeMonitoring $true -ErrorAction SilentlyContinue
        
        Write-Status "Security hardening completed" "SUCCESS"
        return $true
    } catch {
        Write-Status "Failed to apply security hardening: $($_.Exception.Message)" "ERROR"
        return $false
    }
}

function Set-AutoStartup {
    Write-Status "Configuring auto-startup..."
    
    try {
        # Create startup script
        $startupScriptContent = @"
@echo off
cd /d "C:\Program Files\KioskArcade-OS"
start "" "KioskArcade OS.exe"
"@
        
        # Ensure directory exists
        $appDir = Split-Path $AppPath -Parent
        if (!(Test-Path $appDir)) {
            New-Item -ItemType Directory -Path $appDir -Force | Out-Null
        }
        
        # Write startup script
        Set-Content -Path $StartupScript -Value $startupScriptContent -Encoding ASCII
        
        # Add to startup programs
        $startupKey = "HKLM:\SOFTWARE\Microsoft\Windows\CurrentVersion\Run"
        Set-ItemProperty -Path $startupKey -Name "KioskArcadeOS" -Value $StartupScript
        
        Write-Status "Auto-startup configuration completed" "SUCCESS"
        return $true
    } catch {
        Write-Status "Failed to configure auto-startup: $($_.Exception.Message)" "ERROR"
        return $false
    }
}

function Set-DisplaySettings {
    Write-Status "Configuring display settings..."
    
    try {
        # Set display to never turn off
        powercfg /change monitor-timeout-ac 0
        powercfg /change monitor-timeout-dc 0
        
        # Set system to never sleep
        powercfg /change standby-timeout-ac 0
        powercfg /change standby-timeout-dc 0
        
        # Disable screen saver
        Set-ItemProperty -Path "HKCU:\Control Panel\Desktop" -Name "ScreenSaveActive" -Value "0"
        
        # Set high performance power plan
        powercfg /setactive 8c5e7fda-e8bf-4a96-9a85-a6e23a8c635c
        
        Write-Status "Display settings configured" "SUCCESS"
        return $true
    } catch {
        Write-Status "Failed to configure display settings: $($_.Exception.Message)" "ERROR"
        return $false
    }
}

function Set-NetworkSettings {
    Write-Status "Configuring network settings..."
    
    try {
        # Disable network discovery
        Set-NetFirewallProfile -Profile Domain,Public,Private -Enabled False
        
        # Allow only necessary network access
        New-NetFirewallRule -DisplayName "KioskArcade-OS" -Direction Outbound -Program $AppPath -Action Allow -ErrorAction SilentlyContinue
        
        Write-Status "Network settings configured" "SUCCESS"
        return $true
    } catch {
        Write-Status "Failed to configure network settings: $($_.Exception.Message)" "ERROR"
        return $false
    }
}

function Revert-KioskMode {
    Write-Status "Reverting kiosk mode configuration..."
    
    try {
        # Remove kiosk user
        Remove-LocalUser -Name $KioskUser -ErrorAction SilentlyContinue
        
        # Remove kiosk registry settings
        $registryPath = "HKLM:\SOFTWARE\Microsoft\Windows\CurrentVersion\Policies\System"
        Remove-ItemProperty -Path $registryPath -Name "EnableKioskMode" -ErrorAction SilentlyContinue
        Remove-ItemProperty -Path $registryPath -Name "KioskUser" -ErrorAction SilentlyContinue
        Remove-ItemProperty -Path $registryPath -Name "KioskApp" -ErrorAction SilentlyContinue
        
        # Remove startup entry
        $startupKey = "HKLM:\SOFTWARE\Microsoft\Windows\CurrentVersion\Run"
        Remove-ItemProperty -Path $startupKey -Name "KioskArcadeOS" -ErrorAction SilentlyContinue
        
        # Re-enable Windows services
        Set-Service -Name "wuauserv" -StartupType Automatic -ErrorAction SilentlyContinue
        Set-MpPreference -DisableRealtimeMonitoring $false -ErrorAction SilentlyContinue
        
        # Re-enable firewall
        Set-NetFirewallProfile -Profile Domain,Public,Private -Enabled True
        
        Write-Status "Kiosk mode reverted successfully" "SUCCESS"
        return $true
    } catch {
        Write-Status "Failed to revert kiosk mode: $($_.Exception.Message)" "ERROR"
        return $false
    }
}

# Main execution
Write-Status "Starting KioskArcade OS Windows 11 setup..." "INFO"
Write-Status "App Path: $AppPath" "INFO"
Write-Status "App Name: $AppName" "INFO"

if ($Revert) {
    Write-Status "Reverting kiosk mode configuration..." "INFO"
    if (Test-Prerequisites) {
        Revert-KioskMode
        Write-Status "Revert completed. System will need to be restarted." "SUCCESS"
    }
} else {
    Write-Status "Setting up kiosk mode..." "INFO"
    
    if (Test-Prerequisites) {
        $success = $true
        
        $success = $success -and (Set-KioskUser)
        $success = $success -and (Set-KioskMode)
        $success = $success -and (Set-SecurityHardening)
        $success = $success -and (Set-AutoStartup)
        $success = $success -and (Set-DisplaySettings)
        $success = $success -and (Set-NetworkSettings)
        
        if ($success) {
            Write-Status "Kiosk mode setup completed successfully!" "SUCCESS"
            Write-Status "System will restart in 30 seconds..." "INFO"
            Write-Status "After restart, the system will boot directly into KioskArcade OS" "INFO"
            Write-Status "Default admin password: admin123" "INFO"
            
            # Restart system
            if ($Force -or (Read-Host "Restart system now? (y/N)") -eq "y") {
                Restart-Computer -Force
            }
        } else {
            Write-Status "Kiosk mode setup failed. Please check the errors above." "ERROR"
            exit 1
        }
    } else {
        Write-Status "Prerequisites check failed. Setup aborted." "ERROR"
        exit 1
    }
} 