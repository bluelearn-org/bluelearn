export type DiffLine = {
  type: "unchanged" | "added" | "removed";
  text: string;
};

export type FieldDiff = {
  changed: boolean;
  diff: string | null;
  lines: DiffLine[] | null;
};

// Compare two nullable string fields.
export function diffField(from: string | null, to: string | null): FieldDiff {
  if (from === to) return { changed: false, diff: null, lines: null };
  const lines = createFieldDiffLines(from, to);
  return {
    changed: true,
    lines,
    diff: lines
      .map((l) =>
        l.type === "unchanged"
          ? ` ${l.text}`
          : l.type === "added"
            ? `+${l.text}`
            : `-${l.text}`
      )
      .join("\n"),
  };
}

// Compare two unordered sets, keeping each side in `from`/`to` order.
export function diffSet<T>(from: T[], to: T[]) {
  const fromSet = new Set(from);
  const toSet = new Set(to);
  const added = to.filter((item) => !fromSet.has(item));
  const removed = from.filter((item) => !toSet.has(item));
  return {
    changed: added.length > 0 || removed.length > 0,
    added,
    removed,
    unchanged: from.filter((item) => toSet.has(item)),
  };
}

// LCS-based diff over any two ordered sequences, producing a
// structured token list.
export function diffSequences<T>(
  from: T[],
  to: T[],
  key: (item: T) => string,
  label: (item: T) => string
): DiffLine[] {
  const m = from.length;
  const n = to.length;
  const fromKeys = from.map(key);
  const toKeys = to.map(key);
  const dp: number[][] = Array.from({ length: m + 1 }, () =>
    new Array<number>(n + 1).fill(0)
  );
  for (let i = m - 1; i >= 0; i--) {
    for (let j = n - 1; j >= 0; j--) {
      if (fromKeys[i] === toKeys[j]) {
        dp[i][j] = dp[i + 1][j + 1] + 1;
      } else {
        dp[i][j] = Math.max(dp[i + 1][j], dp[i][j + 1]);
      }
    }
  }

  // Reconstruct the diff by walking forward, emitting "unchanged" / "removed"
  // / "added" tokens in the order a reader expects (matches `git diff
  // --unified=0`).
  const out: DiffLine[] = [];
  let i = 0;
  let j = 0;
  while (i < m && j < n) {
    if (fromKeys[i] === toKeys[j]) {
      out.push({ type: "unchanged", text: label(to[j]) });
      i++;
      j++;
    } else if (dp[i + 1][j] >= dp[i][j + 1]) {
      out.push({ type: "removed", text: label(from[i]) });
      i++;
    } else {
      out.push({ type: "added", text: label(to[j]) });
      j++;
    }
  }
  while (i < m) {
    out.push({ type: "removed", text: label(from[i]) });
    i++;
  }
  while (j < n) {
    out.push({ type: "added", text: label(to[j]) });
    j++;
  }

  return out;
}

function createFieldDiffLines(
  from: string | null,
  to: string | null
): DiffLine[] {
  const identity = (line: string) => line;
  return diffSequences(
    (from ?? "").split("\n"),
    (to ?? "").split("\n"),
    identity,
    identity
  );
}
