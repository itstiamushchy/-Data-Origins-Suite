// Витоки Даних — parsers/executable.js
window.Parsers = window.Parsers || {};

window.Parsers.pe = function (buffer) {
    var view = new DataView(buffer);
    if (view.getUint16(0, true) !== 0x5A4D) return null; // "MZ"
    var peOffset = view.getUint32(60, true);
    if (peOffset + 24 > view.byteLength || view.getUint32(peOffset, true) !== 0x00004550) return null; // "PE\0\0"

    var out = { 'Format:Name': 'Portable Executable (PE)' };
    var machine = view.getUint16(peOffset + 4, true);
    var MACHINE_MAP = { 0x014c: 'x86 (32-біт)', 0x8664: 'x64 (64-біт)', 0x01c4: 'ARM', 0xAA64: 'ARM64' };
    out['PE:Machine'] = MACHINE_MAP[machine] || ('код 0x' + machine.toString(16));
    out['PE:NumberOfSections'] = view.getUint16(peOffset + 6, true);
    var timestamp = view.getUint32(peOffset + 8, true);
    if (timestamp > 0) out['PE:CompileTime'] = new Date(timestamp * 1000).toISOString();
    var characteristics = view.getUint16(peOffset + 22, true);
    out['PE:IsDLL'] = (characteristics & 0x2000) !== 0;
    out['PE:Is32BitOnly'] = (characteristics & 0x0100) !== 0;

    var optMagic = view.getUint16(peOffset + 24, true);
    out['PE:ImageType'] = optMagic === 0x10b ? 'PE32' : optMagic === 0x20b ? 'PE32+' : ('код 0x' + optMagic.toString(16));
    var subsystemOffset = peOffset + 24 + (optMagic === 0x20b ? 68 : 68);
    var subsystem = view.getUint16(subsystemOffset, true);
    var SUBSYSTEM_MAP = { 2: 'Windows GUI', 3: 'Windows Console', 1: 'Native', 5: 'OS/2 Console', 7: 'POSIX Console' };
    out['PE:Subsystem'] = SUBSYSTEM_MAP[subsystem] || ('код ' + subsystem);
    return out;
};

window.Parsers.elf = function (buffer) {
    var view = new DataView(buffer);
    if (view.getUint8(0) !== 0x7F || view.getUint8(1) !== 0x45 || view.getUint8(2) !== 0x4C || view.getUint8(3) !== 0x46) return null;

    var out = { 'Format:Name': 'ELF (Linux/Unix виконуваний файл)' };
    var is64 = view.getUint8(4) === 2;
    out['ELF:Class'] = is64 ? '64-біт' : '32-біт';
    out['ELF:Endianness'] = view.getUint8(5) === 1 ? 'Little-endian' : 'Big-endian';
    var le = view.getUint8(5) === 1;
    var eType = view.getUint16(16, le);
    var TYPE_MAP = { 1: 'Переміщуваний об\'єктний файл (REL)', 2: 'Виконуваний файл (EXEC)', 3: 'Спільна бібліотека (DYN)', 4: 'Дамп пам\'яті (CORE)' };
    out['ELF:Type'] = TYPE_MAP[eType] || ('код ' + eType);
    var eMachine = view.getUint16(18, le);
    var MACHINE_MAP2 = { 3: 'x86', 62: 'x86-64', 40: 'ARM', 183: 'ARM64', 8: 'MIPS', 243: 'RISC-V' };
    out['ELF:Machine'] = MACHINE_MAP2[eMachine] || ('код ' + eMachine);
    return out;
};
