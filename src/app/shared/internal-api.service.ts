import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class InternalApiService {

  auth: {
    login: (email: string, password: string) => Observable<any>
    logout: (token: string) => Observable<any>
  }

  user: {
    currentUser: (token: string) => Observable<any>,
    updateCurrentUser: (token: string, userData: any) => Observable<any>,
    homepageData: (token: string) => Observable<any>,
    friends: {
      searchUsers: (token: string, searchQuery: string, params?: any) => Observable<any>
      getFriends: (token: string) => Observable<any>
      addFriend: (token: string, friendId: number) => Observable<any>
      removeFriend: (token: string, friendId: number) => Observable<any>
    },
    reservations: {
      myReservations: (token: string, params?: any) => Observable<any>
      activeReservations: (token: string) => Observable<any>
      checkAvailability: (token: string, userIds: number[], startDate: string, startTime: string, duration: number) => Observable<any>
      createReservation: (token: string, reservationData: any) => Observable<any>
      cancelReservation: (token: string, reservationId: number) => Observable<any>
      getMaxExtend: (token: string, reservationId: number) => Observable<any>
      extendReservation: (token: string, reservationId: number, extendHours: number) => Observable<any>
    },
    appSettings: (token: string) => Observable<any>
    machines: {
      getMachines: (token: string) => Observable<any>
    }
    notifications: {
      getDropdown: (token: string) => Observable<any>
      getAll: (token: string, params?: any) => Observable<any>
      markAsRead: (token: string, id: number) => Observable<any>
      markAllAsRead: (token: string) => Observable<any>
    }
    gamePlays: {
      getSummary: (token: string) => Observable<any>
    }
    prices: {
      getPrices: (token: string) => Observable<any>
    }
  }

  admin: {
    users: {
      getUsers: (token: string, params?: any) => Observable<any>
      showUser: (token: string, userId: number) => Observable<any>
      createUser: (token: string, userData: any) => Observable<any>
      updateUser: (token: string, userId: number, userData: any) => Observable<any>
      deleteUser: (token: string, userId: number) => Observable<any>
      getUserGamePlays: (token: string, userId: number, params?: any) => Observable<any>
    },
    machines: {
      getMachines: (token: string, params?: any) => Observable<any>
      showMachine: (token: string, machineId: number) => Observable<any>
      createMachine: (token: string, machineData: any) => Observable<any>
      updateMachine: (token: string, machineId: number, machineData: any) => Observable<any>
      deleteMachine: (token: string, machineId: number) => Observable<any>
      wardenCommand: (token: string, machineId: number, command: string) => Observable<any>
      wardenStatus: (token: string, machineId: number) => Observable<any>
    },
    reservations: {
      getReservations: (token: string, params?: any) => Observable<any>
      showReservation: (token: string, reservationId: number) => Observable<any>
      createReservation: (token: string, reservationData: any) => Observable<any>
      updateReservation: (token: string, reservationId: number, reservationData: any) => Observable<any>
      cancelReservation: (token: string, reservationId: number, refund: boolean) => Observable<any>
      updateStatus: (token: string, reservationId: number, status: string) => Observable<any>

      reservationsForMachine: (token: string, machineId: number, params?: any) => Observable<any>
      reservationsForUser: (token: string, userId: number, params?: any) => Observable<any>
      calendarReservationsForUser: (token: string, userId: number, params?: any) => Observable<any>
      checkAvailability: (token: string, userIds: number[], startDate: string, startTime: string, duration: number) => Observable<any>  
      getMaxExtend: (token: string, reservationId: number) => Observable<any>
      extendReservation: (token: string, reservationId: number, extendHours: number, free?: boolean) => Observable<any>
    },
    machineHours: {
      createMachineHours: (token: string, machineHourData: any) => Observable<any>
      getPlayhoursForUser: (token: string, userId: number, params?: any) => Observable<any>
      getTotalHoursForUser: (token: string, userId: number, params?: any) => Observable<any>
      deleteMachineHour: (token: string, hourId: number) => Observable<any>
    },
    hourTransactions: {
      getTransactions: (token: string, params?: any) => Observable<any>
    },
    appSettings: {
      getSettings: (token: string) => Observable<any>
      updateSettings: (token: string, settingsData: any) => Observable<any>
      resetSettings: (token: string) => Observable<any>
    },
    games: {
      getGames: (token: string, params?: any) => Observable<any>
      showGame: (token: string, gameId: number) => Observable<any>
      createGame: (token: string, gameData: any) => Observable<any>
      updateGame: (token: string, gameId: number, gameData: any) => Observable<any>
      deleteGame: (token: string, gameId: number) => Observable<any>
    },
    prices: {
      getPrices: (token: string, params?: any) => Observable<any>
      showPrice: (token: string, priceId: number) => Observable<any>
      createPrice: (token: string, priceData: any) => Observable<any>
      updatePrice: (token: string, priceId: number, priceData: any) => Observable<any>
      deletePrice: (token: string, priceId: number) => Observable<any>
    }
    notifications: {
      getNotifications: (token: string, params?: any) => Observable<any>
      getNotificationsForUser: (token: string, userId: number, params?: any) => Observable<any>
    }
  }

  constructor(private http: HttpClient) {
    this.auth = {
      login: (login, password) => {
        return this.http.post('api/login', {
          user: {
            login: login,
            password: password
          }
        }, { observe: 'response' })
      },
      logout: (token: string) => {
        return this.http.delete('api/logout', { headers: { Authorization: token }})
      }
    }

    this.user = {
      currentUser: (token: string) => {
        return this.http.get('api/user/current_user', { headers: { Authorization: token }})
      },
      updateCurrentUser: (token: string, userData: any) => {
        return this.http.patch('api/user/current_user', { user: userData }, { headers: { Authorization: token }})
      },
      homepageData: (token: string) => {
        return this.http.get('api/user/home', { headers: { Authorization: token }})
      },

      friends: {
        searchUsers: (token: string, searchQuery: string, params?: any) => {
          const defaultParams = { search_query: searchQuery };
          const allParams = params ? { ...defaultParams, ...params } : defaultParams;
          return this.http.get('api/user/user_search', { headers: { Authorization: token }, params: allParams })
        },
        getFriends: (token: string) => {
          return this.http.get('api/user/friends', { headers: { Authorization: token }})
        },
        addFriend: (token: string, friendId: number) => {
          return this.http.post('api/user/friends', { friend_id: friendId }, { headers: { Authorization: token }})
        },
        removeFriend: (token: string, friendId: number) => {
          return this.http.delete(`api/user/friends/${friendId}`, { headers: { Authorization: token }})
        }
      },
      reservations: {
        myReservations: (token: string, params?: any) => {
          return this.http.get('api/user/reservations', { headers: { Authorization: token }, params: params })
        },
        activeReservations: (token: string) => {
          return this.http.get('api/user/reservations/active', { headers: { Authorization: token }})
        },
        checkAvailability: (token: string, userIds: number[], startDate: string, startTime: string, duration: number) => {
        return this.http.post('api/user/check_availability', {
          reservation: {
            user_ids: userIds,
            start_time: `${startDate}T${startTime}:00`,
            duration: duration
          }
        }, { headers: { Authorization: token }})},
        createReservation: (token: string, reservationData: any) => {
          return this.http.post('api/user/reservations', { reservation: reservationData }, { headers: { Authorization: token }})
        },
        cancelReservation: (token: string, reservationId: number) => {
          return this.http.post(`api/user/reservations/cancel`, {reservation: { reservation_id: reservationId }}, { headers: { Authorization: token }})
        },
        getMaxExtend: (token: string, reservationId: number) => {
          return this.http.get(`api/user/reservations/${reservationId}/max_extend`, { headers: { Authorization: token }})
        },
        extendReservation: (token: string, reservationId: number, extendHours: number) => {
          return this.http.post(`api/user/reservations/extend`, { reservation: { reservation_id: reservationId, extend_hours: extendHours } }, { headers: { Authorization: token }})
        }
      },
      appSettings: (token: string) => {
        return this.http.get('api/user/app_settings', { headers: { Authorization: token }})
      },
      machines: {
        getMachines: (token: string) => {
          return this.http.get('api/user/machines', { headers: { Authorization: token }})
        }
      },
      notifications: {
        getDropdown: (token: string) => {
          return this.http.get('api/user/notifications/dropdown', { headers: { Authorization: token }})
        },
        getAll: (token: string, params?: any) => {
          return this.http.get('api/user/notifications', { headers: { Authorization: token }, params: params })
        },
        markAsRead: (token: string, id: number) => {
          return this.http.post(`api/user/notifications/${id}/read`, {}, { headers: { Authorization: token }})
        },
        markAllAsRead: (token: string) => {
          return this.http.post('api/user/notifications/mark_all_read', {}, { headers: { Authorization: token }})
        }
      },
      prices: {
        getPrices: (token: string) => {
          return this.http.get('api/user/prices', { headers: { Authorization: token }})
        }
      },
      gamePlays: {
        getSummary: (token: string) => {
          return this.http.get('api/user/game_plays_summary', { headers: { Authorization: token }})
        }
      }
    }

    this.admin = {
      users: {
        getUsers: (token: string, params?: any) => {
          return this.http.get('api/admin/users', { headers: { Authorization: token }, params: params })
        },
        showUser: (token: string, userId: number) => {
          return this.http.get(`api/admin/users/${userId}`, { headers: { Authorization: token }})
        },
        createUser: (token: string, userData: any) => {
          return this.http.post('api/admin/users', { user: userData }, { headers: { Authorization: token }})
        },
        updateUser: (token: string, userId: number, userData: any) => {
          return this.http.put(`api/admin/users/${userId}`, { user: userData }, { headers: { Authorization: token }})
        },
        deleteUser: (token: string, userId: number) => {
          return this.http.delete(`api/admin/users/${userId}`, { headers: { Authorization: token }})
        },
        getUserGamePlays: (token: string, userId: number, params?: any) => {
          return this.http.get(`api/admin/game_plays_for_user/${userId}`, { headers: { Authorization: token }, params: params })
        }
      },
      machines: {
        getMachines: (token: string, params?: any) => {
          return this.http.get('api/admin/machines', { headers: { Authorization: token }, params: params })
        },
        showMachine: (token: string, machineId: number) => {
          return this.http.get(`api/admin/machines/${machineId}`, { headers: { Authorization: token }})
        },
        createMachine: (token: string, machineData: any) => {
          return this.http.post('api/admin/machines', { machine: machineData }, { headers: { Authorization: token }})
        },
        updateMachine: (token: string, machineId: number, machineData: any) => {
          return this.http.put(`api/admin/machines/${machineId}`, { machine: machineData }, { headers: { Authorization: token }})
        },
        deleteMachine: (token: string, machineId: number) => {
          return this.http.delete(`api/admin/machines/${machineId}`, { headers: { Authorization: token }})
        },
        wardenCommand: (token: string, machineId: number, command: string) => {
          return this.http.post('api/warden-command', { machine_id: machineId, command: command }, { headers: { Authorization: token }})
        },
        wardenStatus: (token: string, machineId: number) => {
          return this.http.get(`api/warden-status/${machineId}`, { headers: { Authorization: token }})
        }
      },
      reservations: {
        getReservations: (token: string, params?: any) => {
          return this.http.get('api/admin/reservations', { headers: { Authorization: token }, params: params })
        },
        showReservation: (token: string, reservationId: number) => {
          return this.http.get(`api/admin/reservations/${reservationId}`, { headers: { Authorization: token }})
        },
        createReservation: (token: string, reservationData: any) => {
          return this.http.post('api/admin/reservations', { reservation: reservationData }, { headers: { Authorization: token }})
        },
        updateReservation: (token: string, reservationId: number, reservationData: any) => {
          return this.http.put(`api/admin/reservations/${reservationId}`, { reservation: reservationData }, { headers: { Authorization: token }})
        },
        cancelReservation: (token: string, reservationId: number, refund: boolean) => {
          return this.http.post(`api/admin/reservations/${reservationId}/cancel`, { refund }, { headers: { Authorization: token }})
        },
        updateStatus: (token: string, reservationId: number, status: string) => {
          return this.http.patch(`api/admin/reservations/${reservationId}/update_status`, { status }, { headers: { Authorization: token }})
        },
        reservationsForMachine: (token: string, machineId: number, params?: any) => {
          return this.http.get(`api/admin/reservations/machine_reservations/${machineId}`, { headers: { Authorization: token }, params: params })
        },
        reservationsForUser: (token: string, userId: number, params?: any) => {
          return this.http.get(`api/admin/reservations/user_reservations/${userId}`, { headers: { Authorization: token }, params: params })
        },
        calendarReservationsForUser: (token: string, userId: number, params?: any) => {
          return this.http.get(`api/admin/reservations/calendar_user_reservations/${userId}`, { headers: { Authorization: token }, params: params })
        },
        checkAvailability: (token: string, userIds: number[], startDate: string, startTime: string, duration: number) => {
          return this.http.post('api/admin/reservations/check_availability', {
            reservation: {
              user_ids: userIds,
              start_time: `${startDate}T${startTime}:00`,
              duration: duration
            }
          }, { headers: { Authorization: token }})
        },
        getMaxExtend: (token: string, reservationId: number) => {
          return this.http.get(`api/admin/reservations/${reservationId}/max_extend`, { headers: { Authorization: token }})
        },
        extendReservation: (token: string, reservationId: number, extendHours: number, free: boolean = false) => {
          return this.http.post(`api/admin/reservations/${reservationId}/extend`, { extend_hours: extendHours, free }, { headers: { Authorization: token }})
        }
      },
      machineHours: {
        createMachineHours: (token: string, machineHourData: any) => {
          return this.http.post('api/admin/machine_hours', { machine_hour: machineHourData }, { headers: { Authorization: token }})
        },
        getPlayhoursForUser: (token: string, userId: number, params?: any) => {
          return this.http.get(`api/admin/playhours_for_user/${userId}`, { headers: { Authorization: token }, params: params })
        },
        getTotalHoursForUser: (token: string, userId: number, params?: any) => {
          return this.http.get(`api/admin/total_hours_for_user/${userId}`, { headers: { Authorization: token }, params: params })
        },
        deleteMachineHour: (token: string, hourId: number) => {
          return this.http.delete(`api/admin/machine_hours/${hourId}`, { headers: { Authorization: token }})
        }
      },
      hourTransactions: {
        getTransactions: (token: string, params?: any) => {
          return this.http.get('api/admin/hour_transactions', { headers: { Authorization: token }, params: params })
        }
      },
      appSettings: {
        getSettings: (token: string) => {
          return this.http.get('api/admin/app_setting', { headers: { Authorization: token } })
        },
        updateSettings: (token: string, settingsData: any) => {
          return this.http.put('api/admin/app_setting', { app_setting: settingsData }, { headers: { Authorization: token } })
        },
        resetSettings: (token: string) => {
          return this.http.post('api/admin/app_setting/reset', {}, { headers: { Authorization: token } })
        }
      },
      games: {
        getGames: (token: string, params?: any) => {
          return this.http.get('api/admin/games', { headers: { Authorization: token }, params: params })
        },
        showGame: (token: string, gameId: number) => {
          return this.http.get(`api/admin/games/${gameId}`, { headers: { Authorization: token } })
        },
        createGame: (token: string, gameData: any) => {
          if (gameData instanceof FormData) {
            return this.http.post('api/admin/games', gameData, { headers: { Authorization: token } })
          }
          return this.http.post('api/admin/games', { game: gameData }, { headers: { Authorization: token } })
        },
        updateGame: (token: string, gameId: number, gameData: any) => {
          if (gameData instanceof FormData) {
            return this.http.put(`api/admin/games/${gameId}`, gameData, { headers: { Authorization: token } })
          }
          return this.http.put(`api/admin/games/${gameId}`, { game: gameData }, { headers: { Authorization: token } })
        },
        deleteGame: (token: string, gameId: number) => {
          return this.http.delete(`api/admin/games/${gameId}`, { headers: { Authorization: token } })
        }
      },
      prices: {
        getPrices: (token: string, params?: any) => {
          return this.http.get('api/admin/prices', { headers: { Authorization: token }, params: params })
        },
        showPrice: (token: string, priceId: number) => {
          return this.http.get(`api/admin/prices/${priceId}`, { headers: { Authorization: token } })
        },
        createPrice: (token: string, priceData: any) => {
          return this.http.post('api/admin/prices', { price: priceData }, { headers: { Authorization: token } })
        },
        updatePrice: (token: string, priceId: number, priceData: any) => {
          return this.http.put(`api/admin/prices/${priceId}`, { price: priceData }, { headers: { Authorization: token } })
        },
        deletePrice: (token: string, priceId: number) => {
          return this.http.delete(`api/admin/prices/${priceId}`, { headers: { Authorization: token } })
        }
      },
      notifications: {
        getNotifications: (token: string, params?: any) => {
          return this.http.get('api/admin/notifications', { headers: { Authorization: token }, params: params })
        },
        getNotificationsForUser: (token: string, userId: number, params?: any) => {
          return this.http.get(`api/admin/notifications_for_user/${userId}`, { headers: { Authorization: token }, params: params })
        }
      }
    }
  }
}