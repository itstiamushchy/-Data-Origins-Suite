// Витоки Даних — parsers/mailcal-extra.js
window.Parsers = window.Parsers || {};

window.Parsers.mbox = function (buffer, extHint) {
    var bytes = new Uint8Array(buffer);
    var head = BinUtils.readLatin1(bytes, 0, 5);
    if (head !== 'From ') return null;
    var text = BinUtils.readLatin1(bytes, 0, bytes.length);
    var messageCount = (text.match(/^From /gm) || []).length;
    return { 'Format:Name': 'Mailbox (MBOX)', 'MBOX:MessageCount': messageCount };
};

window.Parsers.pst = function (buffer, extHint) {
    if (extHint !== 'pst' && extHint !== 'ost') return null;
    var view = new DataView(buffer);
    if (BinUtils.readAsciiString(view, 0, 4) !== '!BDN') return null;
    var out = { 'Format:Name': extHint === 'pst' ? 'Outlook Data File (PST)' : 'Outlook Offline Data (OST)' };
    var contentType = view.getUint8(8);
    out['PST:FormatVersion'] = contentType === 0x17 ? 'ANSI (97-2002)' : contentType === 0x15 || contentType === 0x23 ? 'Unicode (2003+)' : 'невідомо';
    return out;
};

window.Parsers.ics = function (buffer, extHint) {
    var bytes = new Uint8Array(buffer);
    var text = BinUtils.readLatin1(bytes, 0, Math.min(bytes.length, 500));
    if (text.indexOf('BEGIN:VCALENDAR') === -1) return null;
    var full = BinUtils.readLatin1(bytes, 0, bytes.length);
    var out = { 'Format:Name': 'iCalendar (ICS)' };
    var prodMatch = full.match(/PRODID:(.+)/);
    if (prodMatch) out['ICS:ProductID'] = prodMatch[1].trim();
    out['ICS:EventCount'] = (full.match(/BEGIN:VEVENT/g) || []).length;
    var firstSummary = full.match(/SUMMARY:(.+)/);
    if (firstSummary) out['ICS:FirstSummary'] = firstSummary[1].trim();
    return out;
};

window.Parsers.vcf = function (buffer, extHint) {
    var bytes = new Uint8Array(buffer);
    var text = BinUtils.readLatin1(bytes, 0, Math.min(bytes.length, 200));
    if (text.indexOf('BEGIN:VCARD') === -1) return null;
    var full = BinUtils.readLatin1(bytes, 0, bytes.length);
    var out = { 'Format:Name': 'vCard (VCF)' };
    out['VCF:ContactCount'] = (full.match(/BEGIN:VCARD/g) || []).length;
    var fnMatch = full.match(/FN:(.+)/);
    if (fnMatch) out['VCF:FirstName'] = fnMatch[1].trim();
    var orgMatch = full.match(/ORG:(.+)/);
    if (orgMatch) out['VCF:Organization'] = orgMatch[1].trim();
    return out;
};
