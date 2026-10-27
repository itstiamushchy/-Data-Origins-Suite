// Витоки Даних — parsers/mkv.js
// Мінімальний читач EBML (формат-основа Matroska/WebM). Не заглиблюємось у Cluster-елементи
// (самі відеодані) — лише Segment -> Info/Tracks, де зберігаються метадані.
window.Parsers = window.Parsers || {};
window.Parsers.mkv = function (buffer) {
    var view = new DataView(buffer);
    if (view.getUint32(0, false) !== 0x1A45DFA3) return null; // EBML-сигнатура

    function readVint(pos, keepMarker) {
        var first = view.getUint8(pos);
        var len = 1;
        for (var mask = 0x80; mask > 0 && !(first & mask); mask >>= 1) len++;
        if (len > 8) return null;
        var value = keepMarker ? first : (first & (0xFF >> len));
        for (var i = 1; i < len; i++) value = value * 256 + view.getUint8(pos + i);
        return { value: value, length: len };
    }

    function readElements(start, end, maxCount) {
        var els = [], p = start, count = 0;
        while (p < end && count++ < (maxCount || 100000)) {
            var idInfo = readVint(p, true);
            if (!idInfo) break;
            var sizeInfo = readVint(p + idInfo.length, false);
            if (!sizeInfo) break;
            var dataStart = p + idInfo.length + sizeInfo.length;
            var dataEnd = dataStart + sizeInfo.value;
            els.push({ id: idInfo.value, dataStart: dataStart, dataEnd: Math.min(dataEnd, end) });
            if (dataEnd <= p) break;
            p = dataEnd;
        }
        return els;
    }

    var out = {};
    var top = readElements(0, view.byteLength, 20);
    var segment = top.filter(function (e) { return e.id === 0x18538067; })[0];
    if (!segment) return out;

    var segChildren = readElements(segment.dataStart, segment.dataEnd, 500);
    var info = segChildren.filter(function (e) { return e.id === 0x1549A966; })[0];
    if (info) {
        var infoChildren = readElements(info.dataStart, info.dataEnd, 100);
        infoChildren.forEach(function (e) {
            if (e.id === 0x7BA9) out['MKV:Title'] = BinUtils.readUtf8(new Uint8Array(buffer), e.dataStart, e.dataEnd);
            else if (e.id === 0x4D80) out['MKV:MuxingApp'] = BinUtils.readUtf8(new Uint8Array(buffer), e.dataStart, e.dataEnd);
            else if (e.id === 0x5741) out['MKV:WritingApp'] = BinUtils.readUtf8(new Uint8Array(buffer), e.dataStart, e.dataEnd);
            else if (e.id === 0x2AD7B1) out['MKV:TimecodeScale'] = readUint(e);
            else if (e.id === 0x4489) out['MKV:DurationRaw'] = readFloat(e);
        });
        if (out['MKV:DurationRaw'] && out['MKV:TimecodeScale']) {
            var seconds = out['MKV:DurationRaw'] * out['MKV:TimecodeScale'] / 1e9;
            out['MKV:Duration'] = seconds.toFixed(2) + ' с';
        }
        delete out['MKV:DurationRaw']; delete out['MKV:TimecodeScale'];
    }

    var tracks = segChildren.filter(function (e) { return e.id === 0x1654AE6B; })[0];
    if (tracks) {
        var entries = readElements(tracks.dataStart, tracks.dataEnd, 50).filter(function (e) { return e.id === 0xAE; });
        var videoDone = false;
        entries.forEach(function (entry) {
            var fields = readElements(entry.dataStart, entry.dataEnd, 50);
            var type = null, codec = null, videoBox = null;
            fields.forEach(function (f) {
                if (f.id === 0x83) type = view.getUint8(f.dataStart);
                else if (f.id === 0x86) codec = BinUtils.readAsciiString(view, f.dataStart, f.dataEnd - f.dataStart);
                else if (f.id === 0xE0) videoBox = f;
            });
            if (type === 1 && !videoDone) {
                videoDone = true;
                if (codec) out['MKV:VideoCodec'] = codec;
                if (videoBox) {
                    readElements(videoBox.dataStart, videoBox.dataEnd, 20).forEach(function (vf) {
                        if (vf.id === 0xB0) out['MKV:Width'] = readUint(vf);
                        else if (vf.id === 0xBA) out['MKV:Height'] = readUint(vf);
                    });
                }
            } else if (type === 2 && !out['MKV:AudioCodec'] && codec) {
                out['MKV:AudioCodec'] = codec;
            }
        });
    }
    return out;

    function readUint(el) {
        var v = 0;
        for (var i = el.dataStart; i < el.dataEnd; i++) v = v * 256 + view.getUint8(i);
        return v;
    }
    function readFloat(el) {
        var len = el.dataEnd - el.dataStart;
        if (len === 4) return view.getFloat32(el.dataStart, false);
        if (len === 8) return view.getFloat64(el.dataStart, false);
        return readUint(el);
    }
};
