// Витоки Даних — parsers/db-misc.js
window.Parsers = window.Parsers || {};

window.Parsers.dbf = function (buffer, extHint) {
    if (extHint !== 'dbf') return null;
    var view = new DataView(buffer);
    var verByte = view.getUint8(0);
    var validVersions = { 0x03: 1, 0x04: 1, 0x05: 1, 0x30: 1, 0x31: 1, 0x83: 1, 0x8B: 1, 0xF5: 1 };
    if (!validVersions[verByte]) return null;

    var out = { 'Format:Name': 'dBase/FoxPro DBF' };
    var y = view.getUint8(1) + 1900, mo = view.getUint8(2), d = view.getUint8(3);
    out['DBF:LastUpdate'] = y + '-' + String(mo).padStart(2, '0') + '-' + String(d).padStart(2, '0');
    out['DBF:RecordCount'] = view.getUint32(4, true);
    out['DBF:HeaderSize'] = view.getUint16(8, true);
    out['DBF:RecordLength'] = view.getUint16(10, true);

    var fieldCount = Math.floor((out['DBF:HeaderSize'] - 32 - 1) / 32);
    var fields = [];
    for (var i = 0; i < fieldCount && i < 200; i++) {
        var fo = 32 + i * 32;
        if (fo + 11 > view.byteLength) break;
        var name = BinUtils.readAsciiString(view, fo, 11);
        if (!name) break;
        fields.push(name);
    }
    if (fields.length) out['DBF:Fields'] = fields.join(', ');
    return out;
};

window.Parsers.mdb = function (buffer) {
    var view = new DataView(buffer);
    if (BinUtils.readAsciiString(view, 4, 15) !== 'Standard Jet DB' && BinUtils.readAsciiString(view, 4, 19) !== 'Standard ACE DB') return null;
    var out = { 'Format:Name': 'Microsoft Access (JET/ACE)' };
    var verCode = view.getUint8(20);
    out['MDB:FormatVersion'] = { 0: 'Jet 3 (Access 97)', 1: 'Jet 4 (Access 2000-2003)', 2: 'ACE 12 (Access 2007)', 3: 'ACE 14 (Access 2010)', 5: 'ACE 16 (Access 2016+)' }[verCode] || ('код ' + verCode);
    return out;
};

window.Parsers.rdb = function (buffer) {
    var view = new DataView(buffer);
    if (BinUtils.readAsciiString(view, 0, 5) !== 'REDIS') return null;
    return { 'Format:Name': 'Redis RDB', 'RDB:Version': BinUtils.readAsciiString(view, 5, 4) };
};

window.Parsers.firebird = function (buffer) {
    var view = new DataView(buffer);
    // Перша сторінка Firebird/Interbase починається з байта типу сторінки (0x08 = Header Page)
    // та містить рядок "Firebird" у перших ~64 байтах на більшості версій ODS.
    var head = BinUtils.readLatin1(new Uint8Array(buffer), 0, Math.min(view.byteLength, 128));
    if (head.indexOf('Firebird') === -1 && head.indexOf('InterBase') === -1) return null;
    return { 'Format:Name': 'Firebird/InterBase (FDB/GDB)' };
};

window.Parsers.pgdump = function (buffer) {
    var view = new DataView(buffer);
    if (BinUtils.readAsciiString(view, 0, 5) !== 'PGDMP') return null;
    return {
        'Format:Name': 'PostgreSQL custom dump',
        'PGDUMP:MajorVersion': view.getUint8(5),
        'PGDUMP:MinorVersion': view.getUint8(6)
    };
};
