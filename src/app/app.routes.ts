import { Routes } from '@angular/router';
import { LoginComponent } from './login/login.component';
import { loginGuard } from './login/login.guard';
import { CubeView } from './user/cube-view/cube-view';
import { Notifications } from './user/notifications/notifications';
import { adminGuard } from './login/admin.guard';
import { Dashboard } from './admin/dashboard/dashboard';
import { Users } from './admin/users/users';
import { Machines } from './admin/machines/machines';
import { Reservations } from './admin/reservations/reservations';
import { Calendar } from './admin/calendar/calendar';
import { HourTransactions } from './admin/hour-transactions/hour-transactions';
import { AppSettings } from './admin/app-settings/app-settings';
import { Poc } from './admin/poc/poc';
import { Games } from './admin/games/games';
import { Prices } from './admin/prices/prices';
import { AdminNotifications } from './admin/notifications/notifications';

export const routes: Routes = [
  { path: '', redirectTo: 'home', pathMatch: 'full' },
  { path: 'login', component: LoginComponent },
  { path: 'home', component: CubeView, canActivate: [loginGuard]},
  { path: 'reservations', component: CubeView, canActivate: [loginGuard]},
  { path: 'reservations/new', component: CubeView, canActivate: [loginGuard]},
  { path: 'events', component: CubeView, canActivate: [loginGuard]},
  { path: 'friends', component: CubeView, canActivate: [loginGuard]},
  { path: 'hours', component: CubeView, canActivate: [loginGuard]},
  { path: 'settings', component: CubeView, canActivate: [loginGuard]},
  { path: 'notifications', component: Notifications, canActivate: [loginGuard]},
  { path: 'poc', component: Poc, canActivate: [adminGuard]},
  { path: 'admin', canActivate: [adminGuard], children: [
    { path: '', redirectTo: 'dashboard', pathMatch: 'full' },
    { path: 'dashboard', component: Dashboard },
    { path: 'users', component: Users },
    { path: 'machines', component: Machines },
    { path: 'reservations', component: Reservations },
    { path: 'calendar', component: Calendar },
    { path: 'hour-transactions', component: HourTransactions },
    { path: 'app-settings', component: AppSettings },
    { path: 'games', component: Games },
    { path: 'prices', component: Prices },
    { path: 'notifications', component: AdminNotifications },
  ]}
];