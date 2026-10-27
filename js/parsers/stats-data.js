// Витоки Даних — parsers/stats-data.js
window.Parsers = window.Parsers || {};

window.Parsers.parquet = function (buffer) {
    var bytes = new Uint8Array(buffer);
    if (buffer.byteLength < 8) return null;
    var head = BinUtils.readLatin1(bytes, 0, 4);
    var tail = BinUtils.readLatin1(bytes, buffer.byteLength - 4, buffer.byteLength);
    if (head !== 'PAR1' || tail !== 'PAR1') return null;
    return { 'Format:Name': 'Apache Parquet', 'PARQUET:Note': 'Схема й статистика стовпців закодовані у Thrift-футері — детальний розбір не реалізовано, підтверджено формат.' };
};

window.Parsers.avro = function (buffer) {
    var view = new DataView(buffer);
    var bytes = new Uint8Array(buffer);
    if (view.getUint8(0) !== 0x4F || view.getUint8(1) !== 0x62 || view.getUint8(2) !== 0x6A || view.getUint8(3) !== 0x01) return null; // "Obj" + 0x01
    var out = { 'Format:Name': 'Apache Avro' };
    // Метадані зберігаються як map<string,bytes>, де значення 'avro.schema' — JSON-рядок схеми.
    // Формат Avro-рядка: zigzag-varint довжина + UTF-8 байти. Читаємо лише перший запис мапи евристично.
    try {
        var text = BinUtils.readUtf8(bytes, 4, Math.min(bytes.length, 8192));
        var m = text.match(/\{"type":"record"[\s\S]*?\}(?=\s*(?:[^"]*"avro\.codec"|\u0000|$))/);
        if (m) {
            var schema = JSON.parse(m[0]);
            if (schema.name) out['AVRO:SchemaName'] = schema.name;
            if (schema.fields) out['AVRO:FieldCount'] = schema.fields.length;
        }
    } catch (e) { /* евристика не спрацювала — повертаємо лише факт формату */ }
    return out;
};

window.Parsers.orc = function (buffer) {
    var bytes = new Uint8Array(buffer);
    if (buffer.byteLength < 3) return null;
    var tail = BinUtils.readLatin1(bytes, buffer.byteLength - 3, buffer.byteLength);
    if (tail !== 'ORC') return null;
    return { 'Format:Name': 'Apache ORC', 'ORC:Note': 'Метадані закодовані у Protobuf-футері — детальний розбір не реалізовано, підтверджено формат.' };
};

window.Parsers.feather = function (buffer) {
    var view = new DataView(buffer);
    if (BinUtils.readAsciiString(view, 0, 6) !== 'ARROW1') return null;
    return { 'Format:Name': 'Apache Arrow/Feather', 'FEATHER:Note': 'Схема закодована у Flatbuffers — детальний розбір не реалізовано, підтверджено формат.' };
};

window.Parsers.statFile = function (buffer, extHint) {
    var bytes = new Uint8Array(buffer);

    if (extHint === 'sas7bdat') {
        var SAS_MAGIC = [0xC2, 0xEA, 0x81, 0x60, 0xB3, 0x14, 0x11, 0xCF, 0xBD, 0x92, 0x08, 0x00, 0x09, 0xC7, 0x31, 0x8C];
        var matches = true;
        for (var i = 0; i < SAS_MAGIC.length; i++) if (bytes[12 + i] !== SAS_MAGIC[i]) { matches = false; break; }
        if (!matches) return null;
        return { 'Format:Name': 'SAS Data Set (sas7bdat)', 'STAT:Note': 'Пропрієтарний бінарний формат — детальний розбір вмісту не реалізовано, підтверджено сигнатуру.' };
    }

    if (extHint === 'sav') {
        var head = BinUtils.readLatin1(bytes, 0, 4);
        if (head !== '$FL2' && head !== '$FL3') return null;
        return { 'Format:Name': 'SPSS Data (SAV)' };
    }

    if (extHint === 'dta') {
        // Сучасний формат (Stata 13+) використовує XML-подібний заголовок; старіші версії — лише байт-код релізу,
        // недостатньо надійний для однозначного підтвердження без розширення.
        var head2 = BinUtils.readLatin1(bytes, 0, 11);
        if (head2.indexOf('<stata_dta>') === 0) return { 'Format:Name': 'Stata Data (DTA, v13+)' };
        return { 'Format:Name': 'Stata Data (DTA, стара версія)', 'STAT:Note': 'Версія формату до Stata 13 — підтверджено лише за розширенням файлу.' };
    }
    return null;
};

window.Parsers.dif = function (buffer, extHint) {
    if (extHint !== 'dif') return null;
    var bytes = new Uint8Array(buffer);
    var head = BinUtils.readLatin1(bytes, 0, Math.min(bytes.length, 20));
    if (head.indexOf('TABLE') !== 0) return null;
    return { 'Format:Name': 'Data Interchange Format (DIF)' };
};
