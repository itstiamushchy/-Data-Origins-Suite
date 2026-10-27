// Витоки Даних — parsers/affinity.js
window.Parsers = window.Parsers || {};
window.Parsers.affinity = function (buffer, extHint) {
    var map = { afdesign: 'Affinity Designer', afphoto: 'Affinity Photo', afpub: 'Affinity Publisher' };
    if (!map[extHint]) return null;
    var entries = window.ZipReader.listEntries(buffer);
    if (!entries) return null;
    return { 'Format:Name': map[extHint], 'AFFINITY:Note': 'Закритий внутрішній формат (ZIP-контейнер) — детальний розбір вмісту не реалізовано, підтверджено контейнер.' };
};
