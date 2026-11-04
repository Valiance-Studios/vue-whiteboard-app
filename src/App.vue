<template>
  <v-app>
    <v-app-bar
      class="app-bar"
      color="surface"
      flat
      border="b"
    >
      <v-app-bar-title class="app-bar-title">
        <router-link
          :to="{name: boardCollectionRoute}"
          class="app-title"
        >
          <v-icon
            icon="mdi-marker"
            color="primary"
          />
          Whiteboard
        </router-link>
      </v-app-bar-title>

      <!-- Filled by the page shown, on screens wide enough: see BoardView. -->
      <div
        :id="pageSlotId"
        class="app-bar-slot"
      />

      <!-- About and the theme toggle are always at the right edge; once signed in, the account controls follow them. -->
      <template #append>
        <about-dialog />
        <theme-toggle
          :class="{'me-2': authStore.user}"
          @change="settingsStore.setThemeChoice"
        />

        <template v-if="authStore.user">
          <!-- The photo is in the slot because v-avatar ignores its `image` prop whenever a slot is given. -->
          <v-avatar
            color="primary"
            variant="tonal"
            size="32"
            class="me-2 me-sm-3"
          >
            <!-- Google's photo host can refuse requests that send a referrer. -->
            <v-img
              v-if="authStore.user.photoURL"
              :src="authStore.user.photoURL"
              alt=""
              cover
              referrerpolicy="no-referrer"
            />
            <span
              v-else
              class="text-subtitle-2 font-weight-bold"
            >{{ userInitial }}</span>
          </v-avatar>
          <span class="app-user-name text-body-2 me-3 d-none d-lg-inline">{{ userName }}</span>
          <v-chip
            v-if="authStore.isDemo"
            size="small"
            color="primary"
            variant="tonal"
            class="me-2"
            title="Demo Mode: boards are saved in this browser only"
          >
            Demo
          </v-chip>
          <!-- Icon-only below desktop widths, leaving room for the title and the page's controls. -->
          <v-btn
            variant="text"
            prepend-icon="mdi-logout"
            aria-label="Sign out"
            title="Sign out"
            class="app-sign-out"
            @click="onSignOut"
          >
            <span class="d-none d-lg-inline">Sign out</span>
          </v-btn>
        </template>
      </template>
    </v-app-bar>

    <v-main>
      <router-view />
    </v-main>
  </v-app>
</template>

<script lang="ts">
import type {ThemeChoice} from '@/theme/themePreference';

import {defineComponent} from 'vue';
import {mapStores} from 'pinia';
import {APP_BAR_PAGE_SLOT_ID} from '@/constants/appBar';
import AboutDialog from '@/components/AboutDialog.vue';
import ThemeToggle from '@/components/ThemeToggle.vue';
import vuetify from '@/plugins/vuetify';
import {useAuthStore} from '@/stores/auth';
import {useBoardsStore} from '@/stores/boards';
import {useSettingsStore} from '@/stores/settings';
import {RouteName} from '@/router';

export default defineComponent({
  name: 'App',

  components: {
    AboutDialog,
    ThemeToggle,
  },

  data() {
    return {
      boardCollectionRoute: RouteName.BoardCollection,
      pageSlotId: APP_BAR_PAGE_SLOT_ID,
    };
  },

  computed: {
    ...mapStores(useAuthStore, useBoardsStore, useSettingsStore),

    sessionUid(): string | null {
      return this.authStore.user?.uid ?? null;
    },

    userName(): string {
      const user = this.authStore.user;

      return user?.displayName ?? user?.email ?? '';
    },

    userInitial(): string {
      return this.userName.charAt(0).toUpperCase();
    },
  },

  watch: {
    sessionUid: {
      handler(): void {
        void this.settingsStore.load();
      },
      immediate: true,
    },

    'settingsStore.themeChoice'(choice: ThemeChoice | null): void {
      if (choice) {
        void vuetify.theme.change(choice);
      }
    },
  },

  methods: {
    async onSignOut(): Promise<void> {
      await this.authStore.signOut();
      // Clear the previous user's data so it never flashes for the next session.
      this.boardsStore.$reset();
      await this.$router.replace({name: RouteName.Login});
    },
  },
});
</script>

<style lang="scss" scoped>
// Visible, so a page's controls can show a message hanging below the bar, such as a rename error.
.app-bar,
.app-bar :deep(.v-toolbar__content) {
  overflow: visible;
}

// Equal sides, so the page's controls are centered on the bar rather than between the sides' different widths.
// A side never gets narrower than its contents, and what is left for the middle can cut a long title short.
.app-bar :deep(.v-toolbar__content) {
  display: grid;
  grid-template-columns: minmax(max-content, 1fr) minmax(0, auto) minmax(max-content, 1fr);
  align-items: center;
}

.app-bar-slot {
  display: flex;
  justify-content: center;
  min-width: 0;
}

// Kept short, so a long name never squeezes out the page's controls.
.app-user-name {
  overflow: hidden;
  max-width: 180px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

// Phones: room for the title beside About, the theme toggle and the account controls.
@media (max-width: 599.98px) {
  // A smaller title, closer to the edge, so it fits beside the buttons at full length.
  .app-bar-title {
    margin-inline-start: 8px;
    font-size: 1.125rem;

    .app-title {
      gap: 4px;
    }
  }
}

// Sign out keeps only its icon, so it drops the gap left for the text and the minimum width meant for a text button.
@media (max-width: 1144.98px) {
  .app-sign-out {
    min-width: 0;
    padding-inline: 8px;

    :deep(.v-btn__prepend) {
      margin-inline: 0;
    }
  }
}

.app-title {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  font-weight: 700;
  color: inherit;
  text-decoration: none;
}
</style>
