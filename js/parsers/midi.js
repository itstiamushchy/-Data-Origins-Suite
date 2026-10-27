// Витоки Даних — parsers/midi.js
window.Parsers = window.Parsers || {};
window.Parsers.midi = function (buffer) {
    var view = new DataView(buffer);
    var bytes = new Uint8Array(buffer);
    if (BinUtils.readAsciiString(view, 0, 4) !== 'MThd') return null;

    var out = {};
    var format = view.getUint16(8, false);
    var trackCount = view.getUint16(10, false);
    var division = view.getUint16(12, false);
    out['MIDI:Format'] = format;
    out['MIDI:TrackCount'] = trackCount;
    out['MIDI:Division'] = division;

    var texts = { trackName: [], copyright: [], text: [], marker: [] };
    var offset = 14;
    var tracksScanned = 0;

    while (offset + 8 <= view.byteLength && tracksScanned < trackCount) {
        if (BinUtils.readAsciiString(view, offset, 4) !== 'MTrk') break;
        var trackLen = view.getUint32(offset + 4, false);
        var trackStart = offset + 8;
        var trackEnd = trackStart + trackLen;
        var p = trackStart;
        var runningStatus = 0;

        while (p < trackEnd && p < view.byteLength) {
            // Пропускаємо variable-length delta-time
            while (bytes[p] & 0x80) p++;
            p++;
            if (p >= trackEnd) break;
            var statusByte = bytes[p];
            if (statusByte === 0xFF) { // Meta event
                var metaType = bytes[p + 1];
                var lenStart = p + 2;
                var len = 0, lp = lenStart;
                do { len = (len << 7) | (bytes[lp] & 0x7F); } while (bytes[lp++] & 0x80);
                var textStart = lp;
                if (metaType === 0x03) texts.trackName.push(BinUtils.readUtf8(bytes, textStart, textStart + len));
                else if (metaType === 0x02) texts.copyright.push(BinUtils.readUtf8(bytes, textStart, textStart + len));
                else if (metaType === 0x01) texts.text.push(BinUtils.readUtf8(bytes, textStart, textStart + len));
                else if (metaType === 0x06) texts.marker.push(BinUtils.readUtf8(bytes, textStart, textStart + len));
                p = textStart + len;
            } else if (statusByte === 0xF0 || statusByte === 0xF7) { // SysEx
                var slen = 0, sp = p + 1;
                do { slen = (slen << 7) | (bytes[sp] & 0x7F); } while (bytes[sp++] & 0x80);
                p = sp + slen;
            } else {
                if (statusByte & 0x80) { runningStatus = statusByte; p++; } else { statusByte = runningStatus; }
                var dataBytes = ((statusByte & 0xF0) === 0xC0 || (statusByte & 0xF0) === 0xD0) ? 1 : 2;
                p += dataBytes;
            }
        }
        offset = trackEnd;
        tracksScanned++;
    }

    if (texts.trackName.length) out['MIDI:TrackName'] = texts.trackName.filter(Boolean).join(' / ');
    if (texts.copyright.length) out['MIDI:Copyright'] = texts.copyright.join(' / ');
    if (texts.text.length) out['MIDI:Text'] = texts.text.slice(0, 5).join(' / ');
    if (texts.marker.length) out['MIDI:Markers'] = texts.marker.join(', ');
    return out;
};
