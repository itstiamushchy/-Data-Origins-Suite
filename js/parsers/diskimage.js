// Витоки Даних — parsers/diskimage.js
window.Parsers = window.Parsers || {};

window.Parsers.iso = function (buffer, extHint) {
    if (extHint !== 'iso') return null;
    var pvdOffset = 0x8000; // сектор 16 * 2048 байт
    if (buffer.byteLength < pvdOffset + 2048) return null;
    var view = new DataView(buffer);
    if (BinUtils.readAsciiString(view, pvdOffset + 1, 5) !== 'CD001') return null;

    var bytes = new Uint8Array(buffer);
    function field(off, len) { return BinUtils.readAsciiString(view, pvdOffset + off, len).trim(); }
    var out = { 'Format:Name': 'ISO 9660 (CD/DVD-образ)' };
    var map = {
        'ISO:SystemID': field(8, 32), 'ISO:VolumeID': field(40, 32),
        'ISO:PublisherID': field(318, 128), 'ISO:DataPreparerID': field(446, 128),
        'ISO:ApplicationID': field(574, 128)
    };
    Object.keys(map).forEach(function (k) { if (map[k]) out[k] = map[k]; });

    var creationRaw = BinUtils.readLatin1(bytes, pvdOffset + 813, pvdOffset + 813 + 16);
    if (/^\d{14}/.test(creationRaw)) {
        out['ISO:CreationDate'] = creationRaw.slice(0, 4) + '-' + creationRaw.slice(4, 6) + '-' + creationRaw.slice(6, 8) +
            ' ' + creationRaw.slice(8, 10) + ':' + creationRaw.slice(10, 12) + ':' + creationRaw.slice(12, 14);
    }
    return out;
};

window.Parsers.vhd = function (buffer) {
    if (buffer.byteLength < 512) return null;
    var view = new DataView(buffer);
    var footerOffset = buffer.byteLength - 512;
    if (BinUtils.readAsciiString(view, footerOffset, 8) !== 'conectix') return null;

    var out = { 'Format:Name': 'VHD (Virtual Hard Disk)' };
    out['VHD:CreatorApplication'] = BinUtils.readAsciiString(view, footerOffset + 16, 4).trim();
    out['VHD:CreatorVersion'] = view.getUint16(footerOffset + 20, false) + '.' + view.getUint16(footerOffset + 22, false);
    var diskTypeMap = { 2: 'Фіксований', 3: 'Динамічний', 4: 'Різницевий (differencing)' };
    out['VHD:DiskType'] = diskTypeMap[view.getUint32(footerOffset + 60, false)] || 'невідомо';
    var sizeHigh = view.getUint32(footerOffset + 48, false), sizeLow = view.getUint32(footerOffset + 52, false);
    out['VHD:CurrentSizeBytes'] = sizeHigh * 0x100000000 + sizeLow;
    return out;
};

window.Parsers.vhdx = function (buffer) {
    var view = new DataView(buffer);
    if (BinUtils.readAsciiString(view, 0, 8) !== 'vhdxfile') return null;
    return { 'Format:Name': 'VHDX (Hyper-V Virtual Hard Disk)', 'VHDX:Note': 'Регіони та метадані зберігаються у складній табличній структурі — розбір обмежено підтвердженням сигнатури.' };
};

window.Parsers.vmdk = function (buffer) {
    var view = new DataView(buffer);
    var bytes = new Uint8Array(buffer);
    var head = BinUtils.readLatin1(bytes, 0, 4);
    if (head === 'KDMV') {
        var out = { 'Format:Name': 'VMDK (бінарний, hosted sparse extent)' };
        out['VMDK:Version'] = view.getUint32(4, true);
        out['VMDK:CapacitySectors'] = Number(view.getBigUint64(12, true));
        return out;
    }
    var text = BinUtils.readLatin1(bytes, 0, Math.min(bytes.length, 2000));
    if (text.indexOf('# Disk DescriptorFile') === -1) return null;
    var out2 = { 'Format:Name': 'VMDK (текстовий дескриптор)' };
    var m;
    if ((m = text.match(/CID=(\S+)/))) out2['VMDK:CID'] = m[1];
    if ((m = text.match(/parentCID=(\S+)/))) out2['VMDK:ParentCID'] = m[1];
    if ((m = text.match(/createType="?(\S+?)"?[\r\n]/))) out2['VMDK:CreateType'] = m[1];
    return out2;
};

window.Parsers.qcow2 = function (buffer) {
    var view = new DataView(buffer);
    if (BinUtils.readAsciiString(view, 0, 4) !== 'QFI\xFB') return null;
    var out = { 'Format:Name': 'QCOW2 (QEMU)' };
    out['QCOW2:Version'] = view.getUint32(4, false);
    out['QCOW2:ClusterBits'] = view.getUint32(20, false);
    out['QCOW2:VirtualSizeBytes'] = Number(view.getBigUint64(24, false));
    return out;
};
