/* Preserve TTML harmony and alternate tracks for Folia's shared lyric renderer. */
(function (global) {
  'use strict';
  global.parseTtmlRichLyrics = function (source) {
    if (typeof DOMParser !== 'function') return null;
    var xml = new DOMParser().parseFromString(String(source || ''), 'application/xml');
    if (xml.getElementsByTagName('parsererror').length) return null;
    var paragraphs = Array.from(xml.getElementsByTagNameNS('*', 'p'));
    function role(node) { return node.getAttribute('ttm:role') || node.getAttribute('role') || ''; }
    function clock(node, key, fallback) {
      var value = ttmlClockToMs(node.getAttribute(key));
      return Number.isFinite(value) ? value : fallback;
    }
    function alternate(node, kind) {
      return Array.from(node.getElementsByTagNameNS('*', 'span')).filter(function (span) {
        return kind === 'translation' ? /^x-translation/i.test(role(span)) : /^x-roman/i.test(role(span));
      }).map(function (span) { return span.textContent; }).join('').trim();
    }
    function track(node, start, end) {
      var words = [], text = '';
      function visit(element, begin, until) {
        if (element.nodeType === 3) { text += element.nodeValue; return; }
        if (element.nodeType !== 1) return;
        if (element !== node && /^x-(?:bg|translation|roman|lang)/i.test(role(element))) return;
        begin = clock(element, 'begin', begin); until = clock(element, 'end', until);
        var childSpans = Array.from(element.children).filter(function (child) { return child.localName === 'span'; });
        if (element.localName === 'span' && !childSpans.length && element.textContent && Number.isFinite(begin)) {
          words.push({ text: element.textContent, startMs: begin, durMs: Math.max(0, until - begin) });
          text += element.textContent;
        } else Array.from(element.childNodes).forEach(function (child) { visit(child, begin, until); });
      }
      visit(node, start, end);
      return { text: text.trim(), words: words };
    }
    var lines = paragraphs.map(function (paragraph) {
      var start = clock(paragraph, 'begin', NaN), end = clock(paragraph, 'end', NaN);
      var main = track(paragraph, start, end);
      if (!Number.isFinite(start) && main.words.length) start = main.words[0].startMs;
      if (!Number.isFinite(start)) return null;
      if (!Number.isFinite(end)) end = main.words.reduce(function (last, word) { return Math.max(last, word.startMs + word.durMs); }, start + 4800);
      var built = buildWordTimedLyricLine(start, end - start, main.words, main.text, 'ttml-word', 'ttml-line');
      if (!built) return null;
      var mainCopy = paragraph.cloneNode(true);
      Array.from(mainCopy.getElementsByTagNameNS('*', 'span')).filter(function (span) { return /^x-bg/i.test(role(span)); }).forEach(function (span) { span.remove(); });
      built.translation = alternate(mainCopy, 'translation');
      built.romanization = alternate(mainCopy, 'romanization');
      built.backgroundVocals = Array.from(paragraph.getElementsByTagNameNS('*', 'span')).filter(function (span) {
        if (!/^x-bg/i.test(role(span))) return false;
        for (var parent = span.parentElement; parent && parent !== paragraph; parent = parent.parentElement) {
          if (/^x-bg/i.test(role(parent))) return false;
        }
        return true;
      }).map(function (span) {
        var begin = clock(span, 'begin', start), until = clock(span, 'end', end);
        var bg = track(span, begin, until);
        return { text: bg.text.replace(/^\s*\(|\)\s*$/g, ''), startTime: begin / 1000, endTime: until / 1000,
          translation: alternate(span, 'translation'), romanization: alternate(span, 'romanization'),
          words: bg.words.map(function (word) { return { text: word.text, startTime: word.startMs / 1000, endTime: (word.startMs + word.durMs) / 1000 }; }) };
      }).filter(function (vocal) { return vocal.text; });
      return built;
    }).filter(Boolean);
    return lines.length ? finalizeLyricLineDurations(lines, true) : null;
  };
})(window);
