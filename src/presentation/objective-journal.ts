export interface ObjectiveDisplay {
  icon: string;
  detail: string;
}

export function objectiveHistoryEntry(
  previous: ObjectiveDisplay,
  next: ObjectiveDisplay,
): string {
  const match =
    previous.icon === next.icon
      ? undefined
      : /^(\d+) \/ (\d+)(.*)$/.exec(previous.detail);
  const completedDetail = match
    ? `${match[2]!} / ${match[2]!}${match[3]!}`
    : previous.detail;
  return `✓ ${previous.icon} — ${completedDetail}`;
}
