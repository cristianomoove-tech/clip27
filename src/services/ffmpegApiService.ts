/**
 * Clip27 - Serviço de Conexão com o Motor FFmpeg Nativo Local
 * ============================================================
 * Conecta o frontend React ao servidor Python/FFmpeg local (http://localhost:5050)
 * para renderização de alta performance, sem travamento de navegador e com áudio 100% perfeito.
 */

export interface FFmpegServerStatus {
  online: boolean;
  motor?: string;
  ffmpeg_instalado?: boolean;
  faster_whisper_instalado?: boolean;
  versao?: string;
  pasta_saida?: string;
}

export interface FFmpegRenderProgress {
  rodando: boolean;
  progresso_percent: number;
  video_atual: string;
  indice_atual: number;
  total_videos: number;
  status_texto: string;
  concluido: boolean;
  erro?: string | null;
  arquivos_gerados: string[];
}

const SERVER_URL = 'http://127.0.0.1:5050';

/**
 * Verifica se o servidor local do FFmpeg está em execução
 */
export async function checkFFmpegServerHealth(): Promise<FFmpegServerStatus> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 2000);

    const res = await fetch(`${SERVER_URL}/health`, {
      method: 'GET',
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    if (res.ok) {
      const data = await res.json();
      return {
        online: true,
        motor: data.motor,
        ffmpeg_instalado: data.ffmpeg_instalado,
        faster_whisper_instalado: data.faster_whisper_instalado,
        versao: data.versao,
        pasta_saida: data.pasta_saida,
      };
    }
    return { online: false };
  } catch {
    return { online: false };
  }
}

/**
 * Envia um arquivo de vídeo individual para um slot específico no backend
 * @param file Arquivo File do navegador
 * @param tipo 'gancho' | 'corpo' | 'cta'
 * @param slot 1 | 2 | 3
 */
export async function uploadClipToFFmpegServer(
  file: File,
  tipo: 'gancho' | 'corpo' | 'cta',
  slot: 1 | 2 | 3
): Promise<boolean> {
  try {
    const buffer = await file.arrayBuffer();
    const res = await fetch(`${SERVER_URL}/api/upload-clip?tipo=${tipo}&slot=${slot}`, {
      method: 'POST',
      headers: {
        'Content-Type': file.type || 'video/mp4',
      },
      body: buffer,
    });
    return res.ok;
  } catch (err) {
    console.error(`[FFmpegApi] Erro ao enviar clipe ${tipo}_${slot}:`, err);
    return false;
  }
}

/**
 * Dispara a renderização dos 27 vídeos no servidor FFmpeg
 */
export async function triggerFFmpegBatchRender(options?: {
  resolucao?: '720p' | '1080p';
  fps?: number;
  micro_edits?: boolean;
  manchetes?: string[];
}): Promise<{ sucesso: boolean; mensagem?: string; erro?: string }> {
  try {
    const res = await fetch(`${SERVER_URL}/api/gerar-27`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        resolucao: options?.resolucao || '720p',
        fps: options?.fps || 30,
        micro_edits: options?.micro_edits !== false,
        manchetes: options?.manchetes || [],
      }),
    });

    const data = await res.json();
    if (!res.ok) {
      return { sucesso: false, erro: data.erro || 'Falha ao iniciar renderização' };
    }
    return { sucesso: true, mensagem: data.mensagem };
  } catch (err: any) {
    return { sucesso: false, erro: err.message || 'Erro de conexão com o servidor FFmpeg' };
  }
}

/**
 * Obtém o status e percentual da renderização em tempo real
 */
export async function pollFFmpegProgress(): Promise<FFmpegRenderProgress | null> {
  try {
    const res = await fetch(`${SERVER_URL}/api/progresso`);
    if (res.ok) {
      return await res.json();
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Retorna a URL para download direto do arquivo .ZIP com os 27 vídeos gerados
 */
export function getFFmpegZipDownloadUrl(): string {
  return `${SERVER_URL}/api/download-zip`;
}

