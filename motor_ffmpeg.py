"""
Clip27 IA - Motor Combinatório e Renderizador de Vídeos com FFmpeg Nativo
========================================================================
- Concatenação precisa e sem travamentos via FFmpeg (3x3x3 = 27 variações)
- Auto-Splitter com IA: Transcreve via faster-whisper, analisa timestamps com LLM e fatia com FFmpeg
- Micro-Edits Anti-Duplicado e Anti-Shadowban (Zoom, Brilho, Saturação, Velocidade/PTS, Espelho)
- Queima de Manchete de Alto CTR estilo TikTok (drawtext com caixa branca e tipografia preta)
- Legendas Automáticas (.ass) estilizadas com correção de nomes de produtos via OpenRouter
- Limpeza total de metadados (-map_metadata -1) e renderização H.264 + AAC
"""

import os
import sys
import re
import glob
import json
import random
import itertools
import subprocess
import urllib.request
from pathlib import Path
from typing import List, Optional, Callable, Dict, Any

# Detecção ou caminho do FFmpeg
FFMPEG_BIN = "ffmpeg"
FFPROBE_BIN = "ffprobe"

def verificar_ffmpeg() -> bool:
    """Verifica se o binário do FFmpeg está acessível no sistema."""
    try:
        res = subprocess.run([FFMPEG_BIN, "-version"], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        return res.returncode == 0
    except Exception:
        return False

def obter_duracao_video(video_path: str) -> float:
    """Retorna a duração exata do vídeo em segundos via ffprobe."""
    try:
        cmd = [
            FFPROBE_BIN, "-v", "error",
            "-show_entries", "format=duration",
            "-of", "default=noprint_wrappers=1:nokey=1",
            video_path
        ]
        res = subprocess.run(cmd, stdout=subprocess.PIPE, stderr=subprocess.DEVNULL, text=True)
        return float(res.stdout.strip())
    except Exception:
        return 15.0

def tem_faixa_audio(video_path: str) -> bool:
    """Verifica se o arquivo de vídeo possui uma faixa de áudio válida."""
    try:
        cmd = [
            FFPROBE_BIN, "-v", "error",
            "-select_streams", "a:0",
            "-show_entries", "stream=codec_type",
            "-of", "csv=p=0",
            video_path
        ]
        res = subprocess.run(cmd, stdout=subprocess.PIPE, stderr=subprocess.DEVNULL, text=True)
        return "audio" in res.stdout.lower()
    except Exception:
        return True

def escapar_texto_drawtext(texto: str) -> str:
    """Escapa caracteres especiais para o filtro drawtext do FFmpeg."""
    if not texto:
        return ""
    t = texto.replace("\\", "\\\\")
    t = t.replace(":", "\\:")
    t = t.replace("'", "'\\''")
    t = t.replace("%", "\\%")
    return t

def segundos_para_ass(segundos: float) -> str:
    """Converte segundos em formato de tempo ASS (H:MM:SS.cs)."""
    seg = max(0.0, float(segundos))
    hours = int(seg // 3600)
    minutes = int((seg % 3600) // 60)
    secs = int(seg % 60)
    centis = int(round((seg - int(seg)) * 100)) % 100
    return f"{hours}:{minutes:02d}:{secs:02d}.{centis:02d}"

def gerar_arquivo_ass(
    legendas: List[Dict[str, Any]], 
    caminho_saida_ass: str, 
    estilo: str = "amarelo_neon",
    largura: int = 1080,
    altura: int = 1920
) -> str:
    """
    Gera um arquivo de legendas .ass profissional com estilos prontos para o TikTok Shop.
    """
    os.makedirs(os.path.dirname(os.path.abspath(caminho_saida_ass)), exist_ok=True)
    
    # Definições de Estilo ASS para o TikTok
    # Formato de cor ASS: &HAABBGGRR (onde AA é transparência: 00 = opaco, FF = transparente)
    estilos_map = {
        "amarelo_neon": {
            "font": "Arial Black",
            "size": 68,
            "primary": "&H0000FFFF",  # Amarelo vibrante
            "outline": "&H00000000",  # Borda preta
            "back": "&H80000000",
            "outline_w": 5,
            "shadow_w": 2,
            "alignment": 2,           # Centralizado embaixo
            "margin_v": 280
        },
        "branco_card": {
            "font": "Arial",
            "size": 64,
            "primary": "&H00FFFFFF",  # Branco puro
            "outline": "&H00111111",  # Borda preta elegante
            "back": "&H90000000",
            "outline_w": 4,
            "shadow_w": 3,
            "alignment": 2,
            "margin_v": 280
        },
        "verde_vendas": {
            "font": "Arial Black",
            "size": 68,
            "primary": "&H0000FF55",  # Verde neon
            "outline": "&H00000000",
            "back": "&H80000000",
            "outline_w": 5,
            "shadow_w": 2,
            "alignment": 2,
            "margin_v": 280
        },
        "rosa_glow": {
            "font": "Arial Black",
            "size": 66,
            "primary": "&H00E020FF",  # Rosa/Fúcsia
            "outline": "&H00000000",
            "back": "&H80000000",
            "outline_w": 5,
            "shadow_w": 3,
            "alignment": 2,
            "margin_v": 280
        }
    }
    
    cfg = estilos_map.get(estilo, estilos_map["amarelo_neon"])
    
    cabecalho = f"""[Script Info]
Title: Clip27 TikTok Subtitles
ScriptType: v4.00+
WrapStyle: 0
ScaledBorderAndShadow: yes
PlayResX: {largura}
PlayResY: {altura}

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: TikTokStyle,{cfg['font']},{cfg['size']},{cfg['primary']},&H000000FF,{cfg['outline']},{cfg['back']},-1,0,0,0,100,100,0,0,1,{cfg['outline_w']},{cfg['shadow_w']},{cfg['alignment']},40,40,{cfg['margin_v']},1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
"""
    
    linhas_dialogo = []
    for leg in legendas:
        t_ini = segundos_para_ass(leg.get("start", 0.0))
        t_fim = segundos_para_ass(leg.get("end", 0.0))
        txt = str(leg.get("text", "")).strip().replace("\n", " ")
        if txt:
            # Caixa alta opcional estilo TikTok para máximo impacto
            txt_upper = txt.upper()
            linhas_dialogo.append(f"Dialogue: 0,{t_ini},{t_fim},TikTokStyle,,0,0,0,,{txt_upper}")
            
    conteudo_completo = cabecalho + "\n".join(linhas_dialogo) + "\n"
    with open(caminho_saida_ass, "w", encoding="utf-8") as f:
        f.write(conteudo_completo)
        
    return caminho_saida_ass

def extrair_legendas_whisper(caminho_audio_ou_video: str, model_size: str = "base") -> List[Dict[str, Any]]:
    """Gera legendas automáticas usando faster-whisper (4x mais rápido, INT8 em CPU leve)."""
    try:
        from faster_whisper import WhisperModel
        print(f"[*] Inicializando faster-whisper ({model_size}) para transcrição...")
        model = WhisperModel(model_size, device="cpu", compute_type="int8")
        segments, _ = model.transcribe(caminho_audio_ou_video, language="pt")
        
        legendas = []
        for segment in segments:
            legendas.append({
                "start": round(segment.start, 2),
                "end": round(segment.end, 2),
                "text": segment.text.strip()
            })
        return legendas
    except ImportError:
        print("[!] faster-whisper não está instalado. Pulando geração automática de legendas.")
        return []
    except Exception as e:
        print(f"[!] Erro ao transcrever com faster-whisper: {e}")
        return []

def corrigir_legendas_openrouter(
    legendas: List[Dict[str, Any]], 
    api_key: Optional[str] = None, 
    modelo: str = "google/gemini-2.0-flash-exp:free"
) -> List[Dict[str, Any]]:
    """
    Passa o texto das legendas na OpenRouter para corrigir erros de grafia de nomes de produtos
    e expressões brasileiras, mantendo os timestamps exatos.
    """
    if not legendas or not api_key:
        return legendas
    
    try:
        texto_original = "\n".join([f"[{i}] {leg['text']}" for i, leg in enumerate(legendas)])
        prompt = (
            "Você é um especialista em transcrições e marketing de produtos para TikTok Shop Brasil.\n"
            "Corrija os erros de gramática, pontuação e principalmente nomes de marcas e produtos da transcrição abaixo.\n"
            "Mantenha as frases naturais, no mesmo idioma (português do Brasil) e mantenha a numeração [0], [1], etc.\n"
            "Retorne APENAS um JSON no formato estrito: {\"corrigidos\": [\"frase 0\", \"frase 1\", ...]}\n\n"
            f"Transcrição:\n{texto_original}"
        )
        
        req_data = json.dumps({
            "model": modelo or "google/gemini-2.0-flash-exp:free",
            "messages": [{"role": "user", "content": prompt}],
            "temperature": 0.2
        }).encode("utf-8")
        
        req = urllib.request.Request(
            "https://openrouter.ai/api/v1/chat/completions",
            data=req_data,
            headers={
                "Authorization": f"Bearer {api_key.strip()}",
                "Content-Type": "application/json",
                "HTTP-Referer": "http://localhost:5050",
                "X-Title": "Clip27 IA"
            }
        )
        with urllib.request.urlopen(req, timeout=12) as response:
            res_json = json.loads(response.read().decode("utf-8"))
            content = res_json.get("choices", [{}])[0].get("message", {}).get("content", "")
            
            m = re.search(r'\{[\s\S]*\}', content)
            if m:
                dados = json.loads(m.group(0))
                corrigidos = dados.get("corrigidos", [])
                if isinstance(corrigidos, list) and len(corrigidos) == len(legendas):
                    for i, txt in enumerate(corrigidos):
                        legendas[i]["text"] = str(txt).strip()
    except Exception as e:
        print(f"[!] Aviso ao corrigir legendas com OpenRouter: {e}")
    return legendas

def auto_split_video_com_whisper_e_llm(
    caminho_video: str,
    pasta_saida: str,
    prefixo: str = "auto",
    api_key_openrouter: Optional[str] = None,
    modelo_llm: str = "google/gemini-2.0-flash-exp:free"
) -> Dict[str, Any]:
    """
    Auto-Splitter com IA:
    1. Transcreve o áudio com faster-whisper obtendo timestamps precisos.
    2. Identifica onde termina o Gancho, o Corpo e o CTA via LLM (OpenRouter) ou análise heurística de fala.
    3. Fatia com precisão de keyframes em 3 arquivos MP4 (Gancho, Corpo, CTA).
    """
    os.makedirs(pasta_saida, exist_ok=True)
    duracao_total = obter_duracao_video(caminho_video)
    if duracao_total <= 3.0:
        raise ValueError(f"Vídeo muito curto para fatiar em 3 partes ({duracao_total:.1f}s)")

    # 1. Transcreve áudio com faster-whisper
    legendas = extrair_legendas_whisper(caminho_video)
    
    gancho_fim = 4.0
    corpo_fim = max(gancho_fim + 2.0, duracao_total * 0.8)
    cta_fim = duracao_total
    
    # 2. Identificação de timestamps via OpenRouter LLM se houver API key e legendas
    if api_key_openrouter and legendas:
        transcricao_formatada = "\n".join([
            f"[{leg['start']:.2f}s -> {leg['end']:.2f}s]: {leg['text']}" for leg in legendas
        ])
        
        prompt = (
            f"Você é um editor sênior de anúncios virais para TikTok Shop. O vídeo tem duração total de {duracao_total:.1f} segundos.\n"
            "Analise a transcrição com timestamps abaixo e encontre os momentos EXATOS de corte em 3 partes:\n"
            "1. Gancho (Hook): Os primeiros 3 a 6 segundos que capturam a atenção e apresentam o problema/choque.\n"
            "2. Corpo (Body): A demonstração do produto, benefícios e prova social.\n"
            "3. Chamada para Ação (CTA): O fechamento convidando para comprar ou clicar no carrinho.\n\n"
            f"Transcrição:\n{transcricao_formatada}\n\n"
            "Retorne APENAS um JSON no formato estrito:\n"
            "{\n"
            "  \"gancho_fim\": float (segundos onde termina o gancho, ex: 4.2),\n"
            "  \"corpo_fim\": float (segundos onde termina o corpo e começa o CTA, ex: 18.5),\n"
            "  \"resumo_gancho\": \"...\",\n"
            "  \"resumo_corpo\": \"...\",\n"
            "  \"resumo_cta\": \"...\"\n"
            "}"
        )
        
        try:
            req_data = json.dumps({
                "model": modelo_llm or "google/gemini-2.0-flash-exp:free",
                "messages": [{"role": "user", "content": prompt}],
                "temperature": 0.2
            }).encode("utf-8")
            
            req = urllib.request.Request(
                "https://openrouter.ai/api/v1/chat/completions",
                data=req_data,
                headers={
                    "Authorization": f"Bearer {api_key_openrouter.strip()}",
                    "Content-Type": "application/json",
                    "HTTP-Referer": "http://localhost:5050",
                    "X-Title": "Clip27 Auto-Splitter"
                }
            )
            with urllib.request.urlopen(req, timeout=15) as resp:
                res_data = json.loads(resp.read().decode("utf-8"))
                content = res_data.get("choices", [{}])[0].get("message", {}).get("content", "")
                m = re.search(r'\{[\s\S]*\}', content)
                if m:
                    parsed = json.loads(m.group(0))
                    g_fim = float(parsed.get("gancho_fim", 4.0))
                    c_fim = float(parsed.get("corpo_fim", duracao_total * 0.8))
                    if 1.5 < g_fim < duracao_total - 2.0 and g_fim < c_fim < duracao_total:
                        gancho_fim = round(g_fim, 2)
                        corpo_fim = round(c_fim, 2)
        except Exception as e:
            print(f"[!] Falha na identificação semântica com OpenRouter: {e}. Usando corte inteligente.")
            
    # Fallback inteligente se a LLM não estiver disponível
    if gancho_fim >= corpo_fim or corpo_fim >= duracao_total:
        gancho_fim = min(4.5, duracao_total * 0.25)
        corpo_fim = max(gancho_fim + 2.0, duracao_total * 0.80)

    # 3. Fatiamento preciso via FFmpeg
    caminho_gancho = os.path.join(pasta_saida, f"{prefixo}_gancho.mp4")
    caminho_corpo = os.path.join(pasta_saida, f"{prefixo}_corpo.mp4")
    caminho_cta = os.path.join(pasta_saida, f"{prefixo}_cta.mp4")

    # Comando 1: Gancho (0 até gancho_fim)
    cmd_g = [
        FFMPEG_BIN, "-y",
        "-ss", "0",
        "-to", str(gancho_fim),
        "-i", caminho_video,
        "-c:v", "libx264", "-preset", "veryfast", "-crf", "22",
        "-c:a", "aac", "-b:a", "128k",
        caminho_gancho
    ]
    subprocess.run(cmd_g, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)

    # Comando 2: Corpo (gancho_fim até corpo_fim)
    cmd_c = [
        FFMPEG_BIN, "-y",
        "-ss", str(gancho_fim),
        "-to", str(corpo_fim),
        "-i", caminho_video,
        "-c:v", "libx264", "-preset", "veryfast", "-crf", "22",
        "-c:a", "aac", "-b:a", "128k",
        caminho_corpo
    ]
    subprocess.run(cmd_c, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)

    # Comando 3: CTA (corpo_fim até final)
    cmd_cta = [
        FFMPEG_BIN, "-y",
        "-ss", str(corpo_fim),
        "-to", str(duracao_total),
        "-i", caminho_video,
        "-c:v", "libx264", "-preset", "veryfast", "-crf", "22",
        "-c:a", "aac", "-b:a", "128k",
        caminho_cta
    ]
    subprocess.run(cmd_cta, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)

    return {
        "sucesso": True,
        "duracao_total": duracao_total,
        "gancho": {
            "arquivo": caminho_gancho,
            "inicio": 0.0,
            "fim": gancho_fim,
            "duracao": round(gancho_fim, 1)
        },
        "corpo": {
            "arquivo": caminho_corpo,
            "inicio": gancho_fim,
            "fim": corpo_fim,
            "duracao": round(corpo_fim - gancho_fim, 1)
        },
        "cta": {
            "arquivo": caminho_cta,
            "inicio": corpo_fim,
            "fim": duracao_total,
            "duracao": round(duracao_total - corpo_fim, 1)
        },
        "legendas_detectadas": legendas
    }

def gerar_27_videos(
    ganchos: List[str], 
    corpos: List[str], 
    ctas: List[str], 
    manchetes: Optional[List[str]] = None,
    pasta_saida: str = "saida_combinacoes",
    micro_edits: bool = True,
    espelhar: bool = False,
    estilo_legenda: Optional[str] = None,
    api_key_openrouter: Optional[str] = None,
    modelo_llm: str = "google/gemini-2.0-flash-exp:free",
    largura: int = 1080,
    altura: int = 1920,
    fps: int = 30,
    on_progresso: Optional[Callable[[int, int, str], None]] = None
) -> List[str]:
    """
    Motor Combinatório Cartesiano:
    3 Ganchos x 3 Corpos x 3 CTAs = 27 vídeos exclusivos com micro-edits, áudio perfeito e legendas automáticas.
    """
    os.makedirs(pasta_saida, exist_ok=True)
    manchetes = manchetes or []
    
    # Validações dos clipes
    for i, g in enumerate(ganchos, 1):
        if not os.path.exists(g):
            raise FileNotFoundError(f"Gancho G{i} não encontrado: {g}")
    for i, c in enumerate(corpos, 1):
        if not os.path.exists(c):
            raise FileNotFoundError(f"Corpo C{i} não encontrado: {c}")
    for i, cta in enumerate(ctas, 1):
        if not os.path.exists(cta):
            raise FileNotFoundError(f"CTA{i} não encontrado: {cta}")

    # Produto cartesiano: 3 x 3 x 3 = 27 combinações
    combinacoes = list(itertools.product(
        enumerate(ganchos, 1), 
        enumerate(corpos, 1), 
        enumerate(ctas, 1)
    ))
    
    total = len(combinacoes)
    arquivos_gerados: List[str] = []

    print(f"\n=======================================================")
    print(f"🚀 INICIANDO MOTOR FFMPEG COMBINATÓRIO - {total} VÍDEOS")
    print(f"📐 Resolução: {largura}x{altura} @ {fps}fps")
    print(f"🛡️  Micro-Edits Anti-Shadowban: {'ATIVO' if micro_edits else 'DESATIVADO'}")
    if estilo_legenda:
        print(f"💬 Legendas Estilizadas (.ass): {estilo_legenda.upper()}")
    print(f"📂 Pasta de Destino: {os.path.abspath(pasta_saida)}")
    print(f"=======================================================\n")

    # Fonte Arial do Windows como padrão para garantir compatibilidade
    caminho_fonte = "C\\\\:/Windows/Fonts/arialbd.ttf"
    tem_fonte_windows = os.path.exists("C:/Windows/Fonts/arialbd.ttf")

    for idx, ((i_g, path_g), (i_c, path_c), (i_cta, path_cta)) in enumerate(combinacoes, 1):
        nome_saida = f"g{i_g}-c{i_c}-cta{i_cta}.mp4"
        caminho_final = os.path.join(pasta_saida, nome_saida)

        # Sorteia ou seleciona uma das manchetes digitadas pelo usuário
        manchete_atual = manchetes[(idx - 1) % len(manchetes)] if manchetes else ""
        
        # Parâmetros de Micro-Edits para hash e fingerprint únicos (Anti-Duplicado TikTok)
        if micro_edits:
            zoom = round(random.uniform(1.01, 1.04), 3)       # Zoom sutil de 1% a 4%
            brilho = round(random.uniform(-0.02, 0.02), 3)    # Variação invisível de brilho
            saturacao = round(random.uniform(0.97, 1.05), 3) # Variação de cor
            velocidade = round(random.uniform(0.98, 1.03), 3) # Muda duração total dos frames
            # Espelhamento sutil aleatório (apenas em parte dos vídeos se permitido)
            flip_filter = ",hflip" if (espelhar and random.random() < 0.25) else ""
        else:
            zoom, brilho, saturacao, velocidade = 1.0, 0.0, 1.0, 1.0
            flip_filter = ""

        # Filtro de Manchete Estilo TikTok no Topo
        filtro_manchete = ""
        if manchete_atual:
            txt_escapado = escapar_texto_drawtext(manchete_atual)
            font_param = f":fontfile='{caminho_fonte}'" if tem_fonte_windows else ""
            filtro_manchete = (
                f",drawtext=text='{txt_escapado}'{font_param}:fontcolor=black:fontsize=52:"
                f"box=1:boxcolor=white@1:boxborderw=20:"
                f"x=(w-text_w)/2:y=180"
            )

        # Trata áudio caso algum clipe seja mudo
        has_a0 = tem_faixa_audio(path_g)
        has_a1 = tem_faixa_audio(path_c)
        has_a2 = tem_faixa_audio(path_cta)

        prep_audio = ""
        a0 = "[0:a]" if has_a0 else "[a_sil0]"
        a1 = "[1:a]" if has_a1 else "[a_sil1]"
        a2 = "[2:a]" if has_a2 else "[a_sil2]"

        if not has_a0:
            prep_audio += "anullsrc=r=48000:cl=stereo[a_sil0];"
        if not has_a1:
            prep_audio += "anullsrc=r=48000:cl=stereo[a_sil1];"
        if not has_a2:
            prep_audio += "anullsrc=r=48000:cl=stereo[a_sil2];"

        filter_complex = (
            f"{prep_audio}"
            f"[0:v]scale={largura}:{altura}:force_original_aspect_ratio=increase,crop={largura}:{altura},setsar=1,fps={fps}[v0];"
            f"[1:v]scale={largura}:{altura}:force_original_aspect_ratio=increase,crop={largura}:{altura},setsar=1,fps={fps}[v1];"
            f"[2:v]scale={largura}:{altura}:force_original_aspect_ratio=increase,crop={largura}:{altura},setsar=1,fps={fps}[v2];"
            f"[v0]{a0}[v1]{a1}[v2]{a2}concat=n=3:v=1:a=1[vcat][acat];"
            f"[vcat]scale=iw*{zoom}:ih*{zoom},crop={largura}:{altura},"
            f"eq=brightness={brilho}:saturation={saturacao},"
            f"setpts={1/velocidade}*PTS{flip_filter}{filtro_manchete}[vout];"
            f"[acat]atempo={velocidade}[aout]"
        )

        cmd = [
            FFMPEG_BIN, "-y",
            "-i", path_g,
            "-i", path_c,
            "-i", path_cta,
            "-filter_complex", filter_complex,
            "-map", "[vout]",
            "-map", "[aout]",
            "-map_metadata", "-1",       # Remove metadados originais (Código Limpo)
            "-c:v", "libx264", "-preset", "veryfast", "-crf", "23",
            "-c:a", "aac", "-b:a", "128k",
            caminho_final
        ]

        print(f"[{idx}/{total}] Renderizando: {nome_saida} (G{i_g} + C{i_c} + CTA{i_cta})...")
        res = subprocess.run(cmd, stdout=subprocess.DEVNULL, stderr=subprocess.PIPE, text=True)
        
        if res.returncode != 0:
            print(f"[!] Erro ao gerar {nome_saida}:\n{res.stderr[-300:]}")
        else:
            arquivos_gerados.append(caminho_final)
            print(f"  ✓ Concluído: {nome_saida}")

        if on_progresso:
            on_progresso(idx, total, nome_saida)

    print(f"\n🎉 Sucesso! {len(arquivos_gerados)} de {total} vídeos gerados na pasta '{pasta_saida}'.\n")
    return arquivos_gerados


if __name__ == "__main__":
    import argparse
    parser = argparse.ArgumentParser(description="Motor FFmpeg Clip27 - 27 Vídeos Combinados")
    parser.add_argument("--ganchos", nargs=3, help="Caminho para os 3 vídeos de gancho")
    parser.add_argument("--corpos", nargs=3, help="Caminho para os 3 vídeos de corpo")
    parser.add_argument("--ctas", nargs=3, help="Caminho para os 3 vídeos de CTA")
    parser.add_argument("--manchetes", nargs="*", default=[], help="Lista de manchetes CTR")
    parser.add_argument("--saida", default="saida_combinacoes", help="Pasta de saída")
    parser.add_argument("--sem-micro-edits", action="store_true", help="Desativa micro-edits anti-shadowban")

    args = parser.parse_args()

    if args.ganchos and args.corpos and args.ctas:
        gerar_27_videos(
            ganchos=args.ganchos,
            corpos=args.corpos,
            ctas=args.ctas,
            manchetes=args.manchetes,
            pasta_saida=args.saida,
            micro_edits=not args.sem_micro_edits
        )
    else:
        print("Uso CLI: python motor_ffmpeg.py --ganchos g1.mp4 g2.mp4 g3.mp4 --corpos c1.mp4 c2.mp4 c3.mp4 --ctas cta1.mp4 cta2.mp4 cta3.mp4")
