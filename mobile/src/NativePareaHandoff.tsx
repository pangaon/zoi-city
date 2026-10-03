import { useAuth } from "./Auth";
import { NativeParea } from "./NativeParea";
/** Existing Tickets entry now opens the native whole-ticket operation in its exact scope. */
export function NativePareaHandoff({ eventId }: { eventId: string }) {
  const { session, workspaceId } = useAuth();
  return (
    <NativeParea
      key={`${eventId}:${session?.user.id || ""}:${workspaceId}`}
      eventId={eventId}
    />
  );
}
