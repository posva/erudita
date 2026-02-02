/**
 * Run async operations with a concurrency limit
 */
export async function asyncPool<T, R>(
  concurrency: number,
  items: T[],
  fn: (item: T) => Promise<R>,
): Promise<R[]> {
  const results: R[] = []
  const executing = new Set<Promise<void>>()

  for (const [index, item] of items.entries()) {
    const promise = fn(item).then((result) => {
      results[index] = result
    })
    const wrapped = promise.finally(() => executing.delete(wrapped))
    executing.add(wrapped)

    if (executing.size >= concurrency) {
      await Promise.race(executing)
    }
  }

  await Promise.all(executing)
  return results
}
