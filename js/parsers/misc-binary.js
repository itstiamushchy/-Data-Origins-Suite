// Витоки Даних — parsers/misc-binary.js
window.Parsers = window.Parsers || {};

window.Parsers.bson = function (buffer, extHint) {
    if (extHint !== 'bson') return null;
    var view = new DataView(buffer);
    if (buffer.byteLength < 5) return null;
    var declaredLen = view.getUint32(0, true);
    if (declaredLen !== buffer.byteLength || view.getUint8(buffer.byteLength - 1) !== 0x00) return null;
    var out = { 'Format:Name': 'BSON (MongoDB документ)' };
    // Перелічуємо ключі верхнього рівня без повного розбору значень кожного типу.
    var bytes = new Uint8Array(buffer);
    var keys = [];
    var p = 4;
    var guard = 0;
    while (p < buffer.byteLength - 1 && guard++ < 1000) {
        var type = bytes[p];
        if (type === 0) break;
        var nameStart = p + 1;
        var nameEnd = nameStart; while (bytes[nameEnd] !== 0 && nameEnd < bytes.length) nameEnd++;
        keys.push(BinUtils.readUtf8(bytes, nameStart, nameEnd));
        var valueStart = nameEnd + 1;
        var skip = bsonValueSize(type, view, bytes, valueStart);
        if (skip < 0) break;
        p = valueStart + skip;
    }
    out['BSON:TopLevelFields'] = keys.join(', ');
    return out;

    function bsonValueSize(type, view, bytes, off) {
        switch (type) {
            case 0x01: return 8; // double
            case 0x02: return 4 + view.getUint32(off, true); // string
            case 0x03: case 0x04: return view.getUint32(off, true); // document/array
            case 0x05: return 5 + view.getUint32(off, true); // binary
            case 0x07: return 12; // ObjectId
            case 0x08: return 1; // bool
            case 0x09: return 8; // UTC datetime
            case 0x0A: return 0; // null
            case 0x10: return 4; // int32
            case 0x11: case 0x12: return 8; // timestamp / int64
            default: return -1;
        }
    }
};

window.Parsers.wasm = function (buffer) {
    var view = new DataView(buffer);
    if (view.getUint32(0, true) !== 0x6D736100) return null; // "\0asm"
    var version = view.getUint32(4, true);
    return { 'Format:Name': 'WebAssembly (WASM)', 'WASM:Version': version };
};

window.Parsers.pyc = function (buffer, extHint) {
    if (extHint !== 'pyc' && extHint !== 'pyo') return null;
    var view = new DataView(buffer);
    var magic = view.getUint16(0, true);
    var MAGIC_MAP = {
        3390: '3.7', 3394: '3.8', 3413: '3.9', 3425: '3.10', 3495: '3.11', 3531: '3.12', 3571: '3.13'
    };
    if (!MAGIC_MAP[magic]) return null;
    return { 'Format:Name': 'Python Compiled (PYC)', 'PYC:PythonVersion': MAGIC_MAP[magic] };
};
