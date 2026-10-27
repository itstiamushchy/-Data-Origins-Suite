// Витоки Даних — parsers/vm-extra.js
window.Parsers = window.Parsers || {};

window.Parsers.vdi = function (buffer) {
    var bytes = new Uint8Array(buffer);
    var head = BinUtils.readLatin1(bytes, 0, 64);
    if (head.indexOf('Oracle VM VirtualBox') === -1 && head.indexOf('Sun xVM VirtualBox') === -1 && head.indexOf('innotek VirtualBox') === -1) return null;
    var view = new DataView(buffer);
    var out = { 'Format:Name': 'VirtualBox Disk Image (VDI)' };
    var sig = view.getUint32(64, true);
    if (sig !== 0xBEDA107F) return out;
    out['VDI:Comment'] = head.replace(/\0+$/, '').trim();
    return out;
};

window.Parsers.ovf = function (buffer, extHint) {
    if (extHint === 'ovf') {
        var bytes = new Uint8Array(buffer);
        var text = BinUtils.readLatin1(bytes, 0, Math.min(bytes.length, 2000));
        if (text.indexOf('<Envelope') === -1 && text.indexOf('ovf:') === -1) return null;
        var out = { 'Format:Name': 'Open Virtualization Format (OVF)' };
        try {
            var doc = new DOMParser().parseFromString(BinUtils.readUtf8(bytes, 0, bytes.length), 'application/xml');
            var nameEl = doc.getElementsByTagNameNS('*', 'VirtualSystem')[0];
            var vendorEl = doc.getElementsByTagNameNS('*', 'Vendor')[0];
            if (nameEl) out['OVF:SystemID'] = nameEl.getAttribute('ovf:id') || nameEl.getAttribute('id');
            if (vendorEl) out['OVF:Vendor'] = vendorEl.textContent.trim();
        } catch (e) {}
        return out;
    }
    if (extHint === 'ova') {
        var view = new DataView(buffer);
        if (BinUtils.readAsciiString(view, 257, 6).trim() !== 'ustar') return null;
        return { 'Format:Name': 'OVA (TAR-архів з OVF усередині)', 'OVA:Note': 'Відкрийте .ovf всередині архіву окремо для детальних метаданих.' };
    }
    return null;
};
