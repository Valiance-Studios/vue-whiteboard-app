/**
 * Stops whatever is left listening on the Firebase emulator ports.
 *
 * Usage: npm run emulators:stop
 *
 * `npm run test:emulator` and `npm run test:e2e` start their own emulators, so they fail with
 * "port taken" while an `npm run emulators` session - or a leftover Java process from a crashed
 * run - still holds the ports. This sweeps those up. A process that does not look like a Firebase
 * emulator is reported and left alone, so an unrelated server on a shared port (8080) survives.
 */
import {spawnSync} from 'node:child_process';
import {readFileSync} from 'node:fs';
import {setTimeout as delay} from 'node:timers/promises';

const isWindows = process.platform === 'win32';
/** Ports the CLI opens for its hub and logging emulators; neither is declared in firebase.json. */
const INTERNAL_PORTS = [4400, 4500];
const EMULATOR_PATTERN = /firebase|emulator/i;
const SIGKILL_DELAY_MS = 5_000;
const POLL_INTERVAL_MS = 200;

interface PortHolder {
  pid: number;
  description: string;
  ports: number[];
}

function portOf(emulator: unknown): number | null {
  if (typeof emulator !== 'object' || emulator === null) {
    return null;
  }

  const {port} = emulator as {port?: unknown};

  return typeof port === 'number' ? port : null;
}

/** The emulator ports declared in firebase.json, plus the ones the CLI always opens. */
function emulatorPorts(): number[] {
  const config: unknown = JSON.parse(readFileSync(new URL('../firebase.json', import.meta.url), 'utf8'));
  const {emulators} = (config ?? {}) as {emulators?: Record<string, unknown>};
  const configured = Object.values(emulators ?? {})
    .map(portOf)
    .filter((port): port is number => port !== null);

  return [...new Set([...configured, ...INTERNAL_PORTS])];
}

/** Runs a command and returns its stdout, or an empty string if it fails (nothing found). */
function run(command: string, args: string[]): string {
  const {status, stdout} = spawnSync(command, args, {encoding: 'utf8'});

  return status === 0 && stdout ? stdout : '';
}

function listeningPids(port: number): number[] {
  const lines = isWindows
    ? run('netstat', ['-ano', '-p', 'TCP'])
        .split(/\r?\n/)
        .filter((line) => line.includes('LISTENING') && new RegExp(`:${port}\\s`).test(line))
        .map((line) => line.trim().split(/\s+/).at(-1) ?? '')
    : run('lsof', ['-ti', `tcp:${port}`, '-sTCP:LISTEN']).split(/\r?\n/);

  return lines.map((line) => Number(line.trim())).filter((pid) => Number.isInteger(pid) && pid > 0);
}

/** The process's command line, used to tell an emulator apart from an unrelated server. */
function describeProcess(pid: number): string {
  const command = isWindows
    ? run('powershell', ['-NoProfile', '-Command', `(Get-CimInstance Win32_Process -Filter "ProcessId=${pid}").CommandLine`])
    : run('ps', ['-o', 'command=', '-p', String(pid)]);

  return command.trim();
}

function isRunning(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

function stop(pid: number, force: boolean): void {
  if (isWindows) {
    spawnSync('taskkill', ['/pid', String(pid), '/T', '/F'], {stdio: 'ignore'});

    return;
  }

  try {
    process.kill(pid, force ? 'SIGKILL' : 'SIGTERM');
  } catch {
    // Already exited between listing it and signalling it.
  }
}

/** Groups the processes holding the ports by pid, since one process can hold several. */
function findPortHolders(ports: number[]): PortHolder[] {
  const byPid = new Map<number, PortHolder>();

  for (const port of ports) {
    for (const pid of listeningPids(port)) {
      const holder = byPid.get(pid);

      if (holder) {
        holder.ports.push(port);
        continue;
      }

      byPid.set(pid, {pid, description: describeProcess(pid), ports: [port]});
    }
  }

  return [...byPid.values()];
}

async function waitForExit(holders: PortHolder[]): Promise<PortHolder[]> {
  const deadline = Date.now() + SIGKILL_DELAY_MS;
  let remaining = holders.filter((holder) => isRunning(holder.pid));

  while (remaining.length > 0 && Date.now() < deadline) {
    await delay(POLL_INTERVAL_MS);
    remaining = remaining.filter((holder) => isRunning(holder.pid));
  }

  return remaining;
}

async function main(): Promise<number> {
  const ports = emulatorPorts();
  const holders = findPortHolders(ports);
  const emulators = holders.filter((holder) => EMULATOR_PATTERN.test(holder.description));
  const others = holders.filter((holder) => !EMULATOR_PATTERN.test(holder.description));

  if (holders.length === 0) {
    console.log(`No emulators are running; ports ${ports.join(', ')} are free.`);

    return 0;
  }

  for (const emulator of emulators) {
    console.log(`Stopping emulator process ${emulator.pid} on port ${emulator.ports.join(', ')}.`);
    stop(emulator.pid, false);
  }

  for (const survivor of await waitForExit(emulators)) {
    console.log(`Process ${survivor.pid} ignored the shutdown request; forcing it.`);
    stop(survivor.pid, true);
  }

  for (const other of others) {
    console.warn(`Left port ${other.ports.join(', ')} alone: pid ${other.pid} is not a Firebase emulator (${other.description || 'unknown command'}).`);
  }

  const stillTaken = ports.filter((port) => listeningPids(port).length > 0);

  if (stillTaken.length > 0) {
    console.error(`Port ${stillTaken.join(', ')} is still in use. Stop the process holding it, then run this again.`);

    return 1;
  }

  console.log('All emulator ports are free.');

  return 0;
}

main().then(
  (exitCode) => process.exit(exitCode),
  (error: unknown) => {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  },
);
