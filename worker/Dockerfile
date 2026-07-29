# --- Build whisper.cpp ---------------------------------------------------
# Estágio à parte (não a imagem final) — precisa de toolchain de compilação
# (cmake/g++/git) que não faz sentido carregar pra produção; só o binário
# final e o modelo saem daqui (ver COPY --from mais abaixo).
FROM debian:bookworm-slim AS whisper-build

RUN apt-get update \
  && apt-get install -y --no-install-recommends git build-essential cmake ca-certificates curl \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /build
# Tag fixa — nunca segue master, que podia mudar nomes de flags/binário sem
# aviso e partir a integração (ver runWhisperCppChunk em index.js). Alvo
# "whisper-cli" confirmado em examples/cli/CMakeLists.txt desta tag.
#
# Clone parcial (--filter=blob:none) + sparse-checkout em vez de clonar o
# repo inteiro — a árvore completa arrasta bindings mobile (Android/iOS/
# SwiftUI/CoreML) e binários de teste em models/, que não fazem falta
# nenhuma só pra compilar o whisper-cli e não pesam nada na imagem final de
# qualquer forma (ficam neste estágio, descartado). Lista de caminhos
# confirmada a olhar pro CMakeLists.txt real desta tag (o que
# add_subdirectory/add_executable pedem pro alvo whisper-cli), não é palpite.
RUN git clone --depth 1 --branch v1.7.4 --filter=blob:none --no-checkout https://github.com/ggerganov/whisper.cpp.git . \
  && git sparse-checkout init --cone \
  && git sparse-checkout set cmake ggml src include bindings/javascript examples/cli examples/bench examples/server examples/quantize examples/deprecation-warning models \
  && git checkout v1.7.4
RUN cmake -B build -DCMAKE_BUILD_TYPE=Release \
  && cmake --build build --config Release -j"$(nproc)" --target whisper-cli
# Modelo multilingue (legendas em português — NUNCA usar variantes ".en",
# essas só percebem inglês) quantizado q5_1 — o nível de quantização que o
# download-ggml-model.sh desta tag aceita pra "base" (confirmado em
# models/download-ggml-model.sh; "base-q5_0" NÃO existe, só "base-q5_1").
# Baked na imagem — nunca precisa de rede em runtime pra arrancar as
# legendas, ao contrário do CDN da Hugging Face usado antes.
RUN bash ./models/download-ggml-model.sh base-q5_1

# --- Imagem final ---------------------------------------------------------
FROM node:22-bookworm-slim

RUN apt-get update \
  && apt-get install -y --no-install-recommends ffmpeg ca-certificates \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY package.json ./
RUN npm install --omit=dev
COPY index.js ./

COPY --from=whisper-build /build/build/bin/whisper-cli /usr/local/bin/whisper-cli
COPY --from=whisper-build /build/models/ggml-base-q5_1.bin /app/models/ggml-base-q5_1.bin

EXPOSE 8080

CMD ["node", "index.js"]
