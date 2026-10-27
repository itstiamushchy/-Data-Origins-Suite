// Витоки Даних — tiff-reader.js
// Універсальний парсер TIFF/EXIF/GPS IFD-структур.
// Використовується: JPEG (APP1), TIFF, RAW (CR2/NEF/ARW/DNG/ORF), HEIC (Exif-блок), WEBP (EXIF-чанк).
window.TiffReader = (function () {
    'use strict';

    var TYPE_SIZES = { 1: 1, 2: 1, 3: 2, 4: 4, 5: 8, 6: 1, 7: 1, 8: 2, 9: 4, 10: 8, 11: 4, 12: 8 };

    var TAG_NAMES = {
        // IFD0 / TIFF
        0x010E: 'ImageDescription', 0x010F: 'Make', 0x0110: 'Model',
        0x0112: 'Orientation', 0x011A: 'XResolution', 0x011B: 'YResolution',
        0x0128: 'ResolutionUnit', 0x0131: 'Software', 0x0132: 'DateTime',
        0x013B: 'Artist', 0x8298: 'Copyright', 0x8769: 'ExifIFDPointer',
        0x8825: 'GPSInfoIFDPointer', 0x0100: 'ImageWidth', 0x0101: 'ImageHeight',
        0x0102: 'BitsPerSample', 0x0103: 'Compression', 0x0106: 'PhotometricInterpretation',
        0x013D: 'Predictor', 0x0211: 'YCbCrCoefficients', 0x0213: 'YCbCrPositioning',
        // Exif SubIFD
        0x829A: 'ExposureTime', 0x829D: 'FNumber', 0x8822: 'ExposureProgram',
        0x8827: 'ISOSpeedRatings', 0x9000: 'ExifVersion', 0x9003: 'DateTimeOriginal',
        0x9004: 'DateTimeDigitized', 0x9101: 'ComponentsConfiguration',
        0x9201: 'ShutterSpeedValue', 0x9202: 'ApertureValue', 0x9203: 'BrightnessValue',
        0x9204: 'ExposureBiasValue', 0x9205: 'MaxApertureValue', 0x9206: 'SubjectDistance',
        0x9207: 'MeteringMode', 0x9208: 'LightSource', 0x9209: 'Flash',
        0x920A: 'FocalLength', 0x927C: 'MakerNote', 0x9286: 'UserComment',
        0xA000: 'FlashpixVersion', 0xA001: 'ColorSpace', 0xA002: 'PixelXDimension',
        0xA003: 'PixelYDimension', 0xA20E: 'FocalPlaneXResolution',
        0xA20F: 'FocalPlaneYResolution', 0xA217: 'SensingMethod',
        0xA300: 'FileSource', 0xA301: 'SceneType', 0xA402: 'ExposureMode',
        0xA403: 'WhiteBalance', 0xA404: 'DigitalZoomRatio', 0xA405: 'FocalLengthIn35mmFilm',
        0xA406: 'SceneCaptureType', 0xA407: 'GainControl', 0xA408: 'Contrast',
        0xA409: 'Saturation', 0xA40A: 'Sharpness', 0xA433: 'LensMake', 0xA434: 'LensModel',
        // GPS IFD
        0x0000: 'GPSVersionID', 0x0001: 'GPSLatitudeRef', 0x0002: 'GPSLatitude',
        0x0003: 'GPSLongitudeRef', 0x0004: 'GPSLongitude', 0x0005: 'GPSAltitudeRef',
        0x0006: 'GPSAltitude', 0x0007: 'GPSTimeStamp', 0x001D: 'GPSDateStamp',
        0x000B: 'GPSDOP', 0x000C: 'GPSSpeedRef', 0x000D: 'GPSSpeed',
        0x0011: 'GPSImgDirectionRef', 0x0012: 'GPSImgDirection'
    };

    function readTypedValue(view, dv_offset, type, count, littleEndian, tiffStart) {
        var size = (TYPE_SIZES[type] || 1) * count;
        var valueOffset = dv_offset;
        if (size > 4) {
            valueOffset = tiffStart + view.getUint32(dv_offset, littleEndian);
        }
        var out = [];
        for (var i = 0; i < count; i++) {
            var o = valueOffset + i * (TYPE_SIZES[type] || 1);
            switch (type) {
                case 1: case 7: out.push(view.getUint8(o)); break; // BYTE / UNDEFINED
                case 2: // ASCII — читаємо весь блок одразу, виходимо з циклу
                    return readAsciiBlock(view, valueOffset, count);
                case 3: out.push(view.getUint16(o, littleEndian)); break; // SHORT
                case 4: out.push(view.getUint32(o, littleEndian)); break; // LONG
                case 5: // RATIONAL
                    out.push(view.getUint32(o, littleEndian) / (view.getUint32(o + 4, littleEndian) || 1));
                    break;
                case 9: out.push(view.getInt32(o, littleEndian)); break; // SLONG
                case 10: // SRATIONAL
                    out.push(view.getInt32(o, littleEndian) / (view.getInt32(o + 4, littleEndian) || 1));
                    break;
                default: out.push(view.getUint8(o));
            }
        }
        return count === 1 && type !== 7 ? out[0] : out;
    }

    function readAsciiBlock(view, offset, count) {
        var s = '';
        for (var i = 0; i < count; i++) {
            var c = view.getUint8(offset + i);
            if (c === 0) break;
            s += String.fromCharCode(c);
        }
        return s;
    }

    function readIFD(view, ifdOffset, tiffStart, littleEndian, out) {
        if (ifdOffset <= 0 || ifdOffset + 2 > view.byteLength) return null;
        var entryCount = view.getUint16(ifdOffset, littleEndian);
        var subIfdPointers = {};
        for (var i = 0; i < entryCount; i++) {
            var entryOffset = ifdOffset + 2 + i * 12;
            if (entryOffset + 12 > view.byteLength) break;
            var tag = view.getUint16(entryOffset, littleEndian);
            var type = view.getUint16(entryOffset + 2, littleEndian);
            var count = view.getUint32(entryOffset + 4, littleEndian);
            var name = TAG_NAMES[tag];
            try {
                var value = readTypedValue(view, entryOffset + 8, type, count, littleEndian, tiffStart);
                if (tag === 0x8769 || tag === 0x8825) {
                    subIfdPointers[tag] = tiffStart + value;
                } else if (name) {
                    out[name] = value;
                } else {
                    out['Tag_0x' + tag.toString(16).toUpperCase()] = value;
                }
            } catch (e) { /* пропускаємо пошкоджений запис */ }
        }
        return subIfdPointers;
    }

    // Розбирає TIFF-структуру починаючи з tiffStart у заданому ArrayBuffer.
    // Повертає плаский об'єкт з тегами IFD0 + Exif SubIFD + GPS IFD.
    function parse(buffer, tiffStart) {
        tiffStart = tiffStart || 0;
        var view = new DataView(buffer);
        var byteOrder = view.getUint16(tiffStart, false);
        var littleEndian;
        if (byteOrder === 0x4949) littleEndian = true;
        else if (byteOrder === 0x4D4D) littleEndian = false;
        else return null;

        var magic = view.getUint16(tiffStart + 2, littleEndian);
        if (magic !== 42) return null; // не TIFF/CR2 підписаний блок

        var ifd0Offset = view.getUint32(tiffStart + 4, littleEndian);
        var out = {};
        var pointers = readIFD(view, tiffStart + ifd0Offset, tiffStart, littleEndian, out) || {};

        if (pointers[0x8769]) {
            var exifPointers = readIFD(view, pointers[0x8769], tiffStart, littleEndian, out) || {};
            Object.assign(pointers, exifPointers);
        }
        if (pointers[0x8825]) {
            readIFD(view, pointers[0x8825], tiffStart, littleEndian, out);
        }
        return out;
    }

    return { parse: parse, TAG_NAMES: TAG_NAMES };
})();
