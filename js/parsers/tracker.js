// Витоки Даних — parsers/tracker.js
// Трекерні формати мають мінімум метаданих за специфікацією — лише назва композиції.
window.Parsers = window.Parsers || {};
window.Parsers.tracker = function (buffer, extHint) {
    var view = new DataView(buffer);
    var bytes = new Uint8Array(buffer);
    var out = null;

    if (extHint === 'xm' && BinUtils.readAsciiString(view, 0, 17) === 'Extended Module: ') {
        out = { 'Format:Name': 'FastTracker XM' };
        out['Tracker:Title'] = BinUtils.readLatin1(bytes, 17, 37).trim();
    } else if (extHint === 's3m' && BinUtils.readAsciiString(view, 44, 4) === 'SCRM') {
        out = { 'Format:Name': 'Scream Tracker S3M' };
        out['Tracker:Title'] = BinUtils.readLatin1(bytes, 0, 28).replace(/\0+$/, '').trim();
    } else if (extHint === 'it' && BinUtils.readAsciiString(view, 0, 4) === 'IMPM') {
        out = { 'Format:Name': 'Impulse Tracker IT' };
        out['Tracker:Title'] = BinUtils.readLatin1(bytes, 4, 30).replace(/\0+$/, '').trim();
    } else if (extHint === 'mod' && buffer.byteLength > 1084) {
        var tag = BinUtils.readAsciiString(view, 1080, 4);
        var modTags = { 'M.K.': 1, 'M!K!': 1, 'FLT4': 1, 'FLT8': 1, '8CHN': 1, '6CHN': 1 };
        if (modTags[tag]) {
            out = { 'Format:Name': 'ProTracker MOD' };
            out['Tracker:Title'] = BinUtils.readLatin1(bytes, 0, 20).replace(/\0+$/, '').trim();
        }
    }
    return out;
};
