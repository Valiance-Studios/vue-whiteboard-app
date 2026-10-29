<template>
  <v-app>
    <v-app-bar
      color="surface"
      flat
      border="b"
    >
      <v-app-bar-title>
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

      <template
        v-if="authStore.user"
        #append
      >
        <v-avatar
          :image="authStore.user.photoURL ?? undefined"
          color="primary"
          variant="tonal"
          size="32"
          class="me-3"
        >
          <span
            v-if="!authStore.user.photoURL"
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
        <v-btn
          variant="text"
          prepend-icon="mdi-logout"
          @click="onSignOut"
        >
          Sign out
        </v-btn>
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
import {useAuthStore} from '@/stores/auth';
import {useBoardsStore} from '@/stores/boards';
import {RouteName} from '@/router';

export default defineComponent({
  name: 'App',

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
.app-title {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  font-weight: 700;
  color: inherit;
  text-decoration: none;
}
</style>
