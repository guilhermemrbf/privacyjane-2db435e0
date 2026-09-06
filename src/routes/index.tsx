import { createFileRoute } from "@tanstack/react-router";
import { useEffect } from "react";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Privacy | Jane" },
      { name: "description", content: "Acesso ao conteúdo exclusivo." },
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
