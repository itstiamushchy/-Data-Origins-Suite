// Витоки Даних — parsers/sqlite.js
window.Parsers = window.Parsers || {};
window.Parsers.sqlite = function (buffer) {
    var view = new DataView(buffer);
    var bytes = new Uint8Array(buffer);
    if (BinUtils.readAsciiString(view, 0, 15) !== 'SQLite format 3') return null;

    var out = {};
    var pageSizeRaw = view.getUint16(16, false);
    out['SQLITE:PageSize'] = pageSizeRaw === 1 ? 65536 : pageSizeRaw;
    out['SQLITE:FileFormatWriteVersion'] = view.getUint8(18);
    out['SQLITE:FileFormatReadVersion'] = view.getUint8(19);
    out['SQLITE:PageCount'] = view.getUint32(28, false);
    out['SQLITE:TextEncoding'] = { 1: 'UTF-8', 2: 'UTF-16LE', 3: 'UTF-16BE' }[view.getUint32(56, false)] || 'невідомо';
    out['SQLITE:UserVersion'] = view.getUint32(60, false);
    out['SQLITE:ApplicationID'] = view.getUint32(68, false);

    // Евристичний пошук назв таблиць/індексів: SQLite зберігає SQL-текст CREATE-операторів
    // у відкритому вигляді всередині сторінок sqlite_master, тому прямий текстовий пошук надійний
    // без повного розбору B-tree сторінок.
    var text = BinUtils.readLatin1(bytes, 0, bytes.length);
    var tableNames = [];
    var re = /CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?["'`\[]?([A-Za-z_][\w]*)["'`\]]?/gi;
    var m;
    while ((m = re.exec(text)) !== null && tableNames.length < 50) {
        if (tableNames.indexOf(m[1]) === -1) tableNames.push(m[1]);
    }
    if (tableNames.length) out['SQLITE:Tables'] = tableNames.join(', ');
    return out;
};
