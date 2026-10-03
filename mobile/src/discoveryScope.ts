type Client = {
  session: { user: { id: string } } | null;
  token: () => Promise<string>;
  request: (path: string, body: unknown, token: string) => Promise<any>;
};
const uuid = (v: unknown) =>
  typeof v === "string" &&
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);
/** Only existing settings RPCs; fence identity after refresh and response waits. */
export async function discoveryPrivateRpc(
  client: Client,
  actor: string,
  current: () => boolean,
  name: string,
  args: Record<string, unknown>,
) {
  if (
    ![
      "community_me",
      "community_preferences_save",
      "community_profile_save",
    ].includes(name) ||
    (name === "community_me" && Object.keys(args).length) ||
    (name !== "community_me" &&
      (!Number.isSafeInteger(args.p_expected_version) ||
        Number(args.p_expected_version) < 0 ||
        !args.p_data ||
        typeof args.p_data !== "object" ||
        Array.isArray(args.p_data)))
  )
    throw Error("Choose current account preferences.");
  const check = () => {
    if (!uuid(actor) || client.session?.user.id !== actor || !current())
      throw Error("Your account or preferences changed.");
  };
  check();
  const token = await client.token();
  check();
  const value = await client.request("/rest/v1/rpc/" + name, args, token);
  check();
  return value;
}
