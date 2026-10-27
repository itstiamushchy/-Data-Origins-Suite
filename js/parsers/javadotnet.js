// Витоки Даних — parsers/javadotnet.js
window.Parsers = window.Parsers || {};

window.Parsers.jar = function (buffer, extHint) {
    if (extHint !== 'jar' && extHint !== 'war' && extHint !== 'ear') return null;
    var entries = window.ZipReader.listEntries(buffer);
    if (!entries) return null;
    var manifestEntry = entries.filter(function (e) { return e.name === 'META-INF/MANIFEST.MF'; })[0];
    var out = { 'Format:Name': extHint.toUpperCase() + ' (Java-архів)' };
    if (!manifestEntry) return out;

    return window.ZipReader.extractEntry(buffer, manifestEntry).then(function (bytes) {
        if (!bytes) return out;
        var text = BinUtils.readUtf8(bytes, 0, bytes.length);
        var FIELD_MAP = { 'Manifest-Version': 'ManifestVersion', 'Created-By': 'CreatedBy', 'Main-Class': 'MainClass', 'Implementation-Title': 'Title', 'Implementation-Version': 'Version', 'Implementation-Vendor': 'Vendor' };
        Object.keys(FIELD_MAP).forEach(function (key) {
            var re = new RegExp(key + ':\\s*(.+)');
            var m = text.match(re);
            if (m) out['JAR:' + FIELD_MAP[key]] = m[1].trim();
        });
        return out;
    });
};

window.Parsers.javaClass = function (buffer) {
    var view = new DataView(buffer);
    if (view.getUint32(0, false) !== 0xCAFEBABE) return null;
    var minor = view.getUint16(4, false);
    var major = view.getUint16(6, false);
    var JDK_MAP = { 45: '1.1', 46: '1.2', 47: '1.3', 48: '1.4', 49: '5', 50: '6', 51: '7', 52: '8', 53: '9', 54: '10', 55: '11', 56: '12', 57: '13', 58: '14', 59: '15', 60: '16', 61: '17', 62: '18', 63: '19', 64: '20', 65: '21' };
    return { 'Format:Name': 'Java compiled class', 'CLASS:JavaVersion': JDK_MAP[major] ? 'Java ' + JDK_MAP[major] : ('major=' + major), 'CLASS:MinorVersion': minor };
};
