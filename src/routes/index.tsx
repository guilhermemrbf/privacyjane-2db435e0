import { createFileRoute } from "@tanstack/react-router";
import { useEffect } from "react";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Privacy | Jane" },
      {
        name: "description",
        content:
          "Sou a Jane, mais conhecida como coroa do hot 💋\n\nDentro do meu VIP você vai encontrar:\n❤️‍🔥 +234 vídeos exclusivos só pra você, Gozando bem gostoso sozinha, Chamadas privadinhas, Punheta guiada com minha voz, Meu WhatsApp pessoal além de conversar comigo diretamente pelo chat",
      },
    ],
  }),
  component: Index,
});

function Index() {
  useEffect(() => {
    window.location.replace("/sales.html?v=" + Date.now());
  }, []);
  return null;
}
