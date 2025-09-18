#!/bin/bash

# =======================================================
# Uninstaller Bell System Madrasah Tsanawiyah Negeri 1 Pandeglang
# =======================================================

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
PROJECT_DIR="$HOME/bel-madrasah"
SERVICE_NAME="bel-madrasah"
SERVICE_FILE="$HOME/.config/systemd/user/$SERVICE_NAME.service"
CURRENT_USER=$(whoami)

# Function to print colored output
print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Function to check if service exists
service_exists() {
    systemctl --user list-unit-files | grep -q "$SERVICE_NAME.service"
}

# Function to check if service is running
service_is_running() {
    systemctl --user is-active --quiet "$SERVICE_NAME.service"
}

# Function to stop and disable service
remove_service() {
    print_status "Menghentikan dan menghapus service..."
    
    # Stop service if running
    if service_is_running; then
        print_status "Service sedang berjalan, menghentikan..."
        if systemctl --user stop "$SERVICE_NAME.service"; then
            print_success "Service berhasil dihentikan"
        else
            print_warning "Gagal menghentikan service (mungkin sudah berhenti)"
        fi
    else
        print_status "Service tidak sedang berjalan"
    fi
    
    # Disable service if exists
    if service_exists; then
        print_status "Disable service..."
        if systemctl --user disable "$SERVICE_NAME.service"; then
            print_success "Service berhasil di-disable"
        else
            print_warning "Gagal disable service"
        fi
    else
        print_status "Service tidak ditemukan di systemd"
    fi
    
    # Remove service file
    if [ -f "$SERVICE_FILE" ]; then
        print_status "Menghapus file service..."
        if rm "$SERVICE_FILE"; then
            print_success "File service dihapus: $SERVICE_FILE"
        else
            print_error "Gagal menghapus file service"
        fi
    else
        print_status "File service tidak ditemukan"
    fi
    
    # Reload systemd daemon
    print_status "Reload systemd daemon..."
    systemctl --user daemon-reload
    print_success "Systemd daemon di-reload"
}

# Function to disable user lingering
disable_lingering() {
    print_status "Memeriksa user lingering..."
    
    # Check if lingering is enabled
    if loginctl show-user "$CURRENT_USER" | grep -q "Linger=yes"; then
        read -p "User lingering masih aktif. Apakah ingin disable? [y/N]: " -n 1 -r
        echo
        if [[ $REPLY =~ ^[Yy]$ ]]; then
            if sudo loginctl disable-linger "$CURRENT_USER"; then
                print_success "User lingering di-disable"
            else
                print_warning "Gagal disable user lingering"
            fi
        else
            print_status "User lingering tetap aktif (tidak diubah)"
        fi
    else
        print_status "User lingering sudah tidak aktif"
    fi
}

# Function to remove project directory
remove_project_dir() {
    print_status "Memeriksa direktori proyek..."
    
    if [ -d "$PROJECT_DIR" ]; then
        echo
        print_warning "Direktori proyek ditemukan: $PROJECT_DIR"
        echo "Isi direktori:"
        ls -la "$PROJECT_DIR" 2>/dev/null || echo "  (tidak dapat membaca isi direktori)"
        echo
        
        read -p "Apakah Anda ingin menghapus SEMUA file di direktori ini? [y/N]: " -n 1 -r
        echo
        
        if [[ $REPLY =~ ^[Yy]$ ]]; then
            print_status "Menghapus direktori proyek..."
            if rm -rf "$PROJECT_DIR"; then
                print_success "Direktori proyek dihapus: $PROJECT_DIR"
            else
                print_error "Gagal menghapus direktori proyek"
                return 1
            fi
        else
            print_status "Direktori proyek tidak dihapus"
            echo
            print_warning "File-file berikut masih ada di sistem:"
            echo "  - $PROJECT_DIR/main.py"
            echo "  - $PROJECT_DIR/jadwal.py"
            echo "  - $PROJECT_DIR/tone/ (file audio)"
            echo "  - $PROJECT_DIR/audio-list.txt"
            echo
            print_status "Anda dapat menghapus manual jika diperlukan: rm -rf $PROJECT_DIR"
        fi
    else
        print_status "Direktori proyek tidak ditemukan"
    fi
}

# Function to check for remaining files
check_remaining_files() {
    print_status "Memeriksa file yang tersisa..."
    
    local remaining_files=()
    
    # Check service file
    if [ -f "$SERVICE_FILE" ]; then
        remaining_files+=("$SERVICE_FILE")
    fi
    
    # Check project directory
    if [ -d "$PROJECT_DIR" ]; then
        remaining_files+=("$PROJECT_DIR")
    fi
    
    # Check if any systemd user services contain our service name
    local systemd_dir="$HOME/.config/systemd/user"
    if [ -d "$systemd_dir" ]; then
        local found_services=$(find "$systemd_dir" -name "*$SERVICE_NAME*" 2>/dev/null)
        if [ -n "$found_services" ]; then
            remaining_files+=($found_services)
        fi
    fi
    
    if [ ${#remaining_files[@]} -gt 0 ]; then
        echo
        print_warning "File/direktori berikut masih ada di sistem:"
        for file in "${remaining_files[@]}"; do
            echo "  - $file"
        done
        echo
        read -p "Apakah ingin menghapus semua file tersisa? [y/N]: " -n 1 -r
        echo
        if [[ $REPLY =~ ^[Yy]$ ]]; then
            for file in "${remaining_files[@]}"; do
                if [ -f "$file" ] || [ -d "$file" ]; then
                    print_status "Menghapus: $file"
                    rm -rf "$file"
                fi
            done
            print_success "File tersisa dihapus"
        fi
    else
        print_success "Tidak ada file tersisa"
    fi
}

# Function to show uninstallation summary
show_summary() {
    echo
    echo "========================================="
    print_success "UNINSTALL SELESAI!"
    echo "========================================="
    echo
    
    # Check what's left
    local items_removed=()
    local items_remaining=()
    
    # Check service
    if service_exists; then
        items_remaining+=("Systemd service")
    else
        items_removed+=("Systemd service")
    fi
    
    # Check project directory
    if [ -d "$PROJECT_DIR" ]; then
        items_remaining+=("Project directory")
    else
        items_removed+=("Project directory")
    fi
    
    # Check lingering
    if loginctl show-user "$CURRENT_USER" | grep -q "Linger=yes"; then
        items_remaining+=("User lingering")
    else
        items_removed+=("User lingering")
    fi
    
    # Show summary
    if [ ${#items_removed[@]} -gt 0 ]; then
        print_success "Berhasil dihapus:"
        for item in "${items_removed[@]}"; do
            echo "  ✓ $item"
        done
    fi
    
    if [ ${#items_remaining[@]} -gt 0 ]; then
        print_warning "Masih tersisa:"
        for item in "${items_remaining[@]}"; do
            echo "  ⚠ $item"
        done
        echo
        print_status "Item tersisa dapat dihapus manual jika diperlukan"
    fi
    
    echo
    print_status "Untuk uninstall ffmpeg (jika diperlukan):"
    echo "  sudo apt remove ffmpeg        # Ubuntu/Debian"
    echo "  sudo yum remove ffmpeg        # RHEL/CentOS"
    echo "  sudo dnf remove ffmpeg        # Fedora"
    echo "  sudo pacman -R ffmpeg         # Arch Linux"
    echo
    print_success "Terima kasih telah menggunakan Bell System Madrasah!"
}

# Function to backup before uninstall
create_backup() {
    if [ -d "$PROJECT_DIR" ]; then
        read -p "Apakah ingin membuat backup sebelum uninstall? [y/N]: " -n 1 -r
        echo
        if [[ $REPLY =~ ^[Yy]$ ]]; then
            local backup_dir="$HOME/bel-madrasah-backup-$(date +%Y%m%d-%H%M%S)"
            print_status "Membuat backup ke: $backup_dir"
            
            if cp -r "$PROJECT_DIR" "$backup_dir"; then
                print_success "Backup berhasil dibuat: $backup_dir"
                echo
                print_status "Backup berisi:"
                ls -la "$backup_dir" 2>/dev/null
                echo
            else
                print_error "Gagal membuat backup"
                read -p "Lanjutkan uninstall tanpa backup? [y/N]: " -n 1 -r
                echo
                if [[ ! $REPLY =~ ^[Yy]$ ]]; then
                    print_error "Uninstall dibatalkan"
                    exit 1
                fi
            fi
        fi
    fi
}

# Function to show current installation status
show_current_status() {
    print_status "Status instalasi saat ini:"
    echo
    
    # Check service
    if service_exists; then
        if service_is_running; then
            echo -e "  Service: ${GREEN}● AKTIF${NC} (berjalan)"
        else
            echo -e "  Service: ${YELLOW}● TERDAFTAR${NC} (tidak berjalan)"
        fi
    else
        echo -e "  Service: ${RED}● TIDAK ADA${NC}"
    fi
    
    # Check project directory
    if [ -d "$PROJECT_DIR" ]; then
        local file_count=$(find "$PROJECT_DIR" -type f 2>/dev/null | wc -l)
        echo -e "  Project Directory: ${GREEN}● ADA${NC} ($file_count files)"
    else
        echo -e "  Project Directory: ${RED}● TIDAK ADA${NC}"
    fi
    
    # Check lingering
    if loginctl show-user "$CURRENT_USER" | grep -q "Linger=yes"; then
        echo -e "  User Lingering: ${GREEN}● AKTIF${NC}"
    else
        echo -e "  User Lingering: ${RED}● TIDAK AKTIF${NC}"
    fi
    
    echo
}

# Main uninstallation process
main() {
    echo "========================================="
    echo "Bell System Madrasah Uninstaller"
    echo "Madrasah Tsanawiyah Negeri 1 Pandeglang"
    echo "========================================="
    echo
    
    # Check if running as root
    if [ "$EUID" -eq 0 ]; then
        print_error "Jangan jalankan uninstaller ini sebagai root!"
        print_warning "Gunakan user biasa, bukan sudo."
        exit 1
    fi
    
    # Show current status
    show_current_status
    
    # Confirmation
    print_warning "PERINGATAN: Proses ini akan menghapus sistem bel madrasah!"
    read -p "Apakah Anda yakin ingin melanjutkan uninstall? [y/N]: " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        print_error "Uninstall dibatalkan"
        exit 1
    fi
    
    echo
    print_status "Memulai proses uninstall..."
    
    # Create backup if requested
    create_backup
    
    # Remove service
    remove_service
    
    # Remove project directory
    remove_project_dir
    
    # Disable lingering
    disable_lingering
    
    # Check for remaining files
    check_remaining_files
    
    # Show summary
    show_summary
}

# Handle script interruption
trap 'echo; print_error "Uninstall dibatalkan oleh user"; exit 1' INT TERM

# Run main function
main "$@"
