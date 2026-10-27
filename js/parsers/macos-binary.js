// Витоки Даних — parsers/macos-binary.js
window.Parsers = window.Parsers || {};

window.Parsers.machO = function (buffer) {
    var view = new DataView(buffer);
    var magic = view.getUint32(0, false);
    var MAGIC_MAP = { 0xFEEDFACE: '32-біт', 0xFEEDFACF: '64-біт', 0xCAFEBABE: 'Універсальний (Fat/Universal)', 0xBEBAFECA: 'Універсальний (Fat/Universal, зворотний порядок)' };
    if (!MAGIC_MAP[magic]) {
        var magicLE = view.getUint32(0, true);
        if (!MAGIC_MAP[magicLE]) return null;
        magic = magicLE;
    }
    var out = { 'Format:Name': 'Mach-O (macOS виконуваний файл)', 'MACHO:Architecture': MAGIC_MAP[magic] };
    if (magic === 0xFEEDFACE || magic === 0xFEEDFACF) {
        var CPU_MAP = { 7: 'x86', 0x01000007: 'x86-64', 12: 'ARM', 0x0100000C: 'ARM64' };
        var cpuType = view.getUint32(4, false);
        out['MACHO:CPUType'] = CPU_MAP[cpuType] || ('код ' + cpuType);
        var FILETYPE_MAP = { 1: 'Об\'єктний файл', 2: 'Виконуваний файл', 6: 'Динамічна бібліотека', 8: 'Пакет (bundle)' };
        out['MACHO:FileType'] = FILETYPE_MAP[view.getUint32(12, false)] || 'невідомо';
    }
    return out;
};

window.Parsers.icns = function (buffer) {
    var view = new DataView(buffer);
    if (BinUtils.readAsciiString(view, 0, 4) !== 'icns') return null;
    var out = { 'Format:Name': 'Apple Icon Image (ICNS)' };
    var fileSize = view.getUint32(4, false);
    out['ICNS:FileSize'] = fileSize;
    var types = [];
    var offset = 8;
    while (offset + 8 <= view.byteLength && offset < fileSize) {
        var type = BinUtils.readAsciiString(view, offset, 4);
        var len = view.getUint32(offset + 4, false);
        if (len < 8) break;
        types.push(type);
        offset += len;
    }
    out['ICNS:IconVariants'] = types.join(', ');
    return out;
};
