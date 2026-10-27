// Витоки Даних — parsers/cert.js
// Мінімальний DER/ASN.1-рідер, достатній для стандартних полів X.509-сертифіката.
window.Parsers = window.Parsers || {};

var OID_NAMES = { '2.5.4.3': 'CN', '2.5.4.6': 'C', '2.5.4.7': 'L', '2.5.4.8': 'ST', '2.5.4.10': 'O', '2.5.4.11': 'OU' };

function derReadLength(bytes, pos) {
    var first = bytes[pos];
    if (first < 0x80) return { length: first, headerLen: 1 };
    var numBytes = first & 0x7F;
    var length = 0;
    for (var i = 0; i < numBytes; i++) length = length * 256 + bytes[pos + 1 + i];
    return { length: length, headerLen: 1 + numBytes };
}

function derReadTLV(bytes, pos) {
    var tag = bytes[pos];
    var len = derReadLength(bytes, pos + 1);
    var valueStart = pos + 1 + len.headerLen;
    return { tag: tag, valueStart: valueStart, valueEnd: valueStart + len.length, next: valueStart + len.length };
}

function derReadOid(bytes, start, end) {
    var parts = [];
    var first = bytes[start];
    parts.push(Math.floor(first / 40), first % 40);
    var val = 0;
    for (var i = start + 1; i < end; i++) {
        val = val * 128 + (bytes[i] & 0x7F);
        if (!(bytes[i] & 0x80)) { parts.push(val); val = 0; }
    }
    return parts.join('.');
}

function derReadName(bytes, start, end) {
    // RDNSequence: SEQUENCE OF SET OF SEQUENCE { OID, String }
    var parts = [];
    var p = start;
    while (p < end) {
        var setTlv = derReadTLV(bytes, p); // SET
        var seqTlv = derReadTLV(bytes, setTlv.valueStart); // SEQUENCE в SET
        var oidTlv = derReadTLV(bytes, seqTlv.valueStart);
        var strTlv = derReadTLV(bytes, oidTlv.next);
        var oid = derReadOid(bytes, oidTlv.valueStart, oidTlv.valueEnd);
        var name = OID_NAMES[oid];
        if (name) {
            var value = BinUtils.readUtf8(bytes, strTlv.valueStart, strTlv.valueEnd);
            parts.push(name + '=' + value);
        }
        p = setTlv.next;
    }
    return parts.join(', ');
}

function derReadTime(bytes, tlv) {
    var s = BinUtils.readAsciiString(new DataView(bytes.buffer, bytes.byteOffset), tlv.valueStart, tlv.valueEnd - tlv.valueStart);
    // UTCTime YYMMDDHHMMSSZ або GeneralizedTime YYYYMMDDHHMMSSZ
    if (s.length === 13) return '20' + s.slice(0, 2) + '-' + s.slice(2, 4) + '-' + s.slice(4, 6) + ' ' + s.slice(6, 8) + ':' + s.slice(8, 10) + ':' + s.slice(10, 12) + ' UTC';
    if (s.length >= 15) return s.slice(0, 4) + '-' + s.slice(4, 6) + '-' + s.slice(6, 8) + ' ' + s.slice(8, 10) + ':' + s.slice(10, 12) + ':' + s.slice(12, 14) + ' UTC';
    return s;
}

function parseX509(bytes) {
    var out = {};
    try {
        var cert = derReadTLV(bytes, 0); // Certificate SEQUENCE
        var tbs = derReadTLV(bytes, cert.valueStart); // TBSCertificate SEQUENCE
        var p = tbs.valueStart;
        var first = derReadTLV(bytes, p);
        if (first.tag === 0xA0) { p = first.next; first = derReadTLV(bytes, p); } // пропускаємо [0] version, якщо є
        p = first.next; // serialNumber
        var sigAlg = derReadTLV(bytes, p); p = sigAlg.next; // signature algorithm
        var issuer = derReadTLV(bytes, p); p = issuer.next; // issuer Name
        var validity = derReadTLV(bytes, p); p = validity.next; // validity SEQUENCE
        var subject = derReadTLV(bytes, p); // subject Name

        out['CERT:Issuer'] = derReadName(bytes, issuer.valueStart, issuer.valueEnd);
        out['CERT:Subject'] = derReadName(bytes, subject.valueStart, subject.valueEnd);

        var notBeforeTlv = derReadTLV(bytes, validity.valueStart);
        var notAfterTlv = derReadTLV(bytes, notBeforeTlv.next);
        out['CERT:NotBefore'] = derReadTime(bytes, notBeforeTlv);
        out['CERT:NotAfter'] = derReadTime(bytes, notAfterTlv);
    } catch (e) { /* нестандартна структура — повертаємо що встигли розібрати */ }
    return out;
}

window.Parsers.cert = function (buffer, extHint) {
    var bytes = new Uint8Array(buffer);
    var head = BinUtils.readLatin1(bytes, 0, Math.min(bytes.length, 40));

    if (head.indexOf('-----BEGIN CERTIFICATE-----') === 0) {
        var text = BinUtils.readLatin1(bytes, 0, bytes.length);
        var b64 = text.replace(/-----BEGIN CERTIFICATE-----/, '').replace(/-----END CERTIFICATE-----[\s\S]*/, '').replace(/\s+/g, '');
        var der;
        try { der = Uint8Array.from(atob(b64), function (c) { return c.charCodeAt(0); }); } catch (e) { return { 'Format:Name': 'PEM-сертифікат (не вдалось декодувати base64)' }; }
        var out = { 'Format:Name': 'X.509 сертифікат (PEM)' };
        Object.assign(out, parseX509(der));
        return out;
    }

    if (['crt', 'cer', 'der'].indexOf(extHint) > -1 && bytes[0] === 0x30) { // DER SEQUENCE tag
        var out2 = { 'Format:Name': 'X.509 сертифікат (DER)' };
        Object.assign(out2, parseX509(bytes));
        return out2;
    }

    if (extHint === 'p12' || extHint === 'pfx') {
        if (bytes[0] !== 0x30) return null;
        return { 'Format:Name': 'PKCS#12 (P12/PFX)', 'CERT:Note': 'Вміст зазвичай зашифрований паролем — детальний розбір вмісту не реалізовано, підтверджено лише контейнер.' };
    }
    return null;
};
