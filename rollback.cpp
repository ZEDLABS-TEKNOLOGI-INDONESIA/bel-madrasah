// Menunda penandaan firmware sebagai sehat sampai otaTick() memastikan perangkat
// berjalan normal, sehingga bootloader dapat kembali ke versi lama bila gagal.
extern "C" bool verifyRollbackLater()
{
    return true;
}
