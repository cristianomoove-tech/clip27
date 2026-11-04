import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import { spawn } from 'child_process';
import net from 'net';

/**
 * Plugin para inicialização automática do motor nativo FFmpeg na porta 5050
 */
function autoStartMotorFFmpegPlugin() {
  return {
    name: 'auto-start-motor-ffmpeg',
    configureServer() {
      const socket = new net.Socket();
      socket.setTimeout(800);
      socket.on('connect', () => {
        socket.destroy();
        console.log('\x1b[32m[Clip27] Motor FFmpeg Nativo já está ativo na porta 5050.\x1b[0m');
      });
      socket.on('error', () => {
        socket.destroy();
        console.log('\x1b[33m[Clip27] Iniciando Motor FFmpeg Nativo automaticamente em segundo plano...\x1b[0m');
        try {
          const child = spawn('pythonw.exe', ['server_ffmpeg.py'], {
            detached: true,
            stdio: 'ignore',
            cwd: process.cwd(),
          });
          child.unref();
        } catch {
          try {
            const child = spawn('python', ['server_ffmpeg.py'], {
              detached: true,
              stdio: 'ignore',
              cwd: process.cwd(),
            });
            child.unref();
          } catch (e) {
            console.error('[Clip27] Não foi possível disparar o motor FFmpeg:', e);
          }
        }
      });
      socket.on('timeout', () => {
        socket.destroy();
      });
      socket.connect(5050, '127.0.0.1');
    },
  };
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '.', '');
  return {
    plugins: [react(), tailwindcss(), autoStartMotorFFmpegPlugin()],
    envPrefix: ['VITE_'],
    resolve: {
      alias: {
        '@': path.resolve('.'),
      },
    },
    build: {
      outDir: 'dist',
      sourcemap: false,
      chunkSizeWarningLimit: 1600,
    },
    server: {
      port: 3000,
      host: '0.0.0.0',
      hmr: process.env.DISABLE_HMR !== 'true',
    },
  };
});
