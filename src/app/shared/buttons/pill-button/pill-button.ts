import { Component, Input } from '@angular/core';

@Component({
  selector: 'app-pill-button',
  imports: [],
  templateUrl: './pill-button.html',
  styleUrl: './pill-button.scss',
})
export class PillButton {
  @Input() label = 'Pill button';
}
