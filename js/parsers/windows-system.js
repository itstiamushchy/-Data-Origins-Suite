// Витоки Даних — parsers/windows-system.js
window.Parsers = window.Parsers || {};

window.Parsers.msi = function (buffer, extHint) {
    if (extHint !== 'msi' && extHint !== 'msp') return null;
    var cfb = window.Ole2Reader.parse(buffer);
    if (!cfb) return null;
    var out = { 'Format:Name': 'Windows Installer (MSI)' };
    var summaryBytes = cfb.getStream('\u0005SummaryInformation');
    if (summaryBytes) {
        var summary = window.Ole2Reader.parsePropertySetStream(summaryBytes, window.Ole2Reader.SUMMARY_INFO_MAP);
        Object.keys(summary).forEach(function (k) { out['MSI:' + k] = summary[k]; });
    }
    return out;
};

window.Parsers.lnk = function (buffer, extHint) {
    if (extHint !== 'lnk') return null;
    var view = new DataView(buffer);
    if (view.getUint32(0, true) !== 0x0000004C) return null; // HeaderSize must be 0x4C
    var CLSID = [0x01, 0x14, 0x02, 0x00, 0x00, 0x00, 0x00, 0x00, 0xC0, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x46];
    for (var i = 0; i < 16; i++) if (view.getUint8(4 + i) !== CLSID[i]) return null;

    var out = { 'Format:Name': 'Windows Shortcut (LNK)' };
    var flags = view.getUint32(20, true);
    var HAS_TARGET_ID_LIST = 0x01, HAS_LINK_INFO = 0x02, HAS_NAME = 0x04, HAS_RELATIVE_PATH = 0x08, HAS_WORKING_DIR = 0x10, HAS_ARGUMENTS = 0x20, HAS_ICON_LOCATION = 0x40;

    var creationTime = readFiletime(view, 28), accessTime = readFiletime(view, 36), writeTime = readFiletime(view, 44);
    if (creationTime) out['LNK:CreationTime'] = creationTime;
    if (writeTime) out['LNK:ModifiedTime'] = writeTime;

    var offset = 76; // кінець заголовка
    if (flags & HAS_TARGET_ID_LIST) {
        var idListSize = view.getUint16(offset, true);
        offset += 2 + idListSize;
    }
    var bytes = new Uint8Array(buffer);
    if (flags & HAS_LINK_INFO) {
        var linkInfoSize = view.getUint32(offset, true);
        var linkInfoStart = offset;
        var localBasePathOffset = view.getUint32(offset + 16, true);
        if (localBasePathOffset) {
            var p = linkInfoStart + localBasePathOffset;
            var end = p; while (bytes[end] !== 0 && end < linkInfoStart + linkInfoSize) end++;
            out['LNK:TargetPath'] = BinUtils.readLatin1(bytes, p, end);
        }
        offset = linkInfoStart + linkInfoSize;
    }

    function readStringData(off) {
        var charCount = view.getUint16(off, true);
        var isUnicode = (flags & 0x80) !== 0; // IsUnicode
        var byteLen = charCount * (isUnicode ? 2 : 1);
        var strStart = off + 2;
        var value = isUnicode
            ? (function () { try { return new TextDecoder('utf-16le').decode(bytes.slice(strStart, strStart + byteLen)); } catch (e) { return ''; } })()
            : BinUtils.readLatin1(bytes, strStart, strStart + byteLen);
        return { value: value, next: strStart + byteLen };
    }
    if (flags & HAS_NAME) { var r1 = readStringData(offset); out['LNK:Description'] = r1.value; offset = r1.next; }
    if (flags & HAS_RELATIVE_PATH) { var r2 = readStringData(offset); out['LNK:RelativePath'] = r2.value; offset = r2.next; }
    if (flags & HAS_WORKING_DIR) { var r3 = readStringData(offset); out['LNK:WorkingDirectory'] = r3.value; offset = r3.next; }
    if (flags & HAS_ARGUMENTS) { var r4 = readStringData(offset); out['LNK:Arguments'] = r4.value; offset = r4.next; }
    if (flags & HAS_ICON_LOCATION) { var r5 = readStringData(offset); out['LNK:IconLocation'] = r5.value; }
    return out;

    function readFiletime(v, off) {
        var low = v.getUint32(off, true), high = v.getUint32(off + 4, true);
        if (low === 0 && high === 0) return null;
        var ms = (high * 0x100000000 + low) / 10000 - 11644473600000;
        try { return new Date(ms).toISOString(); } catch (e) { return null; }
    }
};

window.Parsers.uf2 = function (buffer, extHint) {
    if (extHint !== 'uf2') return null;
    var view = new DataView(buffer);
    if (view.getUint32(0, true) !== 0x0A324655) return null; // "UF2\n"
    var out = { 'Format:Name': 'UF2 (мікроконтролерна прошивка)' };
    out['UF2:BlockSize'] = view.getUint32(16, true);
    out['UF2:TotalBlocks'] = view.getUint32(24, true);
    out['UF2:FamilyID'] = '0x' + view.getUint32(28, true).toString(16);
    return out;
};
