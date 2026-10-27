// Витоки Даних — parsers/db-internals.js
window.Parsers = window.Parsers || {};

window.Parsers.innodb = function (buffer, extHint) {
    if (['ibd', 'ibdata', 'ibdata1'].indexOf(extHint) === -1) return null;
    if (buffer.byteLength < 38) return null;
    var view = new DataView(buffer);
    // Перша сторінка InnoDB (FIL header): checksum(4), page number(4) — за розширенням плюс базовий розмір сторінки.
    var out = { 'Format:Name': 'InnoDB Tablespace (' + extHint.toUpperCase() + ')' };
    out['INNODB:PageNumber'] = view.getUint32(4, false);
    return out;
};

window.Parsers.myisamFrm = function (buffer, extHint) {
    if (extHint !== 'frm') return null;
    var view = new DataView(buffer);
    var ver = view.getUint8(0);
    if (ver !== 0xFE && ver !== 0x00) return null;
    return { 'Format:Name': 'MySQL Table Definition (FRM)' };
};

window.Parsers.wiredtiger = function (buffer, extHint) {
    if (extHint !== 'wt') return null;
    var bytes = new Uint8Array(buffer);
    var text = BinUtils.readLatin1(bytes, 0, Math.min(bytes.length, 200));
    if (text.indexOf('WiredTiger') === -1) return null;
    return { 'Format:Name': 'WiredTiger (MongoDB storage)' };
};

window.Parsers.redisAof = function (buffer, extHint) {
    if (extHint !== 'aof') return null;
    var bytes = new Uint8Array(buffer);
    var head = BinUtils.readLatin1(bytes, 0, 11);
    if (head !== 'REDIS' && head.indexOf('*') !== 0) return null; // RESP-команди починаються з '*'
    return { 'Format:Name': 'Redis AOF (Append Only File)' };
};
