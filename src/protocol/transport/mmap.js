import { readFile } from 'fs/promises';
import { platform } from 'os';
import { createLogger } from '../../logger.js';

const log = createLogger('transport:mmap');

const currentPlatform = platform();

let koffi = null;
let kernel32 = null;
let windowsInitialized = false;
let windowsInitError = null;

/**
 * Async initialization for Windows shared memory support using koffi
 * @returns {Promise<boolean>}
 */
async function initializeWindowsAsync() {
  if (windowsInitialized) return !windowsInitError;
  windowsInitialized = true;

  try {
    const koffiModule = await import('koffi');
    koffi = koffiModule.default || koffiModule;

    const lib = koffi.load('kernel32.dll');

    kernel32 = {
      OpenFileMappingW: lib.func('OpenFileMappingW', 'void*', ['uint32', 'bool', 'str16']),
      MapViewOfFile: lib.func('MapViewOfFile', 'void*', [
        'void*',
        'uint32',
        'uint32',
        'uint32',
        'uintptr_t'
      ]),
      UnmapViewOfFile: lib.func('UnmapViewOfFile', 'bool', ['void*']),
      CloseHandle: lib.func('CloseHandle', 'bool', ['void*']),
      GetLastError: lib.func('GetLastError', 'uint32', [])
    };

    log.info('Windows shared memory support initialized with koffi');
    return true;
  } catch (err) {
    windowsInitError = err;
    log.warn(`Windows shared memory not available: ${err.message}`);
    log.warn('Install koffi package for Windows mmap support: npm install koffi');
    return false;
  }
}

/**
 * Read from Windows named shared memory
 * @param {string} mmapName - Name of the shared memory
 * @param {number} dataSize - Size of data to read
 * @returns {Promise<Buffer>}
 */
async function readFromWindowsMmap(mmapName, dataSize) {
  const FILE_MAP_READ = 0x0004;

  const hMapFile = kernel32.OpenFileMappingW(FILE_MAP_READ, false, mmapName);

  if (!hMapFile) {
    const error = kernel32.GetLastError();
    throw new Error(`Failed to open file mapping '${mmapName}': error code ${error}`);
  }

  try {
    const pBuf = kernel32.MapViewOfFile(hMapFile, FILE_MAP_READ, 0, 0, dataSize);

    if (!pBuf) {
      const error = kernel32.GetLastError();
      throw new Error(`Failed to map view of file: error code ${error}`);
    }

    try {
      const data = Buffer.alloc(dataSize);
      const view = koffi.decode(pBuf, koffi.array('uint8', dataSize));
      for (let i = 0; i < dataSize; i++) {
        data[i] = view[i];
      }
      return data;
    } finally {
      kernel32.UnmapViewOfFile(pBuf);
    }
  } finally {
    kernel32.CloseHandle(hMapFile);
  }
}

/**
 * Read from Linux POSIX shared memory (/dev/shm/)
 * @param {string} mmapName - Name of the shared memory (starts with /)
 * @param {number} dataSize - Size of data to read
 * @returns {Promise<Buffer>}
 */
async function readFromLinuxMmap(mmapName, dataSize) {
  const shmPath = `/dev/shm${mmapName}`;

  log.debug(`Reading from Linux shared memory: ${shmPath}`);

  const data = await readFile(shmPath);

  if (data.length !== dataSize) {
    log.warn(`Data size mismatch: expected ${dataSize}, got ${data.length}`);
  }

  return data;
}

/**
 * Read from macOS file-backed mmap (uses filePath)
 * @param {string} filePath - Path to the backing file
 * @param {number} dataSize - Size of data to read
 * @returns {Promise<Buffer>}
 */
async function readFromMacOSMmap(filePath, dataSize) {
  log.debug(`Reading from macOS file-backed mmap: ${filePath}`);

  const data = await readFile(filePath);

  if (data.length !== dataSize) {
    log.warn(`Data size mismatch: expected ${dataSize}, got ${data.length}`);
  }

  return data;
}

/**
 * Read binary data from a memory-mapped region
 * @param {string} mmapName - Name of the memory-mapped region
 * @param {number} dataSize - Size of data to read
 * @param {string} [filePath] - File path for macOS file-backed mmap
 * @returns {Promise<Buffer>}
 */
export async function readFromMmap(mmapName, dataSize, filePath = null) {
  log.debug(`Reading from mmap: ${mmapName}, size: ${dataSize}, platform: ${currentPlatform}`);

  switch (currentPlatform) {
  case 'win32':
    if (!(await initializeWindowsAsync())) {
      throw new Error(
        'Windows shared memory support not available. ' +
            'Please install koffi (npm install koffi), or use stdin/file transport mode.'
      );
    }
    return await readFromWindowsMmap(mmapName, dataSize);

  case 'linux':
    return await readFromLinuxMmap(mmapName, dataSize);

  case 'darwin':
    if (!filePath) {
      throw new Error(
        'macOS mmap requires filePath in metadata. ' +
            'Please ensure aspose-mcp-server provides filePath for macOS.'
      );
    }
    return await readFromMacOSMmap(filePath, dataSize);

  default:
    throw new Error(
      `Memory-mapped transport is not supported on platform: ${currentPlatform}. ` +
          'Please use stdin or file transport mode instead.'
    );
  }
}

/**
 * Check if memory-mapped transport is available on this platform
 * @returns {Promise<boolean>}
 */
export async function isMmapAvailable() {
  switch (currentPlatform) {
  case 'win32':
    return await initializeWindowsAsync();

  case 'linux':
  case 'darwin':
    return true;

  default:
    return false;
  }
}

/**
 * Get platform-specific mmap information
 * @returns {Object}
 */
export function getMmapInfo() {
  return {
    platform: currentPlatform,
    strategy:
      currentPlatform === 'win32'
        ? 'WindowsNamed'
        : currentPlatform === 'linux'
          ? 'LinuxPosix'
          : currentPlatform === 'darwin'
            ? 'FileBacked'
            : 'Unsupported',
    windowsAvailable: currentPlatform === 'win32' ? !windowsInitError : null,
    windowsError: windowsInitError?.message || null
  };
}
