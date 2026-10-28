/**
 * Runs a command against the Firebase Local Emulator Suite, then shuts the emulators down.
 *
 * Usage: node scripts/with-emulators.ts [firebase emulators:start args] -- <command>
 *
 * Replaces `firebase emulators:exec`, which on Windows leaves the Firestore emulator's Java
 * process running after it exits, so the next run fails with "port taken". This script stops
 * the emulators' whole process tree instead.
 */
import type {ChildProcess} from 'node:child_process';

import {spawn, spawnSync} from 'node:child_process';

const READY_PATTERN = /All emulators ready/;
const STARTUP_TIMEOUT_MS = 120_000;
const isWindows = process.platform === 'win32';

interface ParsedArgs {
  emulatorArgs: string[];
  command: string[];
}

function parseArgs(argv: string[]): ParsedArgs {
  const separator = argv.indexOf('--');

  if (separator === -1 || separator === argv.length - 1) {
    throw new Error('Usage: node scripts/with-emulators.ts [emulator args] -- <command>');
  }

  return {emulatorArgs: argv.slice(0, separator), command: argv.slice(separator + 1)};
}

function stopEmulators(emulators: ChildProcess): Promise<void> {
  if (emulators.exitCode !== null || emulators.signalCode !== null || emulators.pid === undefined) {
    return Promise.resolve();
  }

  const exited = new Promise<void>((resolve) => {
    emulators.once('exit', () => resolve());
  });

  if (isWindows) {
    spawnSync('taskkill', ['/pid', String(emulators.pid), '/T', '/F'], {stdio: 'ignore'});
  } else {
    // The emulators run in their own process group (detached), so this reaches the Java process too.
    process.kill(-emulators.pid, 'SIGTERM');
  }

  return exited;
}

/** Starts the emulators and resolves once they report ready. Their output is shown only if startup fails. */
function startEmulators(args: string[]): Promise<ChildProcess> {
  return new Promise((resolve, reject) => {
    const emulators = spawn(['firebase', 'emulators:start', ...args].join(' '), {
      shell: true,
      detached: !isWindows,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let output = '';

    const fail = (message: string): void => {
      clearTimeout(timer);
      void stopEmulators(emulators).then(() => reject(new Error(`${message}\n\n${output}`)));
    };

    const timer = setTimeout(() => fail('Timed out waiting for the emulators to start.'), STARTUP_TIMEOUT_MS);

    const onOutput = (chunk: Buffer): void => {
      output += chunk.toString();

      if (READY_PATTERN.test(output)) {
        clearTimeout(timer);
        emulators.stdout.off('data', onOutput);
        emulators.stderr.off('data', onOutput);
        // Keep draining output so the emulators never block on a full pipe.
        emulators.stdout.resume();
        emulators.stderr.resume();
        resolve(emulators);
      }
    };

    emulators.stdout.on('data', onOutput);
    emulators.stderr.on('data', onOutput);
    emulators.once('exit', (code) => fail(`The emulators exited before becoming ready (exit code ${code}).`));
  });
}

function runCommand(command: string[]): Promise<number> {
  return new Promise((resolve) => {
    const child = spawn(command.join(' '), {shell: true, stdio: 'inherit'});

    child.once('exit', (code) => resolve(code ?? 1));
  });
}

async function main(): Promise<number> {
  const {emulatorArgs, command} = parseArgs(process.argv.slice(2));
  const emulators = await startEmulators(emulatorArgs);

  for (const signal of ['SIGINT', 'SIGTERM'] as const) {
    process.once(signal, () => {
      void stopEmulators(emulators).then(() => process.exit(130));
    });
  }

  try {
    return await runCommand(command);
  } finally {
    await stopEmulators(emulators);
  }
}

main().then(
  (exitCode) => process.exit(exitCode),
  (error: unknown) => {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  },
);
