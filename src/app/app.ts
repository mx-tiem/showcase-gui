import { Component, signal, OnInit } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { Navbar } from "./navbar/navbar/navbar";
import { LoginService } from './login/login.service';
import { ThemeService } from './shared/theme.service';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, Navbar],
  templateUrl: './app.html',
  styleUrl: './app.scss'
})
export class App implements OnInit {
  protected readonly title = signal('dojo-gui');

  constructor(
    private loginService: LoginService,
    private themeService: ThemeService
  ) {}

  ngOnInit() {
    this.loginService.setCurrentUser();
  }
}
