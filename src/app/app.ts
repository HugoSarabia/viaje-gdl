import { ChangeDetectorRef, Component, ElementRef, NgZone, OnInit, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TerminalComponent } from './components/terminal/terminal.component';
import { AudioService } from './services/audio.service';

type Pane = { x: number; y: number; w: number; h: number; label?: string };

@Component({
  selector: 'app-root',
  imports: [CommonModule, FormsModule, TerminalComponent],
  templateUrl: './app.html',
  styleUrl: './app.scss',
})
export class App implements OnInit {
  debug = false;

  // 🎵 Propiedades para el control de audio
  showAudioControls = true;
  audioInitialized = false;

  viewBox = { w: 1912, h: 955 }; // ← Usar las dimensiones reales desde el inicio

  // 🔧 Dimensiones reales de la imagen (mantenemos la referencia)
  imageSize = { w: 1912, h: 955 };

  // 🔧 Flag para controlar cuando la imagen está completamente cargada
  imageLoaded = false;

  // 🔧 Factor de escala para ajustar coordenadas
  get scaleX() {
    return this.viewBox.w / this.imageSize.w;
  }
  get scaleY() {
    return this.viewBox.h / this.imageSize.h;
  }
  get scale() {
    return Math.max(this.scaleX, this.scaleY);
  }

  // 🔧 Coordenadas originales CORREGIDAS y con labels únicos
  originalPanes: Pane[] = [
    // Fila superior de ventanas
    { x: 65, y: 300, w: 101, h: 86, label: 'V1' },
    { x: 180, y: 300, w: 154, h: 86, label: 'V2' },
    { x: 349, y: 300, w: 158, h: 86, label: 'V3' },
    { x: 520, y: 300, w: 164, h: 86, label: 'V4' },
    { x: 697, y: 300, w: 158, h: 86, label: 'V5' },
    { x: 869, y: 300, w: 152, h: 86, label: 'V6' },
    { x: 1035, y: 300, w: 16, h: 86, label: 'V7' },
    { x: 1108, y: 300, w: 139, h: 86, label: 'V8' },

    // Ventanas grandes inferiores
    { x: 65, y: 402, w: 102, h: 235, label: 'G1' },
    { x: 182, y: 402, w: 152, h: 235, label: 'G2' },
    { x: 348, y: 402, w: 158, h: 235, label: 'G3' },

    // Ventanas pequeñas del centro (corregidas)
    { x: 520, y: 402, w: 15, h: 62, label: 'P1' },
    { x: 520, y: 402, w: 30, h: 14, label: 'P2' }, // Ajustada Y para evitar solapamiento
    { x: 557, y: 402, w: 95, h: 14, label: 'P3' },
    { x: 660, y: 402, w: 25, h: 14, label: 'P4' },
    { x: 673, y: 402, w: 11, h: 62, label: 'P5' },

    // Ventanas grandes derechas (labels corregidos)
    { x: 520, y: 480, w: 177, h: 235, label: 'G4' },
    { x: 696, y: 402, w: 160, h: 235, label: 'G5' },
    { x: 869, y: 402, w: 155, h: 235, label: 'G6' },
    { x: 1035, y: 402, w: 16, h: 235, label: 'G7' },
    { x: 1108, y: 402, w: 140, h: 235, label: 'G8' },
    { x: 1261, y: 402, w: 42, h: 235, label: 'G9' },
  ];

  // 🔧 Coordenadas escaladas dinámicamente (mejorada)
  get panes(): Pane[] {
    if (!this.imageLoaded) {
      // Mientras la imagen no esté cargada, usar las coordenadas originales
      return this.originalPanes;
    }

    const offsetX = (this.viewBox.w - this.imageSize.w * this.scale) / 2;
    const offsetY = (this.viewBox.h - this.imageSize.h * this.scale) / 2;

    return this.originalPanes.map((pane) => ({
      x: pane.x * this.scale + offsetX,
      y: pane.y * this.scale + offsetY,
      w: pane.w * this.scale,
      h: pane.h * this.scale,
      label: pane.label,
    }));
  }

  airportImg = 'assets/img/Airport.png';
  planeImg = 'assets/img/plane2.png';
  planeImg2 = 'assets/img/plane3.png';
  planeImg3 = 'assets/img/plane4.png';

  backgroundMusic = 'assets/audio/music.mp3';

  @ViewChild('svgEl', { static: true }) svgEl!: ElementRef<SVGSVGElement>;
  @ViewChild(TerminalComponent) terminalComponent!: TerminalComponent;

  constructor(
    private cdr: ChangeDetectorRef,
    private ngZone: NgZone,
    public audioService: AudioService // 🎵 Inyectar servicio de audio
  ) {}

  ngOnInit() {
    // 🔧 MEJORADO: Carga de imagen con callback que actualiza el estado
    this.loadImageAndUpdateDimensions();
    // 🎵 Inicializar audio después de un pequeño delay
    setTimeout(() => {
      this.initializeAudio();
    }, 1000);
  }

  ngAfterViewInit() {
    // Dar tiempo para que el DOM se estabilice antes de observar cambios
    setTimeout(() => {
      this.setupResizeObserver();
    }, 100);
  }

  // 🎵 Método para inicializar el audio
  private async initializeAudio() {
    try {
      await this.audioService.loadAndPlay(this.backgroundMusic, {
        loop: true,
        volume: 0.3, // Volumen bajo para no ser molesto
        autoplay: true,
      });

      // Fade in suave al iniciar
      await this.audioService.fadeIn(2000);

      this.audioService.isPlaying.set(true);
      this.audioInitialized = true;
      console.log('🎵 Audio inicializado correctamente');
    } catch (error) {
      console.error('❌ Error inicializando audio:', error);
      // La app continúa funcionando sin audio
    }
  }

  // 🎵 Controles públicos para el audio
  toggleAudio() {
    if (this.audioService.isPlaying()) {
      this.audioService.pause();
    } else {
      this.audioService.play();
    }
  }

  async muteAudio() {
    if (this.audioService.volume() > 0) {
      await this.audioService.fadeOut(500);
    }
  }

  async unMuteAudio() {
    if (this.audioService.volume() === 0) {
      this.audioService.setVolume(0.3);
      await this.audioService.fadeIn(500);
    }
  }

  toggleMute() {
    if (this.audioService.volume() === 0) {
      this.unMuteAudio().then(() => {
        // Opcional: Asegurar que el audio se reproduce al desmutear
        this.audioService.play();
      });
    } else {
      this.muteAudio().then(() => {
        // Opcional: Asegurar que el audio se pausa al mutear
        this.audioService.pause();
      });
    }
  }

  setVolume(event: Event) {
    const target = event.target as HTMLInputElement;
    const volume = parseFloat(target.value);
    this.audioService.setVolume(volume);
  }

  // 🎵 Formatear tiempo para mostrar en controles
  formatTime(seconds: number): string {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  }

  // 🔧 NUEVO: Método separado para cargar imagen
  private loadImageAndUpdateDimensions() {
    const img = new Image();
    img.src = this.airportImg;

    img.onload = () => {
      this.ngZone.run(() => {
        this.imageSize = {
          w: img.naturalWidth,
          h: img.naturalHeight,
        };

        // Actualizar viewBox inicial con las dimensiones reales
        this.viewBox = { ...this.imageSize };
        this.imageLoaded = true;

        console.log('✅ Imagen cargada. Dimensiones:', this.imageSize);
        this.cdr.detectChanges();
      });
    };

    img.onerror = () => {
      console.error('❌ Error cargando imagen:', this.airportImg);
      // Mantener dimensiones por defecto si falla la carga
      this.imageLoaded = true;
    };
  }

  // 🔧 SEPARADO: Configuración del ResizeObserver
  private setupResizeObserver() {
    this.ngZone.runOutsideAngular(() => {
      const resizeObserver = new ResizeObserver((entries) => {
        for (let entry of entries) {
          const { width, height } = entry.contentRect;

          // Solo actualizar si la imagen ya está cargada
          if (this.imageLoaded) {
            this.debounceViewBoxUpdate(width, height);
          }
        }
      });

      if (this.svgEl?.nativeElement?.parentElement) {
        resizeObserver.observe(this.svgEl.nativeElement.parentElement);
      }
    });
  }

  // 🔧 Debounce mejorado con verificación de cambios significativos
  private viewBoxUpdateTimeout?: number;

  private debounceViewBoxUpdate(width: number, height: number) {
    // Solo actualizar si hay un cambio significativo (más de 5px)
    if (Math.abs(this.viewBox.w - width) < 5 && Math.abs(this.viewBox.h - height) < 5) {
      return;
    }

    if (this.viewBoxUpdateTimeout) {
      clearTimeout(this.viewBoxUpdateTimeout);
    }

    this.viewBoxUpdateTimeout = window.setTimeout(() => {
      this.ngZone.run(() => {
        this.viewBox = { w: width, h: height };
        this.cdr.detectChanges();
        console.log('📐 ViewBox actualizado:', this.viewBox);
      });
    }, 16); // ~60fps
  }

  // 🔧 Método para debug - mostrar información de coordenadas
  debugCoordinates() {
    console.log('🔍 Debug Info:');
    console.log('ViewBox:', this.viewBox);
    console.log('Image Size:', this.imageSize);
    console.log('Scale:', this.scale);
    console.log('Panes (primeros 3):', this.panes.slice(0, 3));
  }

  ngOnDestroy() {
    if (this.viewBoxUpdateTimeout) {
      clearTimeout(this.viewBoxUpdateTimeout);
    }
    // 🎵 Limpiar audio al destruir el componente
    this.audioService.destroy();
  }
}
