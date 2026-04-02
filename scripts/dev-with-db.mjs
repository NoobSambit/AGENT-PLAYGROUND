import fs from 'node:fs/promises'
import path from 'node:path'
import { spawn } from 'node:child_process'
import process from 'node:process'
import { Client } from 'pg'

const LOCAL_HOSTS = new Set(['127.0.0.1', '::1', 'localhost'])

function log(message) {
  console.log(`[dev-with-db] ${message}`)
}

function parseDatabaseUrl() {
  const raw = process.env.DATABASE_URL?.trim()

  if (!raw) {
    return null
  }

  try {
    return new URL(raw)
  } catch (error) {
    log(`Skipping PostgreSQL auto-start because DATABASE_URL is invalid: ${error.message}`)
    return null
  }
}

function isLocalDatabase(databaseUrl) {
  return (
    (databaseUrl.protocol === 'postgres:' || databaseUrl.protocol === 'postgresql:') &&
    LOCAL_HOSTS.has(databaseUrl.hostname)
  )
}

function getPort(databaseUrl) {
  return Number(databaseUrl.port || 5432)
}

function getNpmCommand() {
  return process.platform === 'win32' ? 'npm.cmd' : 'npm'
}

function getDbName(databaseUrl) {
  return databaseUrl.pathname.replace(/^\//, '') || 'postgres'
}

function getDbUser(databaseUrl) {
  return decodeURIComponent(databaseUrl.username || process.env.USER || 'postgres')
}

function getAdminConnectionString(databaseUrl) {
  const adminUrl = new URL(databaseUrl.toString())
  adminUrl.pathname = '/postgres'
  return adminUrl.toString()
}

function shellQuote(value) {
  return `'${String(value).replace(/'/g, `'\\''`)}'`
}

function resolveEnvPath(input, fallbackSegments) {
  const homeDir = process.env.HOME || process.cwd()
  const raw = input?.trim()

  if (!raw) {
    return path.join(homeDir, ...fallbackSegments)
  }

  if (raw === '~') {
    return homeDir
  }

  if (raw.startsWith('~/')) {
    return path.join(homeDir, raw.slice(2))
  }

  return path.isAbsolute(raw) ? raw : path.resolve(process.cwd(), raw)
}

async function exists(targetPath) {
  try {
    await fs.access(targetPath)
    return true
  } catch {
    return false
  }
}

async function canConnect(connectionString) {
  const client = new Client({
    connectionString,
    connectionTimeoutMillis: 1500
  })

  try {
    await client.connect()
    await client.query('SELECT 1')
    return true
  } catch {
    return false
  } finally {
    await client.end().catch(() => {})
  }
}

function runShellCommand(command, label, stdio = 'inherit') {
  return new Promise((resolve, reject) => {
    const child = spawn(command, {
      shell: true,
      stdio,
      env: process.env
    })

    let stdout = ''

    if (stdio === 'pipe') {
      child.stdout?.on('data', (chunk) => {
        stdout += String(chunk)
      })
    }

    child.once('error', reject)
    child.once('exit', (code, signal) => {
      if (code === 0) {
        resolve(stdout.trim())
        return
      }

      reject(new Error(`${label} failed with ${signal ? `signal ${signal}` : `exit code ${code}`}`))
    })
  })
}

async function captureShellCommand(command) {
  try {
    return await runShellCommand(command, command, 'pipe')
  } catch {
    return null
  }
}

function getManagedPostgresConfig(databaseUrl) {
  const dataDir = resolveEnvPath(process.env.LOCAL_PG_DATA_DIR, ['.agent-playground', 'postgres', 'data'])
  const logFile = resolveEnvPath(process.env.LOCAL_PG_LOG_FILE, ['.agent-playground', 'postgres', 'postgres.log'])
  const socketDir = resolveEnvPath(process.env.LOCAL_PG_SOCKET_DIR, ['.agent-playground', 'postgres', 'socket'])
  const user = getDbUser(databaseUrl)
  const dbName = getDbName(databaseUrl)
  const port = getPort(databaseUrl)

  return {
    dataDir,
    logFile,
    socketDir,
    user,
    dbName,
    port,
    start: `pg_ctl -D ${shellQuote(dataDir)} -l ${shellQuote(logFile)} -o ${shellQuote(`-p ${port} -c unix_socket_directories=${socketDir}`)} start`,
    stop: `pg_ctl -D ${shellQuote(dataDir)} stop`
  }
}

async function ensureManagedCluster(config) {
  const versionFile = path.join(config.dataDir, 'PG_VERSION')
  await fs.mkdir(path.dirname(config.logFile), { recursive: true })
  await fs.mkdir(config.socketDir, { recursive: true })

  if (await exists(versionFile)) {
    return
  }

  log(`Initializing local PostgreSQL data directory at ${config.dataDir}`)
  await fs.mkdir(config.dataDir, { recursive: true })

  await runShellCommand(
    `initdb -D ${shellQuote(config.dataDir)} --username=${shellQuote(config.user)} --auth=trust`,
    'PostgreSQL initdb'
  )
}

async function ensureManagedDatabase(config, databaseUrl) {
  const client = new Client({
    connectionString: getAdminConnectionString(databaseUrl),
    connectionTimeoutMillis: 1500
  })

  try {
    await client.connect()
    const result = await client.query('SELECT 1 FROM pg_database WHERE datname = $1', [config.dbName])

    if (result.rowCount === 0) {
      log(`Creating database ${config.dbName}`)
      await client.query(`CREATE DATABASE "${config.dbName.replace(/"/g, '""')}"`)
    }
  } finally {
    await client.end().catch(() => {})
  }
}

async function detectSystemctlCommands() {
  const hasSystemctl = await captureShellCommand('command -v systemctl')

  if (!hasSystemctl) {
    return null
  }

  const hasPostgresService = await captureShellCommand("systemctl list-unit-files | rg '^postgresql\\.service\\b'")

  if (!hasPostgresService) {
    return null
  }

  return {
    start: 'systemctl start postgresql',
    stop: 'systemctl stop postgresql',
    source: 'systemctl postgresql.service'
  }
}

async function detectServiceCommands() {
  const hasService = await captureShellCommand('command -v service')

  if (!hasService) {
    return null
  }

  return {
    start: 'service postgresql start',
    stop: 'service postgresql stop',
    source: 'service postgresql'
  }
}

async function resolveLifecycle(databaseUrl) {
  const managedPostgres = getManagedPostgresConfig(databaseUrl)

  if (managedPostgres) {
    return {
      kind: 'managed',
      source: 'LOCAL_PG_DATA_DIR',
      ...managedPostgres
    }
  }

  const configuredStart = process.env.LOCAL_PG_START_CMD?.trim()
  const configuredStop = process.env.LOCAL_PG_STOP_CMD?.trim()

  if (configuredStart) {
    return {
      kind: 'command',
      start: configuredStart,
      stop: configuredStop || null,
      source: 'LOCAL_PG_START_CMD'
    }
  }

  const systemctlCommands = await detectSystemctlCommands()
  if (systemctlCommands) {
    return {
      kind: 'command',
      ...systemctlCommands
    }
  }

  const serviceCommands = await detectServiceCommands()
  if (serviceCommands) {
    return {
      kind: 'command',
      ...serviceCommands
    }
  }

  return null
}

async function waitForDatabase(connectionString, attempts = 20) {
  for (let index = 0; index < attempts; index += 1) {
    if (await canConnect(connectionString)) {
      return true
    }

    await new Promise((resolve) => setTimeout(resolve, 1000))
  }

  return false
}

async function runMigrations() {
  log('Applying database migrations')
  await runShellCommand(`${getNpmCommand()} run db:migrate`, 'Database migrations')
}

async function main() {
  const databaseUrl = parseDatabaseUrl()
  let startedByScript = false
  let stopCommand = null
  let cleaningUp = false

  log('Preparing local development environment')

  const cleanup = async () => {
    if (cleaningUp) {
      return
    }

    cleaningUp = true

    if (startedByScript && stopCommand) {
      log('Stopping PostgreSQL that was started by this command')
      await runShellCommand(stopCommand, 'PostgreSQL stop').catch((error) => {
        console.error(`[dev-with-db] ${error.message}`)
      })
    }
  }

  try {
    if (databaseUrl && isLocalDatabase(databaseUrl)) {
      const connectionString = process.env.DATABASE_URL
      const port = getPort(databaseUrl)
      log(`Checking PostgreSQL at ${databaseUrl.hostname}:${port}`)
      const alreadyRunning = await canConnect(connectionString)

      if (alreadyRunning) {
        log(`PostgreSQL is already running on ${databaseUrl.hostname}:${port}`)
      } else {
        const lifecycle = await resolveLifecycle(databaseUrl)

        if (!lifecycle) {
          throw new Error(
            `PostgreSQL is not reachable on ${databaseUrl.hostname}:${port}. Configure LOCAL_PG_DATA_DIR for a user-managed database or set LOCAL_PG_START_CMD and LOCAL_PG_STOP_CMD.`
          )
        }

        if (lifecycle.kind === 'managed') {
          await ensureManagedCluster(lifecycle)
        }

        log(`Starting PostgreSQL using ${lifecycle.source}`)
        await runShellCommand(lifecycle.start, 'PostgreSQL start')

        const readyConnectionString =
          lifecycle.kind === 'managed' ? getAdminConnectionString(databaseUrl) : connectionString
        const ready = await waitForDatabase(readyConnectionString)
        if (!ready) {
          throw new Error('PostgreSQL start command finished, but the database never became reachable.')
        }

        if (lifecycle.kind === 'managed') {
          await ensureManagedDatabase(lifecycle, databaseUrl)
        }

        startedByScript = true
        stopCommand = lifecycle.stop
        log('PostgreSQL is ready')
      }
    } else if (databaseUrl) {
      log(`Skipping PostgreSQL auto-start for non-local DATABASE_URL host ${databaseUrl.hostname}`)
    } else {
      log('Skipping PostgreSQL auto-start because DATABASE_URL is not set')
    }

    await runMigrations()

    log('Starting Next.js dev server')
    const appProcess = spawn(getNpmCommand(), ['run', 'dev:app'], {
      stdio: 'inherit',
      env: process.env
    })

    ;['SIGINT', 'SIGTERM'].forEach((signal) => {
      process.on(signal, () => {
        if (!appProcess.killed) {
          appProcess.kill(signal)
        }
      })
    })

    const exitCode = await new Promise((resolve, reject) => {
      appProcess.once('error', reject)
      appProcess.once('exit', (code, signal) => {
        if (signal) {
          resolve(1)
          return
        }

        resolve(code ?? 0)
      })
    })

    await cleanup()
    process.exit(exitCode)
  } catch (error) {
    await cleanup()
    throw error
  }
}

main().catch((error) => {
  console.error(`[dev-with-db] ${error.message}`)
  process.exit(1)
})
