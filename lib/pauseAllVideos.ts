// Chamado no instante em que QUALQUER transição de página arranca (curtain
// fade, voo de card, voo de texto, swipe de aula) — antes da navegação em
// si, porque as transições deste site mantêm a página antiga montada (e a
// tocar) durante a transição; sem isto, um trailer/vídeo da aula continuava
// a reproduzir por cima da página nova enquanto essa transição decorria.
export function pauseAllVideos() {
  if (typeof document === "undefined") return;
  document.querySelectorAll("video").forEach((v) => {
    if (!v.paused) v.pause();
  });
}
