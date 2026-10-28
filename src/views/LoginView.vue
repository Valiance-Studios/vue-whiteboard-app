<template>
  <v-container
    class="fill-height"
    fluid
  >
    <v-row justify="center">
      <v-col
        cols="12"
        sm="8"
        md="5"
        lg="4"
      >
        <v-card
          class="pa-6 text-center"
          elevation="4"
        >
          <v-card-title class="text-h5">
            Welcome
          </v-card-title>
          <v-card-subtitle>Sign in to access your boards</v-card-subtitle>

          <v-card-text>
            <v-alert
              v-if="errorMessage"
              type="error"
              variant="tonal"
              class="mb-4"
              density="compact"
            >
              {{ errorMessage }}
            </v-alert>

            <v-btn
              block
              size="large"
              color="primary"
              prepend-icon="mdi-google"
              :loading="signingIn"
              @click="onSignIn"
            >
              Sign in with Google
            </v-btn>
          </v-card-text>
        </v-card>
      </v-col>
    </v-row>
  </v-container>
</template>

<script lang="ts">
import {defineComponent} from 'vue';
import {mapStores} from 'pinia';
import {useAuthStore} from '@/stores/auth';
import {RouteName} from '@/router';

export default defineComponent({
  name: 'LoginView',

  data() {
    return {
      signingIn: false,
      errorMessage: null as string | null,
    };
  },

  computed: {
    ...mapStores(useAuthStore),

    redirectPath(): string | null {
      const redirect = this.$route.query.redirect;
      // Only allow in-app paths to avoid open redirects.
      return typeof redirect === 'string' && redirect.startsWith('/') && !redirect.startsWith('//') ? redirect : null;
    },
  },

  methods: {
    async onSignIn(): Promise<void> {
      this.signingIn = true;
      this.errorMessage = null;
      try {
        await this.authStore.signInWithGoogle();
        await this.$router.replace(this.redirectPath ?? {name: RouteName.BoardCollection});
      } catch (error) {
        this.errorMessage = error instanceof Error ? error.message : 'Sign-in failed.';
      } finally {
        this.signingIn = false;
      }
    },
  },
});
</script>

<style lang="scss" scoped>
</style>
