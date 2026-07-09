export interface SlideDeckSlide {
  title: string;
  body: string;
}

export function buildSlideDeck(resourceName: string): SlideDeckSlide[] {
  const topic = resourceName
    .replace(/\.(pptx|ppt)$/i, "")
    .replace(/^Slides\s*-\s*/i, "")
    .trim();
  const topicLower = topic.toLowerCase();

  return [
    { title: topic, body: "" },
    { title: `Porque ${topicLower} importa`, body: "Contexto e motivação para o tópico desta aula." },
    { title: "Conceitos-chave", body: "Principais ideias e definições a reter." },
    { title: "Exemplo prático", body: `Aplicação de ${topicLower} num caso real.` },
    { title: "Resumo", body: "Pontos principais — revê antes de avançar." },
  ];
}
