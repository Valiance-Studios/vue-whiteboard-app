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
              v-if="authStore.deniedUser"
              type="warning"
              variant="tonal"
              class="mb-4"
              density="compact"
            >
              {{ authStore.deniedUser.email ?? 'This account' }} does not have access to this app.
            </v-alert>

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

            <div class="login-divider my-4 text-body-2 text-medium-emphasis">
              or
            </div>

            <v-btn
              block
              size="large"
              variant="outlined"
              color="primary"
              prepend-icon="mdi-account-outline"
              :disabled="signingIn"
              @click="onDemoMode"
            >
              Demo Mode
            </v-btn>
            <p
              v-if="savedDemoName"
              class="text-caption text-medium-emphasis mt-2 mb-0"
            >
              Welcome back, {{ savedDemoName }}.
              <button
                type="button"
                class="login-link"
                @click="onSomeoneNew"
              >
                Not you?
              </button>
            </p>
            <p
              v-else
              class="text-caption text-medium-emphasis mt-2 mb-0"
            >
              No account needed. Boards are saved in this browser only.
            </p>
          </v-card-text>
        </v-card>
      </v-col>
    </v-row>

    <demo-mode-dialog
      v-model="demoDialogOpen"
      :previous-name="replacingSavedDemo ? savedDemoName : null"
      @start="startDemo"
    />
  </v-container>
</template>

<script lang="ts">
import {defineComponent} from 'vue';
import {mapStores} from 'pinia';
import DemoModeDialog from '@/components/DemoModeDialog.vue';
import {useAuthStore} from '@/stores/auth';
import {RouteName} from '@/router';

export default defineComponent({
  name: 'LoginView',

  components: {
    DemoModeDialog,
  },

  data() {
    return {
      signingIn: false,
      errorMessage: null as string | null,
      demoDialogOpen: false,
      /** The returning demo visitor's name, if any, read once when the page opens. */
      savedDemoName: null as string | null,
      /** Whether the open name dialog is for someone new replacing the saved demo visitor. */
      replacingSavedDemo: false,
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

  created(): void {
    this.savedDemoName = this.authStore.savedDemoName();
  },

  methods: {
    async onSignIn(): Promise<void> {
      this.signingIn = true;
      this.errorMessage = null;

      try {
        const signedIn = await this.authStore.signInWithGoogle();

        if (signedIn) {
          await this.enterApp();
        }
      } catch (error) {
        console.error('Sign-in failed', error);
        this.errorMessage = 'Sign-in failed. Please try again.';
      } finally {
        this.signingIn = false;
      }
    },

    /** A returning demo visitor goes straight in; a first-time one is asked for a name. */
    onDemoMode(): void {
      this.replacingSavedDemo = false;

      if (this.authStore.enterDemo()) {
        void this.enterApp();
      } else {
        this.demoDialogOpen = true;
      }
    },

    onSomeoneNew(): void {
      this.replacingSavedDemo = true;
      this.demoDialogOpen = true;
    },

    startDemo(name: string): void {
      if (this.replacingSavedDemo) {
        this.authStore.enterDemoAsSomeoneNew(name);
      } else {
        this.authStore.enterDemo(name);
      }

      void this.enterApp();
    },

    async enterApp(): Promise<void> {
      await this.$router.replace(this.redirectPath ?? {name: RouteName.BoardCollection});
    },
  },
});
</script>

<style lang="scss" scoped>
// "or" between two rules.
.login-link {
  color: rgb(var(--v-theme-primary));
  font: inherit;
  text-decoration: underline;
  cursor: pointer;
}

.login-divider {
  display: flex;
  align-items: center;
  gap: 12px;

  &::before,
  &::after {
    content: '';
    flex: 1;
    border-top: 1px solid rgb(var(--v-border-color) / var(--v-border-opacity));
  }
}
</style>
