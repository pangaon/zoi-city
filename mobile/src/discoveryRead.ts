import { BASE, PUBLIC_KEY } from "./session";
/** Public reads never carry the private account's bearer credential. */
export async function discoveryRead(
  name: string,
  args: Record<string, unknown>,
  signal?: AbortSignal,
) {
  if (
    ![
      "explore_search",
      "explore_geo",
      "explore_cities",
      "home_entity",
      "geography_reviewed_point",
    ].includes(name)
  )
    throw Error("Unknown public discovery read.");
  const controller = new AbortController(),
    abort = () => controller.abort();
  signal?.addEventListener("abort", abort);
  if (signal?.aborted) controller.abort();
  const timer = setTimeout(abort, 12000);
  try {
    const response = await fetch(BASE + "/rest/v1/rpc/" + name, {
      method: "POST",
      headers: {
        apikey: PUBLIC_KEY,
        Authorization: "Bearer " + PUBLIC_KEY,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(args),
      signal: controller.signal,
    });
    if (!response.ok) {
      const error = Object.assign(
        Error("The service is unavailable. Please retry."),
        { status: response.status },
      );
      throw error;
    }
    return await response.json();
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener("abort", abort);
  }
}
