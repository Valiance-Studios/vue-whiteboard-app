<template>
  <v-app>
    <v-app-bar
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

      <!-- About and the theme toggle are always at the right edge; once signed in, the account controls follow them. -->
      <template #append>
        <about-dialog />
        <theme-toggle :class="{'me-2': authStore.user}" />

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
          <span class="text-body-2 me-3 d-none d-sm-inline">{{ userName }}</span>
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
          <!-- Icon-only on phones, where the title would otherwise be squeezed out. -->
          <v-btn
            variant="text"
            prepend-icon="mdi-logout"
            aria-label="Sign out"
            title="Sign out"
            class="app-sign-out"
            @click="onSignOut"
          >
            <span class="d-none d-sm-inline">Sign out</span>
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
import {defineComponent} from 'vue';
import {mapStores} from 'pinia';
import AboutDialog from '@/components/AboutDialog.vue';
import ThemeToggle from '@/components/ThemeToggle.vue';
import {useAuthStore} from '@/stores/auth';
import {useBoardsStore} from '@/stores/boards';
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
    };
  },

  computed: {
    ...mapStores(useAuthStore, useBoardsStore),

    userName(): string {
      const user = this.authStore.user;

      return user?.displayName ?? user?.email ?? '';
    },

    userInitial(): string {
      return this.userName.charAt(0).toUpperCase();
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
// Phones: room for the title beside About, the theme toggle and the account controls.
// Sign out keeps only its icon, so it drops the gap left for the text and the minimum width meant for a text button.
@media (max-width: 599.98px) {
  // A smaller title, closer to the edge, so it fits beside the buttons at full length.
  .app-bar-title {
    margin-inline-start: 8px;
    font-size: 1.125rem;

    .app-title {
      gap: 4px;
    }
  }

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
