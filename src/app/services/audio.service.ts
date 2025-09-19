import { Injectable, signal } from '@angular/core';

@Injectable({
  providedIn: 'root'
})
export class AudioService {
  private audio: HTMLAudioElement | null = null;
  private audioContext: AudioContext | null = null;

  // Signals para el estado del audio
  public isPlaying = signal(false);
  volume = signal(0.5);
  currentTime = signal(0);
  duration = signal(0);
  isLoaded = signal(false);
  isMuted = signal(false);

  constructor() {
    // Inicializar AudioContext (mejor para el control de audio)
    this.initAudioContext();
  }

  private initAudioContext() {
    try {
      this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    } catch (error) {
      console.warn('AudioContext no soportado:', error);
    }
  }

  // 🎵 Método principal para cargar y reproducir música
  async loadAndPlay(audioSrc: string, options: AudioOptions = {}): Promise<void> {
    try {
      // Crear elemento de audio
      this.audio = new Audio(audioSrc);

      // Configurar propiedades
      this.audio.loop = options.loop ?? true;
      this.audio.volume = options.volume ?? 0.5;
      this.audio.preload = 'auto';

      // Event listeners
      this.setupAudioEvents();

      // Cargar el audio
      await this.audio.load();

      // Intentar reproducir automáticamente
      if (options.autoplay !== false) {
        await this.playWithUserInteraction();
      }

    } catch (error) {
      console.error('Error cargando audio:', error);
      throw error;
    }
  }

  private setupAudioEvents() {
    if (!this.audio) return;

    this.audio.addEventListener('loadedmetadata', () => {
      this.duration.set(this.audio?.duration ?? 0);
      this.isLoaded.set(true);
    });

    this.audio.addEventListener('timeupdate', () => {
      this.currentTime.set(this.audio?.currentTime ?? 0);
    });

    this.audio.addEventListener('play', () => {
      this.isPlaying.set(true);
    });

    this.audio.addEventListener('pause', () => {
      this.isPlaying.set(false);
    });

    this.audio.addEventListener('ended', () => {
      this.isPlaying.set(false);
    });

    this.audio.addEventListener('error', (e) => {
      console.error('Error de audio:', e);
      this.isPlaying.set(false);
    });
  }

  // 🎵 Reproducir con manejo de políticas de autoplay
  private async playWithUserInteraction(): Promise<void> {
    if (!this.audio) return;

    try {
      // Intentar reproducir directamente
      await this.audio.play();
    } catch (error: any) {
      if (error.name === 'NotAllowedError') {
        console.warn('Autoplay bloqueado. Esperando interacción del usuario...');
        this.setupUserInteractionListener();
      } else {
        console.error('Error reproduciendo audio:', error);
      }
    }
  }

  // 🎵 Configurar listener para interacción del usuario
  private setupUserInteractionListener() {
    const playOnInteraction = async () => {
      try {
        if (this.audio && this.audioContext?.state === 'suspended') {
          await this.audioContext.resume();
        }
        await this.audio?.play();

        // Remover listeners después del primer play exitoso
        document.removeEventListener('click', playOnInteraction);
        document.removeEventListener('keydown', playOnInteraction);
        document.removeEventListener('touchstart', playOnInteraction);
      } catch (error) {
        console.error('Error en interacción de usuario:', error);
      }
    };

    // Agregar listeners para diferentes tipos de interacción
    document.addEventListener('click', playOnInteraction, { once: true });
    document.addEventListener('keydown', playOnInteraction, { once: true });
    document.addEventListener('touchstart', playOnInteraction, { once: true });
  }

  // 🎵 Controles públicos
  async play(): Promise<void> {
    if (!this.audio) return;
    try {
      await this.audio.play();
    } catch (error) {
      console.error('Error reproduciendo:', error);
    }
  }

  pause(): void {
    this.audio?.pause();
  }

  stop(): void {
    if (this.audio) {
      this.audio.pause();
      this.audio.currentTime = 0;
    }
  }

  setVolume(volume: number): void {
    const clampedVolume = Math.max(0, Math.min(1, volume));
    this.volume.set(clampedVolume);
    if (this.audio) {
      this.audio.volume = clampedVolume;
    }
  }

  setCurrentTime(time: number): void {
    if (this.audio) {
      this.audio.currentTime = time;
    }
  }

  // 🎵 Fade in/out effects
  async fadeIn(duration: number = 1000): Promise<void> {
    if (!this.audio) return;

    const startVolume = 0;
    const endVolume = this.volume();
    this.audio.volume = startVolume;

    await this.play();

    return new Promise(resolve => {
      const steps = 20;
      const stepTime = duration / steps;
      const volumeStep = endVolume / steps;
      let currentStep = 0;

      const interval = setInterval(() => {
        currentStep++;
        const newVolume = startVolume + (volumeStep * currentStep);

        if (this.audio) {
          this.audio.volume = Math.min(newVolume, endVolume);
        }

        if (currentStep >= steps) {
          clearInterval(interval);
          this.isMuted.set(false);
          resolve();
        }
      }, stepTime);
    });
  }

  async fadeOut(duration: number = 1000): Promise<void> {
    if (!this.audio) return;

    const startVolume = this.audio.volume;

    return new Promise(resolve => {
      const steps = 20;
      const stepTime = duration / steps;
      const volumeStep = startVolume / steps;
      let currentStep = 0;

      const interval = setInterval(() => {
        currentStep++;
        const newVolume = startVolume - (volumeStep * currentStep);

        if (this.audio) {
          this.audio.volume = Math.max(newVolume, 0);
        }

        if (currentStep >= steps) {
          clearInterval(interval);
          this.pause();
          this.isMuted.set(true);
          resolve();
        }
      }, stepTime);
    });
  }

  // 🎵 Cleanup
  destroy(): void {
    this.stop();
    if (this.audio) {
      this.audio.remove();
      this.audio = null;
    }
    if (this.audioContext && this.audioContext.state !== 'closed') {
      this.audioContext.close();
    }
  }
}

// Interfaz para opciones de audio
interface AudioOptions {
  loop?: boolean;
  volume?: number;
  autoplay?: boolean;
}
