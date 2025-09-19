import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  NgZone,
  OnDestroy,
  signal,
  type OnInit,
} from '@angular/core';

@Component({
  selector: 'app-terminal',
  imports: [],
  templateUrl: './terminal.component.html',
  styleUrl: './terminal.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TerminalComponent implements OnInit, OnDestroy {
  public days: number = 0;
  public hours: number = 0;
  public minutes: number = 0;
  public seconds: number = 0;
  public timeToTravelValue = 0;

  private messages = [
    'PRÓXIMO VIAJE: ¡GUADALAJARA, JALISCO!',
    `FALTAN: ${this.days} DÍAS, ${this.hours} HORAS, ${this.minutes} MINUTOS Y ${this.seconds} SEGUNDOS`,
    'GUNGINGANGIN',
  ];

  scrollPosition = signal(0);
  currentMessage = signal('');
  currentTime = signal('');
  isAnimating = signal(true);
  display = signal('block');

  private currentMessageIndex = 0;
  private animationId?: number;
  private timeIntervalId?: number;
  private containerWidth = 510;
  private textWidth = 0;
  private scrollSpeed = 2;
  private pauseTime = 1000; // Tiempo que el texto permanece oculto
  private isPaused = false;
  private pauseStart = 0;

  private fechaViaje = new Date('2025-10-13T12:00:00'); // Fecha y hora del viaje

  constructor(private cdr: ChangeDetectorRef, private ngZone: NgZone) {}

  ngOnInit() {
    // Ejecutar la actualización del tiempo fuera de Angular Zone
    this.ngZone.runOutsideAngular(() => {
      this.loadNextMessage();
      this.updateTime();
      this.timeIntervalId = window.setInterval(() => {
        this.ngZone.run(() => {
          this.updateTime();
        });
      }, 1000);
    });
  }
  ngAfterViewInit() {
    // Diferir el inicio de la animación
    setTimeout(() => {
      this.startScrolling();
    }, 0);
  }
  ngOnDestroy() {
    if (this.animationId) {
      cancelAnimationFrame(this.animationId);
    }
    if (this.timeIntervalId) {
      clearInterval(this.timeIntervalId);
    }
  }

  timeToTravel() {
    const now = new Date();
    this.timeToTravelValue = this.fechaViaje.getTime() - now.getTime();
  }
  get daysToTravel() {
    return Math.floor(this.timeToTravelValue / (1000 * 60 * 60 * 24));
  }
  get hoursToTravel() {
    return Math.floor((this.timeToTravelValue / (1000 * 60 * 60)) % 24);
  }
  get minutesToTravel() {
    return Math.floor((this.timeToTravelValue / (1000 * 60)) % 60);
  }
  get secondsToTravel() {
    return Math.floor((this.timeToTravelValue / 1000) % 60);
  }

  private updateTime() {
    const now = new Date();
    this.currentTime.set(
      now.toLocaleTimeString('es-MX', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      })
    );
    this.timeToTravel();
    this.days = this.daysToTravel;
    this.hours = this.hoursToTravel;
    this.minutes = this.minutesToTravel;
    this.seconds = this.secondsToTravel;
    // Actualizar el mensaje con el tiempo restante
    this.updateDateMessage(this.days, this.hours, this.minutes, this.seconds);
    this.cdr.markForCheck();
  }

  // 🔧 Método público mejorado para actualizaciones externas
  updateDateMessage(day: number, hour: number, minute: number, second: number) {
    // Usar NgZone para asegurar que la actualización sea controlada
    this.ngZone.run(() => {
      if (day === 0 && hour === 0 && minute === 0 && second === 0) {
        this.updateMessageSafely('¡EL VIAJE ES HOY!');
        return;
      }

      if (day < 0 || hour < 0 || minute < 0 || second < 0) {
        this.updateMessageSafely('¡YA ESTAMOS EN GUADALAJARA!');
        return;
      }

      const message = this.buildTimeMessage(day, hour, minute, second);
      this.messages[1] = message; // Actualizar el mensaje en el array
      this.cdr.markForCheck();
    });
  }

  private updateMessageSafely(message: string) {
    // Actualizar el array de mensajes de forma segura
    this.messages[0] = message;

    // Si estamos mostrando el primer mensaje, actualizarlo inmediatamente
    if (this.currentMessageIndex === 1 || this.messages.length === 1) {
      this.currentMessage.set(message);
    }

    this.cdr.markForCheck();
  }

  private buildTimeMessage(day: number, hour: number, minute: number, second: number): string {
    // Helper para pluralización
    const pluralize = (value: number, singular: string, plural: string): string =>
      value === 1 ? singular : plural;

    // Obtener las formas correctas de cada unidad
    const dayText = pluralize(day, 'DÍA', 'DÍAS');
    const hourText = pluralize(hour, 'HORA', 'HORAS');
    const minuteText = pluralize(minute, 'MINUTO', 'MINUTOS');
    const secondText = pluralize(second, 'SEGUNDO', 'SEGUNDOS');

    // Determinar el verbo inicial basado en si hay exactamente 1 día
    const verb = day === 1 ? 'FALTA' : 'FALTAN';

    // Construir el mensaje
    return `${verb}: ${day} ${dayText}, ${hour} ${hourText}, ${minute} ${minuteText} Y ${second} ${secondText}`;
  }

  private loadNextMessage() {
    // Cambiar al siguiente mensaje
    this.currentMessage.set(this.messages[this.currentMessageIndex]);
    this.currentMessageIndex = (this.currentMessageIndex + 1) % this.messages.length;

    // Calcular ancho aproximado del texto
    this.textWidth = this.currentMessage().length * 45;
    // Posicionar el texto fuera del contenedor (derecha)
    this.scrollPosition.set(this.containerWidth);

    // Resetear estados
    this.isPaused = false;
    this.display.set('block'); // Mostrar el texto cuando carga el nuevo mensaje
    this.isAnimating.set(true);
    this.cdr.markForCheck();
  }

  private startScrolling() {
    const animate = (timestamp: number) => {
      if (this.isPaused) {
        // Durante la pausa, mantener el texto oculto
        if (timestamp - this.pauseStart > this.pauseTime) {
          // Fin de la pausa, cargar siguiente mensaje
          this.loadNextMessage();
        }
      } else {
        // Mover el texto hacia la izquierda
        this.scrollPosition.update((pos) => pos - this.scrollSpeed);

        // Verificar si el texto ha salido completamente por la izquierda
        if (this.scrollPosition() <= -this.textWidth) {
          // Iniciar pausa
          this.isPaused = true;
          this.pauseStart = timestamp;
          this.display.set('none'); // Ocultar el texto durante la pausa
          this.isAnimating.set(false);
          this.cdr.markForCheck();
        }
      }

      this.animationId = requestAnimationFrame(animate);
    };

    this.animationId = requestAnimationFrame(animate);
  }

  private setInterval(callback: () => void, ms: number): number {
    return window.setInterval(callback, ms);
  }
}
