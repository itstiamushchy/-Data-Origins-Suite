// Витоки Даних — parsers/mp4audio.js
window.Parsers = window.Parsers || {};
window.Parsers.mp4audio = function (buffer) {
    var view = new DataView(buffer);
    if (view.byteLength < 12) return null;
    var type0 = BinUtils.readAsciiString(view, 4, 4);
    if (type0 !== 'ftyp') return null;
    var brand = BinUtils.readAsciiString(view, 8, 4);
    // Контейнер спільний з відео MP4; якщо немає moov/udta/meta/ilst — повертаємо лише бренд.
    var out = { 'Format:Brand': brand };
    var ILST_MAP = {
        '©nam': 'Title', '©ART': 'Artist', '©alb': 'Album', '©day': 'Year',
        '©gen': 'Genre', '©wrt': 'Composer', '©cmt': 'Comment', 'aART': 'AlbumArtist',
        'trkn': 'TrackNumber', 'covr': 'HasCoverArt'
    };

    function readBoxes(start, end) {
        var boxes = [];
        var p = start;
        while (p + 8 <= end) {
            var size = view.getUint32(p, false);
            var type = BinUtils.readAsciiString(view, p + 4, 4);
            var headerLen = 8;
            if (size === 1) headerLen = 16;
            var boxEnd = size === 0 ? end : p + (size || (end - p));
            boxes.push({ type: type, dataStart: p + headerLen, end: boxEnd });
            if (size <= 0) break;
            p = boxEnd;
        }
        return boxes;
    }

    var top = readBoxes(0, view.byteLength);
    var moov = top.filter(function (b) { return b.type === 'moov'; })[0];
    if (!moov) return out;
    var moovChildren = readBoxes(moov.dataStart, moov.end);
    var udta = moovChildren.filter(function (b) { return b.type === 'udta'; })[0];
    if (!udta) return out;
    var udtaChildren = readBoxes(udta.dataStart, udta.end);
    var meta = udtaChildren.filter(function (b) { return b.type === 'meta'; })[0];
    if (!meta) return out;
    // meta-box має 4-байтну full-box версію/флаги
    var metaChildren = readBoxes(meta.dataStart + 4, meta.end);
    var ilst = metaChildren.filter(function (b) { return b.type === 'ilst'; })[0];
    if (!ilst) return out;

    var items = readBoxes(ilst.dataStart, ilst.end);
    items.forEach(function (item) {
        var mapped = ILST_MAP[item.type];
        if (!mapped) return;
        var dataBoxes = readBoxes(item.dataStart, item.end);
        var dataBox = dataBoxes.filter(function (b) { return b.type === 'data'; })[0];
        if (!dataBox) return;
        if (mapped === 'HasCoverArt') {
            out['MP4:HasCoverArt'] = true;
            return;
        }
        var valueStart = dataBox.dataStart + 8; // пропускаємо type(4) + locale(4) всередині data-box
        var text = BinUtils.readUtf8(new Uint8Array(buffer), valueStart, dataBox.end);
        out['MP4:' + mapped] = text.replace(/\0+$/, '').trim();
    });
    return out;
};
