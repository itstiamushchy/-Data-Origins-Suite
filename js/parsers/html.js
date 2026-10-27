// Витоки Даних — parsers/html.js
window.Parsers = window.Parsers || {};
window.Parsers.html = function (buffer, extHint) {
    var bytes = new Uint8Array(buffer);
    var head = BinUtils.readLatin1(bytes, 0, Math.min(bytes.length, 1000)).toLowerCase();
    var looksLikeHtml = head.indexOf('<!doctype html') > -1 || head.indexOf('<html') > -1 || (extHint === 'html' || extHint === 'htm');
    if (!looksLikeHtml) return null;

    var out = {};
    try {
        var text = BinUtils.readUtf8(bytes, 0, bytes.length);
        var doc = new DOMParser().parseFromString(text, 'text/html');
        if (doc.title) out['HTML:Title'] = doc.title.trim();
        function meta(name) {
            var el = doc.querySelector('meta[name="' + name + '"]');
            return el ? el.getAttribute('content') : null;
        }
        var map = {
            'HTML:Author': meta('author'), 'HTML:Description': meta('description'),
            'HTML:Generator': meta('generator'), 'HTML:Keywords': meta('keywords'),
            'HTML:Charset': (doc.characterSet || null)
        };
        Object.keys(map).forEach(function (k) { if (map[k]) out[k] = map[k]; });
        var ogTitle = doc.querySelector('meta[property="og:title"]');
        if (ogTitle) out['HTML:OGTitle'] = ogTitle.getAttribute('content');
    } catch (e) { /* пошкоджений HTML */ }
    return out;
};
