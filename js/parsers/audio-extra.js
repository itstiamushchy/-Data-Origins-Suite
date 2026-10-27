// Витоки Даних — parsers/audio-extra.js
window.Parsers = window.Parsers || {};

window.Parsers.aac = function (buffer, extHint) {
    if (extHint !== 'aac') return null;
    var view = new DataView(buffer);
    var sync = (view.getUint8(0) === 0xFF) && ((view.getUint8(1) & 0xF0) === 0xF0);
    if (!sync) return null;
    var out = { 'Format:Name': 'AAC (елементарний потік, ADTS)' };
    var profile = (view.getUint8(2) >> 6) & 0x03;
    var sampleRateIdx = (view.getUint8(2) >> 2) & 0x0F;
    var SAMPLE_RATES = [96000, 88200, 64000, 48000, 44100, 32000, 24000, 22050, 16000, 12000, 11025, 8000, 7350];
    var channelConfig = ((view.getUint8(2) & 0x01) << 2) | ((view.getUint8(3) >> 6) & 0x03);
    out['AAC:Profile'] = ['Main', 'LC', 'SSR', 'LTP'][profile] || 'невідомо';
    out['AAC:SampleRate'] = SAMPLE_RATES[sampleRateIdx] || 'невідомо';
    out['AAC:Channels'] = channelConfig;
    return out;
};

window.Parsers.amr = function (buffer) {
    var view = new DataView(buffer);
    var head6 = BinUtils.readAsciiString(view, 0, 6);
    if (head6 === '#!AMR\n') return { 'Format:Name': 'AMR-NB (Adaptive Multi-Rate)' };
    var head9 = BinUtils.readAsciiString(view, 0, 9);
    if (head9 === '#!AMR-WB\n') return { 'Format:Name': 'AMR-WB (Adaptive Multi-Rate Wideband)' };
    return null;
};

window.Parsers.ac3 = function (buffer, extHint) {
    if (extHint !== 'ac3') return null;
    var view = new DataView(buffer);
    if (view.getUint16(0, false) !== 0x0B77) return null; // sync word
    var out = { 'Format:Name': 'Dolby Digital (AC-3)' };
    var fscod = (view.getUint8(4) >> 6) & 0x03;
    out['AC3:SampleRate'] = [48000, 44100, 32000][fscod] || 'невідомо';
    return out;
};
