// Витоки Даних — parsers/email.js
window.Parsers = window.Parsers || {};

window.Parsers.eml = function (buffer, extHint) {
    var bytes = new Uint8Array(buffer);
    var head = BinUtils.readLatin1(bytes, 0, Math.min(bytes.length, 2000));
    var looksLikeEml = /^(From|Return-Path|Received|Delivered-To|Message-ID):/im.test(head) || extHint === 'eml';
    if (!looksLikeEml) return null;

    var headerEnd = BinUtils.indexOfBytes(bytes, '\r\n\r\n', 0);
    var altEnd = BinUtils.indexOfBytes(bytes, '\n\n', 0);
    if (headerEnd === -1 || (altEnd > -1 && altEnd < headerEnd)) headerEnd = altEnd;
    var headerText = BinUtils.readLatin1(bytes, 0, headerEnd > -1 ? headerEnd : Math.min(bytes.length, 5000));

    function field(name) {
        var re = new RegExp('^' + name + ':\\s*(.+(?:\\r?\\n[ \\t].*)*)', 'im');
        var m = headerText.match(re);
        return m ? m[1].replace(/\r?\n[ \t]+/g, ' ').trim() : null;
    }
    var out = {};
    var map = {
        'EML:From': field('From'), 'EML:To': field('To'), 'EML:Cc': field('Cc'),
        'EML:Subject': field('Subject'), 'EML:Date': field('Date'),
        'EML:MessageID': field('Message-ID'), 'EML:XMailer': field('X-Mailer')
    };
    Object.keys(map).forEach(function (k) { if (map[k]) out[k] = map[k]; });
    return out;
};

window.Parsers.msg = function (buffer) {
    var cfb = window.Ole2Reader.parse(buffer);
    if (!cfb) return null;
    var names = cfb.entries.map(function (e) { return e.name; });
    var isMsg = names.some(function (n) { return n.indexOf('__substg1.0_') === 0; });
    if (!isMsg) return null;

    var out = { 'Format:Name': 'Outlook MSG' };
    var PROP_MAP = { '0037': 'Subject', '0C1A': 'SenderName', '0E04': 'DisplayTo', '1000': 'Body', '0E1D': 'NormalizedSubject', '0057': 'MessageDeliveryTime' };
    Object.keys(PROP_MAP).forEach(function (tag) {
        var streamName = cfb.entries.filter(function (e) { return e.name.indexOf('__substg1.0_' + tag) === 0; })[0];
        if (!streamName) return;
        var bytesData = cfb.getStream(streamName.name);
        if (!bytesData) return;
        var isUnicode = streamName.name.slice(-4) === '001F';
        var text;
        if (isUnicode) { try { text = new TextDecoder('utf-16le').decode(bytesData).replace(/\0+$/, ''); } catch (e) { text = null; } }
        else text = BinUtils.readLatin1(bytesData, 0, bytesData.length).replace(/\0+$/, '');
        if (text && text.trim() && PROP_MAP[tag] !== 'Body') out['MSG:' + PROP_MAP[tag]] = text.trim();
        else if (text && PROP_MAP[tag] === 'Body') out['MSG:BodyLength'] = text.length;
    });
    return out;
};
