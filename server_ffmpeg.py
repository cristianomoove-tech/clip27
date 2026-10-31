"""
Clip27 IA - Servidor de API Local com FFmpeg Nativo & faster-whisper
=====================================================================
Porta Padrão: 5050
Permite que o aplicativo Web (Studio Clip27) envie os 3 Ganchos, 3 Corpos e 3 CTAs
e processe os 27 vídeos diretamente via FFmpeg nativo sem travamentos, com áudio perfeito
e micro-edits anti-shadowban.
"""

import os
import sys
import json
import time
import shutil
import zipfile
import threading
from pathlib import Path
from http.server import HTTPServer, BaseHTTPRequestHandler
from urllib.parse import urlparse, parse_qs
import cgi

# Importa o motor de renderização
from motor_ffmpeg import (
    gerar_27_videos, 
    verificar_ffmpeg, 
    extrair_legendas_whisper,
    FFMPEG_BIN
)

PORTA = 5050
PASTA_PROJETO = Path(__file__).resolve().parent
PASTA_UPLOADS = PASTA_PROJETO / "motor_uploads"
PASTA_SAIDA = PASTA_PROJETO / "saida_combinacoes"

PASTA_UPLOADS.mkdir(parents=True, exist_ok=True)
PASTA_SAIDA.mkdir(parents=True, exist_ok=True)

# Estado global do processo de renderização
ESTADO_RENDER = {
    "rodando": False,
    "progresso_percent": 0,
    "video_atual": "",
    "indice_atual": 0,
    "total_videos": 27,
    "status_texto": "Pronto para iniciar",
    "concluido": False,
    "erro": None,
    "arquivos_gerados": [],
    "tempo_inicio": 0,
    "tempo_fim": 0,
}
ESTADO_LOCK = threading.Lock()

class ServidorClip27Handler(BaseHTTPRequestHandler):
    def _enviar_headers_cors(self, status=200, content_type="application/json"):
        self.send_response(status)
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS, PUT, DELETE")
        self.send_header("Access-Control-Allow-Headers", "Content-Type, Authorization, X-Requested-With")
        self.send_header("Content-Type", content_type)
        self.end_headers()

    def do_OPTIONS(self):
        # Suporte a CORS Pre-flight do navegador
        self._enviar_headers_cors(204)

    def do_GET(self):
        parsed = urlparse(self.path)
        caminho = parsed.path

        if caminho in ["/", "/health", "/api/status"]:
            ffmpeg_ok = verificar_ffmpeg()
            whisper_ok = True
            try:
                import faster_whisper
            except ImportError:
                whisper_ok = False

            dados = {
                "status": "online",
                "motor": "FFmpeg Nativo Clip27",
                "ffmpeg_instalado": ffmpeg_ok,
                "faster_whisper_instalado": whisper_ok,
                "versao": "2.1.0",
                "pasta_saida": str(PASTA_SAIDA)
            }
            self._enviar_headers_cors(200)
            self.wfile.write(json.dumps(dados, ensure_ascii=False).encode("utf-8"))
            return

        if caminho == "/api/progresso":
            with ESTADO_LOCK:
                dados = dict(ESTADO_RENDER)
            self._enviar_headers_cors(200)
            self.wfile.write(json.dumps(dados, ensure_ascii=False).encode("utf-8"))
            return

        if caminho == "/api/download-zip":
            # Gera ou envia o arquivo ZIP com todas as 27 combinações
            zip_path = PASTA_PROJETO / "clip27_pacote_27_videos.zip"
            try:
                with zipfile.ZipFile(zip_path, 'w', zipfile.ZIP_DEFLATED) as zipf:
                    for root, _, files in os.walk(PASTA_SAIDA):
                        for file in files:
                            if file.lower().endswith(('.mp4', '.png', '.txt')):
                                file_path = os.path.join(root, file)
                                arcname = os.path.relpath(file_path, PASTA_SAIDA)
                                zipf.write(file_path, arcname)

                if os.path.exists(zip_path):
                    tamanho = os.path.getsize(zip_path)
                    self.send_response(200)
                    self.send_header("Access-Control-Allow-Origin", "*")
                    self.send_header("Content-Type", "application/zip")
                    self.send_header("Content-Disposition", 'attachment; filename="clip27_27_videos_ffmpeg.zip"')
                    self.send_header("Content-Length", str(tamanho))
                    self.end_headers()

                    with open(zip_path, "rb") as f:
                        shutil.copyfileobj(f, self.wfile)
                    return
                else:
                    self._enviar_headers_cors(404)
                    self.wfile.write(json.dumps({"erro": "Nenhum arquivo gerado para empacotar."}).encode("utf-8"))
                    return
            except Exception as e:
                self._enviar_headers_cors(500)
                self.wfile.write(json.dumps({"erro": str(e)}).encode("utf-8"))
                return

        # Servir vídeo MP4 individual se solicitado
        if caminho.startswith("/api/video/"):
            nome_arquivo = caminho.replace("/api/video/", "")
            video_file = PASTA_SAIDA / nome_arquivo
            if video_file.exists():
                tamanho = os.path.getsize(video_file)
                self.send_response(200)
                self.send_header("Access-Control-Allow-Origin", "*")
                self.send_header("Content-Type", "video/mp4")
                self.send_header("Content-Length", str(tamanho))
                self.end_headers()
                with open(video_file, "rb") as f:
                    shutil.copyfileobj(f, self.wfile)
                return
            else:
                self._enviar_headers_cors(404)
                self.wfile.write(json.dumps({"erro": "Vídeo não encontrado."}).encode("utf-8"))
                return

        self._enviar_headers_cors(404)
        self.wfile.write(json.dumps({"erro": "Rota não encontrada"}).encode("utf-8"))

    def do_POST(self):
        parsed = urlparse(self.path)
        caminho = parsed.path

        if caminho == "/api/upload-clip":
            # Recebe o envio binário de um clipe específico (ex: Gancho 1, Gancho 2, etc.)
            try:
                ctype, pdict = cgi.parse_header(self.headers.get('content-type', ''))
                params = parse_qs(parsed.query)
                clip_tipo = params.get('tipo', ['gancho'])[0] # 'gancho', 'corpo', 'cta'
                clip_slot = params.get('slot', ['1'])[0]      # '1', '2', '3'

                nome_salvo = f"{clip_tipo}_{clip_slot}.mp4"
                caminho_salvo = PASTA_UPLOADS / nome_salvo

                # Lê os dados binários do corpo
                tamanho_corpo = int(self.headers.get('content-length', 0))
                dados = self.rfile.read(tamanho_corpo)

                with open(caminho_salvo, "wb") as f:
                    f.write(dados)

                resposta = {
                    "sucesso": True,
                    "arquivo": str(caminho_salvo),
                    "tipo": clip_tipo,
                    "slot": int(clip_slot),
                    "tamanho_bytes": len(dados)
                }
                self._enviar_headers_cors(200)
                self.wfile.write(json.dumps(resposta, ensure_ascii=False).encode("utf-8"))
            except Exception as e:
                self._enviar_headers_cors(500)
                self.wfile.write(json.dumps({"erro": f"Falha no upload: {str(e)}"}).encode("utf-8"))
            return

        if caminho == "/api/gerar-27":
            # Inicia o processo de geração dos 27 vídeos
            with ESTADO_LOCK:
                if ESTADO_RENDER["rodando"]:
                    self._enviar_headers_cors(400)
                    self.wfile.write(json.dumps({
                        "erro": "Uma renderização já está em andamento. Aguarde a conclusão."
                    }, ensure_ascii=False).encode("utf-8"))
                    return

            try:
                length = int(self.headers.get('content-length', 0))
                corpo = self.rfile.read(length).decode('utf-8')
                dados = json.loads(corpo) if corpo else {}

                # Resolução selecionada (padrão 720p vertical leve conforme pedido do usuário)
                resolucao = dados.get("resolucao", "720p")
                largura, altura = (720, 1280) if resolucao == "720p" else (1080, 1920)
                fps = int(dados.get("fps", 30))
                micro_edits = bool(dados.get("micro_edits", True))
                manchetes = dados.get("manchetes", [])

                # Identifica caminhos dos arquivos de entrada
                ganchos = [
                    str(PASTA_UPLOADS / "gancho_1.mp4"),
                    str(PASTA_UPLOADS / "gancho_2.mp4"),
                    str(PASTA_UPLOADS / "gancho_3.mp4")
                ]
                corpos = [
                    str(PASTA_UPLOADS / "corpo_1.mp4"),
                    str(PASTA_UPLOADS / "corpo_2.mp4"),
                    str(PASTA_UPLOADS / "corpo_3.mp4")
                ]
                ctas = [
                    str(PASTA_UPLOADS / "cta_1.mp4"),
                    str(PASTA_UPLOADS / "cta_2.mp4"),
                    str(PASTA_UPLOADS / "cta_3.mp4")
                ]

                # Se o payload enviar caminhos personalizados
                if "ganchos" in dados and len(dados["ganchos"]) == 3:
                    ganchos = dados["ganchos"]
                if "corpos" in dados and len(dados["corpos"]) == 3:
                    corpos = dados["corpos"]
                if "ctas" in dados and len(dados["ctas"]) == 3:
                    ctas = dados["ctas"]

                # Valida existência dos 9 clipes
                faltando = []
                for p in ganchos + corpos + ctas:
                    if not os.path.exists(p):
                        faltando.append(os.path.basename(p))

                if faltando:
                    self._enviar_headers_cors(400)
                    self.wfile.write(json.dumps({
                        "erro": f"Faltam clipes para gerar as 27 combinações: {', '.join(faltando)}. Certifique-se de carregar Gancho 1, 2, 3, Corpo 1, 2, 3 e CTA 1, 2, 3."
                    }, ensure_ascii=False).encode("utf-8"))
                    return

                # Inicia renderização em segundo plano (Worker Thread)
                thread = threading.Thread(
                    target=executar_render_background,
                    args=(ganchos, corpos, ctas, manchetes, micro_edits, largura, altura, fps)
                )
                thread.daemon = True
                thread.start()

                self._enviar_headers_cors(200)
                self.wfile.write(json.dumps({
                    "sucesso": True,
                    "mensagem": "Renderização FFmpeg iniciada com sucesso!",
                    "total_combinacoes": 27,
                    "resolucao": f"{largura}x{altura} @ {fps}fps",
                    "micro_edits": micro_edits
                }, ensure_ascii=False).encode("utf-8"))

            except Exception as e:
                self._enviar_headers_cors(500)
                self.wfile.write(json.dumps({"erro": f"Erro interno ao disparar render: {str(e)}"}).encode("utf-8"))
            return

        self._enviar_headers_cors(404)
        self.wfile.write(json.dumps({"erro": "Rota não encontrada"}).encode("utf-8"))


def executar_render_background(ganchos, corpos, ctas, manchetes, micro_edits, largura, altura, fps):
    global ESTADO_RENDER
    with ESTADO_LOCK:
        ESTADO_RENDER["rodando"] = True
        ESTADO_RENDER["progresso_percent"] = 0
        ESTADO_RENDER["video_atual"] = "Iniciando..."
        ESTADO_RENDER["indice_atual"] = 0
        ESTADO_RENDER["total_videos"] = 27
        ESTADO_RENDER["status_texto"] = "Preparando arquivos e filtros FFmpeg..."
        ESTADO_RENDER["concluido"] = False
        ESTADO_RENDER["erro"] = None
        ESTADO_RENDER["arquivos_gerados"] = []
        ESTADO_RENDER["tempo_inicio"] = time.time()

    def callback_progresso(idx, total, nome_saida):
        with ESTADO_LOCK:
            ESTADO_RENDER["indice_atual"] = idx
            ESTADO_RENDER["video_atual"] = nome_saida
            pct = int((idx / total) * 100)
            ESTADO_RENDER["progresso_percent"] = pct
            ESTADO_RENDER["status_texto"] = f"Renderizando [{idx}/{total}]: {nome_saida}"
            ESTADO_RENDER["arquivos_gerados"].append(nome_saida)

    try:
        arquivos = gerar_27_videos(
            ganchos=ganchos,
            corpos=corpos,
            ctas=ctas,
            manchetes=manchetes,
            pasta_saida=str(PASTA_SAIDA),
            micro_edits=micro_edits,
            largura=largura,
            altura=altura,
            fps=fps,
            on_progresso=callback_progresso
        )
        with ESTADO_LOCK:
            ESTADO_RENDER["rodando"] = False
            ESTADO_RENDER["concluido"] = True
            ESTADO_RENDER["progresso_percent"] = 100
            ESTADO_RENDER["status_texto"] = f"Sucesso! Todos os {len(arquivos)} vídeos gerados com FFmpeg nativo."
            ESTADO_RENDER["tempo_fim"] = time.time()
    except Exception as e:
        with ESTADO_LOCK:
            ESTADO_RENDER["rodando"] = False
            ESTADO_RENDER["erro"] = str(e)
            ESTADO_RENDER["status_texto"] = f"Erro na renderização: {str(e)}"


def iniciar_servidor():
    servidor = HTTPServer(('0.0.0.0', PORTA), ServidorClip27Handler)
    print("\n" + "="*65)
    print("🎬 CLIP27 - SERVIDOR FFMPEG NATIVO & MOTOR COMBINATÓRIO 27 VÍDEOS")
    print("="*65)
    print(f"📡 API Ativa em: http://localhost:{PORTA}")
    print(f"🚀 Status FFmpeg: {'OK (Pronto)' if verificar_ffmpeg() else 'NÃO ENCONTRADO'}")
    print(f"📂 Diretório de Uploads: {PASTA_UPLOADS}")
    print(f"📂 Diretório de Saída: {PASTA_SAIDA}")
    print("="*65)
    print("Aguardando conexões do Studio Clip27 Web...\n")
    try:
        servidor.serve_forever()
    except KeyboardInterrupt:
        print("\n[!] Encerrando servidor FFmpeg...")
        servidor.server_close()

if __name__ == "__main__":
    iniciar_servidor()
