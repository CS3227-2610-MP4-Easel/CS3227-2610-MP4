export function advancePlanSelection(previous: { key: string; epoch: number }, key: string) {
  return previous.key === key ? previous : { key, epoch: previous.epoch + 1 };
}
