// Витоки Даних — parsers/gis.js
window.Parsers = window.Parsers || {};

function parseKmlText(text) {
    var out = { 'Format:Name': 'KML (Google Earth)' };
    try {
        var doc = new DOMParser().parseFromString(text, 'application/xml');
        if (doc.querySelector && doc.querySelector('parsererror')) return out;
        var nameEl = doc.getElementsByTagNameNS('*', 'name')[0];
        var descEl = doc.getElementsByTagNameNS('*', 'description')[0];
        if (nameEl) out['KML:Name'] = nameEl.textContent.trim();
        if (descEl) out['KML:Description'] = descEl.textContent.trim().slice(0, 300);
        out['KML:PlacemarkCount'] = doc.getElementsByTagNameNS('*', 'Placemark').length;
    } catch (e) {}
    return out;
}

window.Parsers.kml = function (buffer, extHint) {
    var bytes = new Uint8Array(buffer);

    if (extHint === 'kmz') {
        var entries = window.ZipReader.listEntries(buffer);
        if (!entries) return null;
        var kmlEntry = entries.filter(function (e) { return e.name.toLowerCase() === 'doc.kml'; })[0] || entries.filter(function (e) { return /\.kml$/i.test(e.name); })[0];
        if (!kmlEntry) return { 'Format:Name': 'KMZ (архів без .kml усередині)' };
        return window.ZipReader.extractEntry(buffer, kmlEntry).then(function (kmlBytes) {
            if (!kmlBytes) return { 'Format:Name': 'KMZ' };
            var out = parseKmlText(BinUtils.readUtf8(kmlBytes, 0, kmlBytes.length));
            out['Format:Name'] = 'KMZ (стиснений KML)';
            return out;
        });
    }

    var head = BinUtils.readLatin1(bytes, 0, Math.min(bytes.length, 2000));
    if (head.indexOf('<kml') === -1) return null;
    return parseKmlText(BinUtils.readUtf8(bytes, 0, bytes.length));
};

window.Parsers.gpx = function (buffer) {
    var bytes = new Uint8Array(buffer);
    var head = BinUtils.readLatin1(bytes, 0, Math.min(bytes.length, 300));
    if (head.indexOf('<gpx') === -1) return null;
    var out = { 'Format:Name': 'GPX (GPS Exchange Format)' };
    try {
        var text = BinUtils.readUtf8(bytes, 0, bytes.length);
        var doc = new DOMParser().parseFromString(text, 'application/xml');
        if (doc.querySelector && doc.querySelector('parsererror')) return out;
        var gpxEl = doc.getElementsByTagNameNS('*', 'gpx')[0];
        if (gpxEl) { out['GPX:Creator'] = gpxEl.getAttribute('creator'); out['GPX:Version'] = gpxEl.getAttribute('version'); }
        var nameEl = doc.getElementsByTagNameNS('*', 'name')[0];
        if (nameEl) out['GPX:Name'] = nameEl.textContent.trim();
        var timeEl = doc.getElementsByTagNameNS('*', 'time')[0];
        if (timeEl) out['GPX:Time'] = timeEl.textContent.trim();
        out['GPX:TrackCount'] = doc.getElementsByTagNameNS('*', 'trk').length;
        out['GPX:WaypointCount'] = doc.getElementsByTagNameNS('*', 'wpt').length;
    } catch (e) {}
    return out;
};

window.Parsers.shp = function (buffer, extHint) {
    if (extHint !== 'shp') return null;
    var view = new DataView(buffer);
    if (view.getInt32(0, false) !== 9994) return null;
    var out = { 'Format:Name': 'Esri Shapefile' };
    out['SHP:Version'] = view.getInt32(28, true);
    var SHAPE_TYPES = { 0: 'Null', 1: 'Point', 3: 'PolyLine', 5: 'Polygon', 8: 'MultiPoint', 11: 'PointZ', 13: 'PolyLineZ', 15: 'PolygonZ' };
    out['SHP:ShapeType'] = SHAPE_TYPES[view.getInt32(32, true)] || 'код ' + view.getInt32(32, true);
    out['SHP:BoundingBox'] = [view.getFloat64(36, true), view.getFloat64(44, true), view.getFloat64(52, true), view.getFloat64(60, true)].map(function (n) { return n.toFixed(4); }).join(', ');
    return out;
};
