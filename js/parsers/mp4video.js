// Витоки Даних — parsers/mp4video.js
window.Parsers = window.Parsers || {};
window.Parsers.mp4video = function (buffer) {
    var view = new DataView(buffer);
    if (view.byteLength < 12) return null;
    if (BinUtils.readAsciiString(view, 4, 4) !== 'ftyp') return null;
    var brand = BinUtils.readAsciiString(view, 8, 4);
    var out = { 'Format:Brand': brand };

    function readBoxes(start, end) {
        var boxes = [], p = start;
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

    var mvhd = moovChildren.filter(function (b) { return b.type === 'mvhd'; })[0];
    if (mvhd) {
        var ver = view.getUint8(mvhd.dataStart);
        var tsOff = ver === 1 ? mvhd.dataStart + 20 : mvhd.dataStart + 12;
        var durOff = ver === 1 ? mvhd.dataStart + 28 : mvhd.dataStart + 16;
        var timescale = view.getUint32(tsOff, false);
        var duration = ver === 1
            ? (view.getUint32(durOff, false) * 0x100000000 + view.getUint32(durOff + 4, false))
            : view.getUint32(durOff, false);
        if (timescale > 0) out['MP4:Duration'] = (duration / timescale).toFixed(2) + ' с';
    }

    var traks = moovChildren.filter(function (b) { return b.type === 'trak'; });
    var videoDims = null;
    traks.forEach(function (trak) {
        var trakChildren = readBoxes(trak.dataStart, trak.end);
        var tkhd = trakChildren.filter(function (b) { return b.type === 'tkhd'; })[0];
        var mdia = trakChildren.filter(function (b) { return b.type === 'mdia'; })[0];
        var isVideo = false;
        if (mdia) {
            var mdiaChildren = readBoxes(mdia.dataStart, mdia.end);
            var hdlr = mdiaChildren.filter(function (b) { return b.type === 'hdlr'; })[0];
            if (hdlr && BinUtils.readAsciiString(view, hdlr.dataStart + 8, 4) === 'vide') isVideo = true;
        }
        if (tkhd && isVideo && !videoDims) {
            var tver = view.getUint8(tkhd.dataStart);
            var wOff = tver === 1 ? tkhd.dataStart + 84 : tkhd.dataStart + 72;
            var width = view.getUint32(wOff, false) / 65536;
            var height = view.getUint32(wOff + 4, false) / 65536;
            videoDims = { w: Math.round(width), h: Math.round(height) };
        }
    });
    if (videoDims) { out['MP4:VideoWidth'] = videoDims.w; out['MP4:VideoHeight'] = videoDims.h; }

    // udta/meta/ilst-теги (назва, автор тощо) — та ж структура, що й в аудіо-MP4
    var udta = moovChildren.filter(function (b) { return b.type === 'udta'; })[0];
    if (udta) {
        var udtaChildren = readBoxes(udta.dataStart, udta.end);
        var meta = udtaChildren.filter(function (b) { return b.type === 'meta'; })[0];
        if (meta) {
            var metaChildren = readBoxes(meta.dataStart + 4, meta.end);
            var ilst = metaChildren.filter(function (b) { return b.type === 'ilst'; })[0];
            if (ilst) {
                var ILST_MAP = { '©nam': 'Title', '©ART': 'Artist', '©day': 'Year', '©cmt': 'Comment' };
                readBoxes(ilst.dataStart, ilst.end).forEach(function (item) {
                    var mapped = ILST_MAP[item.type];
                    if (!mapped) return;
                    var dataBoxes = readBoxes(item.dataStart, item.end);
                    var dataBox = dataBoxes.filter(function (b) { return b.type === 'data'; })[0];
                    if (!dataBox) return;
                    var valueStart = dataBox.dataStart + 8;
                    out['MP4:' + mapped] = BinUtils.readUtf8(new Uint8Array(buffer), valueStart, dataBox.end).replace(/\0+$/, '').trim();
                });
            }
        }
    }
    return out;
};
