// Витоки Даних — parsers/svg.js
window.Parsers = window.Parsers || {};
window.Parsers.svg = function (buffer) {
    var bytes = new Uint8Array(buffer);
    var text = BinUtils.readUtf8(bytes, 0, Math.min(bytes.length, 2000)).trim();
    var looksLikeSvg = text.indexOf('<svg') > -1 || (text.indexOf('<?xml') === 0 && text.indexOf('svg') > -1);
    if (!looksLikeSvg) return null;

    var fullText = BinUtils.readUtf8(bytes, 0, bytes.length);
    var out = {};
    try {
        var doc = new DOMParser().parseFromString(fullText, 'image/svg+xml');
        if (doc.querySelector && doc.querySelector('parsererror')) return out;
        var svgEl = doc.documentElement;
        var title = svgEl.querySelector('title');
        var desc = svgEl.querySelector('desc');
        var metadata = svgEl.querySelector('metadata');
        if (title && title.textContent.trim()) out['SVG:Title'] = title.textContent.trim();
        if (desc && desc.textContent.trim()) out['SVG:Description'] = desc.textContent.trim();
        if (metadata && metadata.textContent.trim()) out['SVG:Metadata'] = metadata.textContent.trim().slice(0, 500);
        var creator = doc.getElementsByTagNameNS('*', 'creator')[0] || doc.querySelector('[*|creator]');
        var dcDate = doc.getElementsByTagNameNS('*', 'date')[0];
        if (creator && creator.textContent.trim()) out['SVG:Creator'] = creator.textContent.trim();
        if (dcDate && dcDate.textContent.trim()) out['SVG:Date'] = dcDate.textContent.trim();
        if (svgEl.getAttribute('viewBox')) out['SVG:ViewBox'] = svgEl.getAttribute('viewBox');
        if (svgEl.getAttribute('width')) out['ImageWidth'] = svgEl.getAttribute('width');
        if (svgEl.getAttribute('height')) out['ImageHeight'] = svgEl.getAttribute('height');
    } catch (e) { /* пошкоджений XML — повертаємо що встигли зібрати */ }
    return out;
};
