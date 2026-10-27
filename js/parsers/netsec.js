// Витоки Даних — parsers/netsec.js
window.Parsers = window.Parsers || {};

window.Parsers.pcap = function (buffer) {
    var view = new DataView(buffer);
    var magic = view.getUint32(0, true);
    var LINKTYPE_MAP = { 1: 'Ethernet', 105: 'IEEE 802.11', 0: 'Loopback', 113: 'Linux cooked capture', 127: 'IEEE 802.11 + radiotap' };

    if (magic === 0xA1B2C3D4 || magic === 0xD4C3B2A1) { // класичний PCAP
        var le = magic === 0xA1B2C3D4;
        var out = { 'Format:Name': 'PCAP (мережевий дамп)' };
        out['PCAP:VersionMajor'] = view.getUint16(4, le);
        out['PCAP:VersionMinor'] = view.getUint16(6, le);
        var linktype = view.getUint32(20, le);
        out['PCAP:LinkType'] = LINKTYPE_MAP[linktype] || ('код ' + linktype);
        var packetCount = 0, offset = 24;
        while (offset + 16 <= view.byteLength && packetCount < 100000) {
            var inclLen = view.getUint32(offset + 12, le);
            packetCount++;
            offset += 16 + inclLen;
        }
        out['PCAP:PacketCount'] = packetCount;
        return out;
    }

    if (view.getUint32(0, true) === 0x0A0D0D0A) { // PCAPNG Section Header Block
        var byteOrderMagic = view.getUint32(8, true);
        var leN = byteOrderMagic === 0x1A2B3C4D;
        var out2 = { 'Format:Name': 'PCAPNG (мережевий дамп)' };
        out2['PCAPNG:VersionMajor'] = view.getUint16(12, leN);
        out2['PCAPNG:VersionMinor'] = view.getUint16(14, leN);
        var blockCount = 0, offset2 = 0;
        while (offset2 + 12 <= view.byteLength && blockCount < 200000) {
            var blockLen = view.getUint32(offset2 + 4, leN);
            if (blockLen < 12) break;
            blockCount++;
            offset2 += blockLen;
        }
        out2['PCAPNG:BlockCount'] = blockCount;
        return out2;
    }
    return null;
};

window.Parsers.har = function (buffer, extHint) {
    if (extHint !== 'har') return null;
    var bytes = new Uint8Array(buffer);
    try {
        var json = JSON.parse(BinUtils.readUtf8(bytes, 0, bytes.length));
        if (!json.log) return null;
        var out = { 'Format:Name': 'HTTP Archive (HAR)' };
        if (json.log.creator) { out['HAR:Creator'] = json.log.creator.name; out['HAR:CreatorVersion'] = json.log.creator.version; }
        if (json.log.entries) out['HAR:RequestCount'] = json.log.entries.length;
        return out;
    } catch (e) { return null; }
};

window.Parsers.kdbx = function (buffer) {
    var view = new DataView(buffer);
    if (view.getUint32(0, true) !== 0x9AA2D903) return null;
    var out = { 'Format:Name': 'KeePass Database (KDBX)' };
    var sig2 = view.getUint32(4, true);
    out['KDBX:FormatVersion'] = sig2 === 0xB54BFB67 ? '1.x (застарілий)' : sig2 === 0xB54BFB66 ? 'Pre-release' : sig2 === 0xB54BFB65 ? '2.x/4.x' : 'невідома';
    if (sig2 === 0xB54BFB65) {
        out['KDBX:VersionMinor'] = view.getUint16(8, true);
        out['KDBX:VersionMajor'] = view.getUint16(10, true);
    }
    return out;
};

window.Parsers.pgp = function (buffer, extHint) {
    var bytes = new Uint8Array(buffer);
    var head = BinUtils.readLatin1(bytes, 0, Math.min(bytes.length, 40));
    if (head.indexOf('-----BEGIN PGP') === 0) {
        var blockType = head.match(/-----BEGIN PGP ([A-Z ]+)-----/);
        return { 'Format:Name': 'OpenPGP (ASCII-armored)', 'PGP:BlockType': blockType ? blockType[1].trim() : 'невідомо' };
    }
    if (['gpg', 'pgp', 'asc', 'sig'].indexOf(extHint) > -1 && (bytes[0] & 0x80)) { // бінарний пакет: старший біт встановлено
        var tag = (bytes[0] & 0x40) ? (bytes[0] & 0x3F) : ((bytes[0] >> 2) & 0x0F);
        var TAG_MAP = { 1: 'Public-Key Encrypted Session Key', 2: 'Signature', 5: 'Secret Key', 6: 'Public Key', 8: 'Compressed Data', 11: 'Literal Data' };
        return { 'Format:Name': 'OpenPGP (бінарний)', 'PGP:PacketType': TAG_MAP[tag] || ('тег ' + tag) };
    }
    return null;
};
