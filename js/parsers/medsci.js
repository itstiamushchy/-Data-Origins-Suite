// Витоки Даних — parsers/medsci.js
window.Parsers = window.Parsers || {};

window.Parsers.dicom = function (buffer) {
    var view = new DataView(buffer);
    if (buffer.byteLength < 132) return null;
    if (BinUtils.readAsciiString(view, 128, 4) !== 'DICM') return null;

    var out = { 'Format:Name': 'DICOM (медичні знімки)' };
    var bytes = new Uint8Array(buffer);
    // Явний VR (Explicit VR Little Endian) — стандарт для File Meta Information після преамбули.
    var p = 132;
    var guard = 0;
    while (p + 8 <= view.byteLength && guard++ < 5000) {
        var group = view.getUint16(p, true);
        var element = view.getUint16(p + 2, true);
        var vr = BinUtils.readAsciiString(view, p + 4, 2);
        var valueLen, headerLen;
        var shortVRs = { AE: 1, AS: 1, AT: 1, CS: 1, DA: 1, DS: 1, DT: 1, FL: 1, FD: 1, IS: 1, LO: 1, LT: 1, PN: 1, SH: 1, SL: 1, SS: 1, ST: 1, TM: 1, UI: 1, UL: 1, US: 1 };
        if (shortVRs[vr]) { valueLen = view.getUint16(p + 6, true); headerLen = 8; }
        else if (/^[A-Z]{2}$/.test(vr)) { valueLen = view.getUint32(p + 8, true); headerLen = 12; }
        else break; // не схоже на Explicit VR — зупиняємось
        if (valueLen === 0xFFFFFFFF || p + headerLen + valueLen > view.byteLength) break;

        var tagHex = group.toString(16).padStart(4, '0').toUpperCase() + element.toString(16).padStart(4, '0').toUpperCase();
        var value = BinUtils.readLatin1(bytes, p + headerLen, p + headerLen + valueLen).trim();
        if (tagHex === '00100010') out['DICOM:PatientName'] = value;
        else if (tagHex === '00100020') out['DICOM:PatientID'] = value;
        else if (tagHex === '00100030') out['DICOM:PatientBirthDate'] = value;
        else if (tagHex === '00100040') out['DICOM:PatientSex'] = value;
        else if (tagHex === '00080060') out['DICOM:Modality'] = value;
        else if (tagHex === '00080070') out['DICOM:Manufacturer'] = value;
        else if (tagHex === '00081090') out['DICOM:ManufacturerModel'] = value;
        else if (tagHex === '00080020') out['DICOM:StudyDate'] = value;
        else if (tagHex === '00080080') out['DICOM:InstitutionName'] = value;
        else if (tagHex === '00180015') out['DICOM:BodyPartExamined'] = value;
        else if (group === 0x0002 && element === 0x0010) out['DICOM:TransferSyntax'] = value;

        p += headerLen + valueLen + (valueLen % 2);
        if (Object.keys(out).length > 11) break; // зібрали основні поля — немає сенсу йти далі у піксельні дані
    }
    return out;
};

window.Parsers.matlab = function (buffer) {
    var bytes = new Uint8Array(buffer);
    var head = BinUtils.readLatin1(bytes, 0, Math.min(bytes.length, 20));
    if (head.indexOf('MATLAB') !== 0) return null;
    var out = { 'Format:Name': 'MATLAB Data (MAT)' };
    out['MAT:HeaderText'] = BinUtils.readLatin1(bytes, 0, 116).trim();
    var view = new DataView(buffer);
    var version = view.getUint16(124, true);
    out['MAT:Version'] = '0x' + version.toString(16);
    var endianIndicator = BinUtils.readAsciiString(view, 126, 2);
    out['MAT:Endianness'] = endianIndicator === 'IM' ? 'Little-endian' : endianIndicator === 'MI' ? 'Big-endian' : 'невідомо';
    return out;
};

window.Parsers.nifti = function (buffer, extHint) {
    if (extHint !== 'nii') return null;
    var view = new DataView(buffer);
    if (buffer.byteLength < 348) return null;
    var le = view.getInt32(0, true) === 348;
    if (!le && view.getInt32(0, false) !== 348) return null;
    var out = { 'Format:Name': 'NIfTI (медичні/нейро-зображення)' };
    var dim0 = view.getInt16(40, le);
    var dims = [];
    for (var i = 0; i < Math.min(dim0, 7); i++) dims.push(view.getInt16(42 + i * 2, le));
    out['NIFTI:Dimensions'] = dims.join(' x ');
    var magic = BinUtils.readAsciiString(view, 344, 4);
    out['NIFTI:Magic'] = magic;
    return out;
};

window.Parsers.las = function (buffer, extHint) {
    var view = new DataView(buffer);
    if (BinUtils.readAsciiString(view, 0, 4) !== 'LASF') return null;
    var out = { 'Format:Name': extHint === 'laz' ? 'LAS (стиснений, LAZ)' : 'LAS (LIDAR-хмара точок)' };
    out['LAS:VersionMajor'] = view.getUint8(24);
    out['LAS:VersionMinor'] = view.getUint8(25);
    out['LAS:SystemID'] = BinUtils.readAsciiString(view, 26, 32).trim();
    out['LAS:SoftwareID'] = BinUtils.readAsciiString(view, 58, 32).trim();
    out['LAS:PointCount'] = view.getUint32(107, true);
    return out;
};

window.Parsers.grib = function (buffer) {
    var view = new DataView(buffer);
    if (BinUtils.readAsciiString(view, 0, 4) !== 'GRIB') return null;
    var out = { 'Format:Name': 'GRIB (метеодані)' };
    var edition = view.getUint8(7);
    out['GRIB:Edition'] = edition;
    return out;
};
