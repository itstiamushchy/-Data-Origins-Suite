// Витоки Даних — parsers/psd.js
window.Parsers = window.Parsers || {};
window.Parsers.psd = function (buffer) {
    var view = new DataView(buffer);
    if (BinUtils.readAsciiString(view, 0, 4) !== '8BPS') return null;

    var out = {};
    out['PSD:Channels'] = view.getUint16(12, false);
    out['PSD:Height'] = view.getUint32(14, false);
    out['PSD:Width'] = view.getUint32(18, false);
    out['PSD:Depth'] = view.getUint16(22, false);
    var colorModes = { 0: 'Bitmap', 1: 'Grayscale', 2: 'Indexed', 3: 'RGB', 4: 'CMYK', 7: 'Multichannel', 8: 'Duotone', 9: 'Lab' };
    out['PSD:ColorMode'] = colorModes[view.getUint16(24, false)] || 'Невідомо';

    var offset = 26;
    var colorModeDataLen = view.getUint32(offset, false);
    offset += 4 + colorModeDataLen;
    var resourcesLen = view.getUint32(offset, false);
    var resourcesEnd = offset + 4 + resourcesLen;
    offset += 4;

    while (offset < resourcesEnd && offset + 12 <= view.byteLength) {
        var sig = BinUtils.readAsciiString(view, offset, 4);
        if (sig !== '8BIM') break;
        var resId = view.getUint16(offset + 4, false);
        var nameLen = view.getUint8(offset + 6);
        var namePad = (nameLen % 2 === 0) ? nameLen + 2 : nameLen + 1;
        var dataSizeOffset = offset + 6 + namePad;
        var dataSize = view.getUint32(dataSizeOffset, false);
        var dataStart = dataSizeOffset + 4;

        if (resId === 0x0404) {
            out['PSD:HasIPTC'] = true;
        } else if (resId === 0x0422 || resId === 0x0421) {
            out['PSD:HasEXIF'] = true;
        } else if (resId === 0x040A) {
            out['PSD:HasICCProfile'] = true;
        }
        offset = dataStart + dataSize + (dataSize % 2);
    }
    return out;
};
