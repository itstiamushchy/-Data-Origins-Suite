// Витоки Даних — parsers/mobileapp.js
window.Parsers = window.Parsers || {};

window.Parsers.apk = function (buffer, extHint) {
    if (['apk', 'aab'].indexOf(extHint) === -1) return null;
    var entries = window.ZipReader.listEntries(buffer);
    if (!entries) return null;
    var names = entries.map(function (e) { return e.name; });
    var isApk = names.indexOf('AndroidManifest.xml') > -1;
    var isAab = names.indexOf('base/manifest/AndroidManifest.xml') > -1 || names.some(function (n) { return n.indexOf('BundleConfig.pb') > -1; });
    if (!isApk && !isAab) return null;
    var out = { 'Format:Name': isAab ? 'Android App Bundle (AAB)' : 'Android Package (APK)' };
    out['APK:Note'] = 'AndroidManifest.xml збережено у бінарному форматі AXML — розбір полів (назва пакета, версія, дозволи) не реалізовано.';
    var dexCount = names.filter(function (n) { return /\.dex$/.test(n); }).length;
    if (dexCount) out['APK:DexFileCount'] = dexCount;
    return out;
};

window.Parsers.ipa = function (buffer, extHint) {
    if (extHint !== 'ipa') return null;
    var entries = window.ZipReader.listEntries(buffer);
    if (!entries) return null;
    var plistEntry = entries.filter(function (e) { return /Payload\/[^/]+\.app\/Info\.plist$/.test(e.name); })[0];
    if (!plistEntry) return null;
    return { 'Format:Name': 'iOS App Package (IPA)', 'IPA:Note': 'Info.plist зазвичай у бінарному форматі — текстовий розбір значень не реалізовано, підтверджено наявність.' };
};

window.Parsers.msix = function (buffer, extHint) {
    if (['msix', 'appx'].indexOf(extHint) === -1) return null;
    var entries = window.ZipReader.listEntries(buffer);
    if (!entries) return null;
    var names = entries.map(function (e) { return e.name; });
    var manifestEntry = names.filter(function (n) { return n === 'AppxManifest.xml'; })[0];
    if (!manifestEntry) return null;
    var out = { 'Format:Name': extHint === 'msix' ? 'MSIX Package' : 'APPX Package' };
    return window.ZipReader.extractByName(buffer, entries, manifestEntry).then(function (bytes) {
        if (!bytes) return out;
        try {
            var doc = new DOMParser().parseFromString(BinUtils.readUtf8(bytes, 0, bytes.length), 'application/xml');
            var idEl = doc.getElementsByTagNameNS('*', 'Identity')[0];
            if (idEl) {
                out['MSIX:Name'] = idEl.getAttribute('Name');
                out['MSIX:Version'] = idEl.getAttribute('Version');
                out['MSIX:Publisher'] = idEl.getAttribute('Publisher');
            }
            var dispEl = doc.getElementsByTagNameNS('*', 'DisplayName')[0];
            if (dispEl) out['MSIX:DisplayName'] = dispEl.textContent.trim();
        } catch (e) {}
        return out;
    });
};
