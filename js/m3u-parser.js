/* ═══════════════════════════════════════════════════
   CrimsonTV — M3U / M3U8 Playlist Parser
═══════════════════════════════════════════════════ */

/**
 * Parse raw M3U text into channel objects
 * Supports: #EXTINF, tvg-logo, group-title, http-user-agent, EXTVLCOPT etc.
 */
export function parseM3U(text) {
  const lines = text.split(/\r?\n/);
  const channels = [];
  let current = null;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    if (line.startsWith('#EXTINF:')) {
      current = {
        name: '',
        logo: '',
        group: 'General',
        url: '',
        headers: {},
        tvgId: '',
        tvgName: ''
      };

      const commaIdx = line.lastIndexOf(',');
      if (commaIdx > -1) {
        current.name = line.substring(commaIdx + 1).trim() || 'Unknown';
      }

      const attrPart = line.substring(8, commaIdx > -1 ? commaIdx : line.length);
      const logoMatch = attrPart.match(/tvg-logo="([^"]*)"/i);
      if (logoMatch) current.logo = logoMatch[1];

      const groupMatch = attrPart.match(/group-title="([^"]*)"/i);
      if (groupMatch) current.group = groupMatch[1] || 'General';

      const idMatch = attrPart.match(/tvg-id="([^"]*)"/i);
      if (idMatch) current.tvgId = idMatch[1];

      const nameMatch = attrPart.match(/tvg-name="([^"]*)"/i);
      if (nameMatch) current.tvgName = nameMatch[1];

      const uaMatch = attrPart.match(/http-user-agent="([^"]*)"/i);
      if (uaMatch) current.headers['User-Agent'] = uaMatch[1];

      const refMatch = attrPart.match(/http-referrer="([^"]*)"/i);
      if (refMatch) current.headers['Referer'] = refMatch[1];

    } else if (line.startsWith('#EXTVLCOPT:') && current) {
      const opt = line.substring(11);
      if (opt.startsWith('http-user-agent=')) {
        current.headers['User-Agent'] = opt.substring(16);
      } else if (opt.startsWith('http-referrer=')) {
        current.headers['Referer'] = opt.substring(14);
      }
    } else if (line.startsWith('#') === false && current) {
      let url = line;
      const pipeIdx = url.indexOf('|');
      if (pipeIdx > 0) {
        const opts = url.substring(pipeIdx + 1);
        url = url.substring(0, pipeIdx);
        opts.split(/[&;]/).forEach(p => {
          const eq = p.indexOf('=');
          if (eq > 0) {
            const k = p.substring(0, eq).trim();
            let v = p.substring(eq + 1);
            try { v = decodeURIComponent(v); } catch(e) {}
            if (k && v) current.headers[k] = v;
          }
        });
      }
      current.url = url.trim();
      if (current.url) {
        channels.push(current);
      }
      current = null;
    }
  }
  return channels;
}

/**
 * Fetch and parse an M3U playlist from URL
 */
export async function loadM3U(url) {
  const res = await fetch(url, { cache: 'no-store' });
  if (!res.ok) throw new Error(`Failed to load M3U (${res.status})`);
  const text = await res.text();
  return parseM3U(text);
}

/**
 * Group channels by category
 */
export function groupChannels(channels) {
  const groups = {};
  channels.forEach(ch => {
    const g = ch.group || 'General';
    if (!groups[g]) groups[g] = [];
    groups[g].push(ch);
  });
  return groups;
}
