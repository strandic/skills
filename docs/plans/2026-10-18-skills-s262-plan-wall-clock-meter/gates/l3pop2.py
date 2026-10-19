"""Gate G4's reader for skills-s262: tool calls that hit their time limit, over every transcript under a directory,
read without the meter's code (no regex; the meter matches with regexes and a different record walk).

A call counts once per transcript file when any of these records reports it:
- its tool result has a numeric `toolUseResult.timedOutAfterMs`;
- it is a Bash call whose result text, after an optional leading `<error>`, begins
  `Command did not complete within its <digits>s timeout and was moved to the background`, or begins
  `Command timed out after ` (optionally after one `Exit code <digits>` line);
- a task notification in the record (origin task-notification, or a record with no harness origin whose text opens
  with the tag) says `Background command "…" was stopped after reaching its background time limit`, unless the call it
  names is known and is not a Bash or Monitor call, or the record is scheduled. Only the harness's part of each notice
  is read: from its open tag to its summary's end, the first `</summary>` followed (after whitespace) by `<note>`,
  `<result>`, `<usage>`, the close tag or the text's end; before any summary, to the first `<result>` or close tag. A
  summary that never ends so is no stop notice. The summary must open with the words and the quote, and end with the
  quote and the words, a command (perhaps empty) between. Every notice in a record is read: after a notice's harness
  part, its note and usage are passed over, then its close tag must follow, or the rest of the record is not read;
  text between two closed notices is passed over. A text with no open tag is read as one notice.
A call this file does not hold is known by the id the notice names (once per id); a notice naming none counts alone,
and so does a tool result naming its call by anything but text.
A peer or coordinator record relaying another session's message is never a notice. Lines are read as the meter reads
them: invalid UTF-8 replaced, a BOM only at the file's start, no NaN; records without a real timestamp are not read.
Every regular `*.jsonl` file under the directory is read, dot-directories included; links are not followed.

    python3 -I l3pop2.py <projects dir>  ->  `oracle <n>`"""
import json, os, sys
from datetime import datetime

OWNER = {'human', 'person', 'composer', 'suggestion'}
HARNESS = {'task-notification', 'peer', 'coordinator'}
MOVED = 'Command did not complete within its '
MOVED_END = 's timeout and was moved to the background'
STOPPED = 'Command timed out after '
NOTE_OPEN = '<summary>Background command "'
NOTE_CLOSE = '" was stopped after reaching its background time limit</summary>'
OPEN_TAG, CLOSE_TAG = '<task-notification>', '</task-notification>'
SPACE = set('\t\n\v\f\r \u00a0\u1680\u2028\u2029\u202f\u205f\u3000\ufeff') | {chr(c) for c in range(0x2000, 0x200b)}  # JavaScript's \s
DIGITS = set('0123456789')


def timed(v):
    # YYYY-MM-DDTHH:MM[:SS[.fff]] then Z or ±HH:MM
    if not isinstance(v, str) or len(v) < 17 or v[4] != '-' or v[7] != '-' or v[10] != 'T' or v[13] != ':':
        return False
    if not (v.endswith('Z') or (v[-6] in '+-' and v[-3] == ':')):
        return False
    try:
        return datetime.fromisoformat(v[:-1] + '+00:00' if v.endswith('Z') else v).tzinfo is not None
    except ValueError:
        return False


def no_constant(name):
    raise ValueError(name)


def text_of(c):
    if isinstance(c, str):
        return c
    if isinstance(c, list):
        return ' '.join((b.get('text') or '') for b in c if isinstance(b, dict) and b.get('type') == 'text')
    return ''


def opens_with_limit(s):
    if s.startswith('<error>'):
        s = s[len('<error>'):]
    if s.startswith(MOVED):
        rest = s[len(MOVED):]
        i = 0
        while i < len(rest) and rest[i] in DIGITS:
            i += 1
        return i > 0 and rest[i:].startswith(MOVED_END)
    if s.startswith('Exit code '):
        nl = s.find('\n')
        code = s[len('Exit code '):nl] if nl > 0 else ''
        if not code or any(ch not in DIGITS for ch in code):
            return False
        s = s[nl + 1:]
    return s.startswith(STOPPED)


def tag_value(text, tag):
    # the first <tag>value</tag> whose value is non-empty and holds no '<'
    start = 0
    while True:
        i = text.find(f'<{tag}>', start)
        if i < 0:
            return None
        v0 = i + len(tag) + 2
        j = text.find('<', v0)
        if j > v0 and text.startswith(f'</{tag}>', j):
            return text[v0:j]
        start = i + 1


def first(text, words, start):
    # (index, word) of the earliest of the words at or after start, or (-1, None)
    hits = [(text.find(w, start), w) for w in words]
    hits = [h for h in hits if h[0] >= 0]
    return min(hits) if hits else (-1, None)


def skip_space(text, j):
    while j < len(text) and text[j] in SPACE:
        j += 1
    return j


def part_end(text, start):
    # where the harness's part of a notice beginning at start ends, and whether its summary ended
    i, w = first(text, ('<summary>', '<result>', CLOSE_TAG), start)
    if i < 0:
        return len(text), True
    if w != '<summary>':
        return i, True
    k = i
    while True:
        k = text.find('</summary>', k)
        if k < 0:
            return len(text), False
        e = k + len('</summary>')
        f = skip_space(text, e)
        if f == len(text) or any(text.startswith(t, f) for t in ('<note>', '<result>', '<usage>', CLOSE_TAG)):
            return e, True
        k = e


def notices(text):
    # the harness's part of each notice in the text, with whether its summary ended
    i = text.find(OPEN_TAG)
    if i < 0:
        end, ended = part_end(text, 0)
        return [(text[:end], ended)]
    out = []
    while i >= 0:
        start = i + len(OPEN_TAG)
        end, ended = part_end(text, start)
        out.append((text[start:end], ended))
        j = skip_space(text, end)
        while True:
            t = next((t for t in ('note', 'usage') if text.startswith(f'<{t}>', j)), None)
            if t is None:
                break
            e = text.find(f'</{t}>', j)
            j = skip_space(text, len(text) if e < 0 else e + len(t) + 3)
        if not text.startswith(CLOSE_TAG, j):
            break
        i = text.find(OPEN_TAG, j + len(CLOSE_TAG))
    return out


def stop_notice(h, ended):
    i = h.find('<summary>')
    return (ended and i >= 0 and h.startswith(NOTE_OPEN, i) and h.endswith(NOTE_CLOSE)
            and len(h) - len(NOTE_CLOSE) >= i + len(NOTE_OPEN))


n = 0
paths = []
for root, dirs, files in os.walk(sys.argv[1]):
    paths += [os.path.join(root, f) for f in files if f.endswith('.jsonl') and not os.path.islink(os.path.join(root, f))]
for path in paths:
    recs = []
    for i, raw in enumerate(open(path, 'rb')):
        try:
            d = json.loads(raw.decode('utf-8-sig' if i == 0 else 'utf-8', errors='replace'), parse_constant=no_constant)
        except Exception:
            continue
        if isinstance(d, dict) and d.get('type') in ('user', 'assistant') and timed(d.get('timestamp')):
            recs.append(d)
    recs.sort(key=lambda d: datetime.fromisoformat(d['timestamp'].replace('Z', '+00:00')))
    names, tasks, seen = {}, {}, set()

    def count(call_id):
        global n
        if call_id is None or call_id not in seen:  # None: a record naming no id
            n += 1
            if call_id is not None:
                seen.add(call_id)

    for d in recs:
        c = (d.get('message') or {}).get('content')
        if d['type'] == 'assistant':
            for b in c if isinstance(c, list) else []:
                if isinstance(b, dict) and b.get('type') == 'tool_use' and b.get('id') is not None and b['id'] not in names:
                    names[b['id']] = b.get('name')
            continue
        result = next((b for b in c if isinstance(b, dict) and b.get('type') == 'tool_result'), None) if isinstance(c, list) else None
        if result is not None:
            tid = result.get('tool_use_id')
            text_id = isinstance(tid, str)  # a call named by anything but text is a call of its own
            if not text_id:
                tid = None
            known = tid in names
            r = d.get('toolUseResult')
            if known and isinstance(r, dict):
                for key in ('taskId', 'backgroundTaskId'):
                    if isinstance(r.get(key), str):
                        tasks[r[key]] = tid
                        break
            limit = isinstance(r, dict) and isinstance(r.get('timedOutAfterMs'), (int, float)) and not isinstance(r.get('timedOutAfterMs'), bool)
            if not limit and names.get(tid) == 'Bash':
                limit = opens_with_limit(result.get('content') if isinstance(result.get('content'), str) else text_of(result.get('content')))
            if limit:
                count(tid if known else f'id:{tid}' if text_id else None)
            continue
        if d.get('isCompactSummary'):
            continue
        origin = d.get('origin') if isinstance(d.get('origin'), dict) else {}
        kind = origin.get('kind')
        if kind in OWNER and not d.get('isMeta'):
            continue
        if d.get('turnOrigin') == 'scheduled' or origin.get('subkind') == 'scheduled-trigger':
            continue
        if kind is not None and kind not in OWNER and kind not in HARNESS:
            continue
        text = text_of(c)
        if text.lstrip().startswith('<tick'):
            continue
        if kind in HARNESS and kind != 'task-notification' and ('<cross-session-message' in text or '<teammate-message' in text):
            continue  # another session's message, relayed
        is_note = kind == 'task-notification' or (('<task-notification>' in text) if kind in HARNESS else text.lstrip().startswith('<task-notification>'))
        if not is_note:
            continue
        for part, ended in notices(text):
            if not stop_notice(part, ended):
                continue
            s = part.find('<summary>')
            head = part if s < 0 else part[:s]
            u, t = tag_value(head, 'tool-use-id'), tag_value(head, 'task-id')
            call = u if u in names else tasks.get(t) if t is not None else None
            if call is not None and names.get(call) not in ('Bash', 'Monitor'):
                continue
            count(call if call is not None else f'id:{u}' if u is not None else f'task:{t}' if t is not None else None)
print('oracle', n)
