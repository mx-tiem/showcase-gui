import { Component, HostBinding, Input } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-square-button',
  imports: [CommonModule],
  templateUrl: './square-button.html',
  styleUrl: './square-button.scss',
})
export class SquareButton {
  @Input() label = 'NEXT';
  @Input() reverse = false;
  @Input() disabled = false;

  @HostBinding('class.reversed') get isReversed() { return this.reverse; }
  @HostBinding('class.is-disabled') get isDisabled() { return this.disabled; }
}
