import { Component, Input } from '@angular/core';

@Component({
  selector: 'app-circle-fill-button',
  imports: [],
  templateUrl: './circle-fill-button.html',
  styleUrl: './circle-fill-button.scss',
})
export class CircleFillButton {
  @Input() label = 'Hover Me!';
}
