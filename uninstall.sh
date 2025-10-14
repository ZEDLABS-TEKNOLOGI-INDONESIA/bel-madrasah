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
    if loginctl show-user "$CURRENT_USER" 2>/dev/null | grep -q "Linger=yes"; then
        print_status "Disable user lingering..."
        if sudo loginctl disable-linger "$CURRENT_USER"; then
            print_success "User lingering di-disable"
        else
            print_warning "Gagal disable user lingering"
        fi
    else
        print_status "User lingering sudah tidak aktif"
    fi
}

# Function to remove project directory
remove_project_dir() {
    print_status "Menghapus direktori proyek..."
    
    if [ -d "$PROJECT_DIR" ]; then
        print_status "Menghapus: $PROJECT_DIR"
        if rm -rf "$PROJECT_DIR"; then
            print_success "Direktori proyek dihapus"
        else
            print_error "Gagal menghapus direktori proyek"
            return 1
        fi
    else
        print_status "Direktori proyek tidak ditemukan"
    fi
}

# Function to check and remove remaining files
check_remaining_files() {
    print_status "Memeriksa file tersisa..."
    
    local files_removed=0
    
    # Check systemd user directory for any related files
    local systemd_dir="$HOME/.config/systemd/user"
    if [ -d "$systemd_dir" ]; then
        local found_services=$(find "$systemd_dir" -name "*$SERVICE_NAME*" 2>/dev/null)
        if [ -n "$found_services" ]; then
            while IFS= read -r file; do
                if [ -f "$file" ]; then
                    print_status "Menghapus: $file"
                    rm -f "$file"
                    ((files_removed++))
                fi
            done <<< "$found_services"
        fi
    fi
    
    if [ $files_removed -gt 0 ]; then
        print_success "Dihapus $files_removed file tersisa"
        systemctl --user daemon-reload
    else
        print_success "Tidak ada file tersisa"
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
        local dir_size=$(du -sh "$PROJECT_DIR" 2>/dev/null | cut -f1)
        echo -e "  Project Directory: ${GREEN}● ADA${NC} ($file_count files, $dir_size)"
    else
        echo -e "  Project Directory: ${RED}● TIDAK ADA${NC}"
    fi
    
    # Check lingering
    if loginctl show-user "$CURRENT_USER" 2>/dev/null | grep -q "Linger=yes"; then
        echo -e "  User Lingering: ${GREEN}● AKTIF${NC}"
    else
        echo -e "  User Lingering: ${RED}● TIDAK AKTIF${NC}"
    fi
    
    echo
}

# Function to show uninstallation summary
show_summary() {
    echo
    echo "========================================="
    print_success "UNINSTALL SELESAI!"
    echo "========================================="
    echo
    
    # Verify removal
    local all_clean=true
    
    print_status "Verifikasi penghapusan:"
    echo
    
    # Check service
    if service_exists; then
        echo -e "  ${RED}✗${NC} Systemd service masih ada"
        all_clean=false
    else
        echo -e "  ${GREEN}✓${NC} Systemd service dihapus"
    fi
    
    # Check service file
    if [ -f "$SERVICE_FILE" ]; then
        echo -e "  ${RED}✗${NC} File service masih ada"
        all_clean=false
    else
        echo -e "  ${GREEN}✓${NC} File service dihapus"
    fi
    
    # Check project directory
    if [ -d "$PROJECT_DIR" ]; then
        echo -e "  ${RED}✗${NC} Project directory masih ada"
        all_clean=false
    else
        echo -e "  ${GREEN}✓${NC} Project directory dihapus"
    fi
    
    # Check lingering
    if loginctl show-user "$CURRENT_USER" 2>/dev/null | grep -q "Linger=yes"; then
        echo -e "  ${YELLOW}⚠${NC} User lingering masih aktif"
    else
        echo -e "  ${GREEN}✓${NC} User lingering di-disable"
    fi
    
    echo
    
    if [ "$all_clean" = true ]; then
        print_success "Sistem bersih! Semua komponen berhasil dihapus"
    else
        print_warning "Beberapa komponen masih tersisa"
        print_status "Anda dapat menghapus manual jika diperlukan"
    fi
    
    echo
    print_status "Catatan: ffmpeg tidak dihapus (mungkin digunakan aplikasi lain)"
    print_status "Untuk uninstall ffmpeg secara manual:"
    echo "  sudo apt remove ffmpeg        # Ubuntu/Debian"
    echo "  sudo yum remove ffmpeg        # RHEL/CentOS"
    echo "  sudo dnf remove ffmpeg        # Fedora"
    echo "  sudo pacman -R ffmpeg         # Arch Linux"
    echo
    print_success "Terima kasih telah menggunakan Bell System Madrasah!"
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
    print_warning "PERINGATAN: Proses ini akan MENGHAPUS PERMANEN sistem bel madrasah!"
    print_warning "Tidak ada backup yang akan dibuat!"
    echo
    read -p "Apakah Anda yakin ingin melanjutkan uninstall? [y/N]: " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        print_error "Uninstall dibatalkan"
        exit 1
    fi
    
    # Double confirmation for safety
    echo
    print_warning "Konfirmasi terakhir!"
    read -p "Ketik 'HAPUS' untuk melanjutkan: " confirm
    if [ "$confirm" != "HAPUS" ]; then
        print_error "Uninstall dibatalkan"
        exit 1
    fi
    
    echo
    print_status "Memulai proses uninstall..."
    echo
    
    # Remove service
    remove_service
    echo
    
    # Remove project directory
    remove_project_dir
    echo
    
    # Disable lingering
    disable_lingering
    echo
    
    # Check for remaining files
    check_remaining_files
    
    # Show summary
    show_summary
}

# Handle script interruption
trap 'echo; print_error "Uninstall dibatalkan oleh user"; exit 1' INT TERM

# Run main function
main "$@"