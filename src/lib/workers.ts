/** Runs `processor` over `items`, at most `workers` at a time. Results are in completion order. */
export async function processWithWorkers<T, R>(
  items: T[],
  workers: number,
  processor: (item: T) => Promise<R>
): Promise<R[]> {
  const results: R[] = [];
  const queue = [...items];

  async function worker(): Promise<void> {
    while (queue.length > 0) {
      const item = queue.shift();
      if (item !== undefined) {
        results.push(await processor(item));
      }
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(workers, items.length) }, worker)
  );
  return results;
}
