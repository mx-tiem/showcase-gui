import { Component, Input } from '@angular/core';

@Component({
  selector: 'app-alarm-button',
  imports: [],
  templateUrl: './alarm-button.html',
  styleUrl: './alarm-button.scss',
})
export class AlarmButton {
  @Input() label = 'Download';
}
