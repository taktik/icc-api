export type PaginatorFunction<X> = (
  key: any,
  docId: string | null,
  limit: number | undefined
) => Promise<PaginatorResponse<X>>

export type PaginatorExecutor<X> = (
  latestPaginatorFunctionResult: PaginatorResponse<X>,
  acc: any[],
  limit: number | undefined
) => Promise<PaginatorResponse<X>>

export interface PaginatorResponse<X> {
  rows: Array<X>
  nextKey: any | null | undefined
  nextDocId: string | null | undefined
  done: boolean
}

export interface RowsChunk<X> {
  startIdx: number
  endIdx: number
  rows: Array<X>
  nextKey: any | null
  nextDocId: string | null
}

export interface MissingRowsChunk<X> {
  missing: [number, number]
  lastEndIdx: number
  lastKey: any | null
  lastDocId: string | null
  rows?: Array<X> // Is going to be filled when we go through all missing rows chunks
}

export function sleep(ms: number): Promise<any> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

export function retry<P>(
  fn: () => Promise<P>,
  retryCount = 3,
  sleepTime = 1000,
  exponentialFactor = 1
): Promise<P> {
  let retry = 0
  const doFn: () => Promise<P> = () => {
    return fn().catch((e) =>
      retry++ < retryCount
        ? (sleepTime && sleep((sleepTime *= exponentialFactor)).then(() => doFn())) || doFn()
        : Promise.reject(e)
    )
  }
  return doFn()
}

export async function getRowsUsingPagination<X>(
  paginator: PaginatorFunction<X>,
  filter?: (value: X, idx: number, array: Array<X>) => boolean,
  startIdx?: number,
  endIdx?: number,
  cache?: Array<RowsChunk<X>>
): Promise<Array<X>> {
  const executePaginator: PaginatorExecutor<X> = async (
    latestResult: PaginatorResponse<X>,
    acc: Array<X>,
    limit: number | undefined
  ) => {
    const newResult = await paginator(
      latestResult.nextKey || null,
      latestResult.nextDocId || null,
      endIdx && startIdx ? endIdx - startIdx : undefined
    )
    const rows = (filter ? newResult.rows && newResult.rows.filter(filter) : newResult.rows) || []
    acc.push(...rows)
    if (newResult.done || (limit && acc.length >= limit)) {
      return {
        rows: acc,
        nextKey: newResult.nextKey,
        nextDocId: newResult.nextDocId,
        done: false,
      }
    } else {
      return executePaginator(newResult, acc, limit)
    }
  }

  if (cache && startIdx && endIdx) {
    // Go through cache and build a list of existing rows (RowsChunks) and missing rows (MissingRowChunks)
    // The cache is a sparse structure sorted by index
    // At first, the cache is empty rows is going to be equal to [] and everything will be missing (see empty rows situation below)
    const [rows, lastKey, lastDocId, lastEndIdx] = cache.reduce(
      (
        [rows, lastKey, lastDocId, lastEndIdx, lastTreatedIdx]: [
          Array<RowsChunk<X> | MissingRowsChunk<X>>,
          any | null,
          string | null,
          number,
          number
        ],
        chunk
      ) => {
        const startOfZoi = lastTreatedIdx
        const endOfZoi = endIdx

        if (chunk.endIdx <= startOfZoi) {
          //           [--zoi--] // Zone of interest starts at startOfZoi, ends at endIdx
          // [-chunk-]
          // Doesn't look like anything to me
        } else if (chunk.startIdx >= endIdx) {
          // [--zoi--]
          //           [-chunk-]
          if (startOfZoi < endIdx) {
            rows.push({
              missing: [startOfZoi, endIdx],
              lastEndIdx,
              lastKey,
              lastDocId,
            })
            lastTreatedIdx = endOfZoi
          }
        } else {
          if (chunk.startIdx <= lastTreatedIdx) {
            if (chunk.endIdx <= endIdx) {
              //       [--zoi--]
              // [-chunk-]
              rows.push({
                startIdx: startOfZoi,
                endIdx: chunk.endIdx,
                rows: chunk.rows.slice(startOfZoi - chunk.startIdx, chunk.endIdx - chunk.startIdx),
                nextKey: null,
                nextDocId: null,
              })
              lastTreatedIdx = chunk.endIdx
            } else {
              //       [--zoi--]
              // [------chunk------]
              rows.push({
                startIdx: startOfZoi,
                endIdx: endOfZoi,
                rows: chunk.rows.slice(startOfZoi - chunk.startIdx, endOfZoi - chunk.startIdx),
                nextKey: null,
                nextDocId: null,
              })
              lastTreatedIdx = endOfZoi
            }
          } else {
            //  [--zoi--]
            //        [-chunk-]
            if (chunk.endIdx >= endOfZoi) {
              rows.push({
                missing: [startOfZoi, chunk.startIdx],
                lastEndIdx,
                lastKey,
                lastDocId,
              })
              rows.push({
                startIdx: chunk.startIdx,
                endIdx: endOfZoi,
                rows: chunk.rows.slice(0, endOfZoi - chunk.startIdx),
                nextKey: null,
                nextDocId: null,
              })
              lastTreatedIdx = endOfZoi
            } else {
              //  [-------zoi-------]
              //       [-chunk-]
              rows.push({
                missing: [startOfZoi, chunk.startIdx],
                lastEndIdx,
                lastKey,
                lastDocId,
              })
              rows.push({
                startIdx: chunk.startIdx,
                endIdx: chunk.endIdx,
                rows: chunk.rows.slice(0, chunk.endIdx - chunk.startIdx),
                nextKey: null,
                nextDocId: null,
              })
              lastTreatedIdx = chunk.endIdx
            }
          }
        }
        return [rows, chunk.nextKey, chunk.nextDocId, chunk.endIdx, lastTreatedIdx]
      },
      [[], null, null, 0, startIdx || 0]
    )
    if (!rows.length) {
      rows.push({
        missing: [startIdx, endIdx],
        lastKey: lastKey,
        lastDocId: lastDocId,
        lastEndIdx: lastEndIdx,
      })
    } else {
      const lastRow = rows.length ? rows[rows.length - 1] : undefined
      if (
        lastRow &&
        lastRow.rows &&
        (lastRow as RowsChunk<X>).startIdx + lastRow.rows.length < endIdx
      ) {
        rows.push({
          missing: [(lastRow as RowsChunk<X>).startIdx + lastRow.rows.length, endIdx],
          lastKey: lastKey,
          lastDocId: lastDocId,
          lastEndIdx: lastEndIdx,
        })
      }
    }

    // Once we we have determined which where the missing chunks. Go fetch them based on the lastKey/lastDocId + the limit computed with the lastEndIndex
    await Promise.all(
      rows
        .filter((r: any) => r.missing)
        .map(async (r: any) => {
          const missing = r as MissingRowsChunk<X>
          const { rows, nextKey, nextDocId } = await executePaginator(
            {
              nextKey: missing.lastKey,
              nextDocId: missing.lastDocId,
              rows: [],
              done: false,
            },
            [],
            missing.missing[1] - missing.lastEndIdx
          )

          missing.rows = rows.slice(
            missing.missing[0] - missing.lastEndIdx,
            missing.missing[1] - missing.lastEndIdx
          )
          cache[missing.lastEndIdx] = {
            rows,
            startIdx: missing.missing[0],
            endIdx: missing.missing[1],
            nextKey: nextKey || null,
            nextDocId: nextDocId || null,
          }
        })
    )
    return (rows || []).reduce(
      (acc: X[], r: MissingRowsChunk<X> | RowsChunk<X>) =>
        r.rows
          ? r.rows.reduce((acc, r) => {
              acc.push(r)
              return acc
            }, acc)
          : acc,
      []
    )
  } else {
    const { rows } = await executePaginator(
      {
        nextKey: null,
        nextDocId: null,
        rows: [],
        done: false,
      },
      [],
      undefined
    )
    return rows
  }
}
