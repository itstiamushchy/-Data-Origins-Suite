// Витоки Даних — parsers/subtitles.js
window.Parsers = window.Parsers || {};
window.Parsers.subtitles = function (buffer, extHint) {
    var bytes = new Uint8Array(buffer);
    var text = BinUtils.readUtf8(bytes, 0, Math.min(bytes.length, 200000));
    var trimmed = text.replace(/^\uFEFF/, '').trim();

    if (trimmed.indexOf('WEBVTT') === 0) {
        var out1 = { 'Format:Name': 'WebVTT' };
        out1['VTT:CueCount'] = (text.match(/-->/g) || []).length;
        var noteMatch = text.match(/NOTE\s+(.+)/);
        if (noteMatch) out1['VTT:Note'] = noteMatch[1].trim();
        return out1;
    }

    if (trimmed.indexOf('[Script Info]') === 0 || /^\[Script Info\]/m.test(trimmed)) {
        var out2 = { 'Format:Name': text.indexOf('ScriptType: v4.00+') > -1 ? 'ASS (Advanced SubStation)' : 'SSA/ASS' };
        var fields = { Title: 'Title', 'Original Script': 'OriginalScript', 'Script Type': 'ScriptType', Collisions: 'Collisions' };
        Object.keys(fields).forEach(function (k) {
            var re = new RegExp(k + ':\\s*(.+)');
            var m = text.match(re);
            if (m) out2['ASS:' + fields[k]] = m[1].trim();
        });
        out2['ASS:EventCount'] = (text.match(/^Dialogue:/gm) || []).length;
        return out2;
    }

    if (extHint === 'srt' && /^\d+\s*\r?\n\d{2}:\d{2}:\d{2}[,.]\d{3}\s*-->/m.test(trimmed)) {
        return { 'Format:Name': 'SubRip (SRT)', 'SRT:CueCount': (text.match(/-->/g) || []).length };
    }
    return null;
};
