<template>
  <v-app>
    <v-app-bar
      color="primary"
      density="comfortable"
    >
      <v-app-bar-title>
        <router-link
          :to="{name: boardCollectionRoute}"
          class="app-title"
        >Whiteboard</router-link>
      </v-app-bar-title>

      <template
        v-if="authStore.user"
        #append
      >
        <span class="text-body-2 me-3 d-none d-sm-inline">{{ authStore.user.displayName ?? authStore.user.email }}</span>
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
  color: inherit;
  text-decoration: none;
}
</style>
