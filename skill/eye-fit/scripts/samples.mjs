export const SAMPLES = {
  python: {
    label: "Python",
    keywords: "False None True and as assert async await break class continue def del elif else except finally for from global if import in is lambda nonlocal not or pass raise return try while with yield self match case",
    comment: /#.*/,
    code: String.raw`# Ingest sensor readings with retries and a sliding window
from __future__ import annotations
import asyncio, re
from dataclasses import dataclass, field
from typing import AsyncIterator, Callable, Optional

RETRY_LIMIT = 5
PATTERN = re.compile(r"^(?P<id>[A-Z]{2}\d{4}):(?P<v>-?\d+\.\d+)$")

@dataclass(slots=True)
class Reading:
    sensor_id: str
    value: float
    tags: dict[str, str] = field(default_factory=dict)

    def scaled(self, factor: float = 1.0, *, clamp: Optional[float] = None) -> float:
        v = self.value * factor
        return min(v, clamp) if clamp is not None else v

async def stream(source: AsyncIterator[bytes], parse: Callable[[str], Reading | None]) -> list[Reading]:
    out: list[Reading] = []
    attempt = 0
    async for raw in source:
        line = raw.decode("utf-8", errors="replace").strip()
        if not line or line.startswith("#"):
            continue  # skip headers and blanks
        try:
            if (r := parse(line)) is not None and r.value >= 0x0:
                out.append(r)
        except (ValueError, KeyError) as exc:
            attempt += 1
            if attempt > RETRY_LIMIT:
                raise RuntimeError(f"too many errors: {exc!r}") from exc
            await asyncio.sleep(0.25 * 2 ** attempt)
    return [r for r in out if r.tags.get("force") == "1" or abs(r.value) < 3.5e-1]`,
  },
  typescript: {
    label: "TypeScript",
    keywords: "abstract as async await break case catch class const continue default delete do else enum export extends false finally for from function if implements import in instanceof interface let new null of private protected public readonly return static super switch this throw true try type typeof undefined var void while yield keyof satisfies",
    comment: /\/\/.*|\/\*[\s\S]*?\*\//,
    code: String.raw`/* Debounced search with cancellation and a typed cache */
import { useEffect, useRef, useState } from "react";

type Result<T> = { ok: true; value: T } | { ok: false; error: Error };
interface Hit { id: string; title: string; score: number; tags?: readonly string[] }

const CACHE = new Map<string, Hit[]>();
const MAX_AGE_MS = 30_000;

export async function search(query: string, signal: AbortSignal): Promise<Result<Hit[]>> {
  const key = query.trim().toLowerCase();
  if (CACHE.has(key)) return { ok: true, value: CACHE.get(key)! };
  try {
    const res = await fetch(\`/api/search?q=\${encodeURIComponent(key)}&limit=\${20}\`, { signal });
    if (!res.ok) throw new Error(\`HTTP \${res.status}: \${res.statusText}\`);
    const hits = (await res.json()) as Hit[];
    CACHE.set(key, hits.filter((h) => h.score > 0.35).sort((a, b) => b.score - a.score));
    setTimeout(() => CACHE.delete(key), MAX_AGE_MS);
    return { ok: true, value: CACHE.get(key) ?? [] };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e : new Error(String(e)) };
  }
}

export function useSearch(query: string, delay = 250): [Hit[], boolean] {
  const [hits, setHits] = useState<Hit[]>([]);
  const [busy, setBusy] = useState(false);
  const ctrl = useRef<AbortController | null>(null);
  useEffect(() => {
    if (query.length < 2) return void setHits([]);
    const t = setTimeout(async () => {
      ctrl.current?.abort();
      ctrl.current = new AbortController();
      setBusy(true);
      const r = await search(query, ctrl.current.signal);
      if (r.ok) setHits(r.value);
      setBusy(false);
    }, delay);
    return () => clearTimeout(t);
  }, [query, delay]);
  return [hits, busy];
}`,
  },
  rust: {
    label: "Rust",
    keywords: "as async await break const continue crate dyn else enum extern false fn for if impl in let loop match mod move mut pub ref return self Self static struct super trait true type unsafe use where while Some None Ok Err",
    comment: /\/\/.*|\/\*[\s\S]*?\*\//,
    code: String.raw`// Bounded LRU cache with hit statistics
use std::collections::{HashMap, VecDeque};
use std::hash::Hash;

#[derive(Debug, Default, Clone, Copy)]
pub struct Stats { pub hits: u64, pub misses: u64 }

pub struct Lru<K, V> {
    cap: usize,
    map: HashMap<K, V>,
    order: VecDeque<K>,
    stats: Stats,
}

impl<K: Eq + Hash + Clone, V> Lru<K, V> {
    pub fn new(cap: usize) -> Self {
        assert!(cap > 0, "capacity must be positive");
        Self { cap, map: HashMap::with_capacity(cap), order: VecDeque::new(), stats: Stats::default() }
    }

    pub fn get(&mut self, key: &K) -> Option<&V> {
        match self.map.get(key) {
            Some(v) => {
                self.stats.hits += 1;
                if let Some(pos) = self.order.iter().position(|k| k == key) {
                    let k = self.order.remove(pos).unwrap();
                    self.order.push_back(k);
                }
                Some(v)
            }
            None => { self.stats.misses += 1; None }
        }
    }

    pub fn put(&mut self, key: K, value: V) -> Option<V> {
        if self.map.len() >= self.cap && !self.map.contains_key(&key) {
            if let Some(old) = self.order.pop_front() { self.map.remove(&old); }
        }
        self.order.retain(|k| k != &key);
        self.order.push_back(key.clone());
        self.map.insert(key, value)
    }

    pub fn hit_rate(&self) -> f64 {
        let total = (self.stats.hits + self.stats.misses) as f64;
        if total == 0.0 { 0.0 } else { self.stats.hits as f64 / total * 100.0 }
    }
}`,
  },
};

const STRING = /f?r?"(?:\\.|[^"\\\n])*"|'(?:\\.|[^'\\\n])*'|`(?:\\.|[^`\\])*`/;
const NUMBER = /\b0x[0-9a-fA-F_]+\b|\b\d[\d_]*(?:\.\d+)?(?:e[+-]?\d+)?(?:u64|f64|usize)?\b/;
const WORD = /[A-Za-z_]\w*!?/;
const PUNCT = /[{}()[\];,.:<>=+\-*/%&|!?^~@#]+/;

export function tokenize(langKey) {
  const lang = SAMPLES[langKey];
  const keywords = new Set(lang.keywords.split(" "));
  const re = new RegExp([lang.comment, STRING, NUMBER, WORD, PUNCT].map((r) => `(${r.source})`).join("|"), "g");
  const tokens = [];
  let last = 0;
  for (const m of lang.code.matchAll(re)) {
    if (m.index > last) tokens.push(["", lang.code.slice(last, m.index)]);
    const [text, comment, string, number, word] = m;
    const next = lang.code.slice(m.index + text.length).trimStart()[0];
    let role = "punct";
    if (comment) role = "comment";
    else if (string) role = "str";
    else if (number) role = "const";
    else if (word && keywords.has(word)) role = /^(True|False|None|true|false|null|undefined)$/.test(word) ? "const" : "keyword";
    else if (word && word.endsWith("!")) role = "fn";
    else if (word && /^[A-Z][A-Z0-9_]+$/.test(word)) role = "const";
    else if (word && /^[A-Z]/.test(word)) role = "type";
    else if (word && /^(str|int|float|bytes|dict|list|string|number|boolean|void|u64|f64|usize)$/.test(word)) role = "type";
    else if (word && next === "(") role = "fn";
    else if (word) role = "fg";
    tokens.push([role, text]);
    last = m.index + text.length;
  }
  if (last < lang.code.length) tokens.push(["", lang.code.slice(last)]);
  return tokens;
}
