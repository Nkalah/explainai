import { createFileRoute } from "@tanstack/react-router";
import { ChatPage } from "@/components/chat/ChatPage";

/**
 * Same workspace as /chat, scoped to a saved conversation. Once
 * persistence exists, this is where you'd load prior turns from the DB
 * (e.g. a loader fetching `getConversation(conversationId)`) and feed them
 * into useChat as initial state instead of an empty array.
 */
export const Route = createFileRoute("/chat/$conversationId")({
  component: RouteComponent,
});

function RouteComponent() {
  const { conversationId } = Route.useParams();
  return <ChatPage conversationId={conversationId} />;
}
