import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "@/lib/api";
import {
  createSaveQueue,
  QUEUE_STORAGE_KEY,
  type StorageLike,
} from "@/lib/save-queue/queue";
import { sendMutation } from "@/lib/save-queue/send";
import type { Mutation } from "@/lib/save-queue/types";

const SESSION = "11111111-1111-4111-8111-111111111111";
const EXERCISE = "22222222-2222-4222-8222-222222222222";
const setId = (n: number) =>
  `33333333-3333-4333-8333-${String(n).padStart(12, "0")}`;

const putSet = (n: number, weight = 50, done = false): Mutation => ({
  type: "putSet",
  sessionId: SESSION,
  exerciseId: EXERCISE,
  set: { id: setId(n), position: n, weight, reps: null, done },
});

function memoryStorage(
  initial?: string,
): StorageLike & { data: Map<string, string> } {
  const data = new Map<string, string>();
  if (initial) data.set(QUEUE_STORAGE_KEY, initial);
  return {
    data,
    getItem: (key) => data.get(key) ?? null,
    setItem: (key, value) => void data.set(key, value),
    removeItem: (key) => void data.delete(key),
  };
}

/** A send function whose calls resolve/reject when the test says so. */
function controlledSend() {
  const calls: {
    mutation: Mutation;
    resolve: () => void;
    reject: (error: Error) => void;
  }[] = [];
  const send = vi.fn(
    (mutation: Mutation) =>
      new Promise<void>((resolve, reject) => {
        calls.push({ mutation, resolve, reject });
      }),
  );
  return { send, calls };
}

const flush = () => vi.advanceTimersByTimeAsync(0);

beforeEach(() => {
  vi.useFakeTimers();
});
afterEach(() => {
  vi.useRealTimers();
});

describe("save queue ordering", () => {
  it("sends one mutation at a time, in order", async () => {
    const { send, calls } = controlledSend();
    const queue = createSaveQueue({ send });
    queue.enqueue(putSet(1));
    queue.enqueue({ ...putSet(2) });
    queue.enqueue({
      type: "deleteSet",
      sessionId: SESSION,
      exerciseId: EXERCISE,
      setId: setId(1),
    });
    await flush();
    expect(send).toHaveBeenCalledTimes(1);
    expect(queue.getSnapshot()).toMatchObject({ status: "saving", pending: 3 });

    calls[0].resolve();
    await flush();
    expect(send).toHaveBeenCalledTimes(2);
    calls[1].resolve();
    await flush();
    calls[2].resolve();
    await flush();

    expect(send.mock.calls.map(([m]) => m.type)).toEqual([
      "putSet",
      "putSet",
      "deleteSet",
    ]);
    expect(queue.getSnapshot()).toMatchObject({ status: "saved", pending: 0 });
  });

  it("notifies subscribers only when the snapshot changes", async () => {
    const send = vi.fn().mockResolvedValue(undefined);
    const queue = createSaveQueue({ send });
    const listener = vi.fn();
    const unsubscribe = queue.subscribe(listener);
    queue.enqueue(putSet(1));
    await flush();
    expect(listener).toHaveBeenCalled();
    const before = queue.getSnapshot();
    expect(queue.getSnapshot()).toBe(before);
    unsubscribe();
  });
});

describe("retry", () => {
  it("retries network errors with backoff, keeping order", async () => {
    const send = vi
      .fn<(m: Mutation) => Promise<void>>()
      .mockRejectedValueOnce(new ApiError(0, "offline"))
      .mockRejectedValueOnce(new ApiError(503, "down"))
      .mockResolvedValue(undefined);
    const queue = createSaveQueue({ send, baseDelayMs: 1000 });
    queue.enqueue(putSet(1));
    queue.enqueue(putSet(2));
    await flush();

    expect(send).toHaveBeenCalledTimes(1);
    expect(queue.getSnapshot()).toMatchObject({
      status: "error",
      retrying: true,
      pending: 2,
    });

    await vi.advanceTimersByTimeAsync(999);
    expect(send).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(1); // 1s: second attempt fails again
    expect(send).toHaveBeenCalledTimes(2);

    await vi.advanceTimersByTimeAsync(1999);
    expect(send).toHaveBeenCalledTimes(2);
    await vi.advanceTimersByTimeAsync(1); // 2s backoff: succeeds
    await flush();

    expect(
      send.mock.calls.map(([m]) => (m as { set: { id: string } }).set.id),
    ).toEqual([setId(1), setId(1), setId(1), setId(2)]);
    expect(queue.getSnapshot()).toMatchObject({
      status: "saved",
      pending: 0,
      retrying: false,
    });
  });

  it("caps the backoff delay", async () => {
    const send = vi
      .fn<(m: Mutation) => Promise<void>>()
      .mockRejectedValue(new ApiError(500, "boom"));
    const queue = createSaveQueue({
      send,
      baseDelayMs: 1000,
      maxDelayMs: 3000,
    });
    queue.enqueue(putSet(1));
    await flush();
    await vi.advanceTimersByTimeAsync(1000);
    await vi.advanceTimersByTimeAsync(2000);
    expect(send).toHaveBeenCalledTimes(3);
    await vi.advanceTimersByTimeAsync(3000); // capped at 3s, not 4s
    expect(send).toHaveBeenCalledTimes(4);
  });

  it("retries immediately on retryNow (the online event)", async () => {
    const send = vi
      .fn<(m: Mutation) => Promise<void>>()
      .mockRejectedValueOnce(new ApiError(0, "offline"))
      .mockResolvedValue(undefined);
    const queue = createSaveQueue({ send, baseDelayMs: 60_000 });
    queue.enqueue(putSet(1));
    await flush();
    expect(queue.getSnapshot().retrying).toBe(true);

    queue.retryNow();
    await flush();
    expect(send).toHaveBeenCalledTimes(2);
    expect(queue.getSnapshot().status).toBe("saved");
  });

  it("does not skip ahead while waiting to retry", async () => {
    const send = vi
      .fn<(m: Mutation) => Promise<void>>()
      .mockRejectedValueOnce(new ApiError(0, "offline"))
      .mockResolvedValue(undefined);
    const queue = createSaveQueue({ send, baseDelayMs: 1000 });
    queue.enqueue(putSet(1));
    await flush();
    queue.enqueue(putSet(2));
    await flush();
    expect(send).toHaveBeenCalledTimes(1);
  });
});

describe("rejected changes", () => {
  it("drops a 4xx mutation, surfaces an error and continues", async () => {
    const send = vi
      .fn<(m: Mutation) => Promise<void>>()
      .mockRejectedValueOnce(new ApiError(400, "Reps must be a number."))
      .mockResolvedValue(undefined);
    const storage = memoryStorage();
    const queue = createSaveQueue({ send, storage });
    queue.enqueue(putSet(1));
    queue.enqueue(putSet(2));
    await flush();

    expect(send).toHaveBeenCalledTimes(2);
    expect(queue.getSnapshot()).toMatchObject({
      status: "error",
      pending: 0,
      retrying: false,
      rejected: "Reps must be a number.",
    });
    expect(storage.data.has(QUEUE_STORAGE_KEY)).toBe(false);

    // A later edit starts a fresh, clean state.
    queue.enqueue(putSet(3));
    await flush();
    expect(queue.getSnapshot()).toMatchObject({
      status: "saved",
      rejected: null,
    });
  });

  it("does not retry a 404", async () => {
    const send = vi
      .fn<(m: Mutation) => Promise<void>>()
      .mockRejectedValue(new ApiError(404, "Session not found."));
    const queue = createSaveQueue({ send });
    queue.enqueue(putSet(1));
    await flush();
    await vi.advanceTimersByTimeAsync(120_000);
    expect(send).toHaveBeenCalledTimes(1);
    expect(queue.getSnapshot().pending).toBe(0);
  });
});

describe("persistence", () => {
  it("persists pending work under a versioned key and clears it when empty", async () => {
    const { send, calls } = controlledSend();
    const storage = memoryStorage();
    const queue = createSaveQueue({ send, storage });
    queue.enqueue(putSet(1));
    expect(QUEUE_STORAGE_KEY).toMatch(/:v\d+$/);
    const saved = JSON.parse(storage.data.get(QUEUE_STORAGE_KEY) ?? "{}");
    expect(saved.version).toBe(1);
    expect(saved.items).toHaveLength(1);

    await flush();
    calls[0].resolve();
    await flush();
    expect(storage.data.has(QUEUE_STORAGE_KEY)).toBe(false);
  });

  it("keeps an in-flight mutation persisted until it is acknowledged", async () => {
    const { send } = controlledSend();
    const storage = memoryStorage();
    const queue = createSaveQueue({ send, storage });
    queue.enqueue(putSet(1));
    await flush();
    expect(JSON.parse(storage.data.get(QUEUE_STORAGE_KEY)!).items).toHaveLength(
      1,
    );
  });

  it("restores and resends queued work after a reload, in order", async () => {
    const first = memoryStorage();
    const offline = vi
      .fn<(m: Mutation) => Promise<void>>()
      .mockRejectedValue(new ApiError(0, "offline"));
    const before = createSaveQueue({ send: offline, storage: first });
    before.enqueue(putSet(1));
    before.enqueue(putSet(2));
    await flush();

    // "Reload": a new queue reads what the old one left behind.
    const send = vi.fn().mockResolvedValue(undefined);
    const after = createSaveQueue({
      send,
      storage: memoryStorage(first.data.get(QUEUE_STORAGE_KEY)),
    });
    expect(after.getSnapshot().pending).toBe(2);
    expect(after.pendingFor(SESSION)).toHaveLength(2);
    expect(after.pendingFor("other")).toHaveLength(0);
    after.start();
    await flush();
    expect(send.mock.calls.map(([m]) => m.set.id)).toEqual([
      setId(1),
      setId(2),
    ]);
    expect(after.getSnapshot().status).toBe("saved");
  });

  it("ignores payloads from another version or with bad entries", () => {
    const send = vi.fn().mockResolvedValue(undefined);
    const wrongVersion = memoryStorage(
      JSON.stringify({ version: 0, items: [putSet(1)] }),
    );
    expect(
      createSaveQueue({ send, storage: wrongVersion }).getSnapshot().pending,
    ).toBe(0);
    const garbage = memoryStorage("not json");
    expect(
      createSaveQueue({ send, storage: garbage }).getSnapshot().pending,
    ).toBe(0);
    const mixed = memoryStorage(
      JSON.stringify({ version: 1, items: [putSet(1), { type: "nope" }, 7] }),
    );
    expect(
      createSaveQueue({ send, storage: mixed }).getSnapshot().pending,
    ).toBe(1);
  });

  it("survives storage that throws", async () => {
    const send = vi.fn().mockResolvedValue(undefined);
    const storage: StorageLike = {
      getItem: () => {
        throw new Error("blocked");
      },
      setItem: () => {
        throw new Error("full");
      },
      removeItem: () => {
        throw new Error("blocked");
      },
    };
    const queue = createSaveQueue({ send, storage });
    queue.enqueue(putSet(1));
    await flush();
    expect(send).toHaveBeenCalledTimes(1);
  });
});

describe("coalescing", () => {
  it("folds consecutive updates to the same set into one request", async () => {
    const { send, calls } = controlledSend();
    const queue = createSaveQueue({ send });
    queue.enqueue(putSet(9)); // goes in flight
    await flush();
    queue.enqueue(putSet(1, 50));
    queue.enqueue(putSet(1, 55));
    queue.enqueue(putSet(1, 60, true));
    expect(queue.getSnapshot().pending).toBe(2);

    calls[0].resolve();
    await flush();
    expect(send).toHaveBeenCalledTimes(2);
    expect(send.mock.calls[1][0]).toMatchObject({
      set: { id: setId(1), weight: 60, done: true },
    });
  });

  it("never rewrites the mutation that is already in flight", async () => {
    const { send, calls } = controlledSend();
    const queue = createSaveQueue({ send });
    queue.enqueue(putSet(1, 50));
    await flush();
    queue.enqueue(putSet(1, 55));
    expect(queue.getSnapshot().pending).toBe(2);
    calls[0].resolve();
    await flush();
    expect(send.mock.calls[1][0]).toMatchObject({ set: { weight: 55 } });
  });

  it("does not merge different sets or non-consecutive updates", async () => {
    const { send } = controlledSend();
    const queue = createSaveQueue({ send });
    queue.enqueue(putSet(9));
    await flush();
    queue.enqueue(putSet(1));
    queue.enqueue(putSet(2));
    queue.enqueue(putSet(1));
    expect(queue.getSnapshot().pending).toBe(4);
  });

  it("merges header patches and keeps the latest finish/reopen", async () => {
    const { send } = controlledSend();
    const queue = createSaveQueue({ send });
    queue.enqueue(putSet(9));
    await flush();
    queue.enqueue({
      type: "patchSession",
      sessionId: SESSION,
      patch: { notes: "a" },
    });
    queue.enqueue({
      type: "patchSession",
      sessionId: SESSION,
      patch: { locationId: null },
    });
    queue.enqueue({
      type: "finish",
      sessionId: SESSION,
      finishedAt: "2026-10-30T10:00:00.000Z",
    });
    queue.enqueue({ type: "reopen", sessionId: SESSION });
    expect(queue.pendingFor(SESSION).map((m) => m.type)).toEqual([
      "putSet",
      "patchSession",
      "reopen",
    ]);
    expect(queue.pendingFor(SESSION)[1]).toMatchObject({
      patch: { notes: "a", locationId: null },
    });
  });
});

describe("sendMutation (fake fetch)", () => {
  const fetchMock = vi.fn();
  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  const ok = (status = 200) =>
    new Response(status === 204 ? null : "{}", { status });

  it("maps each mutation to its endpoint", async () => {
    fetchMock.mockImplementation(async () => ok());
    const mutations: Mutation[] = [
      putSet(1),
      {
        type: "deleteSet",
        sessionId: SESSION,
        exerciseId: EXERCISE,
        setId: setId(1),
      },
      {
        type: "putExercise",
        sessionId: SESSION,
        exercise: {
          id: EXERCISE,
          exerciseId: EXERCISE,
          slotId: null,
          position: 0,
        },
        snapshot: { name: "Press", loadType: "total", baseWeight: 0 },
      },
      { type: "deleteExercise", sessionId: SESSION, exerciseId: EXERCISE },
      { type: "patchSession", sessionId: SESSION, patch: { notes: "x" } },
      {
        type: "finish",
        sessionId: SESSION,
        finishedAt: "2026-10-30T10:00:00.000Z",
      },
      { type: "reopen", sessionId: SESSION },
    ];
    for (const mutation of mutations) await sendMutation(mutation);
    const seen = fetchMock.mock.calls.map(([url, init]) =>
      `${init.method} ${url}`
        .replace(SESSION, "S")
        .replace(EXERCISE, "E")
        .replace(setId(1), "T"),
    );
    expect(seen).toEqual([
      "PUT /api/sessions/S/exercises/E/sets/T",
      "DELETE /api/sessions/S/exercises/E/sets/T",
      "PUT /api/sessions/S/exercises/E",
      "DELETE /api/sessions/S/exercises/E",
      "PATCH /api/sessions/S",
      "POST /api/sessions/S/finish",
      "POST /api/sessions/S/reopen",
    ]);
    // The display snapshot is never sent to the server.
    expect(JSON.parse(fetchMock.mock.calls[2][1].body)).not.toHaveProperty(
      "snapshot",
    );
  });

  it("works end to end: network failure, then success", async () => {
    fetchMock
      .mockRejectedValueOnce(new TypeError("Failed to fetch"))
      .mockImplementation(async () => ok());
    const queue = createSaveQueue({ send: sendMutation, baseDelayMs: 500 });
    queue.enqueue(putSet(1));
    await flush();
    expect(queue.getSnapshot().retrying).toBe(true);
    await vi.advanceTimersByTimeAsync(500);
    expect(queue.getSnapshot().status).toBe("saved");
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("drops on a 400 response", async () => {
    fetchMock.mockImplementation(
      async () =>
        new Response(JSON.stringify({ error: "Bad weight." }), { status: 400 }),
    );
    const queue = createSaveQueue({ send: sendMutation });
    queue.enqueue(putSet(1));
    await flush();
    expect(queue.getSnapshot()).toMatchObject({
      rejected: "Bad weight.",
      pending: 0,
    });
  });
});
