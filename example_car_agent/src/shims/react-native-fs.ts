// react-native-fs, on top of cordova-speech's native file API (window.DaVoiceSpeech.files).
// DocumentDirectoryPath / CachesDirectoryPath are set by app/boot.ts before any module that uses them loads.
const files = () => (window as any).DaVoiceSpeech.files;
const g = globalThis as any;

type Item = { name: string; path: string; size: number; isFile: boolean; isDirectory: boolean; mtime: number };
const toItem = (i: Item) => ({
    name: i.name, path: i.path, size: i.size, mtime: new Date(i.mtime), ctime: new Date(i.mtime),
    isFile: () => i.isFile, isDirectory: () => i.isDirectory,
});

type DownloadOptions = {
    fromUrl: string; toFile: string; headers?: Record<string, string>;
    begin?: (r: { jobId: number; statusCode: number; contentLength: number; headers: Record<string, string> }) => void;
    progress?: (r: { jobId: number; contentLength: number; bytesWritten: number }) => void;
    background?: boolean; progressDivider?: number; progressInterval?: number; discretionary?: boolean; cacheable?: boolean;
};

const RNFS = {
    get DocumentDirectoryPath(): string { return g.__DV_DOCS__; },
    get CachesDirectoryPath(): string { return g.__DV_CACHES__; },
    get TemporaryDirectoryPath(): string { return g.__DV_CACHES__; },
    exists: (path: string): Promise<boolean> => files().exists(path),
    unlink: (path: string): Promise<void> => files().unlink(path),
    mkdir: (path: string): Promise<void> => files().mkdir(path),
    readFile: (path: string, encoding: 'utf8' | 'base64' = 'utf8'): Promise<string> => files().readFile(path, encoding),
    writeFile: (path: string, content: string, encoding: 'utf8' | 'base64' = 'utf8'): Promise<void> => files().writeFile(path, content, encoding),
    appendFile: (path: string, content: string, encoding: 'utf8' | 'base64' = 'utf8'): Promise<void> => files().appendFile(path, content, encoding),
    moveFile: (from: string, to: string): Promise<void> => files().moveFile(from, to),
    copyFile: async (from: string, to: string): Promise<void> => {
        await files().writeFile(to, await files().readFile(from, 'base64'), 'base64');
    },
    readDir: async (path: string) => (await files().readDir(path)).map(toItem),
    stat: async (path: string) => toItem(await files().stat(path)),
    hash: (path: string, algorithm: string): Promise<string> => files().hash(path, algorithm),
    getFSInfo: (): Promise<{ freeSpace: number; totalSpace: number }> => files().getFSInfo(),
    downloadFile(options: DownloadOptions): { jobId: number; promise: Promise<{ jobId: number; statusCode: number; bytesWritten: number }> } {
        return files().downloadFile({
            fromUrl: options.fromUrl,
            toFile: options.toFile,
            headers: options.headers,
            begin: options.begin && ((e: any) => options.begin!({ ...e, headers: {} })),
            progress: options.progress,
        });
    },
    stopDownload: (jobId: number): void => { void files().stopDownload(jobId); },
};

export default RNFS;
export const { exists, unlink, mkdir, readFile, writeFile, moveFile, readDir, stat, hash, downloadFile, stopDownload, getFSInfo } = RNFS;
