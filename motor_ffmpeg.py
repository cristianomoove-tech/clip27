"""
Clip27 IA - Motor Combinatório e Renderizador de Vídeos com FFmpeg Nativo
========================================================================
- Concatenação precisa e sem travamentos via FFmpeg (3x3x3 = 27 variações)
- Micro-Edits Anti-Duplicado e Anti-Shadowban (Zoom, Brilho, Saturação, Velocidade/PTS)
- Queima de Manchete de Alto CTR estilo TikTok (drawtext com caixa branca e tipografia preta)
- Integração com faster-whisper para legendas automáticas de alta velocidade
- Limpeza de metadados (-map_metadata -1) e renderização H.264 + AAC
"""

import os
import sys
import glob
import json
import random
import itertools
import subprocess
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
    # Escapa barras invertidas, dois pontos, apóstrofos e porcentagens
    t = texto.replace("\\", "\\\\")
    t = t.replace(":", "\\:")
    t = t.replace("'", "'\\''")
    t = t.replace("%", "\\%")
    return t

def extrair_legendas_whisper(caminho_audio_ou_video: str, model_size: str = "base") -> List[Dict[str, Any]]:
    """Gera legendas automáticas usando faster-whisper."""
    try:
        from faster_whisper import WhisperModel
        print(f"[*] Inicializando faster-whisper ({model_size}) para transcrição...")
        # Usa CPU com computação INT8 (rápido e leve em qualquer máquina)
        model = WhisperModel(model_size, device="cpu", compute_type="int8")
        segments, _ = model.transcribe(caminho_audio_ou_video, language="pt")
        
        legendas = []
        for segment in segments:
            legendas.append({
                "start": segment.start,
                "end": segment.end,
                "text": segment.text.strip()
            })
        return legendas
    except ImportError:
        print("[!] faster-whisper não está instalado. Pulando geração automática de legendas.")
        return []
    except Exception as e:
        print(f"[!] Erro ao transcrever com faster-whisper: {e}")
        return []

def gerar_27_videos(
    ganchos: List[str], 
    corpos: List[str], 
    ctas: List[str], 
    manchetes: Optional[List[str]] = None,
    pasta_saida: str = "saida_combinacoes",
    micro_edits: bool = True,
    largura: int = 1080,
    altura: int = 1920,
    fps: int = 30,
    on_progresso: Optional[Callable[[int, int, str], None]] = None
) -> List[str]:
    """
    Motor Combinatório Cartesiano:
    3 Ganchos x 3 Corpos x 3 CTAs = 27 vídeos exclusivos com micro-edits e áudio perfeito.
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
        else:
            zoom, brilho, saturacao, velocidade = 1.0, 0.0, 1.0, 1.0

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
            f"setpts={1/velocidade}*PTS{filtro_manchete}[vout];"
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
