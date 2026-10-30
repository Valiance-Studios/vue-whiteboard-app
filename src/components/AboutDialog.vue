<template>
  <v-dialog
    v-model="open"
    max-width="560"
    scrollable
  >
    <template #activator="{props: activatorProps}">
      <v-btn
        v-bind="activatorProps"
        icon="mdi-information-outline"
        variant="text"
        density="comfortable"
        aria-label="About this app"
        title="About this app"
      />
    </template>

    <v-card title="About Whiteboard">
      <v-card-text>
        <p class="text-body-2 mb-4">
          A web app allowing users to create whiteboards. A whiteboard contains text that can be written in various
          colors. Users manage their own boards, with support for both cloud and local storage depending on their
          sign-in status.
        </p>
        <p class="text-body-2 mb-4">
          To persist data to the cloud, a user must sign in with a Google account that is allowlisted.
        </p>

        <h3 class="text-subtitle-2 font-weight-bold mb-2">
          On the Horizon
        </h3>
        <p class="text-body-2 mb-4">
          Support for sketching on the whiteboards with the mouse or through touch input.
        </p>

        <h3 class="text-subtitle-2 font-weight-bold mb-2">
          Under the hood
        </h3>
        <ul class="about-highlights text-body-2 mb-4">
          <li
            v-for="highlight in highlights"
            :key="highlight"
          >
            {{ highlight }}
          </li>
        </ul>

        <h3 class="text-subtitle-2 font-weight-bold mb-2">
          Built with
        </h3>
        <div class="about-stack">
          <v-chip
            v-for="tool in techStack"
            :key="tool"
            size="small"
            variant="tonal"
            color="primary"
          >
            {{ tool }}
          </v-chip>
        </div>
      </v-card-text>

      <v-card-actions>
        <v-btn
          :href="repositoryUrl"
          target="_blank"
          rel="noopener noreferrer"
          prepend-icon="mdi-github"
          color="primary"
        >
          View the code
        </v-btn>
        <v-spacer />
        <v-btn @click="open = false">
          Close
        </v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>

<script lang="ts">
import {defineComponent} from 'vue';

/** An app bar button that explains what the app is and how it was built, with a link to its code. */
export default defineComponent({
  name: 'AboutDialog',

  data() {
    return {
      open: false,
      repositoryUrl: 'https://github.com/Valiance-Studios/vue-whiteboard-app',
      highlights: [
        'Boards are protected by Firestore security rules.',
        'Google sign-in is limited to an allowlist, with denied requests recorded for the owner to review.',
        'Storage chosen per session: Firestore for Google accounts, this browser for demo mode.',
        'Unit, security rules and end-to-end tests run against Firebase emulators.',
      ],
      techStack: ['Vue 3', 'TypeScript', 'Vuetify', 'Pinia', 'Tiptap', 'Firebase', 'Vitest', 'Playwright'],
    };
  },
});
</script>

<style lang="scss" scoped>
.about-highlights {
  padding-inline-start: 20px;

  li + li {
    margin-top: 4px;
  }
}

.about-stack {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}
</style>
