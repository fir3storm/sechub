export type DiffLine = {
  type: "add" | "remove" | "same";
  line: string;
};

/** Simple line diff for markdown / text comparison. */
export function diffLines(oldText: string, newText: string): DiffLine[] {
  const oldLines = (oldText ?? "").split("\n");
  const newLines = (newText ?? "").split("\n");
  const m = oldLines.length;
  const n = newLines.length;

  const dp: number[][] = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0));
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i][j] =
        oldLines[i - 1] === newLines[j - 1]
          ? dp[i - 1][j - 1] + 1
          : Math.max(dp[i - 1][j], dp[i][j - 1]);
    }
  }

  const result: DiffLine[] = [];
  let i = m;
  let j = n;
  const stack: DiffLine[] = [];

  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && oldLines[i - 1] === newLines[j - 1]) {
      stack.push({ type: "same", line: oldLines[i - 1] });
      i--;
      j--;
    } else if (j > 0 && (i === 0 || dp[i][j - 1] >= dp[i - 1][j])) {
      stack.push({ type: "add", line: newLines[j - 1] });
      j--;
    } else {
      stack.push({ type: "remove", line: oldLines[i - 1] });
      i--;
    }
  }

  while (stack.length) result.push(stack.pop()!);
  return result;
}

export function diffFormData(
  oldData: Record<string, unknown>,
  newData: Record<string, unknown>
): string {
  const keys = [...new Set([...Object.keys(oldData), ...Object.keys(newData)])].sort();
  const lines: string[] = [];

  for (const key of keys) {
    const oldVal = JSON.stringify(oldData[key] ?? null);
    const newVal = JSON.stringify(newData[key] ?? null);
    if (oldVal !== newVal) {
      lines.push(`- ${key}: ${oldVal}`);
      lines.push(`+ ${key}: ${newVal}`);
    }
  }

  return lines.join("\n");
}
