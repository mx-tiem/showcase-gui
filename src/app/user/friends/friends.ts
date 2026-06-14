import { Component, OnInit, OnChanges, SimpleChanges, Input, ChangeDetectorRef, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatInputModule } from '@angular/material/input';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { InternalApiService } from '../../shared/internal-api.service';
import { LoginService } from '../../login/login.service';
import { TranslocoModule } from '@jsverse/transloco';

interface Friend {
  id: number;
  name: string;
  email: string;
  username: string;
  status: 'online' | 'offline';
}

@Component({
  selector: 'app-friends',
  imports: [
    CommonModule,
    FormsModule,
    MatInputModule,
    MatFormFieldModule,
    MatCardModule,
    MatButtonModule,
    MatIconModule,
    TranslocoModule
  ],
  templateUrl: './friends.html',
  styleUrl: './friends.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class Friends implements OnInit, OnChanges {
  @Input() isActive = false;

  searchQuery = '';
  searchResults: Friend[] = [];
  friends: Friend[] = [];
  showSearchResults = false;
  isSearching = false;
  isLoadingMore = false;
  searchError = '';
  currentSearchQuery = '';
  currentPage = 1;
  hasMoreResults = false;
  totalResults = 0;

  constructor(
    private internalApi: InternalApiService,
    private loginService: LoginService,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit() {
    // Load data when component initializes if active
    if (this.isActive) {
      this.loadFriendsData();
    }
  }

  ngOnChanges(changes: SimpleChanges) {
    // Load data when isActive becomes true
    if (changes['isActive'] && changes['isActive'].currentValue && !changes['isActive'].previousValue) {
      this.loadFriendsData();
    }
  }

  private loadFriendsData() {
    const token = this.loginService.getToken();
    console.log('🎯 Loading friends data... isActive:', this.isActive);

    this.internalApi.user.friends.getFriends(token).subscribe({
      next: (response: any) => {
        console.log('✅ Friends loaded:', response);
        // Assuming the API returns friends in a 'friends' array
        const friendsData = response.friends || response || [];
        this.friends = friendsData.map((friend: any) => ({
          id: friend.id,
          name: friend.name || `${friend.first_name} ${friend.last_name}`.trim(),
          email: friend.email,
          avatar: friend.avatar,
          status: friend.status || 'offline'
        }));
        this.cdr.markForCheck();
      },
      error: (error) => {
        console.error('❌ Failed to load friends:', error);
        this.friends = [];
        // TODO: Show error message to user
        this.cdr.markForCheck();
      }
    });
  }

  onSearchInput() {
    const query = this.searchQuery.trim();
    if (query.length > 0) {
      this.performSearch(query, true); // true = new search
    } else {
      this.resetSearch();
    }
  }

  private resetSearch() {
    this.searchResults = [];
    this.showSearchResults = false;
    this.searchError = '';
    this.currentSearchQuery = '';
    this.currentPage = 1;
    this.hasMoreResults = false;
    this.totalResults = 0;
  }

  private performSearch(query: string, isNewSearch = false) {
    if (isNewSearch) {
      this.currentPage = 1;
      this.isSearching = true;
      this.showSearchResults = false;
      this.searchResults = [];
    } else {
      this.isLoadingMore = true;
    }
    
    this.searchError = '';
    this.currentSearchQuery = query;
    const token = this.loginService.getToken();

    const params = {
      search_query: query,
      page: this.currentPage,
      per_page: 10
    };

    this.internalApi.user.friends.searchUsers(token, query, params).subscribe({
      next: (response: any) => {
        console.log('🔍 Search results:', response);
        
        const users = response.users || response.data || [];
        const pagy = response.pagy || {};
        
        // Map users to the expected format
        const newUsers = users
          .map((user: any) => ({
            id: user.id,
            name: user.name || `${user.first_name || ''} ${user.last_name || ''}`.trim() || user.username || 'Unknown User',
            email: user.email,
            username: user.username || '',
            status: 'offline' as const
          }));

        if (isNewSearch) {
          this.searchResults = newUsers;
        } else {
          // Append new results to existing ones
          this.searchResults = [...this.searchResults, ...newUsers];
        }

        // Update pagination info
        this.currentPage = pagy.current_page || 1;
        this.hasMoreResults = pagy.current_page < pagy.total_pages;
        this.totalResults = pagy.total_count || 0;
        this.showSearchResults = this.searchResults.length > 0 || (isNewSearch && !!this.currentSearchQuery);
        
        this.isSearching = false;
        this.isLoadingMore = false;
        this.cdr.markForCheck();
      },
      error: (error) => {
        console.error('❌ Search error:', error);
        this.searchError = 'Failed to search users. Please try again.';
        if (isNewSearch) {
          this.searchResults = [];
          this.showSearchResults = false;
        }
        this.isSearching = false;
        this.isLoadingMore = false;
        this.hasMoreResults = false;
        this.cdr.markForCheck();
      }
    });
  }

  loadMoreResults() {
    if (this.hasMoreResults && !this.isLoadingMore && this.currentSearchQuery) {
      this.currentPage++;
      this.performSearch(this.currentSearchQuery, false); // false = load more
    }
  }

  addFriend(user: Friend) {
    const token = this.loginService.getToken();
    console.log('➕ Adding friend:', user.name);

    this.internalApi.user.friends.addFriend(token, user.id).subscribe({
      next: (response: any) => {
        console.log('✅ Friend added successfully:', response);
        const newFriend: Friend = {
          ...user
        };
        this.friends.push(newFriend);
        // Remove from search results
        this.searchResults = this.searchResults.filter(result => result.id !== user.id);
        if (this.searchResults.length === 0) {
          this.showSearchResults = false;
        }
        this.cdr.markForCheck();
      },
      error: (error) => {
        console.error('❌ Failed to add friend:', error);
        // TODO: Show error message to user
        this.cdr.markForCheck();
      }
    });
  }

  removeFriend(friend: Friend) {
    const token = this.loginService.getToken();
    console.log('➖ Removing friend:', friend.name);

    this.internalApi.user.friends.removeFriend(token, friend.id).subscribe({
      next: (response: any) => {
        console.log('✅ Friend removed successfully:', response);
        this.friends = this.friends.filter(f => f.id !== friend.id);
        this.cdr.markForCheck();
      },
      error: (error) => {
        console.error('❌ Failed to remove friend:', error);
        // TODO: Show error message to user
        this.cdr.markForCheck();
      }
    });
  }

  getStatusColor(status: string): string {
    return status === 'online' ? '#4caf50' : '#9e9e9e';
  }
}
