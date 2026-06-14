import { Component, Input } from '@angular/core';

@Component({
  selector: 'app-transform-button',
  imports: [],
  templateUrl: './transform-button.html',
  styleUrl: './transform-button.scss',
})
export class TransformButton {
  @Input() label = 'Button';
}
