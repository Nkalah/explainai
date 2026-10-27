import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { ChatPage } from "@/components/chat/ChatPage";

const chatSearchSchema = z.object({
  q: z.string().optional(),
});

export const Route = createFileRoute("/chat")({
  component: RouteComponent,
  validateSearch: chatSearchSchema,
});

function RouteComponent() {
  const { q } = Route.useSearch();
  const navigate = Route.useNavigate();

  return (
    <ChatPage
      initialQuestion={q}
      onInitialQuestionSent={() => {
        // Strip ?q= from the URL once it's been sent so refreshing /chat
        // doesn't re-fire the same question.
        navigate({ search: {}, replace: true });
      }}
    />
  );
}