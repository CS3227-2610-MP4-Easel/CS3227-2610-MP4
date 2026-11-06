/** Every gateway timestamp comes from here, so tests drive time with a fake clock instead of waiting. */
export type Clock = { now(): Date; sleep(ms: number): Promise<void> };

export const systemClock: Clock = {
  now: () => new Date(),
  sleep: (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
};
